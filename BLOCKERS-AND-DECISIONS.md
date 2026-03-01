# Blockers & Decisions Log
**Project:** VaidyaVaani | **Team:** SavyaSachi

---

## BLOCKER #1 — Amazon Connect AISPL Restriction
**Date:** February 28, 2026  
**Status:** WORKAROUND IN PLACE

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

### Decision Made
**Switch to Exotel + Amazon Polly (Kajal voice) instead of Amazon Connect + Nova Sonic**

### Impact
| Feature | Original Plan | Current Plan |
|---------|--------------|--------------|
| IVR Provider | Amazon Connect | Exotel |
| Voice (TTS) | Nova 2 Sonic (Arjun/Kiara) | Amazon Polly (Kajal — Hindi neural) |
| Speech-to-Text | Nova 2 Sonic (unified) | Amazon Transcribe |
| Hinglish support | Native | Limited |
| Cost per call | ₹42 | ₹67 (original architecture) |
| Indian phone number | Yes | Yes |
| AI brain | Claude Sonnet 4.6 | Claude Sonnet 4.6 (unchanged) |
| Call recordings | Auto (Connect) | Exotel + S3 (manual) |
| Contact Lens analytics | Yes | No (use CloudWatch instead) |

### New Architecture
```
Caller → Exotel IVR (Indian number, ₹1/min)
       → Webhook → API Gateway → Lambda (intent router)
       → Amazon Transcribe (STT — voice to text)
       → Amazon Bedrock Claude Sonnet 4.6 (AI triage reasoning)
       → Bedrock Knowledge Base (ICMR/WHO protocols)
       → Amazon Polly - Kajal voice (TTS — text to voice)
       → Lambda → Exotel → speaks response back to caller
       → Amazon SNS (SMS to patient/family/ASHA)
       → DynamoDB (call logging)
```

### Pitch Angle for Judges
> "We integrated with Exotel for the India prototype due to AISPL account 
> restrictions — which is actually more cost-effective at ₹1/min vs Amazon 
> Connect's ₹3.20/min for Indian deployments. The production architecture 
> uses Amazon Connect + Nova 2 Sonic for the unified speech-to-speech 
> experience with native Hindi Arjun/Kiara voices."

### Pending Resolution
- Hack2Skill may provide a standard AWS account → switch back to Connect + Nova Sonic
- If resolved before Mar 2, switch back. If after Mar 2, stay with Exotel for submission.

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


| Item | Owner | Status |
|------|-------|--------|
| Email Hack2Skill about AISPL | Subhash | ✅ Sent |
| Exotel account setup | Subhash | ⬜ Next step |
| WhatsApp Business API | Member 4 | ⬜ In progress |
| AWS billing alarms | Subhash | ⬜ Pending |

---

**Last Updated:** February 28, 2026
