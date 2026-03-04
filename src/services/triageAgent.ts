import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import {
  SymptomInput, TriageAssessment, TreatmentAdvice,
  KBResults, SeverityLevel, BilingualInstruction,
} from '../models/types';
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
  "followUpRequired": boolean,
  "followUpInterval": "2h|24h|48h|1w|null",
  "treatmentInstructions": [
    { "hindi": "string", "english": "string" }
  ],
  "followUpQuestion": "string — one clarifying question to ask caller next, in the language register instructed",
  "disclaimer": { "hindi": "Yeh AI ki salah hai. Doctor se zaroor milein.", "english": "This is AI guidance. Please consult a doctor." }
}`;

// ─── Nova Pro call ────────────────────────────────────────────────────────────

interface NovaProResponse {
  severity: SeverityLevel;
  recommendedCareLevel: 'home' | 'PHC' | 'CHC' | 'district_hospital';
  icd10Code: string;
  summaryHindi: string;
  summaryEnglish: string;
  followUpRequired: boolean;
  followUpInterval: string | null;
  treatmentInstructions: BilingualInstruction[];
  followUpQuestion: string;
  disclaimer: BilingualInstruction;
}

async function callNovaPro(
  input: SymptomInput,
  kbResults: KBResults,
  languageInstruction: string,
): Promise<NovaProResponse> {

  // Build KB context from retrieved chunks
  const kbContext = kbResults.chunks.length > 0
    ? `\nRELEVANT MEDICAL PROTOCOLS:\n${kbResults.chunks.map((c, i) => `[${i + 1}] ${c}`).join('\n')}\n`
    : '';

  const userMessage = `${kbContext}
Patient profile: ${input.patientProfile.category}, age: ${input.patientProfile.exact_age_mentioned ?? 'unknown'}, pregnancy: ${input.patientProfile.pregnancy_flag}
Condition: ${input.conditionId}
Symptoms: ${input.clinicalSymptomsEnglish.join(', ')}
Duration: ${input.duration ?? 'not specified'}
Danger signs: ${input.dangerSignsPresent.length > 0 ? input.dangerSignsPresent.join(', ') : 'none'}

LANGUAGE INSTRUCTION: ${languageInstruction}

Assess and respond with JSON only.`.trim();

  const systemPrompt = `${BASE_SYSTEM_PROMPT}\n\nLANGUAGE: ${languageInstruction}`;

  const body = {
    messages: [
      { role: 'user', content: [{ type: 'text', text: sanitizeInput(userMessage) }] },
    ],
    system: [{ text: systemPrompt }],
    inferenceConfig: {
      maxTokens: 700,
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

  return JSON.parse(jsonText) as NovaProResponse;
}

// ─── Triage Agent service ─────────────────────────────────────────────────────

export class TriageAgentService {

  /**
   * Assesses symptoms using Nova Pro + KB chunks.
   * kbResults: retrieved ICMR/WHO protocol chunks from General Triage KB.
   * Empty kbResults is valid — Nova Pro falls back to training data.
   * Req 4.1, 4.3, 4.4, 9.2, 9.3
   */
  async assessSymptoms(input: SymptomInput, kbResults: KBResults): Promise<TriageAssessment> {
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
      const novaResult = await callNovaPro(input, kbResults, languageInstruction);

      const assessment: TriageAssessment = {
        conditionId:          input.conditionId,
        icd10Code:            novaResult.icd10Code || this.tagICD10(input.conditionId),
        severity:             novaResult.severity,
        recommendedCareLevel: novaResult.recommendedCareLevel,
        summaryHindi:         novaResult.summaryHindi,
        summaryEnglish:       novaResult.summaryEnglish,
        followUpRequired:     novaResult.followUpRequired,
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
   */
  async generateTreatmentAdvice(assessment: TriageAssessment): Promise<TreatmentAdvice> {
    const instructions = this._careInstructions(assessment.recommendedCareLevel);
    return {
      instructions,
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
