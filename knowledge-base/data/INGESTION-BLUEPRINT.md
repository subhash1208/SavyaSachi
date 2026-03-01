# VaidyaVaani — Ingestion Blueprint
**Refined from:** `ingestions-discussion.md` + locked spec architecture  
**Supersedes:** The "What Goes Into Bedrock KB" section of `VaidyaVaani-Data-Sources-Guide.md`  
**Last Updated:** March 1, 2026  
**Status:** LOCKED — aligned with spec design.md tiered architecture

---

## Core Principle

> "Emergency logic must be deterministic. Use the LLM only to extract symptoms from speech and map to structured schema — not to decide red flags."

Not all 13 sources are equal. Ingesting everything into one vector DB weakens clinical reliability. Each source goes to the layer that matches its role.

---

## The 5-Layer Ingestion Map

### Layer 1 — Emergency Protocol Engine (DynamoDB — NOT Bedrock KB)

**Storage:** `vaidyavaani-emergency-scripts` DynamoDB table  
**Key:** `condition_id` (PK) + `patient_category` (SK)  
**Retrieval:** GetItem ~5ms, zero LLM, verbatim read  

| Source | What to Extract | Format |
|--------|----------------|--------|
| WHO Prehospital ABCDE (Source 9) | ABCDE assessment structure | JSON script |
| India NAPSE 2024 (Source 10) | Snakebite prohibitions + Big Four ID | JSON script |
| NHM NAS Guidelines (Source 11) | 108 vs 102 dispatch logic | Hardcoded in Lambda |
| WHO IMCI red flags (Source 3) | Paediatric danger signs | JSON script |
| WHO IMAI red flags (Source 2) | Adult danger signs | JSON script |

**Hackathon scope — 4 conditions × patient categories:**

```
cardiac    + adult     → CPR + aspirin + 108 dispatch
cardiac    + geriatric → Modified CPR (no sternal compression force) + 108
snakebite  + adult     → Immobilise + myth-busting + 108
snakebite  + pediatric → Same + weight-based antivenom note + 108
child_fever + pediatric → ORS + danger signs + 102/108 based on severity
breathing_difficulty + adult → Position upright + 108
breathing_difficulty + pediatric → IMCI pneumonia signs + 108
```

**Script JSON structure (every entry must have all fields):**
```json
{
  "condition_id": "cardiac",
  "patient_category": "adult",
  "icd10_code": "I21.9",
  "dispatch_type": "108",
  "severity": "CRITICAL",
  "source": "ICMR STW STEMI + WHO Prehospital Guidelines",
  "abcde_script": {
    "airway": { "question_hindi": "...", "question_english": "...", "yes_action": "...", "no_action": "..." },
    "breathing": { ... },
    "circulation": { ... },
    "disability": { ... },
    "exposure": { ... }
  },
  "immediate_actions": [
    { "hindi": "Rogi ko lita dijiye", "english": "Keep patient lying down" },
    { "hindi": "Paani mat dijiye", "english": "Do not give water" }
  ],
  "do_not_actions": [
    { "hindi": "Chalne mat dijiye", "english": "Do not let patient walk" }
  ]
}
```

---

### Layer 2 — Clinical Workflow KB (Bedrock KB — narrative sections only)

**Storage:** Bedrock Knowledge Base → OpenSearch Serverless  
**Index:** `icmr_workflows_index`  
**Retrieval:** RAG with metadata filter on `patient_category` + `pregnancy_flag`  

| Source | What to Extract | Format | Chunk Size |
|--------|----------------|--------|------------|
| ICMR STWs (Source 1) — PRIMARY | Narrative advice sections only | PDF direct or Markdown | 400-600 tokens |
| WHO IMAI narrative (Source 2) | Counselling + treatment explanation text | Markdown chunks | 400-600 tokens |
| WHO IMCI narrative (Source 3) | "Communicate and counsel" sections | Markdown chunks | 400-600 tokens |
| RMNCH+A (Source 5) | Maternal health narrative advice | Markdown chunks | 400-600 tokens |
| WHO Snakebite narrative (Source 4) | Explanation text (NOT first aid steps) | Markdown chunks | 400-600 tokens |

