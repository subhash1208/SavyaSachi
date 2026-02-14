# VaidyaVaani — Verified Data Sources & Knowledge Base Strategy

**Complete Guide to Government-Approved Medical Data for VaidyaVaani's AI Triage System**

*Created: February 14, 2026*
*For: SavyaSachi Team — AI for Bharat 2026 Hackathon*

---

## Table of Contents

1. [Why This Matters](#1-why-this-matters)
2. [Source 1: ICMR Standard Treatment Workflows (PRIMARY)](#2-source-1-icmr-standard-treatment-workflows-stws--your-primary-source)
3. [Source 2: WHO IMAI — Adult & Adolescent Illness](#3-source-2-who-imai--integrated-management-of-adolescent-and-adult-illness)
4. [Source 3: WHO IMCI — Childhood Illness](#4-source-3-who-imci--integrated-management-of-childhood-illness)
5. [Source 4: WHO Snakebite Management Guidelines](#5-source-4-who-snakebite-management-guidelines-south-east-asia)
6. [Source 5: India RMNCH+A Strategy — Maternal & Child Health](#6-source-5-india-rmncha-strategy--maternal--child-health)
7. [Source 6: IPHS Guidelines 2022 — Facility Standards](#7-source-6-iphs-guidelines-2022--indian-public-health-standards)
8. [Source 7: Essential Medicines Lists (WHO + India NLEM)](#8-source-7-essential-medicines-lists-who--india-nlem)
9. [Source 8: Open Datasets for Symptom-Disease Mapping](#9-source-8-open-datasets-for-symptom-disease-mapping-supplementary)
10. [Data Format Strategy for Bedrock Knowledge Base](#10-data-format-strategy-for-bedrock-knowledge-base)
11. [Priority Ingestion Order](#11-priority-ingestion-order)
12. [Hackathon-Specific Strategy (What You Actually Need)](#12-hackathon-specific-strategy-what-you-actually-need)
13. [The Killer Pitch Line for Judges](#13-the-killer-pitch-line-for-judges)
14. [Quick Reference: All URLs](#14-quick-reference-all-urls)

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

## 10. Data Format Strategy for Bedrock Knowledge Base

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
| RMNCH+A | PDF (handbook) | **Markdown (chunked by condition)** | Split into: pregnancy, newborn, child sections |
| IPHS | PDF (guidelines) | **Markdown (by facility level)** | Split into: Sub-Centre, PHC, CHC, District Hospital |
| NLEM | PDF (list) | **CSV** | Tabular data — medicine name, category, facility level |
| Emergency Scripts | Hand-crafted | **Markdown** | Deterministic scripts, NOT AI-generated |
| Symptom-Disease Data | CSV | **CSV (direct)** | Already structured, direct ingest |

### The Emergency Scripts Strategy (CRITICAL)

For life-threatening emergencies, VaidyaVaani must use **deterministic, pre-approved scripts** — NOT AI-generated text. This is the "Guardrailed First Aid" approach from the Enterprise Readiness document.

**How it works:**
1. AI classifies the emergency type (e.g., `EMERGENCY_CHEST_PAIN`)
2. System retrieves the **pre-approved static script** from Knowledge Base
3. AI reads the script verbatim — no generation, no hallucination risk

**Example emergency script format (Markdown):**

```markdown
## EMERGENCY_CHEST_PAIN
### Source: ICMR STW + WHO Guidelines
### Language: Hindi Script (for TTS)

**Immediate Actions:**
- Rogi ko lita dijiye (Keep patient lying down)
- Paani mat dijiye (Do not give water)
- Agar aspirin hai toh ek goli chabane ko dijiye (If aspirin available, chew one tablet)
- Rogi ko chalne mat dijiye (Do not let patient walk)
- 108 ambulance abhi bhej rahi hoon (Dispatching 108 ambulance now)

**Danger Signs (Escalate Immediately):**
- Behoshi (Unconsciousness)
- Saans band (Breathing stopped)
- Dhadkan band (Heart stopped)

**DO NOT:**
- Do not let patient eat or drink
- Do not let patient walk or exert
- Do not wait — this is a medical emergency
```

Create similar scripts for: snakebite, severe bleeding, stroke, choking, burns, poisoning, drowning, allergic reaction (anaphylaxis), seizure, pregnancy emergency.

---

## 11. Priority Ingestion Order

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

## 12. Hackathon-Specific Strategy (What You Actually Need)

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
   - `emergency-chest-pain.md`
   - `emergency-snakebite.md`
   - `emergency-severe-bleeding.md`
   - `emergency-stroke.md`
   - `emergency-choking.md`
   - `emergency-burns.md`
   - `emergency-poisoning.md`
   - `emergency-allergic-reaction.md`
   - `emergency-seizure.md`
   - `emergency-pregnancy.md`
2. Each script in both English and Hindi (for bilingual TTS)
3. Upload all to S3, sync with Bedrock KB

**End of Day 3: Knowledge Base has ~25-30 documents covering all demo scenarios + common emergencies.**

---

## 13. The Killer Pitch Line for Judges

> **"Our knowledge base is powered by ICMR Standard Treatment Workflows — the same 157 government-mandated protocols across 28 specialties that the Union Health Ministry has directed all states to adopt — supplemented by WHO IMAI and IMCI clinical guidelines designed specifically for resource-limited settings. VaidyaVaani doesn't use random internet data. It uses the exact same protocols the government wants every doctor in India to follow."**

### Why This Works

1. **ICMR** — India's highest medical research authority. Judges know this name.
2. **"Government-mandated"** — not just approved, but actively directed by the Health Secretary.
3. **"157 protocols across 28 specialties"** — shows comprehensive coverage, not a toy.
4. **WHO IMAI/IMCI** — global gold standard for resource-limited triage. Unquestionable authority.
5. **"Same protocols the government wants every doctor to follow"** — positions VaidyaVaani as a digital extension of government healthcare policy.

### For the Enterprise Readiness Slide

Add to the 8-Point Enterprise Shield:

| # | Category | Standard | VaidyaVaani Implementation |
|---|----------|----------|---------------------------|
| 9 | **Medical Data** | ICMR STW + WHO IMAI/IMCI | 157 government-mandated treatment protocols + WHO clinical guidelines for resource-limited settings |

---

## 14. Quick Reference: All URLs

### Government of India Sources

| Source | URL |
|--------|-----|
| ICMR STW Downloads | https://www.icmr.gov.in/standard-treatment-workflows-stws |
| ICMR STW Portal | https://stw.icmr.org |
| ICMR Downloadable Books | https://www.icmr.gov.in/downloadable-books |
| NHM Portal | https://nhm.gov.in |
| IPHS Guidelines | Available from nhm.gov.in |
| India NLEM | Available from Ministry of Health portal |

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

### Supplementary Open Datasets

| Source | Platform | URL |
|--------|----------|-----|
| Symptom-Disease Prediction | Mendeley Data | Search on data.mendeley.com |
| TachyHealth | HuggingFace | Search on huggingface.co/datasets |
| Disease Symptom Knowledge DB | Kaggle | Search on kaggle.com/datasets |

### News References (For Credibility)

| Article | Source | URL |
|---------|--------|-----|
| ICMR releases 32 new STWs (July 2024) | India Today | https://www.indiatoday.in/health/story/medical-research-panel-icmr-releases-new-treatment-standards-for-doctors-2572191-2024-07-26 |
| Centre asks states to implement 157 STWs | Medical Dialogues | https://medicaldialogues.in/news/health/implement-157-standard-treatment-workflows-in-28-specialities-centre-asks-states-132558 |
| ICMR STWs for 5 new specialties | The Statesman | https://www.thestatesman.com/india/icmr-issues-32-new-standard-treatment-guidelines-for-common-serious-diseases-1503324449.html |
| STWs to help expand health cover | Economic Times | https://m.economictimes.com/wealth/insure/standard-treatment-workflows-to-help-expand-health-cover/amp_articleshow/124005146.cms |
| India NAPSE for snakebite (2024) | Multiple sources | Search "India NAPSE snakebite 2024" |

---

## Summary: The Data Strategy in One Table

| Layer | Source | Authority | Format | Documents | Purpose |
|-------|--------|-----------|--------|-----------|---------|
| **Core Triage** | ICMR STWs | Govt of India (mandated) | PDF | 157 (10 for hackathon) | Treatment protocols for all conditions |
| **Triage Logic** | WHO IMAI | WHO | PDF → Markdown | 5-10 chunks | "What questions to ask" decision trees |
| **Pediatric** | WHO IMCI | WHO | PDF → Markdown | 3-5 chunks | Child assessment, ORS, danger signs |
| **Snakebite** | WHO + NAPSE | WHO + Govt of India | PDF → Markdown | 2-3 chunks | First aid, species ID, treatment |
| **Maternal** | RMNCH+A | Govt of India (NHM) | PDF → Markdown | 3-5 chunks | Pregnancy danger signs, maternal care |
| **Referral** | IPHS | Govt of India (NHM) | PDF → Markdown | 4 chunks | Facility capabilities by level |
| **Medicines** | NLEM | Govt of India | PDF → CSV | 1 file | Available medicines by facility |
| **Emergency** | Hand-crafted from WHO/ICMR | WHO + ICMR (derived) | Markdown | 10 scripts | Deterministic first-aid (no hallucination) |
| **Supplementary** | Open datasets | Academic/Community | CSV | 1-3 files | Symptom-disease mapping |

**Total for Hackathon: ~25-30 documents**
**Total for Production: ~200+ documents**

---

*This document is part of the VaidyaVaani project documentation for the AI for Bharat 2026 Hackathon.*
*Team: SavyaSachi*
*Last Updated: February 14, 2026*
