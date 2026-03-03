# VaidyaVaani Knowledge Base Refinement Walkthrough

This walkthrough details the steps taken to standardize the data ingested into the Amazon Bedrock Knowledge Base (Layer 5) for the VaidyaVaani architecture. By enforcing strict metadata schemas and building a Lambda-based filtering mechanism, we successfully mitigated cross-contamination (hallucination) between pediatric and adult clinical workflows.

## 1. Metadata Schema Standardization

The initial generated `*.metadata.json` files utilized arbitrary strings (like raw PDF filenames) for the `source` tags and completely omitted mandatory demographic tags. AWS Bedrock Knowledge Bases require custom metadata to be strictly encapsulated within a top-level `metadataAttributes` JSON object to be searchable.

We developed a Python script (`fix_rag_metadata.py`) that iterated over all `.md` files in the `processed_rag/` directory and generated strict enumerable tags conforming to the `INGESTION-BLUEPRINT.md`:

```json
{
  "metadataAttributes": {
    "patient_category": "pediatric",
    "condition_type": "general",
    "source": "ICMR_STW",
    "severity": "moderate",
    "age_group": "0-5",
    "pregnancy_flag": "not_applicable"
  }
}
```

## 2. Preventing Hallucination (Cross-Contamination)

Before applying filters, a test query regarding "Type 2 Diabetes" hallucinated and retrieved dietary advice tailored for children with Type 1 Diabetes simply because the vector embeddings were semantically similar.

To fix this, we wrote an AWS Lambda function (`lambda_bedrock_test.py`) that uses the `boto3` `bedrock-agent-runtime` API to explicitly inject a **Staged Hybrid Filter**. Before the LLM even sees the documents, the vector database mathematically excludes any text chunk that does not match the patient's category.

### The Code Implementation
```python
response = client.retrieve_and_generate(
    input={'text': prompt},
    retrieveAndGenerateConfiguration={
        'type': 'KNOWLEDGE_BASE',
        'knowledgeBaseConfiguration': {
            'knowledgeBaseId': kb_id,
            'modelArn': model_arn,
            'retrievalConfiguration': {
                'vectorSearchConfiguration': {
                    'filter': {
                        'equals': {
                            'key': 'patient_category',
                            'value': 'adult' # The strict Metadata Filter!
                        }
                    }
                }
            }
        }
    }
)
```

## 3. Validation and Results

Using Amazon Nova Pro with the Lambda function and the `patient_category = "adult"` filter applied, the system successfully generated a constrained answer:

**Prompt:** "What are the recommended lifestyle modifications for Type 2 Diabetes?"

**Response:**
> "Based on the retrieved results, the recommended lifestyle modifications for Type 2 Diabetes are:
> - Dietary modification 
> - Avoidance of tobacco and restriction/avoidance of alcohol
> - Physical activity 
>
> These lifestyle changes are recommended in addition to pharmacotherapy for managing Type 2 Diabetes."

The response is now perfectly aligned with the adult ICMR STW guidelines, and the citations confirm that only snippets from `diabetes_mellitus_type_2.md` were used, proving the mitigation of the Type 1 Diabetes pediatric hallucination!
