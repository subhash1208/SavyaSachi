# VaidyaVaani — Dual Knowledge Base Architecture

**Emergency Protocol KB (Deterministic) + General Triage KB (Intelligent RAG)**

*Created: February 14, 2026*
*For: SavyaSachi Team — AI for Bharat 2026 Hackathon*
*Companion to: VaidyaVaani-Data-Sources-Guide.md (what goes in) → This doc (how it's organized & routed)*

---

## Table of Contents

1. [Why Two Knowledge Bases](#1-why-two-knowledge-bases)
2. [Architecture Overview](#2-architecture-overview)
3. [Index 1: Emergency Protocol KB (Deterministic, Fast)](#3-index-1-emergency-protocol-kb-deterministic-fast)
4. [Index 2: General Triage KB (Intelligent RAG, Broader)](#4-index-2-general-triage-kb-intelligent-rag-broader)
5. [The Routing Logic — Intent Classification](#5-the-routing-logic--intent-classification)
6. [Emergency Response Fallback Chain](#6-emergency-response-fallback-chain)
7. [Hospital Dashboard — "No Accept" Scenarios](#7-hospital-dashboard--no-accept-scenarios)
8. [Hackathon Demo Strategy](#8-hackathon-demo-strategy)
9. [The Architecture Pitch for Judges](#9-the-architecture-pitch-for-judges)
10. [Metadata Approach vs Separate KBs — Trade-off Analysis](#10-metadata-approach-vs-separate-kbs--trade-off-analysis)

---

## 1. Why Two Knowledge Bases

### The Core Problem

In an emergency, the AI cannot afford to search through 200+ documents about chronic diabetes management when someone is having a heart attack. Two things go wrong with a single large KB:

1. **Retrieval latency increases** — more documents = more vectors to search = slower response
2. **Irrelevant chunk noise** — the retriever might pull a diabetes chunk that mentions "chest tightness" alongside the actual cardiac emergency protocol, confusing the AI's response

### The Solution: Determinism vs Intelligence

This isn't just "fast vs slow" — it's about two fundamentally different response strategies:

| Aspect | Emergency Protocol KB | General Triage KB |
|--------|----------------------|-------------------|
| **Response Type** | Deterministic (read verbatim) | Intelligent (RAG + reasoning) |
| **AI Role** | Retrieves and reads pre-approved script | Retrieves chunks, reasons over them, generates response |
| **Hallucination Risk** | Zero (nothing to hallucinate) | Low (guardrailed RAG, but AI generates text) |
| **Documents** | ~15 hand-crafted emergency scripts | 50-200+ medical protocols and guidelines |
| **Retrieval Time** | <100ms (tiny index) | 200-500ms (larger index, acceptable) |
| **Total Response** | <1 second | 1-3 seconds |
| **When Used** | Life-threatening emergencies | Everything else (triage, advice, chronic care) |

This is architecturally the same pattern as the "Circuit Breaker" in the Enterprise Readiness document — fast/safe path vs normal/intelligent path.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     CALLER SPEAKS                                │
│            (via Feature Phone / Smartphone)                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              AMAZON CONNECT + NOVA SONIC                         │
│         (Speech-to-Speech Processing)                            │
│         Transcribes caller's speech                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│           STEP 1: INTENT CLASSIFICATION (Lambda)                 │
│                                                                  │
│   Simple keyword/pattern match — NOT an LLM call                 │
│   Latency: <200ms                                                │
│                                                                  │
│   Emergency keywords detected?                                   │
│   (chest pain, saans nahi, behosh, khoon, saanp,                │
│    EMERGENCY, press 9, heart attack, stroke,                     │
│    seene mein dard, gir gaya, zeher)                            │
│                                                                  │
│              ┌──── YES ────┐          ┌──── NO ────┐            │
│              │              │          │             │            │
│              ▼              │          ▼             │            │
└──────────────┼──────────────┼──────────┼─────────────┼──────────┘
               │              │          │             │
               ▼              │          ▼             │
┌──────────────────────┐     │  ┌──────────────────────┐
│  EMERGENCY PATH      │     │  │  TRIAGE PATH          │
│  (Deterministic)     │     │  │  (Intelligent RAG)    │
│                      │     │  │                       │
│  ┌────────────────┐  │     │  │  ┌─────────────────┐  │
│  │ Emergency      │  │     │  │  │ General Triage  │  │
│  │ Protocol KB    │  │     │  │  │ KB              │  │
│  │ (~15 docs)     │  │     │  │  │ (50-200+ docs)  │  │
│  │                │  │     │  │  │                 │  │
│  │ Retrieves      │  │     │  │  │ RAG retrieval   │  │
│  │ static script  │  │     │  │  │ + AI reasoning  │  │
│  │ verbatim       │  │     │  │  │ + follow-up Qs  │  │
│  └────────────────┘  │     │  │  └─────────────────┘  │
│                      │     │  │                       │
│  ACTIONS:            │     │  │  ACTIONS:             │
│  • Read first-aid    │     │  │  • Ask questions      │
│  • Dispatch 108/102  │     │  │  • Provide advice     │
│  • SMS to contacts   │     │  │  • Send SMS           │
│  • Alert ASHA        │     │  │  • Schedule follow-up │
│  • Bridge to 108     │     │  │  • Offer ambulance    │
│                      │     │  │  • Alert ASHA         │
│  Total: <1 second    │     │  │                       │
│                      │     │  │  Total: 1-3 seconds   │
└──────────────────────┘     │  └───────────────────────┘
                             │
                             │
         ┌───────────────────┘
         │  ESCALATION PATH:
         │  If during triage, danger signs detected
         │  → Re-route to Emergency Path mid-call
         └─────────────────────────────────────────
```

### Key Design Principle

The General Triage path can ESCALATE to the Emergency path mid-conversation. If someone calls about a "headache" (triage path) but then mentions "ek taraf ka shareer kaam nahi kar raha" (one side of body not working — stroke sign), the system immediately switches to the Emergency Protocol KB.

---


## 3. Index 1: Emergency Protocol KB (Deterministic, Fast)

### Purpose

This KB contains ONLY pre-approved, hand-crafted emergency scripts. The AI retrieves and reads these verbatim. There is zero hallucination risk because the AI is not generating text — it's reading a script.

### Document Count: ~15

| # | Document | Condition | ICD-10 | Dispatch | Source |
|---|----------|-----------|--------|----------|--------|
| 1 | `emergency-cardiac.md` | Heart attack / Chest pain | I21.9 | 108 | ICMR STW (STEMI) + WHO |
| 2 | `emergency-stroke.md` | Stroke / Paralysis | I64 | 108 | ICMR STW + WHO |
| 3 | `emergency-snakebite.md` | Snakebite | T63.0 | 108 | India NAPSE 2024 + WHO SE Asia |
| 4 | `emergency-severe-bleeding.md` | Major bleeding / Trauma | R58 | 108 | WHO Emergency Care |
| 5 | `emergency-choking.md` | Choking / Airway obstruction | T17.9 | 108 | WHO First Aid |
| 6 | `emergency-burns.md` | Severe burns | T30.0 | 108 | WHO Burns Guidelines |
| 7 | `emergency-poisoning.md` | Poisoning / Ingestion | T65.9 | 108 | WHO Poison Management |
| 8 | `emergency-allergic-reaction.md` | Anaphylaxis | T78.2 | 108 | ICMR STW |
| 9 | `emergency-seizure.md` | Seizure / Convulsions | R56.9 | 108 | ICMR STW |
| 10 | `emergency-pregnancy.md` | Pregnancy emergency (eclampsia, hemorrhage) | O14.9 / O72.1 | 108 | RMNCH+A |
| 11 | `emergency-drowning.md` | Drowning / Near-drowning | T75.1 | 108 | WHO First Aid |
| 12 | `emergency-breathing.md` | Severe breathing difficulty | J45.9 | 108 | ICMR STW (Asthma/COPD) |
| 13 | `emergency-unconscious.md` | Unconsciousness / Unresponsive | R40.2 | 108 | WHO Emergency Care |
| 14 | `emergency-infant.md` | Infant not breathing / Limp | P28.4 | 108 | WHO IMCI |
| 15 | `emergency-heatstroke.md` | Heatstroke (India-specific) | T67.0 | 108 | WHO + India guidelines |

### Document Structure Template (Every Script Follows This)

Every emergency script in this KB must follow the exact same structure. This consistency is critical — the AI knows exactly where to find each piece of information, and paramedics receiving the handoff get a standardized assessment.

```markdown
## EMERGENCY_[CONDITION_NAME]
### Source: [ICMR STW / WHO Guideline / India Protocol]
### ICD-10: [Code] ([Full Name])
### Dispatch: 108 (Emergency Response — Paramedic Required)
### Language: Bilingual (Hindi + English)
### Severity: CRITICAL

---

**TRIGGER KEYWORDS (Hindi + English):**
- Hindi: [keywords in Hindi]
- English: [keywords in English]
- Hinglish: [mixed keywords]

---

**A — AIRWAY:**
"Kya woh bol pa rahe hain?" (Can they speak?)
→ NO → [specific action]
→ YES → Proceed to B

**B — BREATHING:**
"Saans chal rahi hai? Tez ya mushkil se?" (Breathing? Fast or difficult?)
→ [assessment logic]

**C — CIRCULATION:**
[Condition-specific circulation checks]
→ [assessment logic]

**D — DISABILITY:**
"Kya woh hosh mein hain?" (Are they conscious?)
→ [assessment logic]

**E — EXPOSURE:**
[Condition-specific exposure checks]
→ [assessment logic]

---

**IMMEDIATE FIRST-AID INSTRUCTIONS:**
1. [Step 1 — Hindi + English]
2. [Step 2 — Hindi + English]
3. [Step 3 — Hindi + English]

**DO NOT (Myth-Busting):**
❌ [Common harmful practice 1]
❌ [Common harmful practice 2]
❌ [Common harmful practice 3]

---

**DISPATCH ACTION:**
- 108 Emergency Response dispatched
- SMS to 3 emergency contacts with location
- Alert nearest hospital with [specific capability needed]
- ASHA worker notified

**ESCALATION:**
- If [danger sign] → [specific escalation]
- If patient deteriorates → Stay on line, 108 paramedic en route
```

### Key Design Principles for Emergency KB

1. **Deterministic, not generative.** The AI reads these scripts. It does not generate new text for emergencies. Zero hallucination risk.
2. **ABCDE order always.** Every script follows Airway → Breathing → Circulation → Disability → Exposure. This is the same framework 108 paramedics use, so the handoff is seamless.
3. **ICD-10 tagged.** Every script has an ICD-10 code. This makes every emergency interaction ABDM-compliant and enables disease surveillance aggregation.
4. **108 vs 102 specified.** Every script explicitly states which ambulance service to dispatch. All 15 emergency scripts dispatch 108 (life-threatening). The 102 transport is only used for non-emergency referrals from the General Triage KB.
5. **Bilingual always.** Hindi + English in every script. The AI selects the appropriate language based on the caller's detected language.
6. **Myth-busting included.** Rural India has harmful traditional practices for many emergencies (tourniquet for snakebite, water for heart attack, etc.). Every script explicitly counters these myths.

---

## 4. Index 2: General Triage KB (Intelligent RAG, Broader)

### Purpose

This KB handles everything that is NOT a life-threatening emergency. The AI uses proper RAG here — retrieves relevant chunks from the knowledge base, reasons over them, asks follow-up questions, and generates a response. This is where the "intelligence" lives.

### Document Breakdown (50-80 for Hackathon, 200+ for Production)

#### Category A: ICMR Standard Treatment Workflows (30-50 documents)

The backbone of the General Triage KB. Each STW is a one-page PDF — perfect for Bedrock KB chunking.

| Priority | Specialty | Example STWs | Count |
|----------|-----------|-------------|-------|
| 🔴 P0 (Hackathon) | General Medicine | Fever, Diarrhea, Dehydration, Cough, Headache | 5 |
| 🔴 P0 (Hackathon) | Pediatrics | Child fever, Malnutrition, Immunization | 3 |
| 🔴 P0 (Hackathon) | Cardiology | Hypertension, Chest pain (non-emergency) | 2 |
| 🟡 P1 (Full Build) | Pulmonology | Asthma, COPD, Pneumonia | 3 |
| 🟡 P1 (Full Build) | Gastroenterology | Abdominal pain, Acid reflux, Jaundice | 3 |
| 🟡 P1 (Full Build) | Dermatology | Skin infections, Eczema, Fungal | 3 |
| 🟡 P1 (Full Build) | Obstetrics | Antenatal care, Normal pregnancy, Postnatal | 3 |
| 🟡 P1 (Full Build) | Orthopedics | Fractures, Joint pain, Back pain | 3 |
| 🟢 P2 (Production) | All 28 specialties | Remaining 100+ STWs | 100+ |

#### Category B: WHO Clinical Guidelines (8-15 chunks)

| Source | Chunks | Content |
|--------|--------|---------|
| WHO IMAI | 5-10 | Adult triage logic, emergency assessment, "what questions to ask" decision trees, chronic care in resource-limited settings |
| WHO IMCI | 3-5 | Child assessment (2 months to 5 years), young infant assessment (1 week to 2 months), dehydration classification, ORS protocol, danger signs |

#### Category C: Maternal & Child Health (3-5 chunks)

| Source | Chunks | Content |
|--------|--------|---------|
| RMNCH+A | 3-5 | Pregnancy danger signs, antenatal care, postnatal care, newborn danger signs, ASHA worker referral criteria |

#### Category D: Facility & Medicine Reference (5 documents)

| Source | Documents | Content |
|--------|-----------|---------|
| IPHS Guidelines | 4 | What Sub-Centre / PHC / CHC / District Hospital can handle |
| NLEM | 1 (CSV) | Available medicines by facility level |

#### Category E: Supplementary Data (1-3 files)

| Source | Documents | Content |
|--------|-----------|---------|
| Symptom-Disease CSV | 1-3 | Structured symptom-to-condition mapping for initial classification |

### How RAG Works in the General Triage KB

```
Caller: "Meri beti ko 3 din se bukhar hai, ulti bhi ho rahi hai"
        (My daughter has had fever for 3 days, also vomiting)

Step 1: Bedrock retrieves relevant chunks:
        → WHO IMCI: "Assess and Classify the Sick Child"
        → ICMR STW: "Acute Gastroenteritis in Children"
        → ICMR STW: "Fever in Children"

Step 2: AI reasons over retrieved chunks:
        → Child + fever + vomiting = assess for dehydration
        → Need to ask: age, fluid intake, urination, lethargy

Step 3: AI generates follow-up question:
        "Beti ki umar kitni hai? Kya woh paani pi pa rahi hai?"
        (How old is your daughter? Can she drink water?)

Step 4: Based on answers, AI classifies:
        → Mild dehydration → ORS advice + SMS + follow-up in 4 hours
        → Severe dehydration → Escalate to Emergency KB (re-route)
        → Danger signs (lethargy, sunken eyes) → 102 transport to PHC
```

### Key Difference from Emergency KB

| Aspect | Emergency KB | General Triage KB |
|--------|-------------|-------------------|
| AI behavior | Reads script verbatim | Reasons over chunks, generates response |
| Follow-up questions | Minimal (ABCDE assessment) | Multiple rounds of Q&A |
| Response style | Directive ("Do this NOW") | Conversational ("Let me ask a few questions") |
| Dispatch | Always 108 (life-threatening) | 102 for transport, or "visit PHC tomorrow" |
| Escalation | N/A (already at highest level) | Can escalate TO Emergency KB mid-call |

---

## 5. The Routing Logic — Intent Classification

### The Critical Design Decision

The router between the two KBs must be **fast, deterministic, and reliable**. This is NOT an LLM call. It's a simple keyword/pattern match in Lambda that runs in under 200ms.

Why not use an LLM for routing?
- LLM call = 500-1000ms latency just to decide which KB to use
- In an emergency, that's 500ms of someone dying while the AI "thinks about thinking"
- A regex/keyword match is faster, cheaper, and more reliable for binary classification (emergency vs not-emergency)

### Emergency Keyword List (Hindi + English + Hinglish)

```python
EMERGENCY_KEYWORDS = {
    # Hindi
    "seene mein dard", "saans nahi aa rahi", "behosh", "khoon",
    "saanp ne kaata", "saanp ka kaata", "zeher", "gir gaya",
    "sir mein bahut dard", "ek taraf ka shareer", "haath pair nahi hil rahe",
    "bachcha saans nahi le raha", "pet se khoon", "jal gaya",
    "zeher kha liya", "dawai zyada kha li", "doob gaya",
    "mirgi ka daura", "jhatkay aa rahe", "hosh nahi",
    "pregnancy mein khoon", "delivery mein dikkat",
    "bahut tez bukhar bachche ko", "bachcha hil nahi raha",
    "loo lag gayi", "garmi se behosh",
    
    # English
    "heart attack", "chest pain", "not breathing", "unconscious",
    "bleeding heavily", "snake bite", "snakebite", "poison",
    "stroke", "paralysis", "choking", "drowning", "burns",
    "seizure", "convulsion", "emergency", "dying",
    "baby not breathing", "pregnancy bleeding", "heatstroke",
    
    # Hinglish
    "heart attack ho raha", "breathing problem", "BP bahut high",
    "sugar bahut low", "accident ho gaya", "head injury",
    
    # Single-word triggers
    "EMERGENCY", "BACHAO", "HELP", "JALDI",
    
    # DTMF (keypress)
    "9"  # Press 9 for emergency
}
```

### Lambda Router Implementation (Pseudocode)

```python
def classify_intent(transcript: str, dtmf_input: str = None) -> dict:
    """
    Intent classification — runs in Lambda, <200ms
    Returns: { "path": "emergency" | "triage", "confidence": float, "matched_keyword": str }
    """
    
    # Priority 1: DTMF override (user pressed 9)
    if dtmf_input == "9":
        return {"path": "emergency", "confidence": 1.0, "matched_keyword": "DTMF_9"}
    
    # Priority 2: Keyword match against transcript
    transcript_lower = transcript.lower().strip()
    
    for keyword in EMERGENCY_KEYWORDS:
        if keyword.lower() in transcript_lower:
            return {
                "path": "emergency",
                "confidence": 0.95,
                "matched_keyword": keyword
            }
    
    # Priority 3: Emotion detection (from Nova Sonic metadata)
    # If caller is panicked/crying → escalate even without keywords
    if nova_sonic_emotion == "panic" or nova_sonic_emotion == "distress":
        return {
            "path": "emergency",
            "confidence": 0.80,
            "matched_keyword": "EMOTION_ESCALATION"
        }
    
    # Default: General Triage
    return {"path": "triage", "confidence": 0.90, "matched_keyword": None}
```

### Mid-Call Escalation Logic

The General Triage path continuously monitors for danger signs. If at any point during a triage conversation the caller mentions emergency keywords or the AI detects danger signs from the medical protocol, the system re-routes to the Emergency KB.

```
TRIAGE CONVERSATION:
Caller: "Sir dard hai subah se" (Headache since morning)
AI: [General Triage KB] → Asks follow-up questions

Caller: "Aur ek taraf ka haath nahi hil raha" 
        (And one side arm is not moving)
        
SYSTEM: ⚠️ DANGER SIGN DETECTED
        "ek taraf" + "nahi hil raha" = possible STROKE
        → IMMEDIATE RE-ROUTE to Emergency KB
        → Retrieve emergency-stroke.md
        → Switch to deterministic ABCDE script
        → Dispatch 108

AI: "Yeh bahut zaroori hai. Main abhi 108 ambulance bhej rahi hoon.
     Unhe lita dijiye. Hilne mat dijiye."
```

### Routing Flow Summary

```
┌──────────────────────────────────────────────┐
│           CALLER INPUT (transcript)           │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────┐
│         DTMF CHECK: Did user press 9?         │
│              YES → EMERGENCY PATH              │
│              NO  → Continue                    │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────┐
│      KEYWORD MATCH: Emergency keywords?       │
│              MATCH → EMERGENCY PATH            │
│              NO MATCH → Continue               │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────┐
│      EMOTION CHECK: Panic/distress detected?  │
│              YES → EMERGENCY PATH              │
│              NO  → TRIAGE PATH                 │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────┐
│           GENERAL TRIAGE KB (RAG)             │
│                                               │
│   Continuous monitoring for danger signs:      │
│   If danger sign detected mid-conversation    │
│   → RE-ROUTE to Emergency KB immediately      │
└───────────────────────────────────────────────┘
```

---


## 6. Emergency Response Fallback Chain

### The Problem

When VaidyaVaani detects a life-threatening emergency and dispatches the Hospital Dashboard notification, what happens if NO hospital responds? The system cannot dead-end. A patient in cardiac arrest cannot wait for a hospital admin to check their phone.

### The Cascading Fallback Design

The fallback chain has 3 layers. Each layer activates automatically if the previous layer fails. The patient is NEVER left without help.

```
┌─────────────────────────────────────────────────────────────────┐
│                    EMERGENCY DETECTED                            │
│          (Emergency KB script retrieved, ABCDE started)          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: HOSPITAL DASHBOARD BLAST (Innovation Layer)            │
│                                                                  │
│  • Notification sent to 3 nearest hospitals (30km radius)        │
│  • Each hospital sees: condition, severity, ICD-10, location     │
│  • Timeout: 60 seconds                                           │
│  • First hospital to click "Accept & Confirm Bed" gets patient   │
│                                                                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                         │
│  │ Hospital │  │ Hospital │  │ Hospital │                         │
│  │    A     │  │    B     │  │    C     │                         │
│  │ (12 km)  │  │ (18 km)  │  │ (27 km)  │                         │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                         │
│       │              │              │                              │
│   Accept?        Accept?        Accept?                           │
│                                                                  │
│  IF any hospital accepts within 60s:                             │
│  → AI tells caller: "Apollo Nizampet has accepted. Ambulance     │
│    on the way. ETA 14 minutes."                                  │
│  → SUCCESS — chain stops here                                    │
│                                                                  │
│  IF no hospital accepts within 60s:                              │
│  → ESCALATE to Layer 2                                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │ (60s timeout — no acceptance)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 2: EXPAND RADIUS + 108 BRIDGE (Safety Net)                │
│                                                                  │
│  TWO THINGS HAPPEN SIMULTANEOUSLY:                               │
│                                                                  │
│  Action A: Expand hospital search                                │
│  • Blast notification to next 3 hospitals (60km radius)          │
│  • Same "Accept & Confirm" mechanism                             │
│  • Timeout: 60 more seconds                                      │
│                                                                  │
│  Action B: Bridge call to 108 dispatcher (PARALLEL)              │
│  • AI dials 108 and plays TTS to dispatcher:                     │
│    "Incoming emergency. Location: Khedi Village, MP.             │
│     Suspected cardiac arrest. ICD-10: I21.9.                     │
│     Patient on line. Connecting now."                             │
│  • Caller is connected to 108 human dispatcher                   │
│  • 108 dispatcher takes over — they have their own               │
│    hospital network and ambulance fleet                           │
│                                                                  │
│  IF expanded hospital accepts:                                   │
│  → AI informs caller + 108 dispatcher                            │
│  → 108 can coordinate ambulance to that hospital                 │
│                                                                  │
│  IF still no hospital accepts:                                   │
│  → 108 dispatcher is ALREADY on the line (from Action B)         │
│  → They handle it through their own network                      │
│  → ESCALATE to Layer 3 as additional backup                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │ (108 already bridged, additional backup)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3: SMS FALLBACK + ASHA ALERT (Last Resort)                │
│                                                                  │
│  Even if everything above is in progress, this fires:            │
│                                                                  │
│  • SMS to caller with nearest 3 hospital names + phone numbers   │
│    + addresses (so family can self-transport if needed)           │
│  • SMS to 3 emergency contacts with patient location + condition │
│  • Alert to nearest ASHA worker with patient details             │
│  • All information logged for audit trail                        │
│                                                                  │
│  This ensures: even if the phone call drops, even if 108 is      │
│  busy, the patient's family has actionable information via SMS.   │
└─────────────────────────────────────────────────────────────────┘
```

### The Key Principle

**108 is the ultimate safety net. The Hospital Dashboard is the innovation layer ON TOP of 108.**

VaidyaVaani does NOT replace 108. It adds intelligence on top:
- 108 doesn't know the patient's condition before the call → VaidyaVaani tells them
- 108 doesn't pre-alert hospitals → VaidyaVaani's dashboard does
- 108 doesn't send first-aid instructions → VaidyaVaani already did (ABCDE script)

But if VaidyaVaani's innovation layer fails (no hospital accepts), 108 is already on the line as the human fallback. The patient is never abandoned.

### Timeline of the Fallback Chain

| Time | Event | Status |
|------|-------|--------|
| 0s | Emergency detected, ABCDE script starts | AI providing first-aid instructions |
| 2s | Hospital Dashboard blast to 3 nearest hospitals | Waiting for acceptance |
| 2s | 108 dispatch initiated (parallel, not sequential) | 108 call connecting |
| 5s | SMS sent to emergency contacts | Family alerted |
| 5s | ASHA worker notified | Ground-level support activated |
| 60s | If no hospital accepts → expand to 60km radius | Wider search |
| 60s | 108 dispatcher connected to caller | Human safety net active |
| 120s | If still no hospital → 108 handles through their network | 108 has their own hospital network |

**Note:** In the timeline above, 108 is bridged at 2 seconds — NOT at 60 seconds. We don't wait for the hospital dashboard to fail before calling 108. Both happen in parallel. The hospital dashboard is a bonus; 108 is the guarantee.

---

## 7. Hospital Dashboard — "No Accept" Scenarios

### Scenario A: Timeout (No Hospital Responds Within 60s)

**Why it happens:** Hospital admin is away from dashboard, phone is on silent, night shift with no one monitoring.

**Solution:** Already handled by Layer 2 of the fallback chain:
- Expand radius to 60km (3 more hospitals)
- 108 already bridged (parallel action)
- SMS with hospital details sent to family

**For production (post-hackathon):**
- Implement push notifications (not just dashboard) — phone vibrates
- Add WhatsApp notification to hospital admin
- Escalation to hospital's main reception landline (auto-dial)

### Scenario B: All Hospitals Decline

**Why it happens:** All nearby hospitals are full, or the condition requires a specialist they don't have (e.g., neurosurgeon for stroke, antivenom for snakebite).

**Solution:**
- 108 dispatcher is already on the line — they know which hospitals have capacity
- System logs the decline reasons (if provided) and shares with 108 dispatcher
- SMS to family includes hospitals beyond the initial radius
- For snakebite specifically: system checks which hospitals have antivenom (from IPHS data)

**For production (post-hackathon):**
- Hospital capacity data integration (when ABDM UHI matures)
- Specialist availability mapping
- Inter-hospital transfer protocols

### Scenario C: False Acceptance (Hospital Accepts but Lacks Resources)

**Why it happens:** Hospital admin clicks "Accept" to get the patient, but the hospital doesn't actually have the required equipment (ventilator, antivenom, blood bank, etc.).

**This is the most dangerous scenario.** Patient arrives at hospital → hospital says "we can't handle this" → patient needs to be transferred → critical time lost.

**Solution (Hackathon — Simplified):**
- When hospital clicks "Accept," show a confirmation checklist:
  ```
  ✅ Confirm: You have [specific capability] available?
  - [ ] Cardiac care unit / ECG available
  - [ ] Doctor on duty who can handle this case
  - [ ] Bed available in emergency ward
  
  ⚠️ If you cannot confirm, please DECLINE so we can 
     route to a hospital that can help.
  ```
- This is a soft check — relies on hospital honesty
- But it's better than blind acceptance

**Solution (Production — Robust):**
- Hospital onboarding process: register capabilities (cardiac, trauma, antivenom, blood bank, ICU, ventilator)
- Real-time capability matching: system only notifies hospitals that HAVE the required capability
- Post-incident feedback loop: if a hospital accepts but can't deliver, flag for review
- Penalty system: hospitals that false-accept repeatedly get deprioritized

### For the Hackathon Demo

You don't need to demo all three scenarios. Demo the happy path:
1. Emergency detected → Hospital Dashboard notification appears on laptop
2. Hospital admin clicks "Accept & Confirm Bed"
3. AI tells caller: "Hospital X has accepted. Ambulance on the way."

If a judge asks "What if no hospital accepts?" — you have the full fallback chain answer ready. That's the point of this document.

---

## 8. Hackathon Demo Strategy

### The 3 Demo-Ready Emergencies (Build These Perfectly)

| # | Emergency | Why This One | Demo Impact |
|---|-----------|-------------|-------------|
| 1 | **Heart Attack / Chest Pain** | Most dramatic, judges relate to it personally. Universal fear. Shows ABCDE framework clearly. | HIGH — "seene mein dard" → AI immediately switches to emergency mode → ABCDE assessment → 108 dispatched → Hospital dashboard notification |
| 2 | **Snakebite** | India-specific (50,000 deaths/year). Shows you understand the Indian context. Myth-busting is powerful ("tourniquet mat lagaiye!"). | HIGH — Shows India-specific knowledge, counters harmful myths, uses India NAPSE 2024 protocol |
| 3 | **Child with High Fever + Dehydration** | Emotional (mother calling about sick child). Shows pediatric capability. ORS instructions = tangible advice. | HIGH — Shows empathy, practical advice (ORS SMS), WHO IMCI protocol, follow-up scheduling |

### The 3 Backup Emergencies (Scripts Ready, Don't Demo)

| # | Emergency | When to Mention |
|---|-----------|----------------|
| 4 | **Pregnancy Emergency (Pre-eclampsia)** | If judge asks about maternal health |
| 5 | **Severe Bleeding** | If judge asks about trauma |
| 6 | **Stroke** | If judge asks about neurological emergencies |

### Demo Flow for Each Emergency

**Demo 1: Heart Attack (60 seconds)**
```
Caller: "Mere pati ko seene mein bahut dard ho raha hai, 
         haath mein bhi dard ja raha hai!"

[SYSTEM: Emergency keyword detected → Emergency KB → emergency-cardiac.md]

AI: "Yeh bahut zaroori hai. Main abhi madad karti hoon.
     Pehle batayein — kya woh bol pa rahe hain?" (A — Airway)

Caller: "Haan, bol rahe hain par dard bahut hai"

AI: "Saans chal rahi hai? Tez ya mushkil se?" (B — Breathing)

Caller: "Saans tez chal rahi hai"

AI: "Suniye dhyan se:
     1. Unhe lita dijiye, hilne mat dijiye
     2. Agar aspirin hai toh ek goli chabane ko dijiye
     3. Paani mat dijiye
     Main 108 emergency ambulance bhej rahi hoon. 
     Paramedic aayega. Line pe rahiye."

[SYSTEM: 108 dispatched, Hospital Dashboard notification sent]
[LAPTOP: Hospital Dashboard shows notification → Admin clicks Accept]

AI: "Apollo Hospital Nizampet ne accept kar liya hai. 
     Ambulance 14 minute mein pahunchegi. 
     Aapke phone par SMS bhej rahi hoon hospital ka address."

[PHONE: SMS arrives with hospital details]
```

**Demo 2: Snakebite (45 seconds)**
```
Caller: "Saanp ne kaat liya! Pair mein kaata hai!"

[SYSTEM: Emergency keyword → Emergency KB → emergency-snakebite.md]

AI: "Ghabraiye mat, main madad karti hoon.
     Sabse pehle — pair ko bilkul mat hilayein.
     
     SUNIYE DHYAN SE — yeh mat kariye:
     ❌ Tourniquet mat lagaiye — haath-pair kharab ho sakta hai
     ❌ Zeher mat choosiye — kaam nahi karta
     ❌ Ghav mat kaatiye
     ❌ Barf mat lagaiye
     
     Pair ko seedha rakhiye, neeche rakhiye.
     Angoothi, ghadi, kuch bhi tight ho toh nikaal dijiye.
     
     108 emergency ambulance bhej rahi hoon.
     Antivenom hospital mein milega."

[SYSTEM: 108 dispatched with "snakebite" tag]
```

**Demo 3: Child Fever (45 seconds)**
```
Caller: "Meri beti ko 3 din se bukhar hai, ulti bhi ho rahi hai"

[SYSTEM: No emergency keyword → General Triage KB → RAG]

AI: "Main samajh sakti hoon aap pareshan hain. 
     Kuch sawaal poochti hoon.
     Beti ki umar kitni hai?"

Caller: "3 saal"

AI: "Kya woh paani pi pa rahi hai?"

Caller: "Bahut kam pi rahi hai"

AI: "Kya aankhen dhasi hui hain? Kya ro rahi hai toh 
     aansoo aa rahe hain?"

Caller: "Haan aankhen thodi dhasi hain"

AI: "Yeh dehydration ke lakshan hain. 
     Abhi sabse zaroori hai ORS dena.
     Maine aapke phone par ORS banane ka tarika 
     SMS kar diya hai.
     
     Agar 4 ghante mein behtar na ho, ya bachchi 
     sust ho jaye, toh turant hospital le jayein.
     Main 4 ghante baad call karke haal poochhungi."

[PHONE: SMS arrives with ORS preparation instructions in Hindi]
```

### What Makes This Demo Win

1. **Three different paths shown:** Emergency KB (cardiac, snakebite) + General Triage KB (child fever)
2. **Real SMS delivery** during demo — tangible, visible proof
3. **Hospital Dashboard** notification on laptop — shows the innovation layer
4. **Bilingual** — Hindi conversation with English medical terms naturally mixed
5. **Emotion** — mother with sick child, panicked spouse with heart attack
6. **India-specific** — snakebite myth-busting, 108 dispatch, ORS instructions

---

## 9. The Architecture Pitch for Judges

### The 30-Second Pitch

> "VaidyaVaani uses a dual-knowledge-base architecture. Our Emergency Protocol KB contains 15 WHO/ICMR-approved deterministic scripts — the AI retrieves and reads these verbatim with zero hallucination risk. Every script follows the WHO ABCDE prehospital assessment framework, is tagged with ICD-10 codes, and specifies 108 vs 102 dispatch. For non-emergency triage, our General Triage KB uses RAG over 157 ICMR Standard Treatment Workflows. The system classifies intent in under 200ms using keyword matching — not an LLM call — and routes to the appropriate knowledge base. Emergency response: under 1 second. General triage: under 3 seconds."

### Why This Pitch Works

| Element | What It Signals to Judges |
|---------|--------------------------|
| "Dual-knowledge-base architecture" | You thought about system design, not just "plug in an LLM" |
| "Deterministic scripts" | You understand that emergencies need reliability, not creativity |
| "Zero hallucination risk" | You've addressed the #1 concern with medical AI |
| "WHO ABCDE framework" | You know emergency medicine standards |
| "ICD-10 codes" | You understand health data interoperability |
| "108 vs 102 dispatch" | You understand India's ambulance infrastructure |
| "Keyword matching, not an LLM call" | You optimize for latency where it matters |
| "Under 1 second / under 3 seconds" | You have concrete performance targets |

### For the Q&A Round

**Judge: "Why two KBs instead of one?"**
> "In an emergency, we can't afford to search through 200 documents about chronic diabetes when someone is having a heart attack. A 15-document emergency KB gives us sub-100ms retrieval with zero noise. The separation also means we can use different response strategies — deterministic for emergencies, intelligent RAG for triage."

**Judge: "What if the system misclassifies an emergency as non-emergency?"**
> "Three safety nets. First, the General Triage KB continuously monitors for danger signs during conversation — if stroke symptoms appear during a headache triage, we immediately re-route to the Emergency KB. Second, Nova Sonic's emotion detection escalates panicked or distressed callers even without keywords. Third, the caller can press 9 at any time to force emergency mode."

**Judge: "What about hallucination in the triage path?"**
> "The General Triage KB uses Bedrock Guardrails to constrain the AI's responses to retrieved medical content. The AI cannot generate medical advice from its training data — it can only reason over ICMR and WHO protocols retrieved from the knowledge base. For emergencies, hallucination is impossible because the AI reads pre-approved scripts verbatim."

---

## 10. Metadata Approach vs Separate KBs — Trade-off Analysis

### Option A: Two Separate Bedrock Knowledge Bases (RECOMMENDED for Hackathon)

```
S3 Bucket: vaidyavaani-emergency-kb/
  ├── emergency-cardiac.md
  ├── emergency-snakebite.md
  ├── emergency-stroke.md
  └── ... (15 documents)

S3 Bucket: vaidyavaani-triage-kb/
  ├── icmr-stw-fever.pdf
  ├── icmr-stw-diabetes.pdf
  ├── who-imci-child-assessment.md
  └── ... (50-80 documents)

Bedrock KB 1: "Emergency Protocol KB" → Points to emergency S3 bucket
Bedrock KB 2: "General Triage KB" → Points to triage S3 bucket

Lambda Router → Decides which KB to query
```

**Pros:**
- Clean separation — easy to explain to judges
- "Dedicated emergency knowledge base" is a strong talking point
- Slightly faster retrieval on emergency side (smaller index)
- Independent scaling and management
- Can use different chunking strategies per KB
- Easier to audit (all emergency scripts in one place)

**Cons:**
- Two KBs to manage (two S3 buckets, two sync operations)
- Slightly more infrastructure code
- If a document belongs in both (rare), you'd need to duplicate it

### Option B: Single KB with Metadata Filtering

```
S3 Bucket: vaidyavaani-kb/
  ├── emergency-cardiac.md        (metadata: category=emergency)
  ├── emergency-snakebite.md      (metadata: category=emergency)
  ├── icmr-stw-fever.pdf          (metadata: category=triage)
  ├── who-imci-child-assessment.md (metadata: category=triage)
  └── ... (all documents together)

Bedrock KB: "VaidyaVaani KB" → Points to single S3 bucket

Lambda Router → Adds metadata filter to query:
  Emergency: filter = { "category": "emergency" }
  Triage: filter = {} (no filter, search everything)
```

Each document gets metadata tags:
```json
{
  "category": "emergency",
  "severity": "critical",
  "condition": "cardiac",
  "icd10": "I21.9",
  "dispatch": "108",
  "response_type": "deterministic"
}
```

**Pros:**
- One KB to manage (simpler infrastructure)
- Metadata filtering happens before vector search (still fast)
- Flexible — can create new "virtual" categories without new KBs
- Documents can have multiple tags

**Cons:**
- Harder to explain to judges ("we use metadata filtering" vs "we have a dedicated emergency KB")
- Slightly less clean separation
- If metadata is misconfigured, emergency query might pull triage docs
- Single point of failure (if KB goes down, both paths fail)

### The Verdict: Two Separate KBs for Hackathon

| Factor | Two KBs | Single KB + Metadata |
|--------|---------|---------------------|
| **Ease of explanation** | ✅ "Dedicated emergency KB" | ❌ Requires explaining metadata filtering |
| **Judge impression** | ✅ Sounds architecturally sophisticated | 😐 Sounds like a workaround |
| **Implementation time** | 😐 Slightly more setup | ✅ Slightly less setup |
| **Reliability** | ✅ Independent — one can fail without affecting other | ❌ Single point of failure |
| **Performance** | ✅ Emergency KB is tiny = instant retrieval | 😐 Metadata filter adds small overhead |
| **Production readiness** | ✅ Clean separation scales well | ✅ Also scales well |
| **Demo clarity** | ✅ "Watch — this query hits our Emergency KB" | ❌ Less visible in demo |

**Recommendation:** Use two separate Bedrock KBs for the hackathon. The "dedicated emergency knowledge base" narrative is too good to pass up. It's a 2-minute talking point that makes your architecture sound enterprise-grade.

For production, you could migrate to a single KB with metadata filtering if management overhead becomes an issue — but for a hackathon, clarity and demo impact trump infrastructure simplicity.

---

## Summary: The Complete Dual-KB Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                    VaidyaVaani Architecture                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  CALLER → Connect + Nova Sonic → Lambda Router (<200ms)      │
│                                    │                         │
│                    ┌───────────────┴───────────────┐         │
│                    │                               │         │
│                    ▼                               ▼         │
│  ┌──────────────────────┐    ┌──────────────────────────┐   │
│  │  EMERGENCY KB         │    │  GENERAL TRIAGE KB        │   │
│  │  15 docs, <1s         │    │  50-200+ docs, 1-3s       │   │
│  │  Deterministic        │    │  Intelligent RAG           │   │
│  │  ABCDE + ICD-10       │    │  ICMR STWs + WHO          │   │
│  │  108 dispatch         │    │  Follow-up questions       │   │
│  │  Zero hallucination   │    │  102 or "visit PHC"        │   │
│  └──────────┬───────────┘    └──────────┬───────────────┘   │
│             │                           │                    │
│             ▼                           ▼                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              ACTIONS (Parallel)                        │   │
│  │  • 108/102 dispatch    • SMS to family                │   │
│  │  • Hospital Dashboard  • ASHA worker alert            │   │
│  │  • 108 call bridge     • Follow-up scheduling         │   │
│  │  • ICD-10 logging      • Disease surveillance log     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  FALLBACK CHAIN:                                             │
│  Hospital Dashboard → Expand Radius + 108 Bridge → SMS      │
│  (Patient is NEVER left without help)                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Document Counts

| KB | Hackathon | Production |
|----|-----------|------------|
| Emergency Protocol KB | 6 scripts (3 demo + 3 backup) | 15 scripts |
| General Triage KB | 25-35 documents | 200+ documents |
| **Total** | **~35-40 documents** | **~215+ documents** |

### Performance Targets

| Metric | Emergency Path | Triage Path |
|--------|---------------|-------------|
| Intent classification | <200ms | <200ms |
| KB retrieval | <100ms | 200-500ms |
| AI response generation | <200ms (read script) | 500-1500ms (RAG + reasoning) |
| **Total response time** | **<1 second** | **1-3 seconds** |

### The One-Liner

> "Two knowledge bases. One for saving lives in under a second. One for everything else."

---

*This document is part of the VaidyaVaani project documentation for the AI for Bharat 2026 Hackathon.*
*Team: SavyaSachi*
*Created: February 14, 2026*
*Companion document: VaidyaVaani-Data-Sources-Guide.md (what goes in each KB)*
*Related: VaidyaVaani-Enterprise-Readiness.md (enterprise standards, hospital dashboard, circuit breaker)*