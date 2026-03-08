# VaidyaVaani — Infrastructure & Deployment Guide

## Overview

This document is the single source of truth for provisioning and deploying VaidyaVaani.

**IaC tool:** AWS CDK v2 (TypeScript)  
**Region:** `ap-south-1` (Mumbai) — closest to rural India callers  
**Bedrock models:** `us-east-1` (Nova Pro/Lite/Micro only available there)  
**Telephony:** Twilio + Amazon Polly (prototype)

---

## Part 1 — What CDK Automates

Run once: `cdk deploy` provisions all of the following.

### API Gateway

| Resource | Purpose |
|---|---|
| `vaidyavaani-api-{stage}` | Single REST API. Twilio webhooks + hospital dashboard routes. Regional endpoint. |

Routes wired to Lambdas:

| Route | Method | Lambda |
|---|---|---|
| `/incoming` | POST | CallHandlerFunction |
| `/gather` | POST | CallHandlerFunction |
| `/status` | POST | CallHandlerFunction |
| `/missed-call` | POST | CallHandlerFunction |
| `/hospital/notify` | POST | HospitalDashboardFunction |
| `/hospital/accept` | POST | HospitalDashboardFunction |
| `/hospital/status` | GET | HospitalDashboardFunction |

### Lambda Functions (12 total)

#### API-Facing (2)

| Function | Handler | Timeout | Memory | Purpose |
|---|---|---|---|---|
| `vaidyavaani-call-handler-{stage}` | `dist/handlers/callHandler.handler` | 29s | 1024 MB | Main IVR brain — all 4 Twilio webhook routes |
| `vaidyavaani-hospital-dashboard-{stage}` | `dist/handlers/hospitalDashboard.handler` | 10s | 512 MB | Hospital notification + acceptance API |

#### Step Functions Targets (8)

These have no API Gateway routes. Step Functions invokes them directly.

| Function | Handler | Timeout | Memory | Purpose |
|---|---|---|---|---|
| `vaidyavaani-send-sms-{stage}` | `dist/lambda/sendSms.handler` | 10s | 256 MB | Triage summary SMS via SNS. All 3 SFN branches. |
| `vaidyavaani-emergency-dispatch-{stage}` | `dist/lambda/emergencyDispatch.handler` | 65s | 512 MB | 3-layer hospital dispatch. 65s because Layer 1 has 60s acceptance window. |
| `vaidyavaani-asha-alert-{stage}` | `dist/lambda/ashaAlert.handler` | 10s | 256 MB | ASHA worker SMS alert. Emergency branch only. |
| `vaidyavaani-surveillance-log-{stage}` | `dist/lambda/surveillanceLog.handler` | 10s | 256 MB | Writes lightweight surveillance record. All 3 branches. |
| `vaidyavaani-call-logger-{stage}` | `dist/lambda/callLogger.handler` | 10s | 256 MB | Final step — persists redacted CallRecord to DynamoDB. Always runs. |
| `vaidyavaani-referral-{stage}` | `dist/lambda/referral.handler` | 10s | 256 MB | Nearest facility lookup. General triage branch only. |
| `vaidyavaani-follow-up-{stage}` | `dist/lambda/followUp.handler` | 10s | 256 MB | Creates EventBridge one-time rule for callback. General triage branch only. |
| `vaidyavaani-chronic-care-{stage}` | `dist/lambda/chronicCare.handler` | 10s | 256 MB | Chronic care enrollment. General triage branch, conditional. |

#### Scheduled / Event-Driven (2)

| Function | Handler | Timeout | Memory | Trigger | Purpose |
|---|---|---|---|---|---|
| `vaidyavaani-follow-up-trigger-{stage}` | `dist/lambda/followUpTrigger.handler` | 30s | 512 MB | EventBridge one-time rules (`vv-fu-*`) | Fires when a follow-up schedule matures. Initiates outbound callback. |
| `vaidyavaani-surveillance-batch-{stage}` | `dist/lambda/surveillanceBatch.handler` | 120s | 512 MB | EventBridge cron — every 6 hours | Aggregates call records, detects outbreak spikes, alerts DHOs via SNS. |

### Step Functions

