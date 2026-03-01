/**
 * VaidyaVaani — Multi-turn Triage Conversation Handler
 * 
 * Conversation state is passed via URL query params between turns.
 * No DB needed for testing — state lives in the TwiML action URL.
 * 
 * Flow:
 *   Step 0: Greeting → press 1 (health) or 9 (emergency)
 *   Step 1: Ask main symptom
 *   Step 2: Ask age + duration ("Kitne saal ke hain? Kitne din se hai?")
 *   Step 3: Ask danger signs ("Koi in mein se hai? Behoshi, saans ki takleef, khoon?")
 *   Step 4: AI triage decision with full context → advice + action
 */

import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const bedrock = new BedrockRuntimeClient({ region: "us-east-1" });

const WEBHOOK_URL = "https://lur01vchk8.execute-api.us-east-1.amazonaws.com/default/vaidyavaani-exotel-webhook";

// Full triage system prompt with Constitutional AI rules
const TRIAGE_SYSTEM_PROMPT = `You are VaidyaVaani, an AI health triage assistant for rural India.
Speak in simple Hinglish (Hindi in Roman script mixed with English).
This is a phone call — MAXIMUM 4 sentences. No bullet points, no lists, no emojis.

You will receive a structured patient summary. Based on it:
- Sentence 1: Acknowledge the full situation (symptom + age + duration)
- Sentence 2: Immediate interim action (what to do RIGHT NOW)
- Sentence 3: Main recommendation — one of: "Ghar par yeh karein", "Aaj doctor ke paas jaiye", "Abhi 108 call karein"
- Sentence 4: Always end with "Yeh AI ki salah hai, doctor se zaroor milein."

CONSTITUTIONAL RULES:
- NEVER prescribe Schedule H or Schedule X drugs by name
- NEVER give a definitive diagnosis
- IF danger signs present (unconscious, difficulty breathing, seizure, heavy bleeding) → ALWAYS say call 108 immediately
- IF child under 5 with fever 102F+ for 2+ days → ALWAYS say go to doctor today
- IF chest pain or stroke symptoms → ALWAYS say call 108 immediately
- ALWAYS recommend doctor for any symptom lasting more than 3 days`;

// Follow-up question system prompt
const FOLLOWUP_SYSTEM_PROMPT = `You are VaidyaVaani, an AI health triage assistant.
Based on the symptom provided, generate ONE short follow-up question in Hinglish.
The question must help determine severity. Maximum 1 sentence.
Focus on: age, duration, associated symptoms, or danger signs.
Do NOT ask about medications. Do NOT give advice yet.
Example: "Kitne din se yeh problem hai aur koi bukhar bhi hai?"`;

/**
 * Build TwiML with Gather (waits for digit input)
 */
function gatherDigits(text, action, numDigits = 1) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather action="${action}" method="GET" numDigits="${numDigits}" timeout="10">
    <Say voice="Polly.Aditi" language="hi-IN">${escapeXml(text)}</Say>
  </Gather>
  <Say voice="Polly.Aditi" language="hi-IN">Koi jawab nahi mila. Phir se call karein.</Say>
  <Hangup/>
</Response>`;
}

/**
 * Build TwiML with Gather (waits for speech OR digit)
 */
function gatherSpeech(text, action) {
  // Since Twilio speech recognition needs upgrade, we use digit-based input
  // Caller presses digits to select options
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather action="${action}" method="GET" timeout="15" finishOnKey="#">
    <Say voice="Polly.Aditi" language="hi-IN">${escapeXml(text)}</Say>
  </Gather>
  <Say voice="Polly.Aditi" language="hi-IN">Koi jawab nahi mila. Phir se call karein.</Say>
  <Hangup/>
</Response>`;
}

/**
 * Build TwiML say + hangup
 */
function sayAndHangup(text) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="hi-IN">${escapeXml(text)}</Say>
  <Hangup/>
</Response>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Build action URL with state encoded as query params
 */
function buildActionUrl(state) {
  const params = new URLSearchParams();
  Object.entries(state).forEach(([k, v]) => {
    if (v !== undefined && v !== null) params.set(k, String(v));
  });
  return `${WEBHOOK_URL}?${params.toString()}`;
}

/**
 * Call Bedrock Nova Pro
 */
