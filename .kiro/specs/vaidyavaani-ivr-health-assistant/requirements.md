# Requirements Document

## Introduction

VaidyaVaani (वैद्यवाणी - "Doctor's Voice") is an AI-powered IVR health assistant designed for India's AI for Bharat 2026 Hackathon (Team: SavyaSachi). The system enables any Indian citizen to call from any phone (feature phone, smartphone, or landline) to receive instant health triage, symptom assessment, and emergency dispatch in Hindi or English, 24/7, without requiring internet access or literacy. The system uses a dual knowledge base architecture — a deterministic Emergency Protocol KB with zero hallucination risk and an intelligent RAG-based General Triage KB — powered entirely by AWS services including Amazon Connect, Amazon Nova 2 Sonic (speech-to-speech with Indian-accented voices), Amazon Bedrock (Claude 3.5 Sonnet), and AWS Step Functions for agentic orchestration. The prototype is built in a 3-tier strategy over 20 days post-shortlist, targeting 3 demo scenarios: heart attack emergency, child fever/dehydration, and disease surveillance dashboard.

## Glossary

- **IVR_System**: The Interactive Voice Response system built on Amazon Connect that receives and manages incoming phone calls via a toll-free number
- **Intent_Router**: A Lambda-based keyword/pattern matching component that classifies caller intent and routes to the appropriate knowledge base within 200ms (not an LLM call)
- **Emergency_KB**: The Emergency Protocol Knowledge Base containing ~15 hand-crafted, deterministic emergency scripts following the WHO ABCDE framework, tagged with ICD-10 codes, with zero hallucination risk and response time under 1 second
- **General_Triage_KB**: The General Triage Knowledge Base containing 50-200+ medical protocol documents using RAG over ICMR STWs, WHO IMAI/IMCI guidelines, and other government-approved sources, with response time of 1-3 seconds
- **Speech_Engine**: Amazon Nova 2 Sonic providing unified speech-to-speech AI with Indian-accented voices (Arjun male voice / Kiara female voice) for Hindi and English, bundled within Amazon Connect
- **Triage_Agent**: The AI agent powered by Amazon Bedrock (Claude 3.5 Sonnet) that assesses symptom severity using ICMR/WHO protocols
- **Emergency_Dispatch_Agent**: The agent responsible for triggering 108 ambulance dispatch with ABCDE assessment data and executing the 3-layer fallback chain
- **Action_Orchestrator**: AWS Step Functions workflow that coordinates agentic actions (SMS, dispatch, alerts, follow-ups) in parallel
- **Hospital_Dashboard**: A web interface (hosted on AWS Amplify) that blasts emergency notifications to nearby hospitals for bed acceptance confirmation
- **Location_Detector**: A 3-tier system for determining caller location: Tier 1 voice input (village/landmark level, 85-90% capture), Tier 2 phone prefix/STD code (district/city level, 100% capture), Tier 3 SMS GPS link (GPS-level, smartphones only)
- **Follow_Up_Scheduler**: Amazon EventBridge-based component that schedules callback appointments for patient status checks
- **Call_Logger**: DynamoDB-based component that records call metadata, triage outcomes, ICD-10 codes, and location data
- **Disease_Surveillance_Agent**: Component that detects anomalous spikes in specific conditions within geographic clusters from aggregated call data and flags potential outbreaks
- **ASHA_Worker_Agent**: Component that alerts Accredited Social Health Activists (frontline community health workers) in the caller's area for critical cases
- **Chronic_Care_Agent**: Component that enrolls chronic condition patients (diabetes, hypertension, TB) and assigns ASHA workers for ongoing monitoring and follow-up
- **Multimodal_Vision_Agent**: Component that analyzes photos sent via WhatsApp using Claude Vision for visual assessment (snake identification, skin conditions, wound analysis)
- **Referral_Agent**: Component that identifies the nearest appropriate healthcare facility (PHC, CHC, or District Hospital) based on condition severity, facility capabilities (per IPHS guidelines), and caller location
- **ABCDE_Framework**: WHO prehospital assessment protocol (Airway → Breathing → Circulation → Disability → Exposure) used to structure all emergency scripts
- **DTMF**: Dual-Tone Multi-Frequency signaling used for keypad input on phones
- **ICD-10**: International Classification of Diseases, 10th Revision, used for diagnosis coding and ABDM interoperability
- **FHIR**: Fast Healthcare Interoperability Resources standard for health data exchange
- **ABHA_ID**: Ayushman Bharat Health Account identifier for digital health records
- **ASHA_Worker**: Accredited Social Health Activist — frontline community health workers in India's public health system
- **Caller**: Any person who dials the VaidyaVaani toll-free number from any phone (feature phone, smartphone, or landline)
- **DPDP_Act**: Digital Personal Data Protection Act 2023, India's data privacy legislation
- **STD_Code**: Subscriber Trunk Dialing code — area code prefix in Indian phone numbers used for district/city-level location detection