**Do NOT ingest from these sources into Layer 2:**
- Algorithm flowcharts → convert to Layer 1 JSON scripts instead
- Drug tables → goes to Layer 3
- ICD-10 codes → goes to Layer 4
- Benchmark datasets (Source 13) → evaluation only, never in KB

**Required metadata tags on every document at upload:**
```json
{
  "patient_category": "pediatric | adult | maternal | general",
  "condition_type": "emergency | chronic | general",
  "source": "WHO_IMCI | ICMR_STW | WHO_IMAI | RMNCH_A | WHO_SNAKEBITE",
  "severity": "critical | moderate | mild",
  "age_group": "0-5 | 6-12 | 13-18 | adult | geriatric",
  "pregnancy_flag": "applicable | not_applicable"
}
```

**Separate indexes for different document types:**
- `icmr_workflows_index` — ICMR STWs
- `maternal_health_index` — RMNCH+A + maternal sections of IMCI
- `general_education_index` — WHO IMAI/IMCI narrative, general advice

---

### Layer 3 — Drug Knowledge DB (DynamoDB — NOT Bedrock KB)

**Storage:** `vaidyavaani-drug-db` DynamoDB table  
**Key:** `drug_name` (PK, normalized lowercase) + `query_type` (SK)  
**Retrieval:** GetItem ~5ms, filtered by `patient_profile.category` + `pregnancy_flag`  

| Source | What to Extract | Format |
|--------|----------------|--------|
| India NLEM 2022 (Source 7) | All 384 medicines | Structured JSON |
| WHO Essential Medicines (Source 7) | Cross-reference for global availability | Structured JSON |

**DynamoDB item structure:**
```json
{
  "drug_name": "paracetamol",
  "query_type": "dosage",
  "dose_child": "10-15 mg/kg every 4-6 hours",
  "dose_adult": "500-1000 mg every 4-6 hours",
  "max_daily_adult": "4000 mg",
  "max_daily_child": "60 mg/kg",
  "contraindications": ["hepatic impairment", "G6PD deficiency"],
  "pregnancy_category": "B — generally safe",
  "renal_adjustment": "reduce dose in severe CKD",
  "source": "India NLEM 2022"
}
```

**Routing from MasterExtractionResult:**
- `query_type = "overdose"` → Emergency path immediately (bypass Drug DB)
- `query_type = "safety" | "dosage"` → Drug DB query filtered by `patient_profile.category` + `pregnancy_flag`
- `query_type = "availability"` → NLEM lookup only

**Hackathon scope (7 drugs minimum):**
paracetamol, ORS, metformin, amlodipine, cotrimoxazole, amoxicillin, antivenom (polyvalent)

---

### Layer 4 — Coding & Interoperability (DynamoDB lookup tables)

**Storage:** Hardcoded in emergency scripts + DynamoDB `vaidyavaani-icd10-map` table  
**Never use LLM to generate codes — deterministic mapping only**

| Source | What to Extract | Storage |
|--------|----------------|---------|
| ABDM ICD-10 (Source 12) | All codes for VaidyaVaani conditions | DynamoDB lookup |
| IPHS Guidelines (Source 6) | Facility capability by level | DynamoDB lookup |
| LOINC | Lab observation codes (post-hackathon) | DynamoDB lookup |

**ICD-10 codes for hackathon conditions (hardcode these):**