| Resource | Definition | Purpose |
|---|---|---|
| `vaidyavaani-triage-workflow-{stage}` | `src/stepfunctions/triageWorkflow.json` | Post-triage parallel orchestration. Triggered by `/status` webhook after call ends. |

**How CDK wires the Step Functions JSON:**

The existing `triageWorkflow.json` has 8 `${placeholder}` variables for Lambda ARNs. CDK substitutes them at deploy time:

```typescript
const workflow = new sfn.StateMachine(this, 'TriageWorkflow', {
  definitionBody: sfn.DefinitionBody.fromFile(
    '../src/stepfunctions/triageWorkflow.json'
  ),
  definitionSubstitutions: {
    SendSmsLambdaArn:          sendSmsFn.functionArn,
    EmergencyDispatchLambdaArn: emergencyDispatchFn.functionArn,
    ASHAAlertLambdaArn:        ashaAlertFn.functionArn,
    SurveillanceLogLambdaArn:  surveillanceLogFn.functionArn,
    CallLoggerLambdaArn:       callLoggerFn.functionArn,
    ReferralLambdaArn:         referralFn.functionArn,
    FollowUpLambdaArn:         followUpFn.functionArn,
    ChronicCareLambdaArn:      chronicCareFn.functionArn,
  },
});
```

No rewriting the ASL. The JSON file is consumed as-is.

**Step Functions orchestration flow:**

```
Call ends → POST /status → CallHandlerFunction builds payload → sfn.startExecution()
                                                                        │
                                                              ┌─────────┴──────────┐
                                                              │  RouteByTriagePath  │
                                                              └─────────┬──────────┘
                                              ┌──────────────────────────┼──────────────────────────┐
                                              │                          │                          │
                                         emergency                   general                      drug
                                              │                          │                          │
                                   ┌──────────┴──────────┐   ┌──────────┴──────────┐   ┌──────────┴──────────┐
                                   │  Parallel (4 tasks)  │   │  Parallel (5 tasks)  │   │  Parallel (2 tasks)  │
                                   │  ├─ SendSMS          │   │  ├─ Referral         │   │  ├─ SendSMS          │
                                   │  ├─ EmergencyDispatch│   │  ├─ SendSMS          │   │  └─ SurveillanceLog  │
                                   │  ├─ ASHAAlert        │   │  ├─ FollowUp         │   └──────────┬──────────┘
                                   │  └─ SurveillanceLog  │   │  ├─ ChronicCare      │              │
                                   └──────────┬──────────┘   │  └─ SurveillanceLog  │              │
                                              │               └──────────┬──────────┘              │
                                              └──────────────────────────┼──────────────────────────┘
                                                                         │
                                                               ┌─────────┴──────────┐
                                                               │   LogCallRecord     │  ← Always runs last
                                                               └─────────┬──────────┘
                                                                         │
                                                               ┌─────────┴──────────┐
                                                               │  WorkflowComplete   │
                                                               └────────────────────┘
```

All parallel branches use Retry + Catch — one failure does not block others (allSettled semantics).

### DynamoDB Tables (7)

| Table | PK | SK | TTL | Purpose |
|---|---|---|---|---|
| `vaidyavaani-conversation-state` | `callSid` (S) | — | `ttl` (1 hour) | Twilio conversation state between webhook turns |
| `vaidyavaani-calls` | `callId` (S) | — | `ttl` (90 days) | Call records + FHIR (DPDP Act compliance) |
| `vaidyavaani-emergency-scripts` | `condition_id` (S) | `patient_category` (S) | — | Deterministic ABCDE scripts — seeded, not generated |
| `vaidyavaani-std-codes` | `stdCode` (S) | — | — | Landline prefix → city/district/state (~600 entries) |
| `vaidyavaani-mobile-circles` | `prefix4` (S) | — | — | Mobile prefix → telecom circle/state (~2000 entries) |
| `vaidyavaani-emergency-notifications` | `emergencyId` (S) | — | `ttl` (2 hours) | Hospital dashboard — pending emergencies |
| `vaidyavaani-emergency-acceptances` | `acceptanceId` (S) | — | `ttl` (2 hours) | Hospital acceptance records |

