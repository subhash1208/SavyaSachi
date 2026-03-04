# Implementation Plan: VaidyaVaani IVR Health Assistant

## Overview

This plan implements VaidyaVaani as a serverless TypeScript application on AWS. Tasks are ordered to build core infrastructure first (data models, intent routing, emergency scripts), then layer on triage logic, dispatch, location detection, agentic actions, surveillance, and chronic care. Each task builds on previous ones, with property-based tests validating correctness at each stage.

## Tasks

- [ ] 1. Set up project structure and core data models
  - [ ] 1.1 Initialize TypeScript project with Jest and fast-check
    - Create project directory structure: `src/`, `src/models/`, `src/handlers/`, `src/services/`, `src/repositories/`, `src/interfaces/`, `src/middleware/`, `src/utils/`, `tests/`
    - Initialize `package.json` with TypeScript, Jest, fast-check, aws-sdk v3, and aws-sdk-client-mock
    - Configure `tsconfig.json` for Lambda-compatible output (ES2020, CommonJS)
    - Configure Jest with ts-jest preset
    - _Requirements: All_

  - [ ] 1.2 Implement core TypeScript data models, enumerations, and service interfaces
    - Create `src/models/types.ts` with all interfaces: `CallRecord`, `LocationData`, `EmergencyScript`, `TriageResult`, `ClassificationInput`, `IntentResult`, `EmergencyData`, `DispatchResult`, `ChronicCareEnrollment`, `FHIRCondition`, `STDCodeEntry`, `OutbreakAlert`, `MasterExtractionResult`, `DrugInfo`, `PatientProfile`, `ConversationState`
    - Create `src/models/enums.ts` with all enumerations: `Language`, `Voice`, `EmergencyCondition`, `ChronicCondition`, `FacilityLevel`, `ActionType`, `CallPurpose`, `FollowUpPurpose`, `DrugQueryType`
    - Create service interface files in `src/interfaces/`: `IIntentRouter.ts`, `IEmergencyKB.ts`, `IGeneralTriageKB.ts`, `ITriageAgent.ts`, `IEmergencyDispatch.ts`, `ILocationDetector.ts`, `ICallLogger.ts`, `IActionOrchestrator.ts`, `ISmsService.ts`, `IReferralAgent.ts`, `IFollowUpScheduler.ts`, `IASHAWorkerAgent.ts`, `IDiseaseSurveillance.ts`, `IChronicCareAgent.ts`, `IMultimodalVision.ts`, `IHospitalDashboard.ts`, `IDrugKB.ts`, `IConversationStateRepository.ts`
    - Create `src/interfaces/index.ts` barrel file exporting all interfaces
    - Create `src/middleware/errorHandler.ts` with shared `withErrorHandler` wrapper for consistent error responses and emergency fallback
    - _Requirements: All_

  - [ ]* 1.3 Write property test for DTMF key routing
    - **Property 18: DTMF key routing correctness**
    - **Validates: Requirements 1.3**

- [ ] 2. Implement Intent Router and Emergency Keyword Matching
  - [ ] 2.1 Implement Intent Router Lambda handler
    - Create `src/handlers/intentRouter.ts` with `classifyIntent()` function
    - Implement `checkEmergencyKeywords()` with Hindi, English, and Hinglish keyword lists
    - Implement DTMF key 9 override logic
    - Implement emotion detection escalation (panic/distress → emergency)
    - Implement SOS word detection
    - Implement `checkDangerSigns()` for mid-call monitoring
    - Default to general triage when no emergency indicators found
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 2.2 Write property test for intent routing correctness
    - **Property 1: Intent routing correctness**
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.7**

  - [ ]* 2.3 Write property test for danger sign mid-call escalation
    - **Property 2: Danger sign mid-call escalation**
    - **Validates: Requirements 2.6**

  - [ ]* 2.4 Write unit tests for Intent Router
    - Test specific Hindi keywords ("saans nahi aa rahi", "seene mein dard", "saanp ne kaata")
    - Test Hinglish keywords ("breathing problem", "heart attack ho raha hai")
    - Test DTMF 9 override with non-emergency text
    - Test SOS word detection
    - Test emotion detection escalation
    - Test default routing to general triage
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7_

- [ ] 3. Implement Emergency Knowledge Base Scripts and Structure
  - [ ] 3.1 Create Emergency Script data and retrieval service
    - Create `src/services/emergencyKB.ts` with `retrieveEmergencyScript()` and `getABCDEAssessment()`
    - Create `src/data/emergencyScripts.ts` with all 15 emergency scripts following ABCDE structure
    - Each script includes: ICD-10 code, dispatch type (108/102), bilingual instructions (Hindi + English), myth-busting DO NOT actions
    - Implement for hackathon priority conditions: cardiac (I21.9), snakebite (T63.0), child fever/dehydration (A09/E86.0)
    - Include remaining 12 scripts with ABCDE structure
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 3.2 Write property test for emergency script structure completeness
    - **Property 3: Emergency script structure completeness**
    - **Validates: Requirements 3.3, 3.4, 3.5**

  - [ ]* 3.3 Write unit tests for Emergency KB
    - Verify all 15 conditions have scripts
    - Verify cardiac script has correct ICD-10 (I21.9) and dispatch (108)
    - Verify snakebite script includes India NAPSE 2024 myth-busting
    - Verify ABCDE order in each script
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

