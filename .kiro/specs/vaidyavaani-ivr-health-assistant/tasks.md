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
    - Create `src/models/types.ts` with all interfaces: `CallRecord`, `LocationData`, `EmergencyScript`, `TriageResult`, `ClassificationInput`, `IntentResult`, `EmergencyData`, `DispatchResult`, `ChronicCareEnrollment`, `FHIRCondition`, `STDCodeEntry`, `OutbreakAlert`
    - Create `src/models/enums.ts` with all enumerations: `Language`, `Voice`, `EmergencyCondition`, `ChronicCondition`, `FacilityLevel`, `ActionType`, `CallPurpose`, `FollowUpPurpose`
    - Create service interface files in `src/interfaces/`: `IIntentRouter.ts`, `IEmergencyKB.ts`, `IGeneralTriageKB.ts`, `ITriageAgent.ts`, `IEmergencyDispatch.ts`, `ILocationDetector.ts`, `ICallLogger.ts`, `IActionOrchestrator.ts`, `ISmsService.ts`, `IReferralAgent.ts`, `IFollowUpScheduler.ts`, `IASHAWorkerAgent.ts`, `IDiseaseSurveillance.ts`, `IChronicCareAgent.ts`, `IMultimodalVision.ts`, `IHospitalDashboard.ts`
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

- [ ] 4. Checkpoint - Core routing and emergency scripts
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement Location Detection Service
  - [ ] 5.1 Implement 3-tier Location Detector
    - Create `src/services/locationDetector.ts` with `extractSTDCode()`, `parseVoiceLocation()`, `sendGPSLink()`, `receiveGPSCoordinates()`, `resolveLocation()`
    - Create `src/data/stdCodeDatabase.ts` with 600+ Indian STD code mappings (city, state, district)
    - Implement voice location parsing with regex patterns for village names, city names, landmarks, relative descriptions ("ke paas", "se 20 km")
    - Implement location resolution logic that combines all tiers into best available location
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 5.2 Write property test for STD code mapping
    - **Property 8: STD code mapping correctness**
    - **Validates: Requirements 6.1**

  - [ ]* 5.3 Write property test for voice location parsing
    - **Property 9: Voice location parsing**
    - **Validates: Requirements 6.2**

  - [ ]* 5.4 Write unit tests for Location Detector
    - Test known STD codes: 0755 → Bhopal, 011 → Delhi, 022 → Mumbai, 033 → Kolkata
    - Test landmark descriptions: "railway station ke paas", "primary school ke saamne"
    - Test relative descriptions: "Bhopal se 20 kilometer"
    - Test fallback from Tier 1 to Tier 2 when voice location unavailable
    - _Requirements: 6.1, 6.2, 6.3, 6.6_

- [ ] 6. Implement FHIR Serialization and Call Logger
  - [ ] 6.1 Implement FHIR JSON generator and Call Logger
    - Create `src/services/fhirGenerator.ts` with `generateFHIRRecord()` that converts triage results to FHIR Condition resources with ICD-10 coding
    - Create `src/services/callLogger.ts` with `logCall()`, `storeRecording()`, `redactPII()`, `generateFHIRRecord()`
    - Implement PII redaction for Indian phone numbers (+91-XXXXXXXXXX, 0XXX-XXXXXXX), email addresses, and Aadhaar-like patterns
    - Implement call record validation ensuring all required fields are present
    - _Requirements: 8.1, 8.2, 8.3, 8.6, 4.5_

  - [ ]* 6.2 Write property test for FHIR JSON round-trip
    - **Property 5: FHIR JSON serialization round-trip**
    - **Validates: Requirements 4.5, 8.6**

  - [ ]* 6.3 Write property test for PII redaction
    - **Property 13: PII redaction completeness**
    - **Validates: Requirements 8.3, 9.7**

  - [ ]* 6.4 Write property test for call record completeness
    - **Property 12: Call record completeness**
    - **Validates: Requirements 8.1, 1.5**

- [ ] 7. Checkpoint - Location, logging, and FHIR
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement Triage Agent and Severity Classification
  - [ ] 8.1 Implement Triage Agent service
    - Create `src/services/triageAgent.ts` with `assessSymptoms()`, `generateTreatmentAdvice()`, `tagICD10()`, `determineFacilityLevel()`
    - Implement severity-to-facility mapping: critical → district_hospital/dispatch, urgent → CHC/district_hospital, non-urgent → home/PHC
    - Implement Bedrock API integration for Claude 3.5 Sonnet with guardrails configuration
    - Implement input sanitization in `src/utils/inputSanitizer.ts` to prevent prompt injection
    - _Requirements: 4.3, 4.4, 9.2, 9.3_

  - [ ]* 8.2 Write property test for severity-to-facility mapping
    - **Property 4: Severity-to-facility mapping consistency**
    - **Validates: Requirements 4.4**

  - [ ]* 8.3 Write property test for input sanitization
    - **Property 15: Input sanitization**
    - **Validates: Requirements 9.3**