All tables: `PAY_PER_REQUEST` billing. `vaidyavaani-calls` and `vaidyavaani-conversation-state` have Point-in-Time Recovery enabled.

### S3

| Bucket | Encryption | Lifecycle | Purpose |
|---|---|---|---|
| `vaidyavaani-recordings-{accountId}-{stage}` | KMS (customer-managed key) | Glacier after 30d, delete after 90d | Call recordings (DPDP Act compliance) |

### KMS

| Key | Alias | Purpose |
|---|---|---|
| Customer-managed key | `alias/vaidyavaani-recordings` | Encrypts S3 recordings bucket |

### SNS

| Topic | Purpose |
|---|---|
| `vaidyavaani-alerts-{stage}` | SMS delivery (triage summaries, ASHA alerts) + DHO outbreak notifications |

Note: SMS to callers uses SNS direct-to-phone (`publish({ PhoneNumber, Message })`), not topic subscriptions. The topic is used for DHO alerts and ASHA worker notifications.

### EventBridge

| Rule | Type | Purpose |
|---|---|---|
| `vv-fu-{callId}-{timestamp}-{counter}` | One-time (dynamic) | Follow-up callback scheduler. Created/deleted by `FollowUpSchedulerService`. |
| `vaidyavaani-surveillance-cron-{stage}` | Rate (every 6 hours) | Triggers `SurveillanceBatchFunction` for outbreak detection. |

CDK grants EventBridge permission to invoke `FollowUpTriggerFunction` for all rules matching `vv-fu-*`.

### IAM (CDK-generated, least-privilege)

CDK's `grant*` methods generate all IAM policies automatically:

```typescript
// Examples of what CDK generates — you don't write these manually
conversationStateTable.grantReadWriteData(callHandlerFn);
emergencyScriptsTable.grantReadData(callHandlerFn);
callsTable.grantReadWriteData(callHandlerFn);
triageWorkflow.grantStartExecution(callHandlerFn);
recordingsBucket.grantReadWrite(callLoggerFn);
alertsTopic.grantPublish(sendSmsFn);
```

---

## Part 2 — What Is Manual (One-Time, Console-Only)

### 1. Bedrock Knowledge Base + OpenSearch Serverless

CDK cannot reliably provision Bedrock KBs. Create once in the Bedrock console:

1. Go to Amazon Bedrock → Knowledge Bases → Create
2. Name: `vaidyavaani-general-triage-kb`
3. Data source: S3 bucket containing `knowledge-base/data/processed_rag/` files
4. Embedding model: Amazon Titan Embeddings v2 (1024 dimensions)
5. Vector store: OpenSearch Serverless (Bedrock creates it automatically)
6. Chunking: Semantic, 512 tokens max, breakpoint threshold 85
7. Parser: Foundation Model as Parser (handles PDFs with flowcharts)
8. After creation, note the **Knowledge Base ID** (format: `XXXXXXXXXX`)
9. Set it as env var on `CallHandlerFunction`: `BEDROCK_KB_ID=<your-kb-id>`

Run ingestion after upload:
```bash
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID>
```

### 2. Bedrock Guardrail

Create once in the Bedrock console:

1. Go to Amazon Bedrock → Guardrails → Create
2. Name: `vaidyavaani-safety-guardrail`
3. Content filters: PROMPT_ATTACK (HIGH input), VIOLENCE (HIGH output), HATE (HIGH both)
4. Denied topics: "Suicide or self-harm", "Illegal drug synthesis"
5. Blocked input message: `"Kripya apni takleef batayein. / Please describe your symptoms."`
6. Blocked output message: `"Kripya doctor se milein. / Please consult a healthcare professional."`
7. Note the **Guardrail ID** and **Guardrail Version**
8. Set as env vars on `CallHandlerFunction`: `BEDROCK_GUARDRAIL_ID=<id>`, `BEDROCK_GUARDRAIL_VERSION=DRAFT`

### 3. Twilio Webhook Configuration

After `cdk deploy` outputs the API Gateway URL:

1. Go to Twilio Console → Phone Numbers → +1 507 776 8060
2. Voice webhook (incoming call): `{API_GATEWAY_URL}/incoming` — HTTP POST
3. Status callback: `{API_GATEWAY_URL}/status` — HTTP POST
4. Save