async function callBedrock(systemPrompt, userMessage) {
  const command = new ConverseCommand({
    modelId: "us.amazon.nova-pro-v1:0",
    system: [{ text: systemPrompt }],
    messages: [{ role: "user", content: [{ text: userMessage }] }],
    inferenceConfig: { maxTokens: 200, temperature: 0.3 }
  });
  const response = await bedrock.send(command);
  return response.output.message.content[0].text;
}

/**
 * Map digit to symptom category
 */
function digitToSymptom(digit) {
  const map = {
    "1": "bukhar (fever)",
    "2": "pet dard (stomach pain)",
    "3": "saans ki takleef (breathing difficulty)",
    "4": "seene mein dard (chest pain)",
    "5": "sir dard (headache)",
    "6": "ulti ya dast (vomiting or diarrhea)",
    "7": "chot ya zakham (injury or wound)",
    "8": "koi aur problem (other problem)"
  };
  return map[digit] || "anjaani takleef (unknown complaint)";
}

/**
 * Map digit to age group
 */
function digitToAge(digit) {
  const map = {
    "1": "2 saal se kam (under 2 years)",
    "2": "2 se 12 saal (child 2-12 years)",
    "3": "13 se 18 saal (teenager)",
    "4": "19 se 40 saal (young adult)",
    "5": "41 se 60 saal (middle aged)",
    "6": "60 saal se zyada (elderly above 60)"
  };
  return map[digit] || "anjaani umar (unknown age)";
}

/**
 * Map digit to duration
 */
function digitToDuration(digit) {
  const map = {
    "1": "aaj shuru hua (started today)",
    "2": "1-2 din se (1-2 days)",
    "3": "3-7 din se (3-7 days)",
    "4": "1 hafte se zyada (more than 1 week)"
  };
  return map[digit] || "pata nahi (unknown duration)";
}

/**
 * Map digit to severity
 */
function digitToSeverity(digit) {
  const map = {
    "1": "halka (mild - can do daily activities)",
    "2": "theek thak (moderate - affecting daily activities)",
    "3": "bahut zyada (severe - cannot do anything)"
  };
  return map[digit] || "pata nahi (unknown severity)";
}

/**
 * Map danger sign digit
 */
function digitToDangerSign(digit) {
  const map = {
    "1": "behoshi ya chakkar (unconsciousness or severe dizziness)",
    "2": "saans lene mein bahut takleef (severe breathing difficulty)",
    "3": "khoon aa raha hai (bleeding)",
    "4": "mirgi ya jhatke (seizures or convulsions)",
    "9": "koi danger sign nahi (no danger signs)"
  };
  return map[digit] || "pata nahi";
}

