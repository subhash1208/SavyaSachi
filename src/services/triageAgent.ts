import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import {
  SymptomInput, TriageAssessment, TreatmentAdvice,
  KBResults, SeverityLevel, BilingualInstruction,
} from '../models/types';
import { ITriageAgent } from '../interfaces/ITriageAgent';
import { sanitizeInput, detectRegister, buildLanguageInstruction } from '../utils/inputSanitizer';
import { Logger } from '../utils/logger';

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
const NOVA_PRO = 'us.amazon.nova-pro-v1:0';

// ─── Severity → Care level mapping ───────────────────────────────────────────

const SEVERITY_CARE: Record<SeverityLevel, TriageAssessment['recommendedCareLevel']> = {
  critical:     'district_hospital',
  urgent:       'CHC',
  'non-urgent': 'PHC',
};

// ICD-10 codes for general triage conditions
const CONDITION_ICD10: Record<string, string> = {
  general_fever:    'R50.9',
  maternal_care:    'Z34.9',
  chronic_disease:  'Z87.39',
  drug_query:       'Z79.899',
  unknown:          'R69',
  diarrhea:         'A09',
  dehydration:      'E86.0',
  headache:         'R51',
  dengue:           'A90',
  diabetes:         'E11.9',
  hypertension:     'I10',
  tb:               'A15.0',
  // Emergency conditions — normally ICD-10 comes from the emergency script,
  // but if Nova Lite routes a borderline case to general triage, tagICD10()
  // needs a fallback so the FHIR record isn't tagged R69 (unknown).
  child_fever:              'A09',
  cardiac:                  'I21.9',
  snakebite:                'T63.0',
  breathing_difficulty:     'J45.9',
  stroke:                   'I64',
  severe_bleeding:          'R58',
  choking:                  'T17.9',
  burns:                    'T30.0',
  poisoning:                'T65.9',
  anaphylaxis:              'T78.2',
  seizure:                  'R56.9',
  pregnancy_emergency:      'O14.9',
  drowning:                 'T75.1',
  unconsciousness:          'R40.2',
  infant_not_breathing:     'P28.4',
  heatstroke:               'T67.0',
};

// ─── Constitutional AI system prompt (base) ───────────────────────────────────

const BASE_SYSTEM_PROMPT = `You are VaidyaVaani, an AI health triage assistant for rural India.
You assess symptoms based on WHO IMAI/IMCI protocols and ICMR Standard Treatment Workflows.

CONSTITUTIONAL RULES — NEVER violate:
- NEVER prescribe Schedule H or Schedule X drugs
- NEVER guarantee a cure or definitive diagnosis
- NEVER ignore WHO danger signs (convulsions, unconsciousness, difficulty breathing, unable to drink)
- NEVER give advice that contradicts ICMR Standard Treatment Workflows
- ALWAYS recommend seeing a doctor for serious symptoms
- ALWAYS escalate to emergency if danger signs are detected
- ALWAYS end with the disclaimer field populated

DANGER SIGNS (always urgent or critical):
- Unconscious or not responding
- Convulsions or fits
- Unable to drink or breastfeed
- Vomiting everything
- Fast or difficult breathing
- Severe dehydration (sunken eyes, skin pinch slow)
- High fever >39°C with stiff neck

RESPOND ONLY with valid JSON matching this exact schema:
{
  "severity": "critical|urgent|non-urgent",
  "recommendedCareLevel": "home|PHC|CHC|district_hospital",
  "icd10Code": "string",
  "summaryHindi": "string — 1-2 sentences, in the language register instructed below",
  "summaryEnglish": "string — 1-2 sentences in English",
  "treatmentInstructions": [{"hindi": "string", "english": "string"}],
  "followUpRequired": boolean,
  "followUpInterval": "2h|24h|48h|1w|null"
}

treatmentInstructions: 1-3 condition-specific care instructions based on the KB protocols.
Examples: ORS preparation for diarrhea, paracetamol dosing for fever, wound cleaning for burns.
Do NOT include logistics (where to go, what to carry) — only clinical self-care steps.`;

// ─── Nova Pro call ────────────────────────────────────────────────────────────