## Requirements

### Requirement 1: Receive and Handle Incoming Calls via IVR

**User Story:** As a Caller, I want to reach VaidyaVaani by dialing a toll-free number from any phone, so that I can access health assistance regardless of my phone type, internet connectivity, or literacy level.

#### Acceptance Criteria

1. WHEN a Caller dials the toll-free number, THE IVR_System SHALL answer the call and play a welcome greeting in Hindi with an option to switch to English (press 2) or other regional languages
2. WHEN a Caller is connected, THE Speech_Engine SHALL process voice input and generate responses using Indian-accented voices (Arjun or Kiara) in Hindi or English
3. WHEN a Caller presses a DTMF key during the call, THE IVR_System SHALL interpret the keypress and route accordingly (press 2 for English, press 9 for emergency)
4. IF the Speech_Engine fails to process audio input, THEN THE IVR_System SHALL fall back to DTMF-based menu navigation and inform the Caller of the fallback mode
5. WHEN a call is received, THE Call_Logger SHALL record the call start time, caller phone number (redacted for privacy), and call source type in DynamoDB
6. WHEN a Caller initiates a missed call to the toll-free number, THE IVR_System SHALL call the Caller back automatically to provide zero-cost access for users with no phone balance

### Requirement 2: Classify Caller Intent and Route to Knowledge Base

**User Story:** As a Caller, I want the system to quickly understand whether my situation is an emergency or a general health question, so that I receive the appropriate level of response without delay.

#### Acceptance Criteria

1. WHEN the Caller provides voice input, THE Intent_Router SHALL classify the intent using keyword and pattern matching within 200 milliseconds without using an LLM call
2. WHEN the Intent_Router detects emergency keywords in Hindi, English, or Hinglish (e.g., "heart attack", "saans nahi aa rahi", "saanp ne kaata", "seene mein dard"), THE Intent_Router SHALL route the call to the Emergency_KB
3. WHEN the Caller presses DTMF key 9, THE Intent_Router SHALL immediately route the call to the Emergency_KB regardless of other input
4. WHEN the Speech_Engine detects panic or distress in the Caller's voice through Nova 2 Sonic emotion detection, THE Intent_Router SHALL escalate the call to the Emergency_KB
5. WHEN no emergency indicators are detected, THE Intent_Router SHALL route the call to the General_Triage_KB for standard symptom assessment
6. WHILE the General_Triage_KB is conducting a triage conversation, THE Intent_Router SHALL continuously monitor for danger signs and re-route to the Emergency_KB mid-call if danger signs appear (e.g., stroke symptoms appearing during a headache triage)
7. WHEN the Caller speaks a single emergency activation word (Emergency SOS mode), THE Intent_Router SHALL immediately route to the Emergency_KB and begin the ABCDE assessment

### Requirement 3: Provide Emergency Triage via Deterministic Protocols

**User Story:** As a Caller experiencing a medical emergency, I want to receive immediate, accurate, life-saving instructions, so that I or my family member can receive first aid while help is dispatched.

#### Acceptance Criteria

