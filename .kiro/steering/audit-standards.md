---
inclusion: always
---

# VaidyaVaani Audit Standards

## Project Context

VaidyaVaani is an AI-powered IVR health assistant for rural India. It uses a TypeScript Lambda backend on AWS with Bedrock (Nova Lite, Nova Pro, Nova Micro), DynamoDB, S3, SNS, and Step Functions. The telephony layer is Twilio + Polly (prototype) with a planned migration to Amazon Connect + Nova Sonic (production). The codebase lives under `src/` with Jest + fast-check for testing.

## Audit Thoroughness

When asked to review, audit, or check for improvement, perform a genuine deep-dive across all five dimensions below. Do not default to "looks good" without exhausting each angle. The user relies on you to surface real issues.

### Five Audit Dimensions (check every one)

1. Reliability: edge cases, error paths, fallback behavior, resilience under AWS service failures
2. Feasibility: AWS service limits, cost, latency targets (keyword scan ~5ms, Nova Lite ~150ms), practical blockers
3. Correctness: types match across `models/types.ts`, `models/enums.ts`, and `interfaces/`; logic is sound; tests pass; no contradictions between files
4. Completeness: code, seed scripts (`src/scripts/`), tests (`src/tests/`), design.md, interfaces — nothing missing
5. Spec Alignment: implementation matches `requirements.md` + `design.md` exactly; flag any drift as a bug

## Cross-File Consistency

Changes in service code must be reflected in: `models/types.ts`, `models/enums.ts`, `interfaces/`, `design.md`, and corresponding tests. Spec drift between any of these is a real bug — treat it as one.

## Architecture Patterns

- Interface-first design: every service implements an interface from `src/interfaces/` (e.g., `IIntentRouter`, `ITriageAgent`, `IEmergencyKB`)
- Services live in `src/services/`, one class per file, implementing the matching interface
- Enums and type aliases in `src/models/enums.ts`; complex types in `src/models/types.ts`
- Lambda handlers in `src/lambda/`; wrap with `withErrorHandler` from `src/middleware/errorHandler.ts`
- Emergency path failures must trigger 108 bridge fallback via the error handler
- Static data (emergency scripts, drug database, STD codes) in `src/data/` as TypeScript exports
- Seed scripts in `src/scripts/` as `.mjs` files for DynamoDB seeding
- Structured JSON logging via `src/utils/logger.ts` (suppressed in test via `NODE_ENV=test`)

## Code Style

- TypeScript with `strict: true`, target ES2020, CommonJS modules
- Path alias `@/` maps to `src/` root
- Use union types from `enums.ts` (e.g., `SeverityLevel`, `EmergencyCondition`) — not raw strings
- Confidence threshold is `CONFIDENCE_THRESHOLD` (0.7) from `enums.ts` — never hardcode the value
- Input sanitization via `src/utils/inputSanitizer.ts` before any LLM call
- Bilingual output (Hindi + English) for all patient-facing text using `BilingualInstruction` type

## Testing Standards

- Test framework: Jest with ts-jest preset, tests in `src/tests/` mirroring the source structure
- Property-based testing: fast-check for spec-level correctness properties (not just happy paths)
- Run tests with `npm test` from `src/` (runs `jest --runInBand`)
- Test coverage gaps to check: untested methods, untested patient categories (geriatric, maternal, paediatric, unknown), untested edge cases
- Mock AWS SDK calls with `aws-sdk-client-mock`
- Test setup sets `NODE_ENV=test` via `src/tests/setup.ts`

## Explaining Findings

Use concrete real-world scenarios grounded in the VaidyaVaani caller experience. Example: "A pregnant woman calling about paracetamol safety would hear..." rather than abstract descriptions. Show what a real caller would experience when a bug or gap exists.

## Domain-Specific Rules

- ETL pipeline applies only to General Triage KB (RAG over WHO IMAI/IMCI protocols) — emergency scripts are always handwritten JSON in `src/data/emergencyScripts.ts`
- Drug dosage tables and management workflows belong in the knowledge base
- Nova Micro (`amazon.nova-micro-v1:0`) is the fallback model for LLM-based metadata classification
- Nova Pro (`us.amazon.nova-pro-v1:0`) is the triage assessment model
- Danger sign patterns: a single match escalates to emergency — do not require a count threshold
- Emotion detection (panic/distress) is dead code in the Twilio+Polly prototype — it only activates with Nova Sonic on Amazon Connect (production)
- Keyword scan is limited to utterances of 4 words or fewer to avoid false positives from negations and past-tense references
- Overdose drug queries always route to emergency regardless of `is_emergency` flag
- `pendingDrugQuery` preserves non-overdose drug questions when emergency takes priority
- ICD-10 tagging uses a static lookup in `triageAgent.ts`; fallback code is `R69` (unknown)

## Audit Output

Write audit results to `docs/TASK-AUDIT-REPORT.md`.
