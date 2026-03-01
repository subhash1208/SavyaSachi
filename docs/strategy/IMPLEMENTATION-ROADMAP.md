# VaidyaVaani — Implementation Roadmap
**Team:** SavyaSachi | **Phase:** Prototype (Shortlisted ✅)
**Start:** Feb 27, 2026 | **Deadline:** March 4, 2026 — 11:00 PM IST
**Total Window:** 5 days 14 hours

---

## Submission Requirements (What Judges Need)

| # | Deliverable | Owner | Due |
|---|-------------|-------|-----|
| 1 | Project Summary (write-up) | Member 5 | Mar 3 |
| 2 | Demo Video (YouTube/Drive link) | Member 4 | Mar 3 |
| 3 | GitHub Repository (public, with code) | You | Mar 3 |
| 4 | Live Working URL (prototype to test) | You | Mar 3 |
| 5 | Problem Statement write-up | Member 5 | Mar 3 |

> ⚠️ Submit everything by Mar 3 evening. Don't wait for Mar 4 deadline.

---

## Tech Stack (Confirmed)

| Layer | Service | Purpose |
|-------|---------|---------|
| Voice/IVR | Amazon Connect + Nova 2 Sonic | Receives calls, Hindi/English speech |
| AI Brain | Claude Sonnet 4.6 (Bedrock) | Medical triage reasoning |
| Knowledge | Bedrock Knowledge Bases (2x) | Emergency KB + General Triage KB |
| Compute | AWS Lambda (Node.js 20.x) | Intent router, triage logic, dispatch |
| Orchestration | AWS Step Functions | Parallel actions (SMS + log + dispatch) |
| Database | Amazon DynamoDB | Call logs, patient data, ASHA workers |
| Messaging | Amazon SNS | SMS to patient/family/ASHA worker |
| Storage | Amazon S3 | Docs, recordings, KB source files |
| Scheduling | Amazon EventBridge | Follow-up callbacks |
| API | Amazon API Gateway | WhatsApp webhook, dashboard API |
| Frontend | AWS Amplify | Hospital/surveillance dashboard |
| Monitoring | Amazon CloudWatch | Logs, alarms, metrics |

---

## Team Roles

| Member | Role | Focus Area |
|--------|------|------------|
| **You (Subhash)** | Team Lead + Architect | AWS setup, Connect, integration, final demo |
| **Member 2** | Backend Dev | Lambda functions, Step Functions, DynamoDB |
| **Member 3** | AI/ML Dev | Bedrock agents, KB setup, prompt engineering |
| **Member 4** | Frontend + Video | Dashboard UI, demo video recording |
| **Member 5 (unofficial)** | QA + Docs | Testing, write-ups, GitHub, submission |

---

## What to Build (Priority Order)

```
P0 — MUST HAVE (no submission without these)
├── Amazon Connect IVR + Nova 2 Sonic (Hindi call works)
├── Lambda intent router (emergency vs general)
├── Bedrock triage agent (symptom → advice)
├── SNS SMS (send summary to caller)
├── DynamoDB call logging
├── Live URL (Amplify hosted dashboard)
└── GitHub repo with code

P1 — SHOULD HAVE (makes us competitive)
├── WhatsApp photo path (Claude Vision for wounds/rashes)
├── Disease surveillance dashboard (outbreak detection)
├── ASHA worker SMS alert
└── Emergency SOS mode (say "EMERGENCY" → instant dispatch)

P2 — NICE TO HAVE (makes us win)
├── Chronic care follow-up (weekly check-in calls)
├── Emotion detection routing (panic → escalate)
├── Missed call callback (zero balance users)
└── Regional language demo (Tamil/Telugu via Transcribe+Polly)
```

---