export const handler = async (event) => {
  console.log("=== VAIDYAVAANI CALL ===");

  const params = event.queryStringParameters || {};

  // Read conversation state from URL params
  const step = params.step || "0";
  const symptom = params.symptom || "";
  const ageGroup = params.age || "";
  const duration = params.duration || "";
  const severity = params.severity || "";
  const dangerSign = params.danger || "";
  const digit = params.Digits || params.digits || "";
  const callSid = params.CallSid || params.CallSid || "unknown";

  console.log("Step:", step, "| Digit:", digit, "| Symptom:", symptom);

  // ── STEP 0: Initial greeting ──────────────────────────────────────────────
  if (step === "0") {
    const greeting = "Namaste, VaidyaVaani mein aapka swagat hai. Main ek AI health assistant hoon, doctor nahi. Health problem ke liye 1 dabayein, emergency ke liye 9 dabayein.";
    return respond(gatherDigits(greeting, buildActionUrl({ step: "1" })));
  }

  // ── STEP 1: Route — health or emergency ──────────────────────────────────
  if (step === "1") {
    if (digit === "9") {
      return respond(sayAndHangup("Yeh emergency hai. Abhi 108 call karein. Jab tak ambulance aaye, patient ko lita kar rakhein. Yeh AI ki salah hai, turant doctor se milein."));
    }
    // Digit 1 or anything else → ask symptom category
    const symptomMenu =
      "Aapki takleef kya hai? " +
      "Bukhar ke liye 1, " +
      "Pet dard ke liye 2, " +
      "Saans ki takleef ke liye 3, " +
      "Seene mein dard ke liye 4, " +
      "Sir dard ke liye 5, " +
      "Ulti ya dast ke liye 6, " +
      "Chot ya zakham ke liye 7, " +
      "Koi aur problem ke liye 8 dabayein.";
    return respond(gatherDigits(symptomMenu, buildActionUrl({ step: "2" })));
  }

  // ── STEP 2: Symptom selected → ask age group ─────────────────────────────
  if (step === "2") {
    const selectedSymptom = digitToSymptom(digit);
    const ageMenu =
      "Theek hai. Ab batayein, patient ki umar kitni hai? " +
      "2 saal se kam ke liye 1, " +
      "2 se 12 saal ke liye 2, " +
      "13 se 18 saal ke liye 3, " +
      "19 se 40 saal ke liye 4, " +
      "41 se 60 saal ke liye 5, " +
      "60 saal se zyada ke liye 6 dabayein.";
    return respond(gatherDigits(ageMenu, buildActionUrl({ step: "3", symptom: selectedSymptom })));
  }

  // ── STEP 3: Age selected → ask duration ──────────────────────────────────
  if (step === "3") {
    const selectedAge = digitToAge(digit);
    const durationMenu =
      "Yeh takleef kab se hai? " +
      "Aaj shuru hua ke liye 1, " +
      "1 se 2 din se ke liye 2, " +
      "3 se 7 din se ke liye 3, " +
      "1 hafte se zyada ke liye 4 dabayein.";
    return respond(gatherDigits(durationMenu, buildActionUrl({ step: "4", symptom, age: selectedAge })));
  }

  // ── STEP 4: Duration selected → ask severity ─────────────────────────────
  if (step === "4") {
    const selectedDuration = digitToDuration(digit);
    const severityMenu =
      "Takleef kitni zyada hai? " +
      "Halki hai, kaam kar sakte hain ke liye 1, " +
      "Theek thak hai, kaam mein takleef ho rahi hai ke liye 2, " +
      "Bahut zyada hai, kuch nahi kar pa rahe ke liye 3 dabayein.";
    return respond(gatherDigits(severityMenu, buildActionUrl({ step: "5", symptom, age: ageGroup, duration: selectedDuration })));
  }

  // ── STEP 5: Severity selected → ask danger signs ─────────────────────────
  if (step === "5") {
    const selectedSeverity = digitToSeverity(digit);
    const dangerMenu =
      "Kya in mein se koi cheez hai? " +
      "Behoshi ya chakkar ke liye 1, " +
      "Saans lene mein bahut takleef ke liye 2, " +
      "Khoon aa raha hai ke liye 3, " +
      "Mirgi ya jhatke ke liye 4, " +
      "Koi nahi ke liye 9 dabayein.";
    return respond(gatherDigits(dangerMenu, buildActionUrl({ step: "6", symptom, age: ageGroup, duration, severity: selectedSeverity })));
  }

  // ── STEP 6: Danger sign → AI triage decision ─────────────────────────────
  if (step === "6") {
    const selectedDanger = digitToDangerSign(digit);

    // Immediate escalation for critical danger signs
    if (["1", "2", "3", "4"].includes(digit)) {
      return respond(sayAndHangup(
        "Yeh bahut serious hai. Abhi turant 108 call karein. " +
        "Jab tak ambulance aaye, patient ko lita kar rakhein, kuch khilayein pilaayein mat. " +
        "Yeh AI ki salah hai, turant doctor se milein."
      ));
    }

    // Build full patient summary for AI
    const patientSummary = `
Patient Summary:
- Symptom: ${symptom}
- Age group: ${ageGroup}
- Duration: ${duration}
- Severity: ${severity}
- Danger signs: ${selectedDanger}

Give triage advice based on this complete picture.`;

    console.log("Calling Bedrock with full patient summary:", patientSummary);

    try {
      const aiAdvice = await callBedrock(TRIAGE_SYSTEM_PROMPT, patientSummary);
      console.log("Bedrock triage response:", aiAdvice);

      // After advice, offer follow-up
      const fullResponse = aiAdvice + " Agar aur koi sawaal ho toh dobara call karein. Dhanyawad.";
      return respond(sayAndHangup(fullResponse));

    } catch (err) {
      console.error("Bedrock error:", err.message);
      return respond(sayAndHangup(
        "Maafi chahte hain, abhi system busy hai. " +
        "Thodi der baad phir call karein ya seedha doctor ke paas jaiye. " +
        "Yeh AI ki salah hai."
      ));
    }
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  return respond(sayAndHangup("Kuch galat ho gaya. Phir se call karein. Dhanyawad."));
};

function respond(xml) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/xml" },
    body: xml
  };
}
