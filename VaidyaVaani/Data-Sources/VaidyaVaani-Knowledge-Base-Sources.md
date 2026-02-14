# VaidyaVaani Knowledge Base Sources

## Overview

This document provides a comprehensive catalog of all clinical guidelines, standards, and regulatory documents that form the knowledge base for VaidyaVaani. These sources ensure that the system provides medically accurate, legally compliant, and contextually appropriate health guidance for the Indian healthcare ecosystem.

## Document Organization

The knowledge base is organized into 9 major categories:

1. Emergency Triage & First Aid (Global + India)
2. Maternal, Newborn, Child Health (India)
3. Telemedicine & Medico-Legal / AI Boundaries (India)
4. Digital Health Standards & Interoperability (ABDM, FHIR, Codes)
5. ASHA, PHC, and Primary Care Protocols (India)
6. Disease Surveillance & Outbreak Detection
7. Chronic Disease & Long-Term Follow-Up (NCDs)
8. Privacy, Security, Accessibility
9. Data Format Standards

---

## 1. Emergency Triage & First Aid (Global + India)

### E1: Emergency Triage Assessment and Treatment (ETAT) – Paediatric

- **Issuing Body:** WHO
- **Scope:** Triage of sick children into Emergency / Priority / Non-urgent categories; ABCD signs; first 5-10 minute actions
- **VaidyaVaani Use Case:** Paediatric triage decision trees; danger-sign rules for under-5s; safe wording for "emergency" vs "can wait"
- **Format:** PDF → convert to text/Markdown and chunk around "Danger Signs", "Emergency Signs" sections
- **Source:** [WHO AFRO](https://www.afro.who.int/sites/default/files/2017-06/participant_manual.pdf)

### E2: WHO Adult Emergency Triage Algorithms

- **Issuing Body:** WHO / National Adaptations
- **Scope:** Adult triage (respiratory distress, chest pain, shock, altered consciousness, trauma, etc.)
- **VaidyaVaani Use Case:** Adult triage logic; classify calls into Critical / Urgent / Non-urgent; informs which flows send to 108
- **Format:** PDFs/posters; chunk algorithms and action boxes for RAG and static scripts
- **Source:** [Safety and Quality Australia](https://www.safetyandquality.gov.au/sites/default/files/2024-04/emergency_triage_education_kit_-_second_edition.pdf)

### E3: Basic Emergency Care (BEC): Approach to the Acutely Ill and Injured

- **Issuing Body:** WHO
- **Scope:** ABCDE approach; acute illness & injury; stabilisation steps
- **VaidyaVaani Use Case:** Backing for question sequences (what to ask), and stabilise-then-refer actions
- **Format:** Training pack PDFs; only need sections on "approach" and common emergencies

### E4: Facility-Based Integrated Management of Neonatal and Childhood Illness (F-IMNCI) – Operational Guidelines

- **Issuing Body:** MoHFW / NHM (India)
- **Scope:** Facility-level management of sick neonates and children; includes ETAT-style triage and emergency signs
- **VaidyaVaani Use Case:** India-specific paediatric triage thresholds; "danger signs" and when to refer immediately to higher facility
- **Format:** PDF; chunk "triage" and "emergency signs" sections
- **Source:** [NHM India](https://nhm.gov.in/images/pdf/programmes/child-health/guidelines/operational_guidelines_for_fimnci.pdf)

### E5: F-IMNCI Chart Booklet

- **Issuing Body:** MoHFW / NHM (India)
- **Scope:** Visual charts for under-5 assessment: pneumonia, diarrhea, malnutrition, fever, etc.
- **VaidyaVaani Use Case:** Simple rule-based paediatric flows for voice triage; cross-check LLM outputs against these rules
- **Format:** PDF booklet; convert chart text into machine-readable tables for rules
- **Source:** [NHM India](https://nhm.gov.in/images/pdf/programmes/child-health/guidelines/Revised-F-IMNCI-Modules-2023/FIMNCI-Chart-Booklet-2023.pdf)

### E6: Emergency Triage of Newborn – OSCE / Mentoring Checklists

- **Issuing Body:** NHM (India)
- **Scope:** Newborn emergency triage steps, assessment checklists
- **VaidyaVaani Use Case:** Neonatal red-flag detection and "stabilise + immediate referral" flows
- **Format:** PDF; short, highly structured – ideal as static protocols
- **Source:** [NHM India](https://nhm.gov.in/New_Updates_2018/NNW/Mentoring%20Checklists.pdf)

### E7: Basic First Aid Manual

- **Issuing Body:** NDMA or State SDMAs (e.g., Meghalaya SDMA)
- **Scope:** Layperson-oriented first aid for common injuries/emergencies (bleeding, fractures, burns, snakebite, CPR, choking, etc.)
- **VaidyaVaani Use Case:** Verbatim first-aid scripts for callers (read via RAG), plus clear "Do / Don't" lists
- **Format:** PDF; chunk by condition (snakebite, burns, fracture, etc.)
- **Source:** [Meghalaya SDMA](https://msdma.gov.in/publications/Basic_First_Aid_Manual_English.pdf)

### E8: Strengthening Facility Based Paediatric Care – Operational Guidelines

- **Issuing Body:** NHM (India)
- **Scope:** How to implement paediatric emergency care and triage in hospitals
- **VaidyaVaani Use Case:** Justification for triage categories and referral recommendations
- **Format:** PDF; mainly for design docs & pitch, not direct RAG
- **Source:** [NHM India](https://nhm.gov.in/images/pdf/programmes/child-health/guidelines/Strenghtening_Facility_Based_Paediatric_Care-Operational_Guidelines.pdf)

---

## 2. Maternal, Newborn, Child Health (India)

### M1: CHO / Mid-Level Provider Booklet – Maternal Health

- **Issuing Body:** NHM / MoHFW (India)
- **Scope:** Danger signs in pregnancy and postpartum; referral criteria; stabilisation protocols
- **VaidyaVaani Use Case:** Pregnancy call flows: classify as routine vs danger; safe advice vs "go now / call 108"
- **Format:** PDF; chunk "danger signs" and "referral criteria"
- **Source:** [NHM India](https://nhm.gov.in/New_Update-2022-23/MH/GUIDELINES-%20MH/CHO_Booklet_%20Maternal_Health-English.pdf)

### M2: Guidelines for Antenatal Care & Skilled Attendance at Birth

- **Issuing Body:** MoHFW (India)
- **Scope:** Antenatal visit schedule, risk factors, when to refer, intrapartum care (includes SBA guidelines)
- **VaidyaVaani Use Case:** Identify high-risk pregnancy calls; support messages like "you must see a skilled provider within 24h/now"
- **Format:** PDF; keep text portions on danger signs and referral
- **Source:** [NHM India](https://nhm.gov.in/images/pdf/programmes/maternal-health/guidelines/sba_guidelines_for_skilled_attendance_at_birth.pdf)

### M3: Guidelines for Obstetric HDU and ICU

- **Issuing Body:** MoHFW (India)
- **Scope:** When HDU/ICU needed; types of obstetric emergencies; where to manage which cases
- **VaidyaVaani Use Case:** Justify escalation of certain symptom combinations as "critical"; helps choose "PHC vs DH" in advice
- **Format:** PDF; not for RAG text but for internal logic and pitch
- **Source:** [NHM India](https://nhm.gov.in/images/pdf/programmes/maternal-health/guidelines/Guidelines_for_Obstetric_HDU_and_ICU.pdf)

### M4: F-IMNCI Operational and Chart Booklets (Paediatric)

- **Issuing Body:** MoHFW / NHM
- **Scope:** Under-5 danger signs, pneumonia, diarrhea, neonatal sepsis, etc.
- **VaidyaVaani Use Case:** Under-5 fever/cough/diarrhea classification & advice flows
- **Format:** Same as E4/E5
- **Source:** [NHM India](https://nhm.gov.in/images/pdf/programmes/child-health/guidelines/operational_guidelines_for_fimnci.pdf)

### M5: Home Based Newborn/Maternal Care & ASHA Modules

- **Issuing Body:** NHM (India)
- **Scope:** ASHA instructions on household-level maternal and newborn care, counselling, red flags (multiple booklets)
- **VaidyaVaani Use Case:** Calibrates when system should alert ASHA; what ASHA is expected to do on ground
- **Format:** PDFs; chunk high-level danger signs + ASHA action steps

---

## 3. Telemedicine & Medico-Legal / AI Boundaries (India)

### L1: Telemedicine Practice Guidelines, 2020

- **Issuing Body:** MoHFW + NITI Aayog (India)
- **Scope:** Legal framework for teleconsultation: modes, consent, responsibilities, emergencies
- **VaidyaVaani Use Case:** Define boundaries: VaidyaVaani triages & navigates; RMPs diagnose & prescribe; emergency flows must refer to in-person care
- **Format:** Official PDF; use key clauses in system prompt + legal slides
- **Source:** [PMC NCBI](https://pmc.ncbi.nlm.nih.gov/articles/PMC8106416/)

### L2: Modification in Medicine List in Telemedicine Practice Guidelines

- **Issuing Body:** MoHFW
- **Scope:** Which medicines can be prescribed remotely and in what context
- **VaidyaVaani Use Case:** Future: ensure any medicine suggestions (if ever) are within allowed lists and always RMP-mediated
- **Format:** PDF; not for RAG to patients; for compliance
- **Source:** [MoHFW Dashboard](https://covid19dashboard.mohfw.gov.in/pdf/ModificationinMedicineListinTelemedicinePracticeGuidelines.pdf)

### L3: Legal / Policy Commentaries on Telemedicine Guidelines

- **Issuing Body:** Journals / Law Blogs
- **Scope:** Interpretation, medico-legal risk, AI use
- **VaidyaVaani Use Case:** For governance slides; to justify guardrails and human-in-the-loop design
- **Format:** Articles; use for internal design and pitch
- **Source:** [PMC NCBI](https://pmc.ncbi.nlm.nih.gov/articles/PMC8106416/)

### L4: Digital Personal Data Protection Act, 2023 (DPDP Act)

- **Issuing Body:** Government of India
- **Scope:** Data privacy, consent, purpose limitation, rights
- **VaidyaVaani Use Case:** Drives data-retention, consent, anonymisation features and privacy statements
- **Format:** Statute / summaries; not part of RAG, but core to architecture

### L5: India AI / IndiaAI Governance & Ethical AI Guidelines

- **Issuing Body:** MeitY / IndiaAI
- **Scope:** Principles for responsible AI, especially in health & public services
- **VaidyaVaani Use Case:** Back AI-governance pitch: explain guardrails, auditability, fairness
- **Format:** Policy docs; cited but not RAG sources
- **Source:** [PIB India](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc2025115685601.pdf)

---

## 4. Digital Health Standards & Interoperability (ABDM, FHIR, Codes)

### D1: ABDM: Health Information Types & FHIR-Based Framework

- **Issuing Body:** NHA / ABDM (India)
- **Scope:** Defines HI types; FHIR R4 clinical profiles; 3 data formats (PDF, FHIR+free text, full FHIR)
- **VaidyaVaani Use Case:** Design call summaries as FHIR Bundles; ensure compatibility with HIP/HIU, eSanjeevani, etc.
- **Format:** Web docs, JSON schemas, PDFs
- **Source:** [LinkedIn Article](https://www.linkedin.com/pulse/exploring-health-information-types-abdm-ayushman-bharat-digital)

### D2: ABHA Number, Consent Manager, HIU/HIP Specs

- **Issuing Body:** NHA / ABDM
- **Scope:** ABHA ID, consent flow for sharing health data, gateway behaviour
- **VaidyaVaani Use Case:** Roadmap: map phone number ↔ ABHA; send summaries as authorised HI to hospitals
- **Format:** API/JSON docs; not KB text
- **Source:** [CoronaSafe Docs](https://docs.coronasafe.network/abdm-documentation/overview-of-fhr-framework/apis-and-standards)

### D3: SNOMED-CT Usage & FHIR Bindings

- **Issuing Body:** SNOMED International + NRCeS India
- **Scope:** How to code symptoms, problems, diagnoses using SNOMED within FHIR
- **VaidyaVaani Use Case:** Internally code conditions and symptoms in triage outputs for interoperability
- **Format:** Technical implementation guides
- **Source:** [SNOMED Docs](https://docs.snomed.org/implementation-guides/loinc-implementation-guide/information-models-and-terminology-binding/5.3-hl7-fhir-and-laboratory-data)

### D4: ICD-10/11 Coding Guidelines (India)

- **Issuing Body:** WHO, adopted by MoHFW
- **Scope:** Diagnosis coding standards
- **VaidyaVaani Use Case:** For reporting and interoperability where diagnosis is recorded by RMP
- **Format:** Used inside FHIR Condition.code, not RAG

### D5: LOINC & FHIR Lab Data Guidelines

- **Issuing Body:** Regenstrief / HL7
- **Scope:** Standard for lab tests & measurements
- **VaidyaVaani Use Case:** Future: when you ingest lab data or integrate with PHCs/Hospitals
- **Format:** Technical guides
- **Source:** [SNOMED Docs](https://docs.snomed.org/implementation-guides/loinc-implementation-guide/information-models-and-terminology-binding/5.3-hl7-fhir-and-laboratory-data)

---

## 5. ASHA, PHC, and Primary Care Protocols (India)

### C1: ASHA Training Modules (Series 1-7 etc.)

- **Issuing Body:** NHM (India)
- **Scope:** Maternal / newborn care, common illnesses, TB, NCDs, health promotion
- **VaidyaVaani Use Case:** Defines what ASHA is trained to do and when she is involved
- **Format:** Use to design "ASHA Escalation Agent" and trust loop

### C2: Home Based Newborn Care (HBNC) & Home Based Care for Young Child (HBYC) Guidelines

- **Issuing Body:** NHM
- **Scope:** How ASHAs and ANMs monitor and manage newborns/young children
- **VaidyaVaani Use Case:** When to send ASHA vs 108 vs PHC; follow-up flows
- **Format:** Guidelines; chunk danger signs and action steps

### C3: Indian Public Health Standards (IPHS) for SHC / PHC / CHC / DH

- **Issuing Body:** MoHFW (India)
- **Scope:** What services and staff exist at each public-health facility level
- **VaidyaVaani Use Case:** Helps recommend realistic destination (SHC vs PHC vs DH) and not over-promise services
- **Format:** PDF; used for system logic and pitch, not patient-facing RAG

---

## 6. Disease Surveillance & Outbreak Detection

### S1: Operational Guidelines – Integrated Disease Surveillance Programme (IDSP)

- **Issuing Body:** MoHFW (India)
- **Scope:** Priority disease list; case definitions; alert thresholds; reporting workflows
- **VaidyaVaani Use Case:** Map "cluster detection" to IDSP thresholds; decide when to alert DHO
- **Format:** PDF; use definitions & thresholds as rules

### S2: Programme-Specific Guidelines

- **Issuing Body:** MoHFW / Programme Divisions
- **Scope:** Case definitions, outbreak criteria, and reporting expectations (e.g., NVBDCP for malaria/dengue, NTEP for TB)
- **VaidyaVaani Use Case:** Enrich outbreak rules (e.g., fevers with rash vs fevers with bleeding); adjust heatmap / alerts
- **Format:** Primarily for logic; not direct patient RAG

---

## 7. Chronic Disease & Long-Term Follow-Up (NCDs)

### N1: NPCDCS Operational Guidelines (NCDs)

- **Issuing Body:** MoHFW (India)
- **Scope:** Screening, follow-up intervals, counselling, referral for diabetes, HTN, CVD, stroke
- **VaidyaVaani Use Case:** Shape weekly check-in questions and escalation thresholds for chronic-care companion
- **Format:** PDF; chunk sections on follow-up and high-risk symptoms

### N2: National TB Elimination Programme (NTEP) Guidelines

- **Issuing Body:** MoHFW / Central TB Division
- **Scope:** TB diagnosis, treatment, adherence monitoring, follow-up
- **VaidyaVaani Use Case:** For TB patients enrolled in chronic care flows; design adherence reminders and warning signs
- **Format:** Use for internal logic and scripts; RAG only with safe, programme-consistent wording

---

## 8. Privacy, Security, Accessibility

### G1: Digital Personal Data Protection Act, 2023

- **Issuing Body:** Government of India
- **Scope:** Legal requirements for data handling, consent, rights
- **VaidyaVaani Use Case:** Data anonymisation, retention, consent prompts; design of logs and analytics
- **Format:** Legal text / summaries; used in architecture & policy docs

### G2: India AI / IndiaAI Governance Guidelines

- **Issuing Body:** MeitY / IndiaAI
- **Scope:** Responsible AI principles; risk categories
- **VaidyaVaani Use Case:** Justify guardrails, explainability, auditability of AI decisions
- **Format:** Policy docs
- **Source:** [PIB India](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc2025115685601.pdf)

### G3: Rights of Persons with Disabilities Act + WCAG 2.1

- **Issuing Body:** Government of India + W3C
- **Scope:** Accessibility standards
- **VaidyaVaani Use Case:** Support claim that voice interface is accessible; design of any dashboards for admins
- **Format:** Design reference, not RAG

---

## 9. Data Format Standards

### Source Guidelines Processing

- **Preferred Format:** PDF → extracted plain text / Markdown
- **Rationale:** Easy to ingest + chunk; retains headings and structure for RAG

### Knowledge Base Storage

- **Preferred Format:** Chunked text (500-1500 tokens) with metadata in vector DB
- **Rationale:** Best for Nova/Claude + RAG; metadata for age group, emergency vs chronic, India vs WHO source

### Clinical Event Storage

- **Preferred Format:** FHIR R4 JSON (ABDM profiles)
- **Rationale:** Directly compatible with ABDM, many Indian HIS/EMR; future proof

### Coding Inside FHIR

- **Preferred Standards:** SNOMED-CT, ICD-10/11, LOINC (where relevant)
- **Rationale:** Standardised semantics; plug-and-play with existing health IT

---

## Implementation Roadmap

### For Hackathon (Minimum Viable KB)

Priority sources to demonstrate seriousness and safety:

- **E-series:** Emergency triage & first aid (E1-E7)
- **M-series:** Maternal, newborn, child health (M1-M2)
- **L1:** Telemedicine Practice Guidelines
- **NDMA First Aid Manual**
- **ABDM/FHIR basics** (D1)

### For Production (Complete KB)

Gradually add:

- ASHA/IPHS protocols (C-series)
- IDSP surveillance (S-series)
- NPCDCS & NTEP for chronic care (N-series)
- Richer ABDM integration (D2-D5)
- Full legal/governance framework (L-series, G-series)

---

## Document Maintenance

- **Last Updated:** February 14, 2026
- **Version:** 1.0
- **Maintained By:** VaidyaVaani Development Team
- **Review Cycle:** Quarterly or when new guidelines are published by MoHFW/WHO

---

## Notes

1. All PDF sources should be converted to plain text/Markdown for RAG ingestion
2. Chunk documents around logical sections (danger signs, referral criteria, etc.)
3. Add metadata tags for filtering: age_group, emergency_level, source_authority, india_specific
4. Maintain source attribution for all RAG outputs
5. Regular updates needed when MoHFW/WHO publish revised guidelines
