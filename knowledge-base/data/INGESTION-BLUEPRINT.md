# VaidyaVaani — Ingestion Blueprint
**Refined from:** `ingestions-discussion.md` + locked spec architecture  
**Supersedes:** The "What Goes Into Bedrock KB" section of `VaidyaVaani-Data-Sources-Guide.md`  
**Last Updated:** March 3, 2026  
**Status:** LOCKED — aligned with spec design.md tiered architecture + ETL-PIPELINE-DESIGN.md

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
    "breathing": { "..." : "..." },
    "circulation": { "..." : "..." },
    "disability": { "..." : "..." },
    "exposure": { "..." : "..." }
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

### Layer 2 + Layer 5 — General Triage KB (Bedrock KB — single KB, single index)

**Storage:** Bedrock Knowledge Base (`vaidyavaani-kb`) → OpenSearch Serverless  
**Retrieval:** RAG with metadata filter on chunk-level tags (`patient_category`, `condition`, `topic`, etc.)  
**ETL Pipeline:** See `ETL-PIPELINE-DESIGN.md` for full details

| Source | What to Extract | Format |
|--------|----------------|--------|
| ICMR STWs (Source 1) — PRIMARY | Full clinical content including narrative, dosage tables, algorithm flowcharts | PDF (FM-as-parser handles flowcharts → text) |
| WHO IMAI narrative (Source 2) | Counselling + treatment explanation text | Markdown |
| WHO IMCI narrative (Source 3) | "Communicate and counsel" sections | Markdown |
| RMNCH+A (Source 5) | Maternal health narrative advice | Markdown |
| WHO Snakebite narrative (Source 4) | Explanation text (NOT first aid steps) | Markdown |

**Do NOT ingest into the KB:**
- ICD-10 codes → goes to Layer 4 (DynamoDB lookup)
- Page numbers, headers, footers, references, administrative content
- Benchmark datasets (Source 13) → evaluation only, never in KB

**Included in KB:** Drug dosage tables, algorithm flowcharts (converted to text by FM-as-parser), management workflows, counselling text, danger signs. Dosage context is needed for the dual-source merge pattern — when a drug query fires both Drug DB (exact dose) and General Triage KB (counselling + danger signs), the KB chunks must contain dosage context to produce a coherent merged response.

#### Ingestion Flow (3 steps, 2 Lambdas)

```
Upload .md or .pdf to s3://vaidyavaani--kb-data/kb-ready/
  → Step 1: Metadata Lambda auto-generates .metadata.json sidecar
      (document-level tags: source, condition_type, severity)
  → Step 2: KB Sync (manual or scheduled)
      → FM-as-parser handles PDFs (flowcharts → structured text)
      → Semantic chunking (512 tokens, threshold 85)
      → Chunk Tagger Lambda adds per-chunk tags:
          patient_category, age_group, topic, condition, urgency, pregnancy_flag
      → Chunk-level tags overwrite document-level tags on collision
  → Step 3: Vectors + metadata stored in OpenSearch Serverless
```

**Key design decisions:**
- **No BDA** — FM-as-parser handles PDFs better, including flowcharts (reads them visually)
- **No document splitting** — multi-category documents (e.g., WHO Vol 1 covering adult + pediatric + maternal) get correct per-chunk tags via the Chunk Tagger without needing to be split into separate files
- **No separate indexes** — single KB, single index. Chunk-level metadata filters handle all routing precision
- **`patient_category`, `age_group`, `pregnancy_flag` are set per-chunk, NOT per-document** — these fields vary within multi-category documents

#### Metadata Schema

**Document-level (set by Metadata Lambda from filename keywords):**
```json
{
  "metadataAttributes": {
    "source":         "WHO_IMCI | WHO_IMAI | ICMR_STW | RMNCH_A | WHO_SNAKEBITE",
    "condition_type": "chronic | general_triage | general",
    "severity":       "critical | moderate | mild"
  }
}
```