- [ ] 4. Implement Drug Knowledge Base (DynamoDB structured drug table)
  - [ ] 4.1 Create Drug KB data and retrieval service
    - Create `src/services/drugKB.ts` with `queryDrug()` and `checkOverdose()`
    - Create `src/data/drugDatabase.ts` with NLEM drug entries as structured JSON (hackathon scope: paracetamol, ORS, metformin, amlodipine, cotrimoxazole, amoxicillin, antivenom)
    - Each entry includes: dose_child, dose_adult, max_daily, contraindications, pregnancy_category, renal_adjustment, source
    - `checkOverdose()` returns true for any drug with query_type "overdose" → triggers emergency path immediately
    - Drug queries filtered by `patient_profile.category` and `pregnancy_flag` from MasterExtractionResult
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [ ]* 4.2 Write property test for drug pregnancy filter
    - **Property 19: Drug pregnancy filter correctness**
    - For any drug query with `pregnancy_flag = "confirmed"` or `"possible"`, the response SHALL contain only pregnancy-safe guidance and SHALL NOT contain adult male dosage fields
    - **Validates: Requirements 14.2**

  - [ ]* 4.3 Write property test for drug not-found fallback
    - **Property 20: Drug not-found safe fallback**
    - For any drug name not present in the database, `queryDrug()` SHALL return a result with `not_found: true` and SHALL NOT throw an error or return null
    - **Validates: Requirements 14.4**

- [ ] 5. Checkpoint - Core routing, emergency scripts, and drug KB
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement Location Detection Service
  - [ ] 6.1 Implement 3-tier Location Detector
    - Create `src/services/locationDetector.ts` with `extractSTDCode()`, `parseVoiceLocation()`, `sendGPSLink()`, `receiveGPSCoordinates()`, `resolveLocation()`
    - Create `src/data/stdCodeDatabase.ts` with static fallback entries (used when DynamoDB unavailable)
    - Tier 2 uses two DynamoDB tables: `vaidyavaani-std-codes` (landline STD codes, partition key: `stdCode`) and `vaidyavaani-mobile-circles` (mobile prefix4, partition key: `prefix4`)
    - Landline lookup: try STD code lengths 5→4→3→2, first match wins
    - Mobile lookup: take first 4 digits of 10-digit number, single GetItem on `vaidyavaani-mobile-circles`
    - Seed scripts: `src/scripts/seedStdCodes.mjs` and `src/scripts/seedMobileCircles.mjs` (run once from CloudShell)
    - Implement voice location parsing with regex patterns for village names, city names, landmarks, relative descriptions ("ke paas", "se 20 km")
    - Implement location resolution logic that combines all tiers into best available location
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 6.2 Write property test for STD code mapping
    - **Property 8: STD code mapping correctness**
    - **Validates: Requirements 6.1**

  - [ ]* 6.3 Write property test for voice location parsing
    - **Property 9: Voice location parsing**
    - **Validates: Requirements 6.2**

  - [ ]* 6.4 Write unit tests for Location Detector
    - Test known STD codes: 0755 → Bhopal, 011 → Delhi, 022 → Mumbai, 033 → Kolkata
    - Test landmark descriptions: "railway station ke paas", "primary school ke saamne"
    - Test relative descriptions: "Bhopal se 20 kilometer"
    - Test fallback from Tier 1 to Tier 2 when voice location unavailable
    - _Requirements: 6.1, 6.2, 6.3, 6.6_

- [ ] 7. Implement FHIR Serialization and Call Logger
  - [ ] 7.1 Implement FHIR JSON generator and Call Logger
    - Create `src/services/fhirGenerator.ts` with `generateFHIRRecord()` that converts triage results to FHIR Condition resources with ICD-10 coding
    - Create `src/services/callLogger.ts` with `logCall()`, `storeRecording()`, `redactPII()`, `generateFHIRRecord()`
    - Implement PII redaction for Indian phone numbers (+91-XXXXXXXXXX, 0XXX-XXXXXXX), email addresses, and Aadhaar-like patterns
    - Implement call record validation ensuring all required fields are present
    - _Requirements: 8.1, 8.2, 8.3, 8.7, 4.5_

  - [ ]* 7.2 Write property test for FHIR JSON round-trip
    - **Property 5: FHIR JSON serialization round-trip**
    - **Validates: Requirements 4.5, 8.7**

  - [ ]* 7.3 Write property test for PII redaction
    - **Property 13: PII redaction completeness**
    - **Validates: Requirements 8.3, 9.7**

  - [ ]* 7.4 Write property test for call record completeness
    - **Property 12: Call record completeness**
    - **Validates: Requirements 8.1, 1.5**