1. WHEN the call is routed to the Emergency_KB, THE Triage_Agent SHALL retrieve and deliver the matching emergency script within 1 second total response time
2. THE Emergency_KB SHALL contain pre-approved, hand-crafted deterministic scripts for each of the 15 emergency conditions: cardiac arrest, stroke, snakebite, severe bleeding, choking, burns, poisoning, allergic reaction (anaphylaxis), seizure, pregnancy emergency, drowning, breathing difficulty, unconsciousness, infant not breathing, and heatstroke
3. WHEN delivering an emergency script, THE Triage_Agent SHALL follow the WHO ABCDE framework sequence (Airway, Breathing, Circulation, Disability, Exposure) and ask condition-specific assessment questions in Hindi or English
4. WHEN an emergency script is delivered, THE Triage_Agent SHALL provide bilingual (Hindi and English) first-aid instructions and myth-busting guidance to counter harmful rural practices (e.g., "Tourniquet mat lagaiye" for snakebite)
5. WHEN an emergency is confirmed, THE Triage_Agent SHALL tag the diagnosis with the appropriate ICD-10 code and specify 108 (emergency response with paramedic) vs 102 (patient transport) dispatch type
6. THE Emergency_KB SHALL deliver scripts verbatim from pre-approved content with zero AI-generated text to eliminate hallucination risk

### Requirement 4: Provide General Health Triage via Intelligent RAG

**User Story:** As a Caller with a non-emergency health concern, I want to receive an accurate symptom assessment and treatment guidance based on government-approved medical protocols, so that I know what to do and where to go for care.

#### Acceptance Criteria

1. WHEN the call is routed to the General_Triage_KB, THE Triage_Agent SHALL retrieve relevant medical protocol chunks and generate a response within 3 seconds total response time
2. THE General_Triage_KB SHALL source its content from ICMR Standard Treatment Workflows (157 STWs across 28 specialties), WHO IMAI (adult triage), WHO IMCI (childhood illness), and other government-approved medical data sources
3. WHEN conducting general triage, THE Triage_Agent SHALL ask follow-up questions to narrow down the symptom assessment using a "diagnosis by exclusion" approach before providing guidance
4. WHEN triage is complete, THE Triage_Agent SHALL provide a severity classification and recommend an appropriate care level (home care with instructions, visit PHC, visit CHC, or visit District Hospital) based on IPHS facility capability guidelines
5. WHEN triage is complete, THE Triage_Agent SHALL tag the assessment with the appropriate ICD-10 code and store it in FHIR JSON format for ABDM interoperability

### Requirement 5: Dispatch Emergency Response with 3-Layer Fallback

**User Story:** As a Caller in a life-threatening emergency, I want the system to dispatch help immediately and guarantee that I am never left without assistance, so that an ambulance or hospital response reaches me as fast as possible.

#### Acceptance Criteria

1. WHEN an emergency is confirmed, THE Emergency_Dispatch_Agent SHALL execute Layer 1 by sending notifications to the 3 nearest hospitals within a 30-kilometer radius via the Hospital_Dashboard with a 60-second acceptance timeout
2. WHEN a hospital accepts via the Hospital_Dashboard by clicking "Accept and Confirm Bed", THE Emergency_Dispatch_Agent SHALL inform the Caller that the hospital has accepted and an ambulance is on the way
3. IF no hospital accepts within 60 seconds (Layer 1 timeout), THEN THE Emergency_Dispatch_Agent SHALL execute Layer 2 by expanding the hospital search radius to 60 kilometers and simultaneously bridging the call to the 108 emergency dispatcher
4. WHEN Layer 2 is activated, THE Emergency_Dispatch_Agent SHALL bridge the 108 dispatcher call in parallel with the expanded hospital search (not sequentially) so the Caller is connected to a human fallback within 2 seconds
5. IF Layer 2 does not yield a hospital acceptance, THEN THE Emergency_Dispatch_Agent SHALL execute Layer 3 by sending SMS fallback to the Caller with the nearest 3 hospitals' contact details and addresses and alerting the nearest ASHA_Worker with patient details
6. THE Emergency_Dispatch_Agent SHALL include the ABCDE assessment summary, ICD-10 code, and caller location in all dispatch communications to hospitals and 108 dispatchers

### Requirement 6: Detect Caller Location Using 3-Tier Strategy

**User Story:** As a Caller, I want the system to determine my location accurately even from a feature phone without GPS, so that emergency services and hospital referrals are directed to the correct area.

#### Acceptance Criteria