**Chunk-level (set by Chunk Tagger Lambda from full chunk text):**
```json
{
  "patient_category": "pediatric | adult | maternal | geriatric | general",
  "age_group":        "0-5 | 6-12 | adult | geriatric",
  "topic":            "dosage | contraindication | side_effects | emergency_signs | referral | lifestyle | monitoring | counselling | symptoms | diagnosis | prevention | general",
  "condition":        "diabetes | dengue | diarrhea | headache | jaundice | fever | pneumonia | snakebite | cardiac | general",
  "urgency":          "emergency | urgent | routine",
  "pregnancy_flag":   "applicable | not_applicable"
}
```

**Chunk-level tags overwrite document-level tags on collision (per AWS docs).** This is the key insight that eliminated the need for document splitting.

#### KB Configuration

| Setting | Value |
|---|---|
| KB ID | `N8MPZ0GKA6` (needs recreation with updated config) |
| Parser | Foundation Model as Parser |
| Chunking | Semantic |
| Max buffer size | 3 |
| Max token size | 512 |
| Breakpoint threshold | 85 |
| Embedding model | Titan Embeddings v2 (1024 dimensions) |
| Search type | Hybrid (semantic + BM25) — enable in console + `searchType: 'HYBRID'` in app calls |
| Custom Transformation Lambda | `vaidyavaani-kb-chunk-tagger` |

**Note:** Existing KB (`N8MPZ0GKA6`) was created with 300 tokens / threshold 90. Chunking config cannot be modified after creation — KB must be deleted and recreated with 512 tokens / threshold 85.

#### Query-Time Metadata Filters

```python
# Example: pediatric patient asking about diarrhea treatment
filter = {
  "andAll": [
    {"equals": {"key": "patient_category", "value": "pediatric"}},
    {"equals": {"key": "condition",        "value": "diarrhea"}},
    {"equals": {"key": "topic",            "value": "counselling"}}
  ]
}
```

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
- `query_type = "safety" | "dosage"` → **Dual-source parallel query:** Drug DB (~5ms) + General Triage KB (~500ms) via `Promise.all()` — merged context to Nova Pro
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

## What Does NOT Go Into Any KB

| Item | Where It Lives | Why |
|------|---------------|-----|
| Emergency ABCDE scripts | DynamoDB `vaidyavaani-emergency-scripts` (Layer 1) — handwritten JSON, never automated | Must be deterministic, auditable, zero hallucination |
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
- [ ] Upload 10 ICMR STW PDFs to `s3://vaidyavaani--kb-data/kb-ready/`
- [ ] Upload WHO IMCI/IMAI/RMNCH+A markdown files to `kb-ready/`
- [ ] Metadata Lambda auto-generates `.metadata.json` sidecars
- [ ] Delete existing KB (`N8MPZ0GKA6`) and recreate with updated config:
  - FM-as-parser enabled
  - Semantic chunking: 512 tokens, threshold 85
  - Custom transformation Lambda: `vaidyavaani-kb-chunk-tagger`
- [ ] Sync KB — FM-as-parser converts PDFs, chunk tagger adds per-chunk metadata
- [ ] Enable Hybrid Search in Bedrock KB console + set `searchType: 'HYBRID'` in app calls
- [ ] Test retrieval with `patient_category` + `condition` metadata filters
- [ ] Verify flowchart content is properly converted to text (check a chunk from an ICMR STW with algorithm flowcharts)

---

## Pitch Line for Judges

> "We use a tiered ingestion architecture — not a single vector database. Emergency protocols are deterministic JSON in DynamoDB, retrieved in 5ms with zero LLM involvement. Drug safety is a structured NLEM database, never guessed by an LLM. Only explanatory clinical narrative goes into the Bedrock vector KB, filtered by patient category at the chunk level before every query. This is how you build medical AI that is safe enough to deploy at national scale."