interface NovaProResponse {
  severity: SeverityLevel;
  recommendedCareLevel: 'home' | 'PHC' | 'CHC' | 'district_hospital';
  icd10Code: string;
  summaryHindi: string;
  summaryEnglish: string;
  treatmentInstructions?: BilingualInstruction[];
  followUpRequired: boolean;
  followUpInterval: string | null;
  // followUpQuestion and disclaimer are intentionally NOT requested from Nova Pro.
  // Follow-up questions come from IGeneralTriageKB, and disclaimers are hardcoded.
  // treatmentInstructions IS requested — condition-specific clinical self-care steps
  // (e.g., ORS for diarrhea, paracetamol dosing for fever). These are merged with
  // static logistics instructions in generateTreatmentAdvice().
}

async function callNovaPro(
  input: SymptomInput,
  kbResults: KBResults,
  languageInstruction: string,
  transcriptHistory?: string[],
): Promise<NovaProResponse> {

  // Build KB context from retrieved chunks
  const kbContext = kbResults.chunks.length > 0
    ? `\nRELEVANT MEDICAL PROTOCOLS:\n${kbResults.chunks.map((c, i) => `[${i + 1}] ${c}`).join('\n')}\n`
    : '';

  // Build conversation history context for multi-turn memory (Req 4.6)
  // Without this, a caller who says "bukhar hai" on Turn 2 and "aur ulti bhi ho rahi hai"
  // on Turn 3 would lose the fever context on Turn 3.
  // Each utterance is sanitized individually — caller speech is untrusted input (Req 9.3).
  const historyContext = transcriptHistory && transcriptHistory.length > 0
    ? `\nCONVERSATION HISTORY (prior caller utterances):\n${transcriptHistory.map((u, i) => `Turn ${i + 1}: ${sanitizeInput(u)}`).join('\n')}\n`
    : '';

  // Sanitize only untrusted caller input — KB chunks and patient profile are system-generated.
  // Sanitizing the entire message would corrupt medical protocol text (e.g., WHO text containing
  // "system" or "ignore previous" in a clinical context would get [removed]).
  const sanitizedSymptoms = input.clinicalSymptomsEnglish.map(s => sanitizeInput(s)).join(', ');

  const userMessage = `${kbContext}${historyContext}
Patient profile: ${input.patientProfile.category}, age: ${input.patientProfile.exact_age_mentioned ?? 'unknown'}, pregnancy: ${input.patientProfile.pregnancy_flag}
Condition: ${input.conditionId}
Symptoms: ${sanitizedSymptoms}
Duration: ${input.duration ?? 'not specified'}
Danger signs: ${input.dangerSignsPresent.length > 0 ? input.dangerSignsPresent.join(', ') : 'none'}

LANGUAGE INSTRUCTION: ${languageInstruction}

Assess and respond with JSON only.`.trim();

  const systemPrompt = `${BASE_SYSTEM_PROMPT}\n\nLANGUAGE: ${languageInstruction}`;

  const body = {
    messages: [
      { role: 'user', content: [{ type: 'text', text: userMessage }] },
    ],
    system: [{ text: systemPrompt }],
    inferenceConfig: {
      maxTokens: 800,
      temperature: 0.1,
      topP: 0.9,
    },
  };

  const command = new InvokeModelCommand({
    modelId: NOVA_PRO,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(body),
  });

  const response = await bedrock.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const text: string = responseBody?.output?.message?.content?.[0]?.text ?? '';
  const jsonText = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

  const parsed = JSON.parse(jsonText) as NovaProResponse;

  // Validate severity — this drives care level routing and dispatch decisions.
  // If Nova Pro hallucinates a severity value, the caller could be under-triaged.
  const validSeverities: SeverityLevel[] = ['critical', 'urgent', 'non-urgent'];
  if (!validSeverities.includes(parsed.severity)) {
    Logger.error('Nova Pro returned invalid severity, forcing urgent', {
      rawSeverity: parsed.severity,
    });
    parsed.severity = 'urgent';  // safe default — over-triage is better than under-triage
  }

  // Validate recommendedCareLevel — Nova Pro could hallucinate "ICU", "emergency_room", etc.
  // Invalid care level would propagate to treatment advice and SMS, confusing the caller.
  const validCareLevels: Array<TriageAssessment['recommendedCareLevel']> = ['home', 'PHC', 'CHC', 'district_hospital'];
  if (!validCareLevels.includes(parsed.recommendedCareLevel)) {
    Logger.error('Nova Pro returned invalid care level, deriving from severity', {
      rawCareLevel: parsed.recommendedCareLevel,
      severity: parsed.severity,
    });
    parsed.recommendedCareLevel = SEVERITY_CARE[parsed.severity];
  }

  return parsed;
}