1. WHEN a call begins, THE Location_Detector SHALL automatically extract the phone number's STD code prefix to determine the district or city as Tier 2 baseline location data
2. WHEN an emergency is detected or location is needed, THE Location_Detector SHALL ask the Caller for their location via voice input as the Tier 1 primary method ("Aap kahan hain? Gaon ka naam ya koi landmark bataiye") and resolve the response to village or landmark level within 15 seconds
3. IF the Caller cannot provide a voice location (unconscious, unable to speak), THEN THE Location_Detector SHALL use the Tier 2 phone prefix data as the fallback location
4. WHERE the Caller is using a smartphone, THE Location_Detector SHALL send an SMS with a GPS link to capture precise coordinates as a Tier 3 enhancement
5. WHEN a location is resolved at any tier, THE Location_Detector SHALL store the location data (raw text, resolved village/district/state, accuracy level, and GPS coordinates if available) in DynamoDB and make it available to the Emergency_Dispatch_Agent, Referral_Agent, and Disease_Surveillance_Agent
6. THE Location_Detector SHALL support landmark-based location descriptions common in rural India (e.g., "railway station ke paas", "primary school ke saamne", "Bhopal se 20 kilometer")

### Requirement 7: Execute Post-Triage Agentic Actions

**User Story:** As a Caller, I want the system to take concrete actions on my behalf after triage (send SMS, alert family, schedule follow-up, find nearest facility), so that I receive ongoing support beyond the phone call.

#### Acceptance Criteria

1. WHEN triage is complete, THE Action_Orchestrator SHALL send an SMS to the Caller with a summary of the triage outcome, treatment instructions (e.g., ORS preparation recipe), and recommended next steps
2. WHEN a follow-up is recommended, THE Follow_Up_Scheduler SHALL schedule a callback at the appropriate interval (e.g., 2 hours for acute conditions) using Amazon EventBridge and record the schedule in DynamoDB
3. WHEN a follow-up callback is triggered, THE IVR_System SHALL initiate an outbound call to the Caller to check on their status and escalate to emergency triage if the condition has worsened
4. WHEN triage recommends a facility visit, THE Referral_Agent SHALL identify the nearest appropriate facility (PHC, CHC, or District Hospital) based on the condition severity, IPHS facility capabilities, and Caller location, and provide the facility name, address, and phone number
5. WHEN an emergency or critical case is detected in a rural area, THE ASHA_Worker_Agent SHALL send an SMS alert to the nearest ASHA worker assigned to the Caller's village or block with patient details and recommended actions
6. THE Action_Orchestrator SHALL execute all post-triage actions in parallel using AWS Step Functions, not sequentially

### Requirement 8: Log Calls and Support Disease Surveillance

**User Story:** As a public health administrator, I want all call data to be logged with ICD-10 codes and geographic data and analyzed for outbreak patterns, so that disease surveillance can detect emerging health threats early.

#### Acceptance Criteria

1. WHEN a call ends, THE Call_Logger SHALL persist the complete call record to DynamoDB including call duration, triage outcome, ICD-10 code, severity classification, dispatch type (108/102/none), actions taken, and location data (village, district, state, GPS if available)
2. WHEN call recordings are generated, THE Call_Logger SHALL store recordings in Amazon S3 with encryption via AWS KMS
3. THE Call_Logger SHALL redact all Personally Identifiable Information before storing call records in compliance with the DPDP_Act 2023
4. WHEN call pattern data is aggregated by ICD-10 code and geographic location, THE Disease_Surveillance_Agent SHALL detect anomalous spikes in specific conditions within geographic clusters (e.g., "23 calls with ICD-10 A90 Dengue from Khedi village in 3 days") and flag potential outbreaks
5. WHEN an outbreak is flagged, THE Disease_Surveillance_Agent SHALL alert the District Health Officer via the analytics dashboard (Amazon QuickSight) with a geographic heatmap and condition breakdown
6. THE Call_Logger SHALL store all triage records in FHIR JSON format with ICD-10 codes for ABDM interoperability and future ABHA_ID linking

### Requirement 9: Ensure System Reliability, Safety, and Security

**User Story:** As a system operator, I want the system to maintain high availability, enforce medical safety guardrails, and protect patient data, so that callers always receive safe, reliable, and private health guidance.

#### Acceptance Criteria

