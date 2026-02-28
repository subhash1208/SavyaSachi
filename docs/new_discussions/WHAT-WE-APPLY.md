# What We Apply — VaidyaVaani Technical Decisions
Based on analysis of all discussion files in this folder.
**Last Updated:** February 27, 2026

---

## ✅ APPLY NOW (Directly Useful, Low Effort)

### 1. Metadata Filtering in Bedrock RAG
**Source:** rag_discussion.txt  
**Effort:** 2 hours | **Impact:** Prevents hallucinations

This is the most immediately useful thing from all discussions. When your Bedrock KB gets a query, pre-filter it before vector search.

**Concrete example for VaidyaVaani:**
```
User says: "Mere 2 saal ke bachche ko bukhar hai"
→ Pre-filter: patient_category = "pediatric"
→ Only searches WHO IMCI (child guidelines)
→ Never touches adult ICMR STWs
→ No adult dosages bleeding into child responses
```

**How to implement:**
- Tag every document in your Bedrock KB with metadata at upload time
- Pass metadata filter in your Lambda's Bedrock `Retrieve` API call

**Metadata tags to add to KB documents:**
```json
{
  "patient_category": "pediatric" | "adult" | "maternal" | "general",
  "condition_type": "emergency" | "chronic" | "general",
  "source": "WHO_IMCI" | "ICMR_STW" | "WHO_IMAI",
  "severity": "critical" | "moderate" | "mild"
}
```

**Lambda code snippet:**
```javascript
const response = await bedrockAgent.retrieve({
  knowledgeBaseId: KB_ID,
  retrievalQuery: { text: expandedQuery },
  retrievalConfiguration: {
    vectorSearchConfiguration: {
      filter: {
        equals: { key: "patient_category", value: patientCategory }
      }
    }
  }
});
```

---

### 2. Prompt Engineering — Constitutional AI + XML Tags
**Source:** rag_discussion_6.txt  
**Effort:** 1 hour | **Impact:** Prevents hallucinations in healthcare context

Since you're using Claude Sonnet 4.6, Constitutional AI and XML structured outputs are native and critical. This is literally life-or-death for a medical application.

**System prompt template to use:**
```xml
<system>
You are VaidyaVaani, an AI-powered health triage assistant for rural India.
You speak in simple Hindi and English.

CONSTITUTIONAL RULES (NEVER violate these):
- NEVER prescribe Schedule H or Schedule X drugs
- NEVER guarantee a cure or definitive diagnosis
- NEVER ignore WHO danger signs (convulsions, unconsciousness, difficulty breathing)
- NEVER give advice that contradicts ICMR Standard Treatment Workflows
- ALWAYS recommend seeing a doctor for serious symptoms
- ALWAYS escalate to emergency if danger signs are detected

OUTPUT FORMAT (ALWAYS use these XML tags):
<thinking>
  [Your step-by-step reasoning here — never shown to user]
</thinking>
<triage_decision>
  severity: critical | moderate | mild
  advice: [Hindi advice here]
  action: dispatch_ambulance | recommend_doctor | home_care
  followup_hours: [number]
</triage_decision>

TEMPERATURE: 0.3 (factual medical responses only)
</system>
```

**Key techniques applied:**
- Constitutional prompting (negative constraints reduce hallucinations by 60%)
- Chain-of-thought forcing (`<thinking>` tags before answer)
- Structured XML output (98% format compliance)
- System/user prompt separation (prevents prompt injection from voice transcripts)
- Temperature 0.3 (medical facts, not creative writing)

---

### 3. Hybrid Search in Bedrock KB
**Source:** rag_discussion_5.txt  
**Effort:** 5 minutes | **Impact:** Drug names and medical terms never get lost

Bedrock Knowledge Bases has a single toggle to enable hybrid search (semantic vector + BM25 keyword). This ensures specific drug names like "ORS", "Paracetamol", "Metformin", "Cotrimoxazole" don't get lost in semantic space.

**Where to enable:**
```
AWS Console → Bedrock → Knowledge Bases → Your KB → Edit
→ Search type → Hybrid (semantic + keyword)
→ Save
```

**Why it matters for VaidyaVaani:**
- Pure vector search: "ORS" might not semantically match "oral rehydration therapy"
- Hybrid search: BM25 catches exact keyword "ORS", vector catches meaning
- Critical for drug names, ICD-10 codes, and specific protocol names

---

### 4. Query Expansion — Colloquial Hindi → Clinical Terms
**Source:** rag_discussion_5.txt  
**Effort:** 1 day | **Impact:** Massively improves triage accuracy for rural users

Your users speak colloquially in Hindi. Before hitting the KB, expand their words into clinical terms using a fast Bedrock call.

**Flow:**
```
User says (via Nova Sonic): "pet mein dard hai"
         ↓
Lambda: Query Expansion Call (Claude Haiku, fast + cheap)
  Prompt: "Expand this Hindi symptom to clinical terms: pet mein dard"
         ↓
Returns: "abdominal pain, stomach ache, gastric pain,
          nausea, possible appendicitis, peptic ulcer indicators"
         ↓
THEN hit Bedrock KB with expanded clinical query
         ↓
Accurate retrieval from ICMR/WHO protocols
```

**Lambda implementation:**
```javascript
async function expandQuery(hindiSymptom) {
  const expansion = await bedrock.invokeModel({
    modelId: "amazon.nova-lite-v1:0", // cheap + fast
    body: JSON.stringify({
      prompt: `Expand this symptom to clinical medical terms (English):
               "${hindiSymptom}"
               Return comma-separated clinical terms only.`,
      max_tokens: 100,
      temperature: 0.1
    })
  });
  return expansion.body.toString();
}
```

