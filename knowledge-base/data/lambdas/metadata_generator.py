"""
Lambda: vaidyavaani-metadata-generator
Trigger: S3 ObjectCreated on kb-ready/*.md or kb-ready/*.pdf
Does:
  - Generates .metadata.json sidecar with document-level tags
  - Writes ingestion registry entry to DynamoDB
  - Only sets fields that are consistent across entire document:
    source, condition_type, severity
  - patient_category, age_group, pregnancy_flag are set per-chunk
    by the chunk tagger during KB sync
Fires: once per document
"""

import boto3
import json
import os
import hashlib
from datetime import datetime, timezone

s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ.get('REGISTRY_TABLE', 'vaidyavaani-ingestion-registry'))

# Document-level fields only — these don't vary within a document
RULES = {
    "condition_type": {
        "chronic":        ["diabetes", "hypertension", "tuberculosis", "tb", "chronic"],
        "general_triage": ["imai", "imci", "non_emergency", "vol1_eng"],
        "general":        []
    },
    "source": {
        "WHO_IMCI":      ["imci"],
        "WHO_IMAI":      ["imai"],
        "RMNCH_A":       ["rmnch", "maternal", "antenatal"],
        "WHO_SNAKEBITE": ["snake", "venom"],
        "ICMR_STW":      []
    },
    "severity": {
        "critical": ["cardiac", "snakebite", "seizure", "emergency", "drowning"],
        "mild":     ["headache", "cold", "cough"],
        "moderate": []
    }
}


def resolve(field, filename):
    """Resolve metadata field from filename keywords. Last entry is fallback."""
    fname = filename.lower()
    for value, keywords in RULES[field].items():
        if keywords and any(kw in fname for kw in keywords):
            return value
    return list(RULES[field].keys())[-1]


def lambda_handler(event, context):
    for record in event['Records']:
        bucket = record['s3']['bucket']['name']
        key = record['s3']['object']['key']

        # skip non-document files and already-generated metadata files
        if key.endswith('.metadata.json'):
            print(f"Skipping metadata file {key}")
            continue
        if not (key.endswith('.md') or key.endswith('.pdf')):
            print(f"Skipping non-document file {key}")
            continue

        filename = os.path.basename(key)
        s3_path = f"s3://{bucket}/{key}"
        document_id = hashlib.md5(s3_path.encode()).hexdigest()

        # resolve document-level metadata from filename
        metadata_attrs = {
            "source":         resolve("source", filename),
            "condition_type": resolve("condition_type", filename),
            "severity":       resolve("severity", filename)
        }

        # write .metadata.json sidecar to S3
        metadata_key = key + ".metadata.json"
        s3.put_object(
            Bucket=bucket,
            Key=metadata_key,
            Body=json.dumps({"metadataAttributes": metadata_attrs}, indent=2),
            ContentType='application/json'
        )
        print(f"Written metadata: s3://{bucket}/{metadata_key}")

        # write registry entry to DynamoDB
        table.put_item(Item={
            "document_id":  document_id,
            "s3_path":      s3_path,
            "filename":     filename,
            "ingested_at":  datetime.now(timezone.utc).isoformat(),
            "condition_type": metadata_attrs["condition_type"],
            "source":       metadata_attrs["source"]
        })
        print(f"Registry entry written for {document_id}")

    return {"statusCode": 200}
