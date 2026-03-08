# Blockers & Decisions Log
**Project:** VaidyaVaani | **Team:** SavyaSachi

---

## BLOCKER #1 — Amazon Connect AISPL Restriction
**Date:** February 28, 2026  
**Status:** RESOLVED — FINAL WORKAROUND: TWILIO (see update below)

### What Happened
AWS account is AISPL (Amazon Internet Services Private Limited — India's AWS subsidiary).
Amazon Connect is NOT available on AISPL accounts. Attempted to create a new standard AWS
account with US address but Indian Visa/Mastercard cards were declined. PayPal not accepted
by AWS. Wise required $20 minimum top-up which was not feasible.

### What We Tried
- ❌ Create Connect instance on AISPL account — blocked by AWS restriction
- ❌ New AWS account with US address — Indian cards declined
- ❌ Wise virtual card — $20 minimum top-up required
- ❌ PayPal — not accepted by AWS
- ✅ Emailed Hack2Skill support (support@hack2skill.com) — awaiting response
- ❌ Exotel — set up initially, abandoned due to poor developer UI and webhook complexity

### Initial Decision (Abandoned)
~~Switch to Exotel + Amazon Polly (Kajal voice)~~ — tried and abandoned. Exotel UI was
difficult to work with and the ExoML webhook format added unnecessary complexity.

### Final Decision (CURRENT — March 1, 2026)
**Switch to Twilio + Amazon Polly (Aditi voice)**

Twilio trial account created. Number obtained: **+1 507 776 8060** ($15.50 trial credits).
Twilio uses TwiML (standard XML) which is simpler to work with than ExoML.
Voice: Amazon Polly **Aditi** (Hindi neural) — referenced via `<Say voice="Polly.Aditi">` in TwiML.

### Final Architecture (CURRENT)
```
Caller → Twilio IVR (+1 507 776 8060, TwiML)
       → Webhook → API Gateway → Lambda (vaidyavaani-exotel-webhook, Node.js 20.x ESM)
       → Amazon Transcribe (STT — voice to text)
       → Amazon Bedrock Nova Pro (AI triage reasoning, us.amazon.nova-pro-v1:0)
       → Bedrock Knowledge Base (ICMR/WHO protocols)
       → Amazon Polly - Aditi voice (TTS — Hindi neural)
       → Lambda returns TwiML → Twilio speaks response back to caller
       → Amazon SNS (SMS to patient/family/ASHA)
       → DynamoDB (call logging)
```

### API Gateway URL
`https://lur01vchk8.execute-api.us-east-1.amazonaws.com/default/vaidyavaani-exotel-webhook`

### Impact vs Original Plan
| Feature | Original Plan | Current Plan |
|---------|--------------|--------------|
| IVR Provider | Amazon Connect | Twilio (+1 507 776 8060) |
| Voice (TTS) | Nova 2 Sonic (Arjun/Kiara) | Amazon Polly (Aditi — Hindi neural) |
| Speech-to-Text | Nova 2 Sonic (unified) | Amazon Transcribe |
| AI model | Claude Sonnet 4.6 | Nova Pro 1.0 (AISPL blocker — see Blocker #2) |
| Hinglish support | Native | Limited |
| Indian phone number | Yes | No (US trial number — demo only) |
| Call recordings | Auto (Connect) | Twilio + S3 (manual) |
| Contact Lens analytics | Yes | No (use CloudWatch instead) |

### Pitch Angle for Judges
> "We used Twilio for the prototype IVR due to AISPL account restrictions on Amazon Connect.
> The production architecture uses Amazon Connect + Nova 2 Sonic for the unified
> speech-to-speech experience with native Hindi Arjun/Kiara voices and Indian toll-free numbers."

---

## BLOCKER #2 — Claude Sonnet 4.6 AISPL Payment Block
**Date:** February 28, 2026
**Status:** WORKAROUND IN PLACE

### What Happened
Claude Sonnet 4.6 requires AWS Marketplace subscription which needs a valid international payment instrument. AISPL accounts cannot complete this subscription.

### Decision Made
**Use Amazon Nova Pro 1.0 for triage.** Claude Sonnet 4.6 requires AWS Marketplace subscription which is blocked on AISPL regardless of IAM permissions. Nova Pro tested and working — correct Hindi triage responses, 2.4s latency, clinically accurate decisions. Model ID: `us.amazon.nova-pro-v1:0`

In the pitch: "Prototype uses Amazon Nova Pro. Production architecture uses Claude Sonnet 4.6 — blocked on AISPL account during hackathon."

---

## DECISION #1 — Emergency Path Architecture
**Date:** February 28, 2026
**Status:** DECIDED

### Decision
Emergency path uses **DynamoDB deterministic scripts** (not Bedrock KB).
General triage path uses **Bedrock KB with metadata filtering**.
Both paths unified via a single **Nova Lite Master Extraction** call (~150ms).

### Architecture
```
Stage 1: Keyword scan (5ms, Lambda) → catches 80% of emergencies
Stage 2: Nova Lite master extraction (150ms) → routes both paths
  → is_emergency=true  → DynamoDB GetItem (5ms) → read script verbatim
  → is_emergency=false → Bedrock KB + metadata filter → Nova Pro triage
```

### DynamoDB Emergency Scripts Table
- Primary key: condition_id
- Sort key: patient_category
- Hackathon scope: cardiac, snakebite, child_fever, breathing_difficulty

---

## KNOWN LIMITATION #1 — Emotion Detection Not Available in Prototype
**Date:** March 2, 2026
**Status:** KNOWN LIMITATION — prototype workaround in place

### What Happened
The design specifies emotion detection (panic/distress from voice tone) via Amazon Nova 2 Sonic + Amazon Connect. Both are blocked on AISPL. Twilio transcribes speech to plain text — no audio stream analysis, no tone detection.

### Impact
`emotionResult` field in `ClassificationInput` is never populated in the prototype. The emotion escalation branch in `classifyIntent()` never fires.

### Prototype Workaround
Nova Lite extracts `severity_signal: "critical|urgent|mild"` from the utterance text. If `severity_signal = "critical"` is returned, the call handler treats it as a high-urgency signal. This detects urgency in words, not panic in voice — a reasonable text-based approximation.

### Production Fix
Amazon Connect + Nova 2 Sonic handles emotion detection natively from the audio stream. No code change needed — just populate `emotionResult` from the Connect contact flow event.

---
|------|-------|--------|
| Email Hack2Skill about AISPL | Subhash | ✅ Sent |
| Exotel account setup | Subhash | ✅ Abandoned — switched to Twilio |
| Twilio account + number | Subhash | ✅ Done (+1 507 776 8060) |
| WhatsApp Business API | Member 4 | ⬜ In progress |
| AWS billing alarms | Subhash | ⬜ Pending |

---

## KNOWN LIMITATION #2 — chronicCareEnrollment Lost on Dropped Calls
**Date:** March 8, 2026
**Status:** KNOWN LIMITATION — no retry in prototype

### What Happens
`state.chronicCareEnrollment` is written to DynamoDB `ConversationState` during `handleGather`
(when Nova Pro detects a chronic condition like diabetes or hypertension).  
It is **only acted on** in `handleStatus` (call-end webhook from Twilio).  
If the call drops before the `/status` callback fires (low-signal area, Twilio timeout, Lambda cold
start), the state record is never deleted but `handleStatus` is never called — the enrollment
action is permanently lost.

### Impact
A diabetic patient in a low-connectivity village who gets triaged AND then drops the call never gets
enrolled in the chronic care follow-up programme. The system has no way to detect the missed enrollment.

### Prototype Workaround
None in prototype. Data is in DynamoDB with TTL=1h; a manual reconciliation scan could recover it.

### Production Fix
1. Use a DynamoDB Stream trigger: on TTL expiry of a record with non-null `chronicCareEnrollment`,
   fire a Step Functions execution to complete the enrollment.
2. Or use Twilio's `statusCallbackEvent=completed` with a retry webhook — Twilio retries the
   status callback up to 3 times if the Lambda returns non-2xx.

---

**Last Updated:** March 8, 2026