- [ ] 8. Checkpoint - Location, logging, and FHIR
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement Triage Agent and Severity Classification
  - [ ] 9.1 Implement Triage Agent service
    - Create `src/services/triageAgent.ts` with `assessSymptoms()`, `generateTreatmentAdvice()`, `tagICD10()`, `determineFacilityLevel()`
    - Implement severity-to-facility mapping: critical → district_hospital/dispatch, urgent → CHC/district_hospital, non-urgent → home/PHC
    - Implement Bedrock API integration for Nova Pro (`us.amazon.nova-pro-v1:0`) with guardrails configuration
    - Implement input sanitization in `src/utils/inputSanitizer.ts` to prevent prompt injection
    - `assessSymptoms()` accepts optional `transcriptHistory: string[]` parameter — when provided, includes full conversation history in the Nova Pro prompt as `CONVERSATION HISTORY` section so the LLM sees all prior caller utterances across turns (multi-turn memory)
    - _Requirements: 4.1, 4.3, 4.4, 4.6, 9.2, 9.3_

  - [ ]* 9.2 Write property test for severity-to-facility mapping
    - **Property 4: Severity-to-facility mapping consistency**
    - **Validates: Requirements 4.4**

  - [ ]* 9.3 Write property test for input sanitization
    - **Property 15: Input sanitization**
    - **Validates: Requirements 9.3**

- [ ] 10. Implement Emergency Dispatch with 3-Layer Fallback
  - [ ] 10.1 Implement Emergency Dispatch Agent
    - Create `src/services/emergencyDispatch.ts` with `executeLayer1()`, `executeLayer2()`, `executeLayer3()`, `bridgeTo108()`
    - Implement hospital selection logic in `src/services/hospitalDashboard.ts` with `getHospitalsInRadius()` using Haversine distance calculation, `blastNotification()`, `acceptPatient()`
    - Implement dispatch message builder that includes ABCDE summary, ICD-10 code, and caller location
    - Implement Layer 1 → Layer 2 → Layer 3 escalation state machine
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 10.2 Write property test for hospital selection within radius
    - **Property 6: Hospital selection within radius**
    - **Validates: Requirements 5.1**

  - [ ]* 10.3 Write property test for dispatch message completeness
    - **Property 7: Dispatch message completeness**
    - **Validates: Requirements 5.6**

  - [ ]* 10.4 Write unit tests for dispatch fallback chain
    - Test Layer 1 hospital acceptance flow
    - Test Layer 1 timeout → Layer 2 escalation
    - Test Layer 2 → Layer 3 escalation
    - Test dispatch message contains all required fields
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [ ] 11. Checkpoint - Triage and dispatch
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Implement Post-Triage Agentic Actions
  - [ ] 12.1 Implement Action Orchestrator and SMS service
    - Create `src/services/actionOrchestrator.ts` with `orchestrateActions()` that triggers all post-triage actions in parallel
    - Create `src/services/smsService.ts` with SMS content generation including triage outcome, treatment instructions, and next steps
    - Create `src/services/referralAgent.ts` with `findNearestFacility()` and `getFacilityCapabilities()` using IPHS facility level data
    - _Requirements: 7.1, 7.4, 7.5, 7.6_

  - [ ]* 12.2 Write property test for SMS content completeness
    - **Property 10: SMS content completeness**
    - **Validates: Requirements 7.1**

  - [ ]* 12.3 Write property test for facility referral level matching
    - **Property 11: Facility referral level matching**
    - **Validates: Requirements 7.4**

  - [ ] 12.4 Implement Follow-Up Scheduler
    - Create `src/services/followUpScheduler.ts` with `scheduleFollowUp()`, `triggerFollowUp()`, `cancelFollowUp()`
    - Integrate with Amazon EventBridge for scheduling
    - Store schedules in DynamoDB
    - _Requirements: 7.2, 7.3_

  - [ ] 12.5 Implement ASHA Worker Agent
    - Create `src/services/ashaWorkerAgent.ts` with `alertASHAWorker()`, `assignChronicCare()`, `sendMonitoringChecklist()`
    - Implement ASHA worker lookup by location (village/block)
    - _Requirements: 7.5, 11.1, 11.2_