- [ ] 9. Implement Emergency Dispatch with 3-Layer Fallback
  - [ ] 9.1 Implement Emergency Dispatch Agent
    - Create `src/services/emergencyDispatch.ts` with `executeLayer1()`, `executeLayer2()`, `executeLayer3()`, `bridgeTo108()`
    - Implement hospital selection logic in `src/services/hospitalDashboard.ts` with `getHospitalsInRadius()` using Haversine distance calculation, `blastNotification()`, `acceptPatient()`
    - Implement dispatch message builder that includes ABCDE summary, ICD-10 code, and caller location
    - Implement Layer 1 → Layer 2 → Layer 3 escalation state machine
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 9.2 Write property test for hospital selection within radius
    - **Property 6: Hospital selection within radius**
    - **Validates: Requirements 5.1**

  - [ ]* 9.3 Write property test for dispatch message completeness
    - **Property 7: Dispatch message completeness**
    - **Validates: Requirements 5.6**

  - [ ]* 9.4 Write unit tests for dispatch fallback chain
    - Test Layer 1 hospital acceptance flow
    - Test Layer 1 timeout → Layer 2 escalation
    - Test Layer 2 → Layer 3 escalation
    - Test dispatch message contains all required fields
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [ ] 10. Checkpoint - Triage and dispatch
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement Post-Triage Agentic Actions
  - [ ] 11.1 Implement Action Orchestrator and SMS service
    - Create `src/services/actionOrchestrator.ts` with `orchestrateActions()` that triggers all post-triage actions in parallel
    - Create `src/services/smsService.ts` with SMS content generation including triage outcome, treatment instructions, and next steps
    - Create `src/services/referralAgent.ts` with `findNearestFacility()` and `getFacilityCapabilities()` using IPHS facility level data
    - _Requirements: 7.1, 7.4, 7.5, 7.6_

  - [ ]* 11.2 Write property test for SMS content completeness
    - **Property 10: SMS content completeness**
    - **Validates: Requirements 7.1**

  - [ ]* 11.3 Write property test for facility referral level matching
    - **Property 11: Facility referral level matching**
    - **Validates: Requirements 7.4**

  - [ ] 11.4 Implement Follow-Up Scheduler
    - Create `src/services/followUpScheduler.ts` with `scheduleFollowUp()`, `triggerFollowUp()`, `cancelFollowUp()`
    - Integrate with Amazon EventBridge for scheduling
    - Store schedules in DynamoDB
    - _Requirements: 7.2, 7.3_

  - [ ] 11.5 Implement ASHA Worker Agent
    - Create `src/services/ashaWorkerAgent.ts` with `alertASHAWorker()`, `assignChronicCare()`, `sendMonitoringChecklist()`
    - Implement ASHA worker lookup by location (village/block)
    - _Requirements: 7.5, 11.1, 11.2_

- [ ] 12. Implement Disease Surveillance
  - [ ] 12.1 Implement Disease Surveillance Agent
    - Create `src/services/diseaseSurveillance.ts` with `aggregateByConditionAndLocation()`, `detectAnomaly()`, `alertDHO()`
    - Implement spike detection algorithm: flag when call count for a condition+location exceeds threshold within time window
    - Implement outbreak alert generation with geographic heatmap data
    - _Requirements: 8.4, 8.5_

  - [ ]* 12.2 Write property test for outbreak spike detection
    - **Property 14: Outbreak spike detection**
    - **Validates: Requirements 8.4**

- [ ] 13. Implement Chronic Care and Multimodal Vision
  - [ ] 13.1 Implement Chronic Care Agent
    - Create `src/services/chronicCareAgent.ts` with enrollment logic that assigns ASHA workers
    - Implement condition-specific monitoring checklists (diabetes: blood sugar, hypertension: BP, TB: medication adherence)
    - Integrate with ASHA_Worker_Agent for checklist delivery
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [ ]* 13.2 Write property test for chronic care ASHA assignment
    - **Property 16: Chronic care ASHA assignment**
    - **Validates: Requirements 11.1**

  - [ ]* 13.3 Write property test for ASHA checklist condition matching
    - **Property 17: ASHA monitoring checklist condition matching**
    - **Validates: Requirements 11.2**

  - [ ] 13.4 Implement Multimodal Vision Agent
    - Create `src/services/multimodalVision.ts` with `analyzeImage()`, `identifySnakeSpecies()`, `assessWound()`
    - Integrate with Claude Vision via Bedrock API
    - Handle unclear/unprocessable photos gracefully
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 14. Checkpoint - All agents and services
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Wire components together and implement Lambda handlers
  - [ ] 15.1 Implement main IVR call handler Lambda
    - Create `src/handlers/callHandler.ts` as the main entry point for Amazon Connect contact flows
    - Wire: call reception → language selection → intent routing → triage → actions → logging
    - Implement missed call callback handler
    - Implement DTMF handling and voice/DTMF fallback logic
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ] 15.2 Implement Step Functions state machine definition
    - Create `src/stepfunctions/triageWorkflow.json` defining the parallel action orchestration
    - Wire: triage result → parallel branches (SMS, dispatch, ASHA alert, follow-up, referral, surveillance log)
    - Include error handling and retry logic for each branch
    - _Requirements: 7.6_

  - [ ] 15.3 Implement Hospital Dashboard API handlers
    - Create `src/handlers/hospitalDashboard.ts` with API Gateway handlers for hospital notification and acceptance
    - Wire: emergency dispatch → hospital notification → acceptance callback → caller notification
    - _Requirements: 5.1, 5.2_

  - [ ]* 15.4 Write integration tests for end-to-end call flow
    - Test emergency call: dial → DTMF 9 → emergency script → dispatch → SMS → logging
    - Test non-emergency call: dial → voice input → triage → SMS → follow-up → logging
    - Test mid-call escalation: general triage → danger signs → emergency re-route
    - Test dispatch fallback chain: Layer 1 timeout → Layer 2 → Layer 3
    - _Requirements: All_

- [ ] 16. Final checkpoint - All tests pass
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