| Condition | ICD-10 | Dispatch |
|-----------|--------|----------|
| Cardiac arrest / Heart attack | I21.9 | 108 |
| Stroke | I64 | 108 |
| Snakebite | T63.0 | 108 |
| Severe bleeding | R58 | 108 |
| Choking | T17.9 | 108 |
| Burns | T30.0 | 108 |
| Poisoning | T65.9 | 108 |
| Anaphylaxis | T78.2 | 108 |
| Seizure | R56.9 | 108 |
| Pregnancy emergency | O14.9 / O72.1 | 108 (hemorrhage) / 102 (routine labor) |
| Breathing difficulty | J45.9 | 108 |
| Child fever / dehydration | A09 / E86.0 | 102 (stable) / 108 (danger signs) |
| Dengue | A90 | 102 (stable) / 108 (hemorrhagic) |
| Diabetes | E11.9 | 102 |
| Hypertension | I10 | 102 |

---

### Layer 5 — Embedding KB (Bedrock KB — safe use of RAG)

**Storage:** Bedrock Knowledge Base → OpenSearch Serverless  
**Index:** `general_education_index`  
**Use:** Explanatory content only — NOT life-critical decision nodes  

| Source | What to Ingest | Notes |
|--------|---------------|-------|
| ICMR STW narrative sections | Explanatory text, counselling | Already covered in Layer 2 |
| WHO IMCI "Communicate and counsel" | Parent education, follow-up advice | Chunk by topic |
| RMNCH+A maternal advice | Antenatal care education | Chunk by trimester |
| Open symptom-disease datasets (Source 8) | Supplementary mapping | Validate against ICMR first |

**Chunk size:** 400-600 tokens  
**Overlap:** 50 tokens between chunks  
**Embedding model:** Titan Embeddings v2 (AWS-native, low latency)  
**Search type:** Hybrid (semantic + BM25 keyword) — enable in Bedrock KB settings

---

## What Does NOT Go Into Any KB

| Item | Where It Lives | Why |
|------|---------------|-----|
| ABCDE framework | Structure of emergency scripts | Framework, not a document |
| 108 vs 102 dispatch logic | Lambda routing code | Operational logic |
| ICD-10 codes | Hardcoded in scripts + DynamoDB | Tags/metadata, not searchable content |
| Triage benchmarks (MIETIC, TriageBench) | Evaluation pipeline only | For testing accuracy, never in production KB |
| ASHA training modules | Reference only | Know for Q&A, don't ingest |

---

## Hackathon Ingestion Checklist (Days 1-3)

### Day 1 — Layer 1 (Emergency Scripts in DynamoDB)
- [ ] Write 4 condition × 2 patient_category = 8 JSON scripts minimum
- [ ] Each script: ABCDE structure + ICD-10 + dispatch type + bilingual instructions + myth-busting
- [ ] Load into `vaidyavaani-emergency-scripts` DynamoDB table
- [ ] Test GetItem by `condition_id` + `patient_category`

### Day 2 — Layer 3 (Drug DB in DynamoDB)
- [ ] Create 7 drug entries (paracetamol, ORS, metformin, amlodipine, cotrimoxazole, amoxicillin, antivenom)
- [ ] Each entry: dosage + safety + overdose + pregnancy_category
- [ ] Load into `vaidyavaani-drug-db` DynamoDB table
- [ ] Test overdose routing → emergency path

### Day 3 — Layer 2 + 5 (Bedrock KB)
- [ ] Download 10 ICMR STWs (demo-relevant conditions)
- [ ] Convert WHO IMCI child assessment + ORS sections to Markdown
- [ ] Add metadata tags to every document before upload
- [ ] Upload to S3 → sync with Bedrock KB
- [ ] Enable Hybrid Search in Bedrock KB settings
- [ ] Test retrieval with `patient_category` metadata filter

---

## Pitch Line for Judges

> "We use a tiered ingestion architecture — not a single vector database. Emergency protocols are deterministic JSON in DynamoDB, retrieved in 5ms with zero LLM involvement. Drug safety is a structured NLEM database, never guessed by an LLM. Only explanatory clinical narrative goes into the Bedrock vector KB, filtered by patient category before every query. This is how you build medical AI that is safe enough to deploy at national scale."