- [ ] 13. Implement Disease Surveillance
  - [ ] 13.1 Implement Disease Surveillance Agent
    - Create `src/services/diseaseSurveillance.ts` with `aggregateByConditionAndLocation()`, `detectAnomaly()`, `alertDHO()`
    - Implement spike detection algorithm: flag when call count for a condition+location exceeds threshold within time window
    - Implement outbreak alert generation with geographic heatmap data
    - _Requirements: 8.5, 8.6_

  - [ ]* 13.2 Write property test for outbreak spike detection
    - **Property 14: Outbreak spike detection**
    - **Validates: Requirements 8.5**

- [ ] 14. Implement Chronic Care and Multimodal Vision
  - [ ] 14.1 Implement Chronic Care Agent
    - Create `src/services/chronicCareAgent.ts` with enrollment logic that assigns ASHA workers
    - Implement condition-specific monitoring checklists (diabetes: blood sugar, hypertension: BP, TB: medication adherence)
    - Integrate with ASHA_Worker_Agent for checklist delivery
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [ ]* 14.2 Write property test for chronic care ASHA assignment
    - **Property 16: Chronic care ASHA assignment**
    - **Validates: Requirements 11.1**

  - [ ]* 14.3 Write property test for ASHA checklist condition matching
    - **Property 17: ASHA monitoring checklist condition matching**
    - **Validates: Requirements 11.2**

  - [ ] 14.4 Implement Multimodal Vision Agent
    - Create `src/services/multimodalVision.ts` with `analyzeImage()`, `identifySnakeSpecies()`, `assessWound()`
    - Integrate with Claude Vision via Bedrock API
    - Handle unclear/unprocessable photos gracefully
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 15. Checkpoint - All agents and services
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Wire components together and implement Lambda handlers
  - [ ] 16.1 Implement main IVR call handler Lambda
    - Create `src/handlers/callHandler.ts` as the main entry point for Twilio webhook via API Gateway (prototype) / Amazon Connect contact flows (production)
    - Implement three Twilio webhook endpoints: `/incoming` (Turn 1 — greeting + first Gather), `/gather` (Turn N — process speech/DTMF, advance conversation), `/status` (call end — finalize record, trigger Step Functions)
    - On every `/gather` invocation: load `ConversationState` from DynamoDB by `callSid`, append caller utterance to `transcriptHistory`, process input, save updated state, return next TwiML
    - When calling `triageAgent.assessSymptoms()`, pass `conversationState.transcriptHistory` so Nova Pro sees the full conversation context across turns (multi-turn memory for follow-up style conversations)
    - Wire: call reception → language selection → intent routing → master extraction (cached in ConversationState after Turn 2) → emergency/drug KB/general triage → actions → logging
    - Implement missed call callback handler
    - Implement DTMF handling and voice/DTMF fallback logic
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 4.6_

  - [ ] 16.2 Implement Step Functions state machine definition
    - Create `src/stepfunctions/triageWorkflow.json` defining the parallel action orchestration
    - Wire: triage result → parallel branches (SMS, dispatch, ASHA alert, follow-up, referral, surveillance log)
    - Include error handling and retry logic for each branch
    - _Requirements: 7.6_

  - [ ] 16.3 Implement Hospital Dashboard API handlers
    - Create `src/handlers/hospitalDashboard.ts` with API Gateway handlers for hospital notification and acceptance
    - Wire: emergency dispatch → hospital notification → acceptance callback → caller notification
    - _Requirements: 5.1, 5.2_

  - [ ]* 16.4 Write integration tests for end-to-end call flow
    - Test emergency call: dial → DTMF 9 → emergency script → dispatch → SMS → logging
    - Test non-emergency call: dial → voice input → master extraction → triage → SMS → follow-up → logging
    - Test drug overdose path: voice input → master extraction → overdose detected → emergency path immediately
    - Test drug safety query: voice input → master extraction → drug DB query filtered by patient_profile → response
    - Test mid-call escalation: general triage → danger signs → emergency re-route
    - Test dispatch fallback chain: Layer 1 timeout → Layer 2 → Layer 3
    - _Requirements: All_

- [ ] 17. Final checkpoint - All tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check (minimum 100 iterations)
- Unit tests validate specific examples and edge cases
- The 3 hackathon demo scenarios (heart attack, child fever, disease surveillance) are prioritized in task ordering
- Emergency scripts for cardiac, snakebite, and child fever/dehydration are built first (Task 3) as they are demo-critical
- **DI Pattern:** All service implementations follow the Dependency Injection pattern from the design. Lambda handlers use constructor injection via factory functions (`createHandler(...)`) to receive service instances. Services depend on interfaces from `src/interfaces/`, not concrete implementations. This enables unit testing with mocks and keeps the 3-layer architecture (Handler → Service → Repository) clean.
- **Error Middleware:** All Lambda handlers are wrapped with `withErrorHandler` from `src/middleware/errorHandler.ts` for consistent error logging and emergency fallback behavior.
