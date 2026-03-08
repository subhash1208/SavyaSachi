/**
 * Input sanitizer for caller speech before it reaches Nova Pro.
 * Prevents prompt injection attacks (Req 9.3).
 *
 * Strips patterns that attempt to override the system prompt or
 * hijack the model's behavior. Caller speech should only contain
 * symptom descriptions — anything else is suspicious.
 */

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(previous|all|above|prior)\s+(instructions?|prompts?|context)/gi,
  /forget\s+(everything|all|previous|prior)/gi,
  /you\s+are\s+now\s+/gi,
  /act\s+as\s+(a\s+)?(different|new|another)/gi,
  /system\s*:/gi,
  /\[system\]/gi,
  /<system>/gi,
  /assistant\s*:/gi,
  /human\s*:/gi,
  /\[INST\]/gi,
  /<<SYS>>/gi,
  /jailbreak/gi,
  /DAN\s+mode/gi,
  /override\s+(safety|guardrail|filter)/gi,
];

const MAX_INPUT_LENGTH = 500; // characters — caller speech is never this long legitimately

/**
 * Sanitizes caller utterance before passing to Nova Pro.
 * - Truncates to MAX_INPUT_LENGTH
 * - Strips prompt injection patterns
 * - Removes null bytes and control characters
 * Returns the sanitized string.
 */
export function sanitizeInput(text: string): string {
  if (!text || typeof text !== 'string') return '';

  // Truncate
  let sanitized = text.substring(0, MAX_INPUT_LENGTH);

  // Strip control characters and null bytes
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Strip injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[removed]');
  }

  return sanitized.trim();
}

/**
 * Returns true if the input contains injection patterns.
 * Used in property tests.
 *
 * NOTE: Each regex has the /g flag, so .test() advances lastIndex.
 * We reset lastIndex before each test to avoid the classic JS gotcha
 * where calling containsInjection twice on the same string gives
 * different results (first call advances lastIndex, second call
 * starts from the middle and misses the match).
 */
export function containsInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => {
    p.lastIndex = 0;
    return p.test(text);
  });
}

// ─── Language Register Detection ──────────────────────────────────────────────

// Common English words that appear in Hinglish speech
const HINGLISH_MARKERS = new Set([
  'fever', 'pain', 'doctor', 'hospital', 'medicine', 'tablet', 'problem',
  'baby', 'child', 'breathing', 'chest', 'stomach', 'head', 'body',
  'blood', 'sugar', 'pressure', 'test', 'injection', 'operation', 'report',
  'normal', 'serious', 'emergency', 'ambulance', 'clinic', 'health',
]);

// Common Hindi transliteration words (Roman script) — NOT English
const HINDI_WORDS = new Set([
  'mujhe', 'hai', 'hain', 'aur', 'sar', 'mein', 'dard', 'bukhar', 'nahi',
  'ho', 'raha', 'rahi', 'rahe', 'ko', 'ka', 'ki', 'ke', 'se', 'ne', 'par',
  'bachche', 'bachcha', 'ulti', 'tez', 'bahut', 'thoda', 'zyada', 'kuch',
  'din', 'raat', 'subah', 'shaam', 'abhi', 'kal', 'aaj', 'pehle', 'baad',
  'ghar', 'gaon', 'paas', 'door', 'yahan', 'wahan', 'kahan', 'kya', 'kaun',
  'kaise', 'kitna', 'kitne', 'bahut', 'thak', 'thaka', 'peena', 'khana',
  'pani', 'paani', 'dawai', 'dawa', 'pet', 'haath', 'pair', 'aankhein',
  'naak', 'kaan', 'gala', 'seena', 'peeth', 'kamar', 'sir', 'mooh',
  'theek', 'bura', 'accha', 'zyada', 'kam', 'jaldi', 'dheere', 'seedha',
  'please', 'haan', 'naa', 'ji', 'bhi', 'sirf', 'bas', 'phir', 'toh',
]);

export type LanguageRegister = 'pure_hindi' | 'hinglish' | 'english';

/**
 * Detects whether the caller is speaking pure Hindi, Hinglish, or English.
 * Used to instruct Nova Pro to match the caller's register.
 *
 * Logic:
 * - Count HINGLISH_MARKERS present → if any found → hinglish candidate
 * - Count words that are English (ASCII-only, not in HINDI_WORDS set)
 * - If >60% of words are non-Hindi English → english
 * - If hinglish markers found → hinglish
 * - Otherwise → pure_hindi
 */
export function detectRegister(utterance: string): LanguageRegister {
  if (!utterance || utterance.trim().length === 0) return 'pure_hindi';

  const words = utterance.toLowerCase().split(/\s+/);
  const totalWords = words.length;

  // Count Hindi words present
  const hindiWordCount = words.filter(w => HINDI_WORDS.has(w)).length;
  const hindiRatio = hindiWordCount / totalWords;

  // If no Hindi words at all → it's English (even if it contains medical terms)
  if (hindiRatio === 0) return 'english';

  // Count Hinglish marker words (English medical terms mixed into Hindi)
  const hinglishCount = words.filter(w => HINGLISH_MARKERS.has(w)).length;

  // Some Hindi + some English medical terms → hinglish
  if (hinglishCount >= 1) return 'hinglish';

  return 'pure_hindi';
}

/**
 * Builds the language instruction for Nova Pro system prompt.
 * Injected dynamically based on caller's detected register + selected language.
 */
export function buildLanguageInstruction(
  selectedLanguage: string,
  register: LanguageRegister,
): string {
  if (selectedLanguage === 'english') {
    return 'Respond in clear, simple English only.';
  }

  if (register === 'hinglish') {
    return [
      'Respond in Hinglish — mix simple Hindi and English naturally, as the caller does.',
      'Use common English medical words the caller already used (fever, pain, doctor).',
      'For facilities: say "health centre" or "PHC" — not "Primary Health Centre".',
      'For hospital: say "district hospital" — not "Zila Aspatal".',
    ].join(' ');
  }

  // pure_hindi
  return [
    'Respond in pure, simple Hindi using Roman transliteration.',
    'Use words a rural Indian villager would understand.',
    'Say "Swasthya Kendra" not "Primary Health Centre".',
    'Say "Zila Aspatal" not "District Hospital".',
    'Say "dawai" not "medicine", "bukhar" not "fever", "dard" not "pain".',
    'Never use English medical terms.',
  ].join(' ');
}