// ─── Triage Agent service ─────────────────────────────────────────────────────

export class TriageAgentService implements ITriageAgent {

  /**
   * Assesses symptoms using Nova Pro + KB chunks.
   * kbResults: retrieved ICMR/WHO protocol chunks from General Triage KB.
   * Empty kbResults is valid — Nova Pro falls back to training data.
   * transcriptHistory: all prior caller utterances from ConversationState — passed to Nova Pro
   * for multi-turn context so the LLM sees the full clinical picture across turns (Req 4.6).
   * Req 4.1, 4.3, 4.4, 4.6, 9.2, 9.3
   */
  async assessSymptoms(input: SymptomInput, kbResults: KBResults, transcriptHistory?: string[]): Promise<TriageAssessment> {
    Logger.info('Triage assessment started', {
      conditionId: input.conditionId,
      symptomCount: input.clinicalSymptomsEnglish.length,
      language: input.language,
      kbChunks: kbResults.chunks.length,
    });

    // Use language_register from Nova Lite extraction if available; fall back to heuristic detection
    const register = input.language_register ?? detectRegister(input.rawUtterance);
    const languageInstruction = buildLanguageInstruction(input.language, register);

    try {
      const novaResult = await callNovaPro(input, kbResults, languageInstruction, transcriptHistory);

      // Cross-validate severity ↔ careLevel consistency.
      // Nova Pro could return severity: 'critical' + careLevel: 'home' — a critical patient
      // told to stay home. Or severity: 'non-urgent' + careLevel: 'district_hospital' — wasting
      // scarce hospital resources. When they disagree, severity wins (it's the clinical signal)
      // and careLevel is derived from the validated severity via SEVERITY_CARE.
      //
      // Minimum care level floors by severity:
      // - critical: district_hospital (must go to hospital)
      // - urgent: CHC (needs medical attention today)
      // - non-urgent: home (rest at home is valid for mild cases)
      const MINIMUM_CARE: Record<SeverityLevel, TriageAssessment['recommendedCareLevel']> = {
        critical:     'district_hospital',
        urgent:       'CHC',
        'non-urgent': 'home',
      };
      let finalCareLevel = novaResult.recommendedCareLevel;
      const minimumCareLevel = MINIMUM_CARE[novaResult.severity];
      const careLevelRank: Record<string, number> = { home: 0, PHC: 1, CHC: 2, district_hospital: 3 };
      const minimumRank = careLevelRank[minimumCareLevel] ?? 0;
      const actualRank = careLevelRank[finalCareLevel] ?? 1;
      if (actualRank < minimumRank) {
        // Nova Pro recommended a care level BELOW the minimum for this severity.
        // Over-triage (higher care level) is always allowed — Nova Pro may see comorbidities.
        // Under-triage (lower care level) is corrected to the severity's default.
        Logger.error('Nova Pro under-triaged care level vs severity, correcting', {
          severity: novaResult.severity,
          rawCareLevel: novaResult.recommendedCareLevel,
          correctedCareLevel: SEVERITY_CARE[novaResult.severity],
        });
        finalCareLevel = SEVERITY_CARE[novaResult.severity];
      }

      // Validate followUpRequired — critical/urgent patients always need follow-up.
      // Nova Pro might say followUpRequired: false for a critical patient, which would
      // mean no callback is scheduled and the patient is forgotten after the call.
      const followUpRequired = novaResult.severity === 'critical' || novaResult.severity === 'urgent'
        ? true
        : novaResult.followUpRequired;

      const assessment: TriageAssessment = {
        conditionId:          input.conditionId,
        icd10Code:            novaResult.icd10Code || this.tagICD10(input.conditionId),
        severity:             novaResult.severity,
        recommendedCareLevel: finalCareLevel,
        summaryHindi:         novaResult.summaryHindi,
        summaryEnglish:       novaResult.summaryEnglish,
        treatmentInstructions: this._validateTreatmentInstructions(novaResult.treatmentInstructions),
        followUpRequired,
        followUpInterval:     novaResult.followUpInterval ?? undefined,
      };

      Logger.info('Triage assessment complete', {
        conditionId: input.conditionId,
        severity: assessment.severity,
        careLevel: assessment.recommendedCareLevel,
        register,
      });

      return assessment;

    } catch (err) {
      Logger.error('Nova Pro triage failed, using safe fallback', {
        error: (err as Error).message,
        conditionId: input.conditionId,
      });
      return this._safeFallback(input);
    }
  }