## 5-Day Sprint

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DAY 1 — FEB 27 (TODAY)
  GOAL: AWS foundation + first call answered by AI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  YOU (9 AM - 6 PM):
  ├── 9:00  Kickoff call with team (30 min) — assign tasks, share this doc
  ├── 9:30  AWS Console: activate credits, set billing alarms ($50/$80/$95)
  ├── 10:00 IAM: create vaidyavaani-dev user, share creds with team
  ├── 10:30 Amazon Connect: create instance in ap-south-1 (Mumbai)
  ├── 11:30 Enable Nova 2 Sonic in Connect, configure Arjun/Kiara voices
  ├── 1:00  Create basic contact flow: call → Nova Sonic greeting in Hindi
  ├── 3:00  Wire Connect → Lambda (first Lambda function deployed)
  ├── 5:00  TEST: dial the number, hear Hindi AI response ✅
  └── 6:00  Standup (15 min)

  MEMBER 2 (Backend):
  ├── DynamoDB: create tables (calls, patients, asha_workers)
  ├── Lambda skeleton: triage-handler, sms-sender, call-logger
  └── SNS: create topic for SMS notifications

  MEMBER 3 (AI/ML):
  ├── Bedrock: request model access for Claude Sonnet 4.6
  ├── S3: create bucket, upload ICMR/WHO protocol docs
  └── Create Emergency KB in Bedrock (cardiac, snakebite, child fever)

  MEMBER 4 (Frontend):
  ├── Amplify: create app, set up basic React/HTML project
  ├── Design dashboard wireframe (simple, 1 page)
  └── Apply for WhatsApp Business API (Meta Developer Portal) ← DO THIS TODAY

  MEMBER 5 (QA/Docs):
  ├── GitHub: set up repo structure, push initial code
  ├── Start Project Summary write-up
  └── Start Problem Statement write-up

  ✅ END OF DAY 1: "I can call the number and hear Hindi AI greeting"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DAY 2 — FEB 28
  GOAL: Full triage call works end-to-end + SMS sent
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  YOU:
  ├── 9:00  Review Day 1 output, fix any blockers
  ├── 10:00 Connect → Lambda → Bedrock integration
  ├── 12:00 Step Functions: triage workflow (intake → assess → advise → SMS)
  ├── 2:00  Emergency dispatch flow (critical symptoms → 108 SMS)
  ├── 4:00  End-to-end test: call → triage → SMS received on phone ✅
  └── 6:00  Standup

  MEMBER 2:
  ├── Lambda: symptom intake handler (captures what user says)
  ├── Lambda: emergency classifier (critical vs non-critical)
  ├── Lambda: SMS dispatcher (ORS instructions, emergency alert)
  └── EventBridge: follow-up callback rule (2 hours after call)

  MEMBER 3:
  ├── Bedrock agent: 3 emergency scripts (cardiac, snakebite, child fever)
  ├── General Triage KB: upload 20+ symptom documents
  ├── Test 10 symptom scenarios, tune Hindi responses
  └── Add ORS instructions, first-aid content

  MEMBER 4:
  ├── Dashboard: live call feed (DynamoDB → API Gateway → UI)
  ├── Basic map showing call locations
  └── Alert panel for emergency calls

  MEMBER 5:
  ├── Test Day 1 features, report bugs
  ├── requirements.md — first complete draft
  └── design.md — first complete draft

  ✅ END OF DAY 2: "Full triage call: AI asks questions → gives advice → SMS sent"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DAY 3 — MAR 1
  GOAL: WhatsApp photo path + Disease surveillance
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  YOU:
  ├── 9:00  Review Day 2, fix critical bugs
  ├── 10:00 WhatsApp Business API webhook setup (API Gateway → Lambda)
  ├── 12:00 S3 + Claude Vision: photo → analysis → callback
  ├── 2:00  Disease surveillance Lambda (hourly pattern detection)
  ├── 4:00  Test: send wound photo via WhatsApp → AI calls back ✅
  └── 6:00  Standup

  MEMBER 2:
  ├── Lambda: WhatsApp webhook handler (receive photo, store to S3)
  ├── Lambda: Claude Vision trigger (S3 event → Bedrock Vision)
  ├── Lambda: disease pattern detector (group calls by location+symptom)
  └── DynamoDB: call pattern aggregation queries

  MEMBER 3:
  ├── Claude Vision prompts (wound, rash, snakebite, burn analysis)
  ├── Test with 5 sample images
  ├── ASHA worker alert message templates (Hindi + English)
  └── Tune all Bedrock responses for naturalness

  MEMBER 4:
  ├── Disease surveillance heatmap (QuickSight or Amplify + Chart.js)
  ├── Outbreak alert panel ("23 fever calls from Khedi in 3 days")
  └── Dashboard deployed to live Amplify URL ✅

  MEMBER 5:
  ├── Test Day 2 features (triage, SMS, emergency)
  ├── requirements.md — FINAL, push to GitHub
  └── design.md — FINAL, push to GitHub

  ✅ END OF DAY 3: "WhatsApp photo → Claude Vision → callback with diagnosis"
                   "Live dashboard URL working"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DAY 4 — MAR 2
  GOAL: ASHA integration + full integration test + demo rehearsal
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  YOU:
  ├── 9:00  Review Day 3, fix blockers
  ├── 10:00 ASHA worker lookup + SMS alert integration
  ├── 12:00 Emergency SOS mode ("EMERGENCY" → instant dispatch)
  ├── 2:00  FULL end-to-end test (all 3 demo scenarios)
  ├── 4:00  Bug fixing with full team
  └── 6:00  Demo rehearsal #1 (all 3 scenarios, timed)

  MEMBER 2:
  ├── Lambda: ASHA worker lookup by village/location
  ├── Lambda: chronic care enrollment handler
  ├── EventBridge: weekly check-in scheduler
  └── Performance: Lambda warm-up, DynamoDB indexes

  MEMBER 3:
  ├── Emotion detection routing (panic tone → escalate)
  ├── Missed call callback logic
  ├── Regional language test (Hindi + English confirmed)
  └── Final prompt quality review for all scenarios

  MEMBER 4:
  ├── Dashboard final polish
  ├── ASHA response tracking panel
  ├── Record demo scenario drafts (rough cuts)
  └── Prepare screen recording setup

  MEMBER 5:
  ├── Full regression test of ALL features
  ├── Bug report to team
  ├── Project Summary — FINAL draft
  └── Problem Statement — FINAL draft

  ✅ END OF DAY 4: "All features working, first demo rehearsal done"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DAY 5 — MAR 3
  GOAL: Record demo video + finalize all submission materials
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  YOU:
  ├── 9:00  Final bug fixes from Day 4
  ├── 10:00 Demo run: Scenario 1 — Hindi triage (fever, vomiting)
  ├── 11:00 Demo run: Scenario 2 — WhatsApp photo (wound analysis)
  ├── 12:00 Demo run: Scenario 3 — Disease surveillance dashboard
  ├── 2:00  Record all 3 scenarios (keep backup recordings)
  ├── 4:00  Demo rehearsal #2 — full team, timed (3 min target)
  ├── 6:00  Final review of ALL submission materials
  └── 8:00  SUBMIT on portal ← don't wait for Mar 4

  MEMBER 4:
  ├── Edit demo video (3 min max, add captions)
  ├── Upload to YouTube (unlisted) or Google Drive
  └── Get shareable link

  MEMBER 5:
  ├── Final test run of all features
  ├── Push all docs to GitHub
  ├── Verify GitHub repo is public
  └── Fill submission portal form

  ✅ END OF DAY 5: "SUBMITTED ✅"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DAY 6 — MAR 4 (BUFFER DAY)
  Only if something went wrong on Mar 3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ├── Fix any last-minute issues
  ├── Re-record demo if needed
  └── HARD DEADLINE: 11:00 PM IST — no exceptions
