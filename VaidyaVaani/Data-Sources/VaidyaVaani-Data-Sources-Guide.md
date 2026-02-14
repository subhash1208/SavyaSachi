# VaidyaVaani — Verified Data Sources & Knowledge Base Strategy

**Complete Guide to Government-Approved Medical Data for VaidyaVaani's AI Triage System**

*Created: February 14, 2026*
*For: SavyaSachi Team — AI for Bharat 2026 Hackathon*

---

## Table of Contents

### Data Sources (Verified & Government-Approved)

1. [Why This Matters](#1-why-this-matters)
2. [Source 1: ICMR Standard Treatment Workflows (PRIMARY)](#2-source-1-icmr-standard-treatment-workflows-stws--your-primary-source)
3. [Source 2: WHO IMAI — Adult & Adolescent Illness](#3-source-2-who-imai--integrated-management-of-adolescent-and-adult-illness)
4. [Source 3: WHO IMCI — Childhood Illness](#4-source-3-who-imci--integrated-management-of-childhood-illness)
5. [Source 4: WHO Snakebite Management Guidelines](#5-source-4-who-snakebite-management-guidelines-south-east-asia)
6. [Source 5: India RMNCH+A Strategy — Maternal & Child Health](#6-source-5-india-rmncha-strategy--maternal--child-health)
7. [Source 6: IPHS Guidelines 2022 — Facility Standards](#7-source-6-iphs-guidelines-2022--indian-public-health-standards)
8. [Source 7: Essential Medicines Lists (WHO + India NLEM)](#8-source-7-essential-medicines-lists-who--india-nlem)
9. [Source 8: Open Datasets for Symptom-Disease Mapping](#9-source-8-open-datasets-for-symptom-disease-mapping-supplementary)

### New Sources (Added Feb 14, 2026 — Post Research Review)

10. [Source 9: WHO Prehospital Emergency Care — ABCDE Framework](#10-source-9-who-prehospital-emergency-care--abcde-framework)
11. [Source 10: National Protocol for Management of Snakebite 2024 (India-Specific)](#11-source-10-national-protocol-for-management-of-snakebite-2024-india-specific)
12. [Source 11: NHM National Ambulance Service (NAS) Guidelines — 108 vs 102](#12-source-11-nhm-national-ambulance-service-nas-guidelines--108-vs-102)
13. [Source 12: ABDM Health Data Standards — ICD-10 & LOINC Coding](#13-source-12-abdm-health-data-standards--icd-10--loinc-coding)
14. [Source 13: Triage Benchmark Datasets (For Evaluation Only)](#14-source-13-triage-benchmark-datasets-for-evaluation-only)

### Strategy & Implementation

15. [Data Format Strategy for Bedrock Knowledge Base](#15-data-format-strategy-for-bedrock-knowledge-base)
16. [Priority Ingestion Order](#16-priority-ingestion-order)
17. [Hackathon-Specific Strategy (What You Actually Need)](#17-hackathon-specific-strategy-what-you-actually-need)
18. [The Killer Pitch Line for Judges](#18-the-killer-pitch-line-for-judges)
19. [Quick Reference: All URLs](#19-quick-reference-all-urls)

---

## 1. Why This Matters

VaidyaVaani's Bedrock Knowledge Base is the "brain" behind every triage decision. If the data powering it is unverified, outdated, or from random internet sources, the AI could give dangerous advice. A judge asking "Where does your medical data come from?" needs to hear government-approved, WHO-validated sources — not "we scraped some medical websites."

**Requirements for VaidyaVaani's data:**
- Must be government-approved or WHO-validated
- Must cover India-specific conditions (snakebite, malaria, dengue, TB, etc.)
- Must support the "diagnosis by exclusion" triage logic (like NHS Pathways)
- Must include emergency protocols that are deterministic (no AI hallucination risk)
- Must cover all demo scenarios: pediatric fever, wound/skin, chest pain, snakebite, pregnancy
- Must be in formats compatible with Amazon Bedrock Knowledge Base

---

## 2. Source 1: ICMR Standard Treatment Workflows (STWs) — YOUR PRIMARY SOURCE

### What It Is

The **Indian Council of Medical Research (ICMR)**, in collaboration with the **National Health Authority (NHA)** and **WHO India Country Office**, has developed Standard Treatment Workflows (STWs) — concise, one-page treatment protocols for common and serious diseases.

### Scale & Authority

| Detail | Info |
|--------|------|
| **Total STWs** | 157 workflows |
| **Specialties Covered** | 28 specialties |
| **Release Timeline** | Volume 1 (2019), Volume 2 (2022), Volume 3 + 32 new STWs (2024) |
| **Developed By** | ICMR + NHA + WHO India |
| **Government Mandate** | Union Health Secretary Apurva Chandra directed ALL states and UTs to adopt these |
| **Dissemination** | Also sent to National Medical Commission (NMC) for medical colleges |

### Why This Is the Gold Mine

- The government has **literally mandated** all states to adopt these protocols
- Designed to be used at **all levels of healthcare** — from primary (PHC) to tertiary (district hospital)
- Each STW is a **one-page concise document** — perfect for Bedrock KB chunking
- Available as an **app-based tool** (stw.icmr.org) — shows the government wants digital adoption
- Covers the exact conditions VaidyaVaani will triage

### Specialties Covered (28 Total)

Includes but not limited to:
- General Medicine
- Cardiology (chest pain, heart attack protocols)
- Pediatrics (child fever, dehydration)
- Pulmonology (breathing difficulty, asthma)
- Nephrology (kidney issues)
- Gastroenterology (abdominal pain, diarrhea)
- Orthopedics (fractures, injuries)
- Neurosurgery (head injury, stroke)
- Obstetrics & Gynecology (pregnancy complications)
- Dermatology (skin conditions)
- Ophthalmology (eye emergencies)
- ENT (ear, nose, throat)
- Psychiatry (mental health)
- Cardiothoracic Vascular Surgery
- Pediatric Cardiology
- Interventional Radiology
- And 12+ more

### Where to Download

| Resource | URL |
|----------|-----|
| **STW Individual Downloads** | https://www.icmr.gov.in/standard-treatment-workflows-stws |
| **STW Portal (Interactive)** | https://stw.icmr.org |
| **Downloadable Books (Vol 1-3)** | https://www.icmr.gov.in/downloadable-books |
| **Mobile App** | Available on Android & iOS (search "ICMR STW") |

### Format Available

- **PDF** (one-page per STW — ideal for direct Bedrock KB ingestion)
- **Book format** (compiled volumes — need to be split into individual protocols)
- **App-based** (stw.icmr.org — could potentially scrape structured data)

### Maps to VaidyaVaani Features

- ✅ Symptom triage (core AI logic)
- ✅ Treatment advice (what to do at home, when to go to hospital)
- ✅ Emergency protocols (chest pain, stroke, severe bleeding)
- ✅ Chronic care guidance (diabetes, hypertension, TB management)
- ✅ Referral logic (which level of facility for which condition)

---

## 3. Source 2: WHO IMAI — Integrated Management of Adolescent and Adult Illness

### What It Is

WHO's clinical guidelines specifically designed for **first-level facility health workers in resource-limited settings**. This is exactly VaidyaVaani's context — providing triage guidance where trained doctors are scarce.

### Key Document: District Clinician Manual

| Detail | Info |
|--------|------|
| **Full Title** | IMAI District Clinician Manual: Hospital Care for Adolescents and Adults |
| **Publisher** | World Health Organization |
| **Target** | Medical officers, clinical officers, senior nurses at district hospitals in resource-constrained settings |
| **Approach** | Triage → Emergency assessment → Diagnosis by exclusion → Treatment |
| **URL** | https://www.who.int/publications/i/item/9789241548281 |
| **Format** | Free PDF download |

### Why It's Critical for VaidyaVaani

- Uses **"diagnosis by exclusion" logic** — the same approach NHS Pathways uses, the same approach VaidyaVaani should use
- Designed for settings with **limited resources** (exactly rural India)
- Covers **triage and emergency assessment** — the core of what VaidyaVaani does
- Provides structured **"what questions to ask"** decision trees
- WHO-approved — unquestionable authority

### What It Covers

- Emergency triage and assessment
- Management of common acute conditions
- Chronic disease management in resource-limited settings
- When to refer vs. when to treat locally
- Danger signs that require immediate action

### Additional IMAI Resources

| Resource | URL |
|----------|-----|
| **Acute Care Module** | Available on WHO publications portal |
| **General Principles of Good Chronic Care** | WHO IMAI companion module |

### Maps to VaidyaVaani Features

- ✅ Core triage algorithm (the "brain" of the AI)
- ✅ Emergency assessment logic
- ✅ "What questions to ask" decision trees
- ✅ Danger sign detection
- ✅ Referral decision logic

---

## 4. Source 3: WHO IMCI — Integrated Management of Childhood Illness

### What It Is

The **pediatric equivalent** of IMAI. WHO's globally-used protocol for assessing and treating sick children in resource-limited settings. Used in 100+ countries.

### Key Details

| Detail | Info |
|--------|------|
| **Full Title** | Integrated Management of Childhood Illness (IMCI) |
| **Publisher** | World Health Organization |
| **Coverage** | Sick child age 2 months to 5 years + sick young infant age 1 week to 2 months |
| **URL** | https://www.who.int/publications/i/item/9241546441 |
| **Format** | Free PDF download |

### Structure (7 Parts)

1. Overview of the IMCI process
2. Assess and classify the sick child (2 months to 5 years)
3. Assess and classify the sick young infant (1 week to 2 months)
4. Identify treatment
5. Treat the sick child or sick young infant
6. Communicate and counsel
7. Give follow-up care

### Why It's Critical for VaidyaVaani

- Your **primary demo scenario** is a mother calling about a sick child with fever and vomiting
- IMCI provides the exact **assessment questions** and **classification logic** for this scenario
- Covers **ORS/dehydration protocols** — the treatment advice in your demo
- Includes **danger signs** that trigger emergency referral
- The "communicate and counsel" section maps directly to how VaidyaVaani should talk to mothers

### Maps to VaidyaVaani Features

- ✅ Demo Scenario 1 (mother with sick child — fever, vomiting, dehydration)
- ✅ Pediatric triage logic
- ✅ ORS preparation instructions (the SMS content in your demo)
- ✅ Danger sign detection for children
- ✅ Follow-up care scheduling logic
- ✅ Communication style with worried parents

---

## 5. Source 4: WHO Snakebite Management Guidelines (South-East Asia)

### What It Is

WHO's comprehensive guidelines for managing snakebites, specifically for the South-East Asia region (India-relevant snake species and treatment protocols).

### Key Documents

| Document | Edition | URL |
|----------|---------|-----|
| **Guidelines for Management of Snakebites (SE Asia)** | 2nd Edition (2016) | https://www.who.int/publications-detail-redirect/9789290225300 |
| **Guidelines for Management of Snakebites (SE Asia)** | 1st Edition (2010) | https://www.who.int/publications/i/item/9789290223774 |
| **Clinical Management of Snake Bites (SE Asia)** | Original | https://www.who.int/southeastasia/publications-detail/B0241 |
| **Snakebite Envenoming Strategy** | 2019 | https://www.who.int/publications/i/item/9789241515641 |
| **WHO Snakebite Treatment Page** | Current | https://www.who.int/teams/control-of-neglected-tropical-diseases/snakebite-envenoming/treatment |

### India-Specific: NAPSE (2024)

India launched the **National Action Plan for Prevention and Control of Snakebite Envenoming (NAPSE)** in 2024 with the goal of halving snakebite deaths by 2030. Key focus areas:
- Better surveillance
- Improved antivenom availability and research
- Enhanced medical capacity
- Public awareness campaigns

### Why It's Critical for VaidyaVaani

- India has **50,000+ snakebite deaths per year** — roughly half of all snakebite deaths worldwide
- Snakebite is one of your **key demo scenarios**
- First aid instructions must be **100% accurate** (wrong advice = death)
- WHO guidelines provide **deterministic first-aid protocols** — no AI hallucination risk
- Species identification from description is covered

### Key First Aid Protocols (From WHO)

These should be converted into **static, guardrailed scripts** (NOT generated by AI):

```
SNAKEBITE FIRST AID (WHO-Approved):
1. Keep the patient calm and still
2. Immobilize the bitten limb (splint if possible)
3. Remove rings, watches, tight clothing near bite
4. DO NOT cut the wound
5. DO NOT suck the venom
6. DO NOT apply tourniquet
7. DO NOT apply ice
8. DO NOT give aspirin or ibuprofen
9. Transport to hospital IMMEDIATELY
10. If possible, note the snake's appearance (do NOT try to catch it)
```

### Maps to VaidyaVaani Features

- ✅ Snakebite demo scenario
- ✅ First-aid voice scripts (deterministic, guardrailed)
- ✅ Species identification logic (from caller's description)
- ✅ Emergency dispatch trigger
- ✅ Hospital referral (nearest facility with antivenom)
- ✅ WhatsApp photo path (snake identification from photo via Claude Vision)

---

## 6. Source 5: India RMNCH+A Strategy — Maternal & Child Health

### What It Is

The **Reproductive, Maternal, Newborn, Child and Adolescent Health (RMNCH+A)** strategy is the Government of India's official framework for maternal and child health under the National Health Mission.

### Key Details

| Detail | Info |
|--------|------|
| **Publisher** | Ministry of Health & Family Welfare, Government of India |
| **Framework** | Lifecycle approach — adolescence → pregnancy → childbirth → childhood |
| **Focus** | 184 high-priority districts |
| **Available From** | NHM portal (nhm.gov.in) |
| **Format** | PDF handbooks and operational guidelines |

### What It Covers

- **Pregnancy danger signs** (pre-eclampsia, eclampsia, hemorrhage, sepsis)
- **Maternal health protocols** (antenatal care, safe delivery, postnatal care)
- **Newborn care** (essential newborn care, danger signs, referral criteria)
- **Child health** (immunization schedules, nutrition, common childhood illnesses)
- **Adolescent health** (reproductive health, nutrition, mental health)
- **ASHA worker roles** in each of these areas

### Why It's Critical for VaidyaVaani

- Your **pregnancy danger signs scenario** (pre-eclampsia) comes directly from these protocols
- Defines exactly what **ASHA workers should do** — maps to your ASHA integration feature
- Covers the **continuum of care** from community to facility — matches VaidyaVaani's referral logic
- Government-approved — judges with public health background will recognize this immediately

### Maps to VaidyaVaani Features

- ✅ Pregnancy danger signs scenario (pre-eclampsia detection)
- ✅ Maternal health triage
- ✅ ASHA worker integration (what to alert ASHA about)
- ✅ Newborn danger sign detection
- ✅ Immunization reminders (chronic care follow-up)
- ✅ Referral logic for maternal emergencies

---

## 7. Source 6: IPHS Guidelines 2022 — Indian Public Health Standards

### What It Is

The **Indian Public Health Standards (IPHS)** define the minimum standards for healthcare facilities at every level in India — from Sub-Centres to District Hospitals. Published under the National Health Mission.

### Why It's Relevant

VaidyaVaani needs to know **WHERE to refer patients**. Not every facility can handle every condition. IPHS tells you:
- What services a **Sub-Centre** can provide (basic first aid, maternal care)
- What a **PHC (Primary Health Centre)** can handle (outpatient care, basic emergencies)
- What a **CHC (Community Health Centre)** offers (specialist services, surgeries)
- What a **District Hospital** is equipped for (complex emergencies, ICU, blood bank)

### Key Details

| Detail | Info |
|--------|------|
| **Publisher** | Ministry of Health & Family Welfare / NHM |
| **Levels Covered** | Sub-Centre, PHC, CHC, District Hospital |
| **Available From** | nhm.gov.in |
| **Format** | PDF guidelines |

### Maps to VaidyaVaani Features

- ✅ Referral logic ("go to PHC" vs "go to District Hospital")
- ✅ Understanding what facilities can handle what conditions
- ✅ Realistic advice (don't tell someone to get an MRI if nearest MRI is 100km away)
- ✅ Hospital Dashboard feature (which facility to notify for emergencies)

---

## 8. Source 7: Essential Medicines Lists (WHO + India NLEM)

### What It Is

Two complementary lists that define which medicines should be available at each healthcare level:

1. **WHO Model List of Essential Medicines** — global standard
2. **India's National List of Essential Medicines (NLEM)** — India-specific, regularly updated by the Ministry of Health

### Why It's Relevant

When VaidyaVaani gives medication advice, it should only suggest medicines that are **actually available** at the patient's nearest facility. Telling a rural patient to take a medicine that's only available in city hospitals is useless.

### Key Details

| Detail | WHO EML | India NLEM |
|--------|---------|------------|
| **Publisher** | WHO | Ministry of Health, Govt of India |
| **Scope** | Global | India-specific |
| **Medicines Listed** | 500+ | 384 (NLEM 2022) |
| **Mapped to Facility Level** | Yes | Yes (PHC, CHC, District Hospital) |
| **Format** | PDF | PDF |

### Maps to VaidyaVaani Features

- ✅ Treatment advice (suggest only available medicines)
- ✅ Medication guidance for chronic care follow-up
- ✅ "Realistic" recommendations based on facility level
- ✅ ORS, paracetamol, basic antibiotics — confirming availability at PHC level

---

## 9. Source 8: Open Datasets for Symptom-Disease Mapping (Supplementary)

### Important Note

These are **NOT government-approved** on their own. They are supplementary datasets that can enhance the knowledge base alongside the verified government sources above.

### Available Datasets

| Dataset | Platform | Format | What It Contains |
|---------|----------|--------|------------------|
| **Symptom-Disease Prediction Dataset** | Mendeley Data | CSV | Structured mapping of symptoms to diseases |
| **TachyHealth** | HuggingFace | Structured JSON | Medical Q&A, symptom descriptions, treatment info |
| **Disease Symptom Knowledge Database** | Kaggle | CSV | Symptom-disease-treatment mappings |

### How to Use Them

- Use as **supplementary training data** alongside ICMR/WHO sources
- Good for building **symptom-to-condition mapping** logic
- CSV format works well with Bedrock KB
- Always **validate against ICMR STWs** before including in production KB
- Never use as the sole source for any medical advice

### Maps to VaidyaVaani Features

- ✅ Symptom recognition (initial classification)
- ✅ "What condition might this be?" logic
- ✅ Training data for improving triage accuracy
- ⚠️ Must be cross-referenced with government sources

---

---

# NEW SOURCES (Added February 14, 2026 — Post Research Review)

The following 5 sources were identified during a second round of research. Each has been assessed by a principal AI engineer for relevance, priority, and hackathon applicability.

---

## 10. Source 9: WHO Prehospital Emergency Care — ABCDE Framework

### What It Is

The **ABCDE approach** is the universal emergency assessment framework used by paramedics, first responders, and emergency physicians worldwide. It stands for:

| Letter | Assessment | What to Check |
|--------|-----------|---------------|
| **A** | **Airway** | Is the airway clear? Can the patient speak/breathe? |
| **B** | **Breathing** | Is breathing normal? Rate? Effort? Oxygen levels? |
| **C** | **Circulation** | Pulse? Bleeding? Skin color? Blood pressure? |
| **D** | **Disability** | Consciousness level? Pupil response? Blood sugar? |
| **E** | **Exposure** | Full body check — injuries, rashes, bites, temperature? |

This is published in WHO's prehospital emergency care guidelines and is the standard taught to every emergency medical professional globally.

### Why It's a Strong Addition (Engineer's Assessment)

**Status: NEW — Not previously covered. We had WHO IMAI (district clinician manual) and IMCI (childhood illness), but ABCDE is a different, more structured emergency assessment framework.**

Why it matters for VaidyaVaani:
- It gives the AI a **structured assessment order** for emergencies. Instead of asking random questions when someone calls in a panic, the AI follows: Airway → Breathing → Circulation → Disability → Exposure.
- It maps perfectly to the **Emergency Protocol KB routing logic**. The intent classifier detects "emergency" → the AI follows ABCDE to assess severity.
- It's **simple enough to implement as a decision tree** in Lambda — no complex ML needed.
- Judges who know emergency medicine will **immediately recognize ABCDE** and respect that you're using it.
- It's the same framework that **108 ambulance paramedics use** — so VaidyaVaani speaks the same language as the emergency responders.

### How to Use It (Practical Implementation)

**Do NOT ingest the full WHO prehospital manual into the KB.** Instead:

1. **Structure all emergency scripts using ABCDE order.** Every emergency script in the Emergency Protocol KB should follow this sequence:

```markdown
## EMERGENCY_CARDIAC — ABCDE Assessment Script
### ICD-10: I21.9 (Acute Myocardial Infarction) | Dispatch: 108

**A — Airway:**
"Kya woh bol pa rahe hain?" (Can they speak?)
→ YES: Airway clear, proceed to B
→ NO: "Unhe side mein lita dijiye. Mooh saaf karein." (Lay on side, clear mouth)

**B — Breathing:**
"Kya saans chal rahi hai? Tez ya dheemi?" (Is breathing normal? Fast or slow?)
→ Labored/Fast: Escalate priority
→ Normal: Proceed to C

**C — Circulation:**
"Kya seene mein dard hai? Haath ya jabde mein dard ja raha hai?" (Chest pain? Radiating to arm/jaw?)
→ YES to radiating: CONFIRMED CARDIAC EMERGENCY
→ "Khoon beh raha hai kahin se?" (Any bleeding?)

**D — Disability:**
"Kya woh hosh mein hain?" (Are they conscious?)
→ NO: CRITICAL — immediate 108 dispatch
→ "Kya haath-pair hil rahe hain?" (Can they move limbs?)

**E — Exposure:**
"Kya paseena aa raha hai? Ulti ho rahi hai?" (Sweating? Vomiting?)
→ Sweating + chest pain = classic cardiac presentation
```

2. **Use ABCDE as the AI's internal assessment framework**, not as a document in the KB. The framework guides how the emergency scripts are written, not what the KB stores.

### Maps to VaidyaVaani Features

- ✅ Emergency Protocol KB script structure (all 15 emergency scripts follow ABCDE)
- ✅ Intent classification logic (ABCDE determines severity level)
- ✅ 108 paramedic handoff (AI assessment in same framework as paramedics)
- ✅ Demo credibility ("We use the WHO ABCDE prehospital assessment framework")

### Hackathon Priority: 🔴 HIGH
Not as a KB document, but as the structural framework for all emergency scripts. Zero extra documents needed — just restructure existing scripts.

---

## 11. Source 10: National Protocol for Management of Snakebite 2024 (India-Specific)

### What It Is

India's own **National Protocol for Management of Snakebite**, released as part of the **NAPSE (National Action Plan for Prevention and Control of Snakebite Envenoming)** launched in 2024. This is distinct from the WHO SE Asia guidelines — it's India-government-specific.

### Why It's Different from WHO Snakebite Guidelines (Source 4)

| Aspect | WHO SE Asia Guidelines (Source 4) | India National Protocol 2024 (This Source) |
|--------|-----------------------------------|-------------------------------------------|
| **Publisher** | WHO Regional Office | Government of India (MoHFW) |
| **Scope** | All of South-East Asia | India-specific |
| **Species Focus** | Regional (multiple countries) | India's "Big Four" + regional species |
| **Legal Authority** | Advisory | Government mandate |
| **Year** | 2016 (2nd edition) | 2024 (latest) |
| **Goal** | General management | Halve snakebite deaths by 2030 |

### Key Protocols (India-Specific)

The 2024 protocol **strictly prohibits** common harmful practices:

```
INDIA NATIONAL SNAKEBITE PROTOCOL 2024 — STRICT PROHIBITIONS:
❌ DO NOT apply tourniquet (causes tissue death, amputation)
❌ DO NOT suck the venom (ineffective, risks infection)
❌ DO NOT cut or incise the bite wound
❌ DO NOT apply ice or cold compress
❌ DO NOT apply herbal remedies or "snake stones"
❌ DO NOT give alcohol or traditional medicines
❌ DO NOT try to catch or kill the snake
```

These prohibitions are critical for VaidyaVaani because **rural India commonly practices all of these harmful "remedies."** The AI must actively counter these myths.

### India's "Big Four" Venomous Snakes

| Snake | Hindi Name | Region | Venom Type |
|-------|-----------|--------|------------|
| **Indian Cobra** (Naja naja) | Naag | All India | Neurotoxic |
| **Common Krait** (Bungarus caeruleus) | Karait | All India | Neurotoxic |
| **Russell's Viper** (Daboia russelii) | Koriwala / Ghonas | All India | Hemotoxic |
| **Saw-scaled Viper** (Echis carinatus) | Phoorsa | Western/Central India | Hemotoxic |

These four species account for the vast majority of India's 50,000+ annual snakebite deaths.

### How to Use It

- **Replace** the generic WHO snakebite first-aid in your Emergency Protocol KB with this India-specific protocol
- Include the "Big Four" identification guide (description-based, for voice; photo-based, for WhatsApp)
- Explicitly include the "DO NOT" list — the AI must actively counter harmful myths
- Tag with ICD-10: T63.0 (Contact with snake venom)

### Maps to VaidyaVaani Features

- ✅ Snakebite emergency script (India-specific, not generic WHO)
- ✅ Myth-busting ("Tourniquet mat lagaiye!" — Don't apply tourniquet!)
- ✅ Species identification (Big Four descriptions for voice triage)
- ✅ WhatsApp photo path (snake photo → Claude Vision → species ID)
- ✅ 108 dispatch with "snakebite + suspected species" info for hospital

### Hackathon Priority: 🔴 HIGH
Replaces/supplements Source 4 for the snakebite emergency script. India-specific = more credible with judges.

---

## 12. Source 11: NHM National Ambulance Service (NAS) Guidelines — 108 vs 102

### What It Is

The **National Health Mission (NHM)** operates two distinct ambulance services across India. VaidyaVaani's emergency dispatch logic **MUST** know the difference — dispatching the wrong type is a credibility killer with judges.

### The Two Services

| Service | Dial Number | Type | Crew | Use Case | Cost |
|---------|-------------|------|------|----------|------|
| **108 — Emergency Response** | 108 | Advanced Life Support (ALS) / Basic Life Support (BLS) | Paramedic + Driver + Equipment | Life-threatening emergencies: cardiac arrest, trauma, stroke, snakebite, severe bleeding, poisoning | Free |
| **102 — Patient Transport** | 102 | Basic transport vehicle | Driver only (no paramedic) | Non-emergency transport: pregnant woman to hospital for delivery, patient transfer between facilities, follow-up visits | Free |

### Why This Matters for VaidyaVaani

Getting this wrong destroys credibility:

| Scenario | Correct Dispatch | Wrong Dispatch |
|----------|-----------------|----------------|
| Heart attack | **108** (paramedic needed) | 102 = patient dies in transit, no paramedic |
| Pregnant woman, routine labor | **102** (transport to hospital) | 108 = wastes critical emergency resource |
| Pregnant woman, hemorrhaging | **108** (life-threatening) | 102 = no paramedic, patient bleeds out |
| Snakebite | **108** (needs antivenom en route) | 102 = no medical equipment |
| Diabetic patient, routine checkup | **102** (transport only) | 108 = wastes emergency ambulance |
| Child with high fever, stable | **102** (transport to PHC) | 108 = overkill, wastes resources |
| Child with seizure, unconscious | **108** (life-threatening) | 102 = no paramedic |

### How to Use It (Practical Implementation)

**This is NOT a KB document.** This is operational logic that goes into:

1. **Emergency scripts** — each script specifies which number to dispatch:
```markdown
## EMERGENCY_CARDIAC
Dispatch: 108 (Emergency Response — Paramedic Required)

## EMERGENCY_PREGNANCY_HEMORRHAGE  
Dispatch: 108 (Emergency Response — Life Threatening)

## NON_EMERGENCY_PREGNANCY_LABOR
Dispatch: 102 (Patient Transport — Routine Delivery)

## EMERGENCY_SNAKEBITE
Dispatch: 108 (Emergency Response — Antivenom May Be Needed)
```

2. **Lambda routing code** — the dispatch function checks severity tier:
```
Tier A (Critical/Life-Threatening) → Dispatch 108
Tier B (Urgent/Non-Critical) → Dispatch 102 OR advise self-transport
Tier C (Non-Urgent) → Advise visit to PHC during working hours
```

3. **Demo script** — when the AI says "Ambulance bhej rahi hoon," it should specify:
   - "108 emergency ambulance bhej rahi hoon, paramedic aayega" (for emergencies)
   - "102 gaadi bhej rahi hoon, aapko hospital le jayegi" (for transport)

### Maps to VaidyaVaani Features

- ✅ Emergency dispatch logic (108 vs 102 routing)
- ✅ Emergency scripts (each script specifies correct dispatch number)
- ✅ Demo credibility (shows you understand India's ambulance infrastructure)
- ✅ Enterprise Readiness (realistic, not fantasy "auto-booking")
- ✅ Conference call bridge (108 for Tier A, API booking for Tier B)

### Hackathon Priority: 🔴 HIGH
Not a KB document — operational logic in Lambda + emergency scripts. 30 minutes to implement, massive credibility boost.

---

## 13. Source 12: ABDM Health Data Standards — ICD-10 & LOINC Coding

### What It Is

The **Ayushman Bharat Digital Mission (ABDM)** has adopted international health data standards for interoperability across India's digital health ecosystem:

- **ICD-10** (International Classification of Diseases, 10th Revision) — standard codes for every diagnosis
- **LOINC** (Logical Observation Identifiers Names and Codes) — standard codes for lab tests and observations
- **MDDS** (Metadata and Data Standards) — India's health data exchange standards

### Why It Matters for VaidyaVaani

We already covered ABDM/FHIR interoperability in the Enterprise Readiness document (Risk 4: "The Silo", Standard 5: "Interoperability"). But the specific use of **ICD-10 codes** adds a concrete, implementable layer:

When VaidyaVaani classifies a condition, it should internally tag it with the ICD-10 code. This makes every triage record ABDM-compliant from day one.

### ICD-10 Codes for VaidyaVaani's Key Conditions

| Condition | ICD-10 Code | Hindi Trigger Keywords |
|-----------|-------------|----------------------|
| Acute Myocardial Infarction (Heart Attack) | I21.9 | seene mein dard, haath mein dard, saans nahi |
| Stroke | I64 | ek taraf ka shareer kaam nahi, bolne mein dikkat |
| Snakebite Envenoming | T63.0 | saanp ne kaata, saanp ka zeher |
| Acute Gastroenteritis (Child) | A09 | ulti, dast, bukhar |
| Dehydration | E86.0 | paani ki kami, mooh sukha |
| Pre-eclampsia | O14.9 | pregnancy mein sir dard, sujan, BP |
| Cellulitis (Wound Infection) | L03.9 | ghav mein sujan, laal, garam |
| Diabetes Mellitus Type 2 | E11.9 | sugar ki bimari, zyada pyaas |
| Hypertension | I10 | BP badha hua, sir dard |
| Asthma / Breathing Difficulty | J45.9 | saans phoolna, dama |
| Seizure / Convulsions | R56.9 | mirgi, jhatkay |
| Burns | T30.0 | jal gaya, aag se |
| Poisoning | T65.9 | zeher kha liya, dawai zyada |
| Allergic Reaction (Anaphylaxis) | T78.2 | sujan, saans mein dikkat, kuch khane ke baad |
| Dengue Fever | A90 | tez bukhar, jodo mein dard, rash |

### How to Use It (Practical Implementation)

1. **Hardcode ICD-10 codes in every emergency script:**
```markdown
## EMERGENCY_CARDIAC
### ICD-10: I21.9 | Dispatch: 108 | Severity: CRITICAL
```

2. **Log ICD-10 code with every triage decision in DynamoDB:**
```json
{
  "call_id": "VV-2026-001234",
  "timestamp": "2026-02-15T02:30:00Z",
  "icd10_code": "I21.9",
  "condition": "Acute Myocardial Infarction",
  "severity": "CRITICAL",
  "dispatch": "108",
  "location": "Khedi Village, MP"
}
```

3. **Use ICD-10 codes in FHIR JSON records** for ABDM interoperability:
```json
{
  "resourceType": "Condition",
  "code": {
    "coding": [{
      "system": "http://hl7.org/fhir/sid/icd-10",
      "code": "I21.9",
      "display": "Acute myocardial infarction, unspecified"
    }]
  }
}
```

4. **Use ICD-10 codes for Disease Surveillance aggregation:**
   - Group calls by ICD-10 code + location + time
   - "23 calls with A90 (Dengue) from Khedi village in 3 days" → outbreak alert

### The Pitch to Judges

> "Every diagnosis VaidyaVaani makes is tagged with ICD-10 codes and stored in FHIR JSON format, making us ABDM-interoperable on day one. Our disease surveillance system aggregates by ICD-10 code and geography to detect outbreak patterns."

### Maps to VaidyaVaani Features

- ✅ ABDM interoperability (FHIR + ICD-10 = compliant from day 1)
- ✅ Disease surveillance (aggregate by ICD-10 code + location)
- ✅ Audit trail (every triage decision has a standard medical code)
- ✅ Enterprise Readiness (shows you understand health data standards)
- ✅ Government pitch (ABDM is the government's own digital health initiative)

### Hackathon Priority: 🟡 MEDIUM
Hardcode ICD-10 codes for 15 conditions in emergency scripts = 30 minutes of work. Add to DynamoDB logging = 1 hour. Massive credibility for minimal effort.

---

## 14. Source 13: Triage Benchmark Datasets (For Evaluation Only)

### ⚠️ IMPORTANT: These Are NOT for the Knowledge Base

These datasets are for **testing and evaluating** your triage prompts and flows — NOT for feeding into the Bedrock KB as medical facts. The distinction is critical.

### Available Benchmark Datasets

| Dataset | Source | What It Is | Format |
|---------|--------|-----------|--------|
| **MIETIC** | Built on MIMIC-IV (MIT) | Triage instruction corpus with labeled emergency cases and ESI (Emergency Severity Index) levels. Designed specifically for LLM triage benchmarking. | Structured dataset |
| **TriageBench** | Academic | Triage vignettes (clinical scenarios) with expected severity classifications. Used to test if an LLM correctly triages patients. | Vignettes + labels |
| **Kaggle Synthetic Triage** | Kaggle | Synthetic emergency department triage data. Useful for testing classification accuracy. | CSV |

### How to Use Them (Engineer's Assessment)

**For the hackathon:** You won't have time to run proper benchmark evaluations. But mention them in your methodology:

> "We plan to validate our triage accuracy using established benchmarks like MIETIC (built on MIMIC-IV) and TriageBench, adapted for Indian clinical contexts with ICMR STW-based ground truth labels."

**For production (post-hackathon):**
1. Take MIETIC vignettes → translate to Hindi → run through VaidyaVaani
2. Compare AI's triage classification vs ground truth ESI levels
3. Measure: accuracy, over-triage rate, under-triage rate
4. Goal: over-triage is acceptable (safe), under-triage is NOT (dangerous)

### Important Caveats

- **MIETIC uses ESI (US standard)** — India doesn't use ESI. You'd need to map ESI levels to your own severity tiers (Critical/Urgent/Non-Urgent).
- **MIMIC-IV is US hospital data** — disease patterns, demographics, and presentations differ from rural India. Use for methodology validation, not as ground truth for Indian conditions.
- **Synthetic data has limitations** — it doesn't capture how a rural Indian farmer describes chest pain in Bhojpuri. Real-world testing with Indian clinical scenarios is essential.

### Maps to VaidyaVaani Features

- ✅ Triage accuracy validation (post-hackathon)
- ✅ Methodology credibility ("we know how to evaluate medical AI")
- ✅ Safety assurance ("we measure over-triage vs under-triage rates")
- ⚠️ NOT for KB ingestion — evaluation only

### Hackathon Priority: 🟢 LOW
Mention in methodology/Q&A. Don't build during hackathon. Zero documents to ingest.

---

## 15. Data Format Strategy for Bedrock Knowledge Base

### What Bedrock KB Supports

Amazon Bedrock Knowledge Bases supports the following document formats for ingestion from S3:

| Format | Extension | Best For |
|--------|-----------|----------|
| **PDF** | .pdf | ICMR STWs (direct ingest, one-pagers) |
| **Plain Text** | .txt | Converted protocols, simple guidelines |
| **Markdown** | .md | Structured protocols, emergency scripts, chunked WHO guidelines |
| **HTML** | .html | Web-scraped content, structured documents |
| **CSV** | .csv | Symptom-disease mappings, tabular data |
| **Microsoft Word** | .doc, .docx | Formatted guidelines |
| **Excel** | .xls, .xlsx | Tabular medical data |

Bedrock KB primarily processes **text-based content**. It can handle tables within documents but does NOT process images/graphs embedded in PDFs as part of the knowledge base.

### Recommended Format for Each Source

| Source | Original Format | Recommended Ingestion Format | Why |
|--------|----------------|------------------------------|-----|
| ICMR STWs | PDF (one-pagers) | **PDF (direct)** | Clean one-page docs, chunking will be accurate |
| WHO IMAI | PDF (large multi-chapter) | **Markdown (chunked by topic)** | Large docs need splitting for better retrieval |
| WHO IMCI | PDF (large multi-chapter) | **Markdown (chunked by topic)** | Same as IMAI — split into assessment sections |
| WHO Snakebite | PDF (large) | **Markdown (chunked)** | Split into: first aid, species ID, treatment |
| India Snakebite 2024 | PDF | **Markdown** | Merge with WHO snakebite, add India-specific prohibitions |
| RMNCH+A | PDF (handbook) | **Markdown (chunked by condition)** | Split into: pregnancy, newborn, child sections |
| IPHS | PDF (guidelines) | **Markdown (by facility level)** | Split into: Sub-Centre, PHC, CHC, District Hospital |
| NLEM | PDF (list) | **CSV** | Tabular data — medicine name, category, facility level |
| Emergency Scripts | Hand-crafted | **Markdown (ABCDE structure)** | Deterministic scripts with ICD-10 + 108/102 dispatch |
| Symptom-Disease Data | CSV | **CSV (direct)** | Already structured, direct ingest |
| NAS 108/102 Logic | Operational | **Not in KB — Lambda code** | Routing logic, not a document |
| ICD-10 Codes | Reference | **Hardcoded in scripts + DynamoDB** | Tags, not a separate document |
| ABCDE Framework | WHO Guidelines | **Not in KB — script structure** | Framework for writing scripts, not a document |
| Triage Benchmarks | Academic datasets | **Not in KB — evaluation only** | For testing accuracy post-hackathon |

### The Emergency Scripts Strategy (CRITICAL)

For life-threatening emergencies, VaidyaVaani must use **deterministic, pre-approved scripts** — NOT AI-generated text. This is the "Guardrailed First Aid" approach from the Enterprise Readiness document.

**How it works:**
1. AI classifies the emergency type (e.g., `EMERGENCY_CHEST_PAIN`)
2. System retrieves the **pre-approved static script** from Knowledge Base
3. AI reads the script verbatim — no generation, no hallucination risk

**Example emergency script format (Markdown) — Now using ABCDE Framework + ICD-10 + 108/102 Dispatch:**

```markdown
## EMERGENCY_CHEST_PAIN
### Source: ICMR STW (STEMI) + WHO Prehospital Guidelines + India NAS
### ICD-10: I21.9 (Acute Myocardial Infarction, Unspecified)
### Dispatch: 108 (Emergency Response — Paramedic Required)
### Language: Bilingual (Hindi + English)

**A — AIRWAY:**
"Kya woh bol pa rahe hain?" (Can they speak?)
→ NO → "Unhe side mein lita dijiye, mooh saaf karein" (Lay on side, clear mouth)
→ YES → Proceed to B

**B — BREATHING:**
"Saans chal rahi hai? Tez ya mushkil se?" (Breathing? Fast or difficult?)
→ Labored → Escalate priority, note for paramedic
→ Normal → Proceed to C

**C — CIRCULATION:**
"Seene mein dard hai? Haath ya jabde mein ja raha hai?" (Chest pain? Radiating to arm/jaw?)
→ YES (radiating) → CONFIRMED CARDIAC — immediate 108 dispatch
"Paseena aa raha hai?" (Sweating?)
→ YES → Classic cardiac presentation

**D — DISABILITY:**
"Kya woh hosh mein hain?" (Are they conscious?)
→ NO → CRITICAL — 108 dispatched, stay on line
"Haath-pair hil rahe hain?" (Can they move limbs?)

**E — EXPOSURE:**
"Ulti ho rahi hai?" (Vomiting?)
"Pehle kabhi aisa hua hai?" (Has this happened before?)

**IMMEDIATE ACTIONS:**
- Rogi ko lita dijiye (Keep patient lying down)
- Paani mat dijiye (Do not give water)
- Agar aspirin hai toh ek goli chabane ko dijiye (If aspirin available, chew one tablet)
- Rogi ko chalne mat dijiye (Do not let patient walk)
- 108 emergency ambulance abhi bhej rahi hoon (Dispatching 108 emergency ambulance now)

**DO NOT:**
- Do not let patient eat or drink
- Do not let patient walk or exert
- Do not wait — this is a medical emergency

**DISPATCH:**
- 108 Emergency Response (Paramedic + ALS equipment)
- SMS to 3 emergency contacts with location
- Alert nearest hospital with cardiac facility
```

Create similar scripts for: snakebite, severe bleeding, stroke, choking, burns, poisoning, drowning, allergic reaction (anaphylaxis), seizure, pregnancy emergency. **Each script must include: ABCDE assessment structure, ICD-10 code, 108 vs 102 dispatch specification, and bilingual (Hindi + English) instructions.**

---

## 16. Priority Ingestion Order

For building the Bedrock Knowledge Base, follow this order:

### Phase 1: Hackathon Demo (Days 1-3) — 20-30 Documents

| Priority | Source | Documents | Purpose |
|----------|--------|-----------|---------|
| 🔴 P0 | Emergency first-aid scripts | 10 scripts | Guardrailed emergency responses (hand-crafted from WHO/ICMR) |
| 🔴 P0 | ICMR STWs (demo-relevant) | 5-10 STWs | Fever, dehydration, chest pain, wound infection, snakebite |
| 🔴 P0 | WHO IMCI (pediatric sections) | 3-5 chunks | Child assessment, dehydration classification, ORS protocol |
| 🟡 P1 | WHO Snakebite (first aid chapter) | 2-3 chunks | First aid, species identification, when to refer |
| 🟡 P1 | Symptom-disease CSV | 1 file | Basic symptom-to-condition mapping |

### Phase 2: Full Hackathon Build (Days 4-10) — 50-80 Documents

| Priority | Source | Documents | Purpose |
|----------|--------|-----------|---------|
| 🟡 P1 | ICMR STWs (expanded) | 30-50 STWs | Cover top 50 conditions by prevalence |
| 🟡 P1 | WHO IMAI (triage chapters) | 5-10 chunks | Adult triage logic, emergency assessment |
| 🟡 P1 | RMNCH+A (pregnancy sections) | 3-5 chunks | Pregnancy danger signs, maternal emergencies |
| 🟢 P2 | IPHS (facility capabilities) | 4 chunks | What each facility level can handle |
| 🟢 P2 | NLEM (medicines list) | 1 CSV | Available medicines by facility level |

### Phase 3: Production Readiness (Post-Hackathon)

| Priority | Source | Documents | Purpose |
|----------|--------|-----------|---------|
| 🟢 P2 | All 157 ICMR STWs | 157 PDFs | Complete coverage |
| 🟢 P2 | Full WHO IMAI/IMCI | All chapters | Complete triage logic |
| 🟢 P2 | Full RMNCH+A | All sections | Complete maternal/child coverage |
| 🟢 P2 | State-specific protocols | Varies | Regional disease patterns, local facilities |
| 🔵 P3 | AYUSH protocols | Varies | Traditional medicine integration (if needed) |

---

## 17. Hackathon-Specific Strategy (What You Actually Need)

### The Reality Check

You don't need ALL 157 STWs for the hackathon. You need data for your **3 demo scenarios** + enough coverage to handle judge Q&A.

### Demo Scenario → Data Mapping

| Demo Scenario | Data Sources Needed | Documents |
|---------------|--------------------|-----------| 
| **Demo 1: Hindi — Mother with sick child (fever, vomiting)** | WHO IMCI (child assessment, dehydration classification, ORS protocol) + ICMR STW (acute gastroenteritis, fever in children) | 3-5 docs |
| **Demo 2: WhatsApp Photo — Wound/skin condition** | WHO wound management guidelines + ICMR STW (cellulitis, wound infection) + skin condition classification | 2-3 docs |
| **Demo 3: Emergency — Chest pain / Snakebite** | Emergency first-aid scripts (hand-crafted) + ICMR STW (STEMI, acute coronary syndrome) + WHO snakebite first aid | 3-5 docs |
| **Chronic Care Demo (if shown)** | ICMR STW (diabetes management, hypertension) + medication adherence protocols | 2-3 docs |
| **Disease Surveillance Dashboard** | No KB data needed — this uses call log analytics, not medical protocols | 0 docs |

### Person 3's Task (Knowledge Base + Content — Days 1-3)

**Day 1:**
1. Download 10 most relevant ICMR STWs from icmr.gov.in:
   - Acute Gastroenteritis (child)
   - Fever in Children
   - Dehydration Management
   - STEMI (heart attack)
   - Acute Coronary Syndrome
   - Snakebite Management
   - Cellulitis / Wound Infection
   - Diabetes Mellitus Type 2
   - Hypertension
   - Pre-eclampsia / Eclampsia
2. Upload directly to S3 bucket as PDFs

**Day 2:**
1. Extract and convert key WHO IMCI sections to Markdown:
   - "Assess and Classify the Sick Child" → `imci-child-assessment.md`
   - "Dehydration Classification" → `imci-dehydration.md`
   - "ORS Preparation and Administration" → `imci-ors-protocol.md`
2. Extract WHO Snakebite first aid chapter → `who-snakebite-first-aid.md`
3. Create symptom-disease mapping CSV for top 20 conditions

**Day 3:**
1. Hand-craft 10 emergency first-aid scripts in Markdown (from WHO/ICMR protocols):
   - `emergency-chest-pain.md` (ICD-10: I21.9, Dispatch: 108)
   - `emergency-snakebite.md` (ICD-10: T63.0, Dispatch: 108) — use India National Protocol 2024
   - `emergency-severe-bleeding.md` (ICD-10: R58, Dispatch: 108)
   - `emergency-stroke.md` (ICD-10: I64, Dispatch: 108)
   - `emergency-choking.md` (ICD-10: T17.9, Dispatch: 108)
   - `emergency-burns.md` (ICD-10: T30.0, Dispatch: 108)
   - `emergency-poisoning.md` (ICD-10: T65.9, Dispatch: 108)
   - `emergency-allergic-reaction.md` (ICD-10: T78.2, Dispatch: 108)
   - `emergency-seizure.md` (ICD-10: R56.9, Dispatch: 108)
   - `emergency-pregnancy.md` (ICD-10: O14.9/O72.1, Dispatch: 108 for hemorrhage/eclampsia, 102 for routine labor)
2. **Every script must follow ABCDE assessment structure** (Airway → Breathing → Circulation → Disability → Exposure)
3. **Every script must include ICD-10 code + 108 vs 102 dispatch specification**
4. Each script in both English and Hindi (for bilingual TTS)
5. Upload all to S3, sync with Bedrock KB

**End of Day 3: Knowledge Base has ~25-30 documents covering all demo scenarios + common emergencies.**

---

## 18. The Killer Pitch Line for Judges

> **"Our knowledge base is powered by ICMR Standard Treatment Workflows — the same 157 government-mandated protocols across 28 specialties that the Union Health Ministry has directed all states to adopt — supplemented by WHO IMAI and IMCI clinical guidelines designed specifically for resource-limited settings. Every emergency script follows the WHO ABCDE prehospital assessment framework, every diagnosis is tagged with ICD-10 codes for ABDM interoperability, and our dispatch logic correctly routes between 108 emergency response and 102 patient transport. VaidyaVaani doesn't use random internet data. It uses the exact same protocols the government wants every doctor in India to follow."**

### Why This Works

1. **ICMR** — India's highest medical research authority. Judges know this name.
2. **"Government-mandated"** — not just approved, but actively directed by the Health Secretary.
3. **"157 protocols across 28 specialties"** — shows comprehensive coverage, not a toy.
4. **WHO IMAI/IMCI** — global gold standard for resource-limited triage. Unquestionable authority.
5. **"ABCDE framework"** — any judge with emergency medicine background instantly recognizes this.
6. **"ICD-10 codes"** — shows you understand health data standards, not just coding.
7. **"108 vs 102"** — shows you understand India's actual ambulance infrastructure.
8. **"Same protocols the government wants every doctor to follow"** — positions VaidyaVaani as a digital extension of government healthcare policy.

### For the Enterprise Readiness Slide

Add to the 8-Point Enterprise Shield:

| # | Category | Standard | VaidyaVaani Implementation |
|---|----------|----------|---------------------------|
| 9 | **Medical Data** | ICMR STW + WHO IMAI/IMCI | 157 government-mandated treatment protocols + WHO clinical guidelines for resource-limited settings |
| 10 | **Emergency Framework** | WHO ABCDE + India NAS | ABCDE prehospital assessment + correct 108/102 dispatch routing |
| 11 | **Health Data Coding** | ABDM / ICD-10 / LOINC | Every diagnosis tagged with ICD-10, stored in FHIR JSON, ABDM-ready |

---

## 19. Quick Reference: All URLs

### Government of India Sources

| Source | URL |
|--------|-----|
| ICMR STW Downloads | https://www.icmr.gov.in/standard-treatment-workflows-stws |
| ICMR STW Portal | https://stw.icmr.org |
| ICMR Downloadable Books | https://www.icmr.gov.in/downloadable-books |
| NHM Portal | https://nhm.gov.in |
| IPHS Guidelines | Available from nhm.gov.in |
| India NLEM | Available from Ministry of Health portal |
| India NAPSE (Snakebite 2024) | Search "India NAPSE snakebite 2024" on MoHFW portal |
| NHM NAS Guidelines (108/102) | Available from nhm.gov.in (National Ambulance Service section) |
| ABDM Health Data Standards | https://abdm.gov.in |

### WHO Sources

| Source | URL |
|--------|-----|
| WHO IMAI District Clinician Manual | https://www.who.int/publications/i/item/9789241548281 |
| WHO IMCI Guidelines | https://www.who.int/publications/i/item/9241546441 |
| WHO Snakebite Guidelines (2nd Ed) | https://www.who.int/publications-detail-redirect/9789290225300 |
| WHO Snakebite Guidelines (1st Ed) | https://www.who.int/publications/i/item/9789290223774 |
| WHO Snakebite SE Asia (Original) | https://www.who.int/southeastasia/publications-detail/B0241 |
| WHO Snakebite Treatment Page | https://www.who.int/teams/control-of-neglected-tropical-diseases/snakebite-envenoming/treatment |
| WHO Snakebite Strategy 2030 | https://www.who.int/publications/i/item/9789241515641 |
| WHO Essential Medicines List | https://www.who.int/groups/expert-committee-on-selection-and-use-of-essential-medicines/essential-medicines-lists |
| WHO Prehospital Emergency Care (ABCDE) | Available from WHO Emergency Care publications |

### Health Data Standards

| Standard | Description | Reference |
|----------|-------------|-----------|
| ICD-10 | International Classification of Diseases, 10th Revision | https://icd.who.int/browse10 |
| LOINC | Logical Observation Identifiers Names and Codes | https://loinc.org |
| FHIR | Fast Healthcare Interoperability Resources | https://www.hl7.org/fhir/ |
| ABDM MDDS | India Metadata and Data Standards for Health | https://abdm.gov.in |

### Supplementary Open Datasets

| Source | Platform | URL |
|--------|----------|-----|
| Symptom-Disease Prediction | Mendeley Data | Search on data.mendeley.com |
| TachyHealth | HuggingFace | Search on huggingface.co/datasets |
| Disease Symptom Knowledge DB | Kaggle | Search on kaggle.com/datasets |

### Triage Benchmark Datasets (Evaluation Only)

| Dataset | Description | Use |
|---------|-------------|-----|
| MIETIC | Triage instruction corpus built on MIMIC-IV, with ESI levels | LLM triage benchmarking |
| TriageBench | Clinical vignettes with expected severity classifications | Triage accuracy testing |
| Kaggle Synthetic Triage | Synthetic ED triage data | Classification accuracy testing |

### News References (For Credibility)

| Article | Source | URL |
|---------|--------|-----|
| ICMR releases 32 new STWs (July 2024) | India Today | https://www.indiatoday.in/health/story/medical-research-panel-icmr-releases-new-treatment-standards-for-doctors-2572191-2024-07-26 |
| Centre asks states to implement 157 STWs | Medical Dialogues | https://medicaldialogues.in/news/health/implement-157-standard-treatment-workflows-in-28-specialities-centre-asks-states-132558 |
| ICMR STWs for 5 new specialties | The Statesman | https://www.thestatesman.com/india/icmr-issues-32-new-standard-treatment-guidelines-for-common-serious-diseases-1503324449.html |
| STWs to help expand health cover | Economic Times | https://m.economictimes.com/wealth/insure/standard-treatment-workflows-to-help-expand-health-cover/amp_articleshow/124005146.cms |
| India NAPSE for snakebite (2024) | Multiple sources | Search "India NAPSE snakebite 2024" |

---

## Summary: The Complete Data Strategy

### All Sources in One Table

| # | Layer | Source | Authority | Format | Documents | Purpose |
|---|-------|--------|-----------|--------|-----------|---------|
| 1 | **Core Triage** | ICMR STWs | Govt of India (mandated) | PDF | 157 (10 for hackathon) | Treatment protocols for all conditions |
| 2 | **Triage Logic** | WHO IMAI | WHO | PDF → Markdown | 5-10 chunks | "What questions to ask" decision trees |
| 3 | **Pediatric** | WHO IMCI | WHO | PDF → Markdown | 3-5 chunks | Child assessment, ORS, danger signs |
| 4 | **Snakebite** | WHO + India NAPSE 2024 | WHO + Govt of India | PDF → Markdown | 2-3 chunks | First aid, species ID, India-specific prohibitions |
| 5 | **Maternal** | RMNCH+A | Govt of India (NHM) | PDF → Markdown | 3-5 chunks | Pregnancy danger signs, maternal care |
| 6 | **Referral** | IPHS | Govt of India (NHM) | PDF → Markdown | 4 chunks | Facility capabilities by level |
| 7 | **Medicines** | NLEM | Govt of India | PDF → CSV | 1 file | Available medicines by facility |
| 8 | **Supplementary** | Open datasets | Academic/Community | CSV | 1-3 files | Symptom-disease mapping |
| 9 | **Emergency Framework** | WHO ABCDE | WHO | Not in KB — script structure | 0 (framework) | ABCDE assessment order for all emergency scripts |
| 10 | **Emergency Scripts** | Hand-crafted from WHO/ICMR | WHO + ICMR (derived) | Markdown (ABCDE + ICD-10 + 108/102) | 10-15 scripts | Deterministic first-aid (no hallucination) |
| 11 | **Ambulance Dispatch** | NHM NAS Guidelines | Govt of India (NHM) | Not in KB — Lambda logic | 0 (code) | 108 vs 102 routing in dispatch function |
| 12 | **Health Data Coding** | ABDM / ICD-10 / LOINC | WHO + Govt of India | Hardcoded in scripts + DynamoDB | 0 (tags) | Every diagnosis tagged with ICD-10 code |
| 13 | **Evaluation** | MIETIC / TriageBench | Academic | Not in KB — testing only | 0 (benchmarks) | Post-hackathon triage accuracy validation |

### What Goes INTO the Bedrock KB (Documents)

| Category | Documents | Total |
|----------|-----------|-------|
| ICMR STWs (PDFs) | 10 for hackathon, 157 for production | 10-157 |
| WHO IMAI/IMCI chunks (Markdown) | Triage logic, child assessment, ORS | 8-15 |
| Snakebite protocols (Markdown) | WHO + India 2024, merged | 2-3 |
| RMNCH+A chunks (Markdown) | Pregnancy, maternal, newborn | 3-5 |
| Emergency scripts (Markdown) | ABCDE-structured, ICD-10 tagged, 108/102 specified | 10-15 |
| IPHS facility data (Markdown) | By facility level | 4 |
| NLEM medicines (CSV) | By facility level | 1 |
| Symptom-disease mapping (CSV) | Supplementary | 1-3 |
| **HACKATHON TOTAL** | | **~35-45 documents** |
| **PRODUCTION TOTAL** | | **~200+ documents** |

### What Does NOT Go Into the KB (Operational Logic)

| Item | Where It Lives | Why Not in KB |
|------|---------------|---------------|
| ABCDE framework | Structure of emergency scripts | It's a framework, not a document |
| 108 vs 102 dispatch logic | Lambda routing code | It's operational logic, not medical data |
| ICD-10 codes | Hardcoded in scripts + DynamoDB schema | They're tags/metadata, not searchable content |
| Triage benchmarks (MIETIC etc.) | Evaluation pipeline (post-hackathon) | For testing accuracy, not for medical facts |
| ASHA training modules | Reference only | Know it for Q&A, don't ingest |
| DPDP Act compliance | Architecture design | Legal framework, not medical data |

---

*This document is part of the VaidyaVaani project documentation for the AI for Bharat 2026 Hackathon.*
*Team: SavyaSachi*
*Last Updated: February 14, 2026 (v2 — added 5 new sources from research review)*
*Total Sources: 13 (8 original + 5 new)*