  /**
   * Generates bilingual treatment advice from a triage assessment.
   * Merges Nova Pro's condition-specific clinical instructions (e.g., ORS for diarrhea)
   * with static logistics instructions (e.g., "go to CHC today").
   * If Nova Pro didn't return treatmentInstructions (fallback path), only static logistics are used.
   */
  async generateTreatmentAdvice(assessment: TriageAssessment): Promise<TreatmentAdvice> {
    const clinicalInstructions = assessment.treatmentInstructions ?? [];
    const logisticsInstructions = this._careInstructions(assessment.recommendedCareLevel);
    return {
      instructions: [...clinicalInstructions, ...logisticsInstructions],
      disclaimer: {
        hindi:   'Yeh AI ki salah hai. Kisi bhi serious situation mein doctor se zaroor milein.',
        english: 'This is AI guidance. Please consult a doctor for any serious condition.',
      },
    };
  }

  /**
   * Maps condition ID to ICD-10 code.
   */
  tagICD10(conditionId: string): string {
    return CONDITION_ICD10[conditionId] ?? 'R69';
  }

  /**
   * Maps severity to recommended care level.
   * Pure function — no AWS calls.
   */
  determineFacilityLevel(severity: SeverityLevel): TriageAssessment['recommendedCareLevel'] {
    return SEVERITY_CARE[severity];
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Validates treatmentInstructions from Nova Pro.
   * Nova Pro could return malformed items (missing hindi/english, non-array, etc.).
   * Returns only well-formed BilingualInstruction items, or undefined if none valid.
   */
  private _validateTreatmentInstructions(
    raw: BilingualInstruction[] | undefined,
  ): BilingualInstruction[] | undefined {
    if (!Array.isArray(raw) || raw.length === 0) return undefined;
    const valid = raw.filter(
      (item) =>
        item &&
        typeof item.hindi === 'string' && item.hindi.trim().length > 0 &&
        typeof item.english === 'string' && item.english.trim().length > 0,
    );
    return valid.length > 0 ? valid : undefined;
  }

  private _safeFallback(input: SymptomInput): TriageAssessment {
    const hasDangerSigns = input.dangerSignsPresent.length > 0;
    const severity: SeverityLevel = hasDangerSigns ? 'critical' : 'urgent';
    return {
      conditionId:          input.conditionId,
      icd10Code:            this.tagICD10(input.conditionId),
      severity,
      recommendedCareLevel: this.determineFacilityLevel(severity),
      summaryHindi:         'Kripya najdeeki Swasthya Kendra mein jaayein.',
      summaryEnglish:       'Please visit the nearest health facility.',
      followUpRequired:     true,
      followUpInterval:     '24h',
    };
  }

  private _careInstructions(
    careLevel: TriageAssessment['recommendedCareLevel'],
  ): BilingualInstruction[] {
    const map: Record<string, BilingualInstruction[]> = {
      home: [
        { hindi: 'Aaram karein aur paani peete rahein.', english: 'Rest and stay hydrated.' },
        { hindi: 'Agar 2 din mein theek na ho, Swasthya Kendra jaayein.', english: 'If no improvement in 2 days, visit the health centre.' },
      ],
      PHC: [
        { hindi: 'Najdeeki Swasthya Kendra mein jaayein.', english: 'Visit your nearest health centre.' },
        { hindi: 'Apna health card saath le jaayein.', english: 'Carry your health card with you.' },
      ],
      CHC: [
        { hindi: 'Aaj hi Community Swasthya Kendra mein jaayein.', english: 'Go to the Community Health Centre today.' },
        { hindi: 'Kisi ko saath le jaayein.', english: 'Take someone with you.' },
      ],
      district_hospital: [
        { hindi: 'Turant Zila Aspatal jaayein ya 108 call karein.', english: 'Go to District Hospital immediately or call 108.' },
        { hindi: 'Akele mat jaayein.', english: 'Do not go alone.' },
      ],
    };
    return map[careLevel] ?? map['PHC'];
  }
}