```

---

## 3 Demo Scenarios (What Judges Will See)

```
SCENARIO 1 — Hindi Triage (Core Demo, 60 sec)
  Caller: Worried mother, child has fever + vomiting
  Flow:   Call → Nova Sonic Hindi greeting → AI asks questions
          → ORS advice → ambulance offer → SMS sent to phone
  Shows:  IVR + AI + Agentic (SMS action)

SCENARIO 2 — WhatsApp Photo (Multimodal, 45 sec)
  Caller: Person with infected wound
  Flow:   Call → AI asks "WhatsApp hai?" → user sends photo
          → Claude Vision analyzes → AI calls back with diagnosis
  Shows:  Multimodal AI (voice + vision)

SCENARIO 3 — Disease Surveillance (Dashboard, 30 sec)
  Screen: Live dashboard showing heatmap
  Show:   "23 fever calls from Khedi village in 3 days"
          Auto-alert sent to District Health Officer
  Shows:  Public health intelligence, agentic AI
```

---

## Daily Standup (6 PM, 15 min, mandatory)

```
Each person answers (2 min max):
  1. What did I finish today?
  2. What am I blocked on?
  3. What will I do tomorrow?

You then:
  → Resolve blockers immediately (don't let them sit overnight)
  → Adjust priorities if needed
  → Update this doc
```

---

## Risk Register

| Risk | Chance | Impact | Your Action |
|------|--------|--------|-------------|
| WhatsApp API approval delay | HIGH | HIGH | Apply TODAY, have mock demo ready as backup |
| Nova Sonic Hindi quality poor | MEDIUM | HIGH | Test Day 1, Transcribe+Polly fallback ready |
| Bedrock latency > 3 sec | MEDIUM | MEDIUM | Pre-warm Lambda, use provisioned concurrency |
| Credits run out | LOW | HIGH | Billing alarms at $50/$80/$95 |
| Submission portal down | LOW | HIGH | Submit Mar 3, not Mar 4 |
| Team member unavailable | LOW | HIGH | You know all components, can cover any role |

---

## Minimum Viable Demo (If Everything Goes Wrong)

Even if only P0 works, this is still a strong submission:

```
1. Call the IVR number
2. Speak in Hindi: "Mere bachche ko bukhar hai"
3. AI triages, gives ORS advice in Hindi
4. SMS received on phone with instructions
5. Follow-up call scheduled

= 7/10 submission. Everything else is bonus.
```

---

## GitHub Repo Checklist (Before Submission)

```
├── [ ] /src — all Lambda function code
├── [ ] /frontend — dashboard code
├── [ ] /knowledge-base — medical protocol docs
├── [ ] /infrastructure — CloudFormation/CDK templates
├── [ ] requirements.md
├── [ ] design.md
├── [ ] README.md — updated with live URL + demo video link
└── [ ] Repo is PUBLIC ← verify this
```

---

## Submission Portal Checklist

```
├── [ ] Project Summary (paste from Member 5's write-up)
├── [ ] Demo Video link (YouTube/Drive from Member 4)
├── [ ] GitHub Repository URL
├── [ ] Live Working URL (Amplify URL)
└── [ ] Problem Statement (paste from Member 5's write-up)
```

---

**Last Updated:** February 27, 2026
**Next Review:** February 28 standup
**Status:** Day 1 in progress