### 4. DynamoDB Seeding

Tables are created by CDK but data goes in separately. Run from `src/`:

```bash
node scripts/seedEmergencyScripts.mjs
node scripts/seedStdCodes.mjs
node scripts/seedMobileCircles.mjs
```

These are one-time data initialization scripts. Re-run only if you wipe a table.

---

## Part 3 — CDK Project Structure

```
infra/
├── DEPLOYMENT.md          ← this file
├── package.json           ← CDK dependencies
├── tsconfig.json          ← TypeScript config for CDK
├── cdk.json               ← CDK app entry point
└── lib/
    └── vaidyavaani-stack.ts  ← single CDK stack (all resources)
```

The CDK project is separate from `src/` — it has its own `package.json` and `node_modules`. This keeps infra dependencies (aws-cdk-lib) out of the Lambda bundle.

---

## Part 4 — Complete Deploy Sequence

### First-Time Deploy

```bash
# 0. Prerequisites
npm install -g aws-cdk
aws configure  # set credentials + region ap-south-1

# 1. Bootstrap CDK (one-time per AWS account/region)
cd infra
npm install
cdk bootstrap aws://{ACCOUNT_ID}/ap-south-1

# 2. Build application code
cd ../src
npm run build

# 3. Deploy infrastructure
cd ../infra
cdk deploy --require-approval never

# 4. Note outputs from CDK deploy:
#    ApiUrl, IncomingCallUrl, TriageWorkflowArn, RecordingsBucketName, AlertsTopicArn

# 5. Seed DynamoDB tables
cd ../src
node scripts/seedEmergencyScripts.mjs
node scripts/seedStdCodes.mjs
node scripts/seedMobileCircles.mjs

# 6. Manual steps (see Part 2):
#    - Create Bedrock KB, note KB_ID
#    - Create Bedrock Guardrail, note GUARDRAIL_ID
#    - Update Lambda env vars with KB_ID + GUARDRAIL_ID
#    - Point Twilio webhook at IncomingCallUrl
```

### Subsequent Deploys (code changes only)

```bash
cd src && npm run build
cd ../infra && cdk deploy
```

### Destroy Everything

```bash
cd infra && cdk destroy
# Note: S3 bucket with recordings will NOT be auto-deleted (retention policy).
# Delete manually if needed: aws s3 rb s3://vaidyavaani-recordings-{accountId}-dev --force
```

---

## Part 5 — Environment Variables Reference

All env vars are set in the CDK stack. Listed here for reference.

### CallHandlerFunction

| Variable | Source | Value |
|---|---|---|
| `STEP_FUNCTIONS_ARN` | CDK output | `triageWorkflow.stateMachineArn` |
| `BEDROCK_REGION` | CDK param | `us-east-1` |
| `BEDROCK_KB_ID` | Manual (after KB creation) | Bedrock KB ID |
| `BEDROCK_GUARDRAIL_ID` | Manual (after guardrail creation) | Guardrail ID |
| `BEDROCK_GUARDRAIL_VERSION` | Manual | `DRAFT` |
| `AWS_REGION` | Lambda runtime | `ap-south-1` |

### FollowUpFunction

| Variable | Source | Value |
|---|---|---|
| `FOLLOW_UP_LAMBDA_ARN` | CDK output | `followUpTriggerFn.functionArn` |

---

## Part 6 — Cost Estimate (Hackathon Demo Scale)

Assuming ~100 test calls:

| Service | Usage | Estimated Cost |
|---|---|---|
| Lambda | 100 calls × ~10 invocations × 1s avg | ~$0.00 (free tier) |
| DynamoDB | ~1000 reads/writes | ~$0.00 (free tier) |
| Step Functions | 100 executions | ~$0.00 (first 4000 free) |
| Bedrock Nova Lite | 100 calls × ~500 tokens | ~$0.02 |
| Bedrock Nova Pro | 50 calls × ~2000 tokens | ~$0.50 |
| SNS SMS (India) | 50 SMS | ~$0.15 |
| S3 | Negligible | ~$0.00 |
| **Total** | | **~$0.70** |

Well within AWS hackathon credits.