**Use Nova Lite (not Sonnet) for query expansion** — it's 20x cheaper and fast enough for this task.

---

### 5. LangExtract for Knowledge Base Building
**Source:** langrapg_discussion.txt  
**Effort:** Half a day | **Impact:** Structured, verifiable KB from ICMR PDFs

Use Google's open-source `langextract` library to process your ICMR PDFs into perfectly structured symptom-to-treatment mappings before uploading to Bedrock KB.

**Why this matters:**
- Standard PDF chunking breaks protocols (symptom on page 3, treatment on page 4 = split chunk)
- LangExtract preserves structure AND links every extracted rule back to exact source paragraph
- Judges/doctors can verify: "This ORS dosage comes from ICMR STW page 47, paragraph 3"

**How to use:**
```bash
pip install langextract
```

```python
import langextract as lx

# Process ICMR PDF
result = lx.extract(
    document="icmr_fever_protocol.pdf",
    schema={
        "symptom": "string",
        "patient_category": "pediatric | adult | maternal",
        "severity": "critical | moderate | mild",
        "treatment": "string",
        "danger_signs": "list",
        "source_page": "integer"
    }
)

# Output: structured JSON with source grounding
# Upload this JSON to S3 → Bedrock KB
```

**Output example:**
```json
{
  "symptom": "fever with convulsions",
  "patient_category": "pediatric",
  "severity": "critical",
  "treatment": "Do not give aspirin. Cool the child. Seek emergency care immediately.",
  "danger_signs": ["convulsions", "unconsciousness", "difficulty breathing"],
  "source_page": 47,
  "source_paragraph": "Section 3.2, WHO IMCI Guidelines 2024"
}
```

---

## 📋 MENTION IN PITCH (No Build Time, Free Credibility)

### 6. RAG vs Fine-tuning Justification
**Source:** rag_discusson_4.txt

When a judge asks *"Why didn't you just fine-tune a model on medical data?"*, your answer:

> "Healthcare data is highly volatile — ICMR protocols and drug availability change regularly. Fine-tuning would freeze our model's knowledge in time, requiring expensive retraining every few months. RAG lets us update protocols by simply uploading new documents to S3, with zero model retraining.
>
> For traceability — critical in healthcare — RAG lets us cite the exact ICMR protocol paragraph behind every recommendation. Fine-tuning cannot do this.
>
> Our future roadmap includes a hybrid architecture: fine-tune a small, fast model (like Phi-3 or Llama 3) specifically on the tone and empathy of an Indian doctor, while continuing to use RAG to inject the actual, up-to-date medical facts."

---

### 7. Samsung TRM — Future Edge Deployment
**Source:** trm_disucssion.txt

Use this in your scalability/future roadmap slide:

> "Right now, VaidyaVaani runs on Amazon Bedrock at ₹42/call. But the future of rural healthcare AI isn't in massive 100-billion parameter cloud models. Samsung AI Lab recently proved that a 7-million parameter Tiny Recursive Model (TRM) can beat flagship models on complex reasoning by thinking recursively — drafting, critiquing, and refining its answer 16 times internally.
>
> Our future roadmap: deploy VaidyaVaani's triage engine on TRM-class models running natively on low-powered edge devices at local PHCs (Primary Health Centres) — eliminating cloud costs entirely for areas with poor connectivity, and bringing AI healthcare truly offline."

---

## ❌ SKIP COMPLETELY (Too Complex, No Time)

| Topic | Source File | Why Skip |
|-------|-------------|----------|
| Cognee (Graph Memory) | cognee.txt | Requires replacing Bedrock KB entirely. 2+ weeks of work. |
| Wave Field LLMs | new_break_trough_discussion.txt | Research only, not in production anywhere yet. |
| RLMs (MIT Recursive LM) | rlm.txt | Not available in Bedrock, needs Python REPL sandbox. |
| NVIDIA KVTC (KV Cache) | rag_memory_discussion.txt | Bedrock abstracts GPU memory, you can't control this. |
| Hierarchical RAG (PageIndex) | rag_discussion_3.txt | Too complex to build in 5 days. Mention in pitch only. |
| AI News/Hype | ai_facts.txt | General news, no direct application. |

---

## Action List by Day

```
TODAY — Feb 27 (30 min total):
├── Enable Hybrid Search toggle in Bedrock KB        [5 min]
├── Add Constitutional prompting to system prompt    [1 hour]
└── Set temperature to 0.3 for triage responses      [5 min]

DAY 2 — Feb 28 (2 hours):
├── Add metadata tags to all KB documents            [1 hour]
│   (patient_category, condition_type, source, severity)
└── Implement metadata pre-filtering in Lambda       [1 hour]

DAY 3 — Mar 1 (1 day):
└── Query expansion Lambda                           [1 day]
    (colloquial Hindi → clinical terms via Nova Lite)

KNOWLEDGE BASE SETUP — Day 1-2 (Member 3):
└── Use LangExtract to process ICMR PDFs             [half day]
    before uploading to Bedrock KB

PITCH DECK — No build time:
├── RAG vs fine-tuning justification slide
└── Future roadmap: Samsung TRM edge deployment
```

---

## Why These Choices Win

| Technique | Effort | Prevents | Judge Appeal |
|-----------|--------|----------|--------------|
| Metadata Filtering | 2 hours | Wrong dosages for wrong age group | High |
| Constitutional AI | 1 hour | Hallucinated drug prescriptions | Critical |
| Hybrid Search | 5 min | Drug names lost in semantic space | Medium |
| Query Expansion | 1 day | Colloquial Hindi misunderstood | High |
| LangExtract KB | Half day | Broken protocol chunks | High |
| RAG justification | 0 | Judge skepticism | High |
| TRM roadmap | 0 | "No offline plan" objection | Medium |