1. THE IVR_System SHALL maintain 99.9% availability through circuit breaker patterns and fallback mechanisms across all AWS service dependencies
2. THE Triage_Agent SHALL enforce Amazon Bedrock Guardrails to prevent hallucinated medical advice, off-topic responses, and harmful content generation
3. THE Triage_Agent SHALL sanitize all Caller voice input before passing it to the AI model to prevent prompt injection attacks
4. WHEN any downstream AWS service is unavailable, THE IVR_System SHALL activate a graceful degradation path that keeps the Caller informed and connected to a human fallback (108 dispatcher) if possible
5. THE Call_Logger SHALL log all AI-generated medical advice with full traceability using Amazon Bedrock X-Ray traces for medical liability audit purposes
6. THE IVR_System SHALL encrypt all data at rest using AWS KMS and in transit using TLS to comply with the DPDP_Act 2023
7. THE IVR_System SHALL redact PII (phone numbers, names, addresses) from all stored records and analytics data before processing

### Requirement 10: Support Multimodal Photo Analysis via WhatsApp

**User Story:** As a smartphone-owning Caller, I want to send a photo of my condition (e.g., snakebite wound, skin rash, snake identification) via WhatsApp for AI visual analysis, so that I can receive more accurate guidance based on what the condition looks like.

#### Acceptance Criteria

1. WHEN the Triage_Agent determines that a photo would improve assessment accuracy (e.g., snakebite species identification, skin condition, wound assessment), THE IVR_System SHALL prompt the Caller to send a photo via WhatsApp to a designated number
2. WHEN a photo is received via the WhatsApp integration, THE Multimodal_Vision_Agent SHALL analyze the image using Claude Vision and return a visual assessment within 5 seconds
3. WHEN the visual assessment is complete, THE Triage_Agent SHALL incorporate the photo analysis results (e.g., snake species identification from India's Big Four venomous snakes, wound severity, skin condition classification) into the overall triage recommendation
4. IF the photo is unclear or unprocessable, THEN THE Multimodal_Vision_Agent SHALL inform the Caller and continue triage based on voice-only assessment without interruption

### Requirement 11: Support Chronic Care Follow-Up via ASHA Workers

**User Story:** As a Caller with a chronic condition (diabetes, hypertension, TB), I want the system to assign an ASHA worker to monitor my condition through regular visits, so that my health is tracked by a local frontline worker who can escalate issues.

#### Acceptance Criteria

1. WHEN a Caller is identified as having a chronic condition during triage, THE Chronic_Care_Agent SHALL enroll the Caller in a chronic care program and assign the nearest ASHA worker to the Caller's case via SMS notification with patient details and condition-specific monitoring instructions
2. WHEN a chronic care patient is enrolled, THE ASHA_Worker_Agent SHALL send the assigned ASHA worker a structured monitoring checklist (e.g., weekly blood sugar check for diabetes, BP monitoring for hypertension) via SMS
3. IF the ASHA worker reports worsening symptoms or danger signs for a chronic care patient, THEN THE Triage_Agent SHALL initiate an outbound call to the patient for reassessment and trigger the Emergency_Dispatch_Agent if warranted
4. WHEN a chronic care enrollment is completed, THE Call_Logger SHALL record the enrollment, assigned ASHA worker, and monitoring schedule in DynamoDB with ICD-10 coding

### Requirement 12: Support Multi-Language Interaction

**User Story:** As a Caller who speaks Hindi, English, or a regional Indian language, I want to interact with VaidyaVaani in my preferred language, so that I can describe my symptoms naturally and understand the guidance provided.

#### Acceptance Criteria

1. THE Speech_Engine SHALL support Tier 1 languages (Hindi and English) natively through Amazon Nova 2 Sonic with Indian-accented voices (Arjun and Kiara)
2. WHERE a Caller selects a Tier 2 regional language (Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Punjabi), THE IVR_System SHALL use Amazon Transcribe for speech-to-text and Amazon Polly for text-to-speech as a fallback path
3. WHEN a Caller code-switches between Hindi and English (Hinglish), THE Speech_Engine SHALL process the mixed-language input and respond appropriately
4. WHEN the IVR_System plays the welcome greeting, THE IVR_System SHALL offer language selection via DTMF keys (press 1 for Hindi, press 2 for English, additional keys for regional languages)
