"""
Lambda: vaidyavaani-kb-chunk-tagger
Type: Bedrock KB Custom Transformation Lambda (post-chunking)
Trigger: Bedrock KB calls this during sync after chunking

Does:
  - Reads chunked files from S3 (written by Bedrock KB)
  - Adds 6 metadata tags per chunk based on content keywords:
    patient_category, age_group, topic, condition, urgency, pregnancy_flag
  - Writes tagged chunks back to S3
  - Returns output references for KB to continue processing

Chunk-level tags overwrite document-level tags on collision (per AWS docs).
This is how multi-category documents (e.g. WHO Vol 1 covering adult + pediatric)
get correct per-chunk patient_category without needing to be split.

API contract reference:
https://docs.aws.amazon.com/bedrock/latest/userguide/kb-custom-transformation.html
"""

import boto3
import json

s3 = boto3.client('s3')


def classify_chunk(content):
    """Read full chunk text and return 6 metadata tags based on keywords."""
    text = content.lower()

    # --- patient_category ---
    patient_category = 'adult'
    if any(w in text for w in ['child', 'infant', 'paediatric', 'pediatric',
                                'newborn', 'neonatal', 'under 5', 'under five',
                                'imci', 'young infant']):
        patient_category = 'pediatric'
    elif any(w in text for w in ['maternal', 'pregnant', 'pregnancy', 'antenatal',
                                  'postnatal', 'obstetric', 'labour', 'labor',
                                  'breastfeeding', 'trimester']):
        patient_category = 'maternal'
    elif any(w in text for w in ['elderly', 'geriatric', 'older adult',
                                  'aged 60', 'aged 65', 'older person']):
        patient_category = 'geriatric'

    # --- age_group ---
    age_group = 'adult'
    if patient_category == 'pediatric':
        age_group = '0-5'
        if any(w in text for w in ['6-12', 'school age', 'adolescent', '13-18']):
            age_group = '6-12'
    elif patient_category == 'geriatric':
        age_group = 'geriatric'

    # --- pregnancy_flag ---
    pregnancy_flag = 'not_applicable'
    if any(w in text for w in ['pregnant', 'pregnancy', 'antenatal', 'postnatal',
                                'maternal', 'breastfeeding', 'trimester', 'obstetric']):
        pregnancy_flag = 'applicable'

    # --- topic ---
    topic = 'general'
    if any(w in text for w in ['dose', 'dosage', 'mg', 'tablet', 'syrup', 'ml',
                                'administer']):
        topic = 'dosage'
    elif any(w in text for w in ['side effect', 'adverse', 'reaction', 'toxicity']):
        topic = 'side_effects'
    elif any(w in text for w in ['contraindic', 'avoid', 'do not give', 'warning',
                                  'caution']):
        topic = 'contraindication'
    elif any(w in text for w in ['danger sign', 'red flag', 'emergency', 'immediately',
                                  'urgent']):
        topic = 'emergency_signs'
    elif any(w in text for w in ['refer', 'hospital', 'facility', 'transfer']):
        topic = 'referral'
    elif any(w in text for w in ['lifestyle', 'diet', 'exercise', 'physical activity',
                                  'smoking', 'alcohol']):
        topic = 'lifestyle'
    elif any(w in text for w in ['monitor', 'follow up', 'check', 'hba1c',
                                  'blood sugar', 'blood pressure']):
        topic = 'monitoring'
    elif any(w in text for w in ['counsel', 'explain', 'advise', 'educate',
                                  'tell the mother']):
        topic = 'counselling'
    elif any(w in text for w in ['symptom', 'sign', 'present', 'complain', 'history']):
        topic = 'symptoms'
    elif any(w in text for w in ['diagnos', 'classify', 'assess', 'examine']):
        topic = 'diagnosis'
    elif any(w in text for w in ['prevent', 'vaccin', 'immunis', 'hygiene',
                                  'sanitation']):
        topic = 'prevention'

    # --- condition ---
    condition = 'general'
    if any(w in text for w in ['diabetes', 'blood sugar', 'insulin', 'metformin',
                                'hba1c']):
        condition = 'diabetes'
    elif any(w in text for w in ['dengue', 'platelet', 'hemorrhagic']):
        condition = 'dengue'
    elif any(w in text for w in ['diarrhea', 'diarrhoea', 'ors', 'dehydration',
                                  'rehydration']):
        condition = 'diarrhea'
    elif any(w in text for w in ['headache', 'migraine', 'cephalgia']):
        condition = 'headache'
    elif any(w in text for w in ['jaundice', 'bilirubin', 'hepatitis', 'liver']):
        condition = 'jaundice'
    elif any(w in text for w in ['fever', 'temperature', 'febrile', 'paracetamol']):
        condition = 'fever'
    elif any(w in text for w in ['pneumonia', 'breathing', 'respiratory',
                                  'chest indrawing']):
        condition = 'pneumonia'
    elif any(w in text for w in ['snake', 'venom', 'antivenom', 'bite']):
        condition = 'snakebite'
    elif any(w in text for w in ['cardiac', 'heart', 'chest pain', 'cpr', 'aspirin']):
        condition = 'cardiac'

    # --- urgency ---
    urgency = 'routine'
    if any(w in text for w in ['immediately', 'emergency', 'danger sign', 'call 108',
                                'urgent', 'critical']):
        urgency = 'emergency'
    elif any(w in text for w in ['refer', 'within 24', 'same day', 'today']):
        urgency = 'urgent'

    return {
        'patient_category': patient_category,
        'age_group': age_group,
        'pregnancy_flag': pregnancy_flag,
        'topic': topic,
        'condition': condition,
        'urgency': urgency
    }


def lambda_handler(event, context):
    """
    Custom transformation Lambda for Bedrock KB.

    Input: Bedrock KB writes chunked files to S3, passes references in event.
    Process: Read each chunk, classify, add metadata tags, write back.
    Output: Return references to tagged chunk files.

    See: https://docs.aws.amazon.com/bedrock/latest/userguide/kb-custom-transformation.html
    """
    bucket_name = event['bucketName']
    input_files = event.get('inputFiles', [])
    output_files = []

    for input_file in input_files:
        file_metadata = input_file.get('fileMetadata', {})
        content_batches = input_file.get('contentBatches', [])
        output_batches = []

        for batch in content_batches:
            batch_key = batch['key']

            # read chunked file from S3
            response = s3.get_object(Bucket=bucket_name, Key=batch_key)
            batch_data = json.loads(response['Body'].read().decode('utf-8'))

            # tag each chunk
            for chunk in batch_data.get('fileContents', []):
                content_body = chunk.get('contentBody', '')
                chunk_metadata = chunk.get('contentMetadata', {})

                # classify based on full chunk text
                tags = classify_chunk(content_body)

                # merge tags into chunk metadata (overwrites document-level on collision)
                chunk_metadata.update(tags)
                chunk['contentMetadata'] = chunk_metadata

            # write tagged chunks back to S3
            s3.put_object(
                Bucket=bucket_name,
                Key=batch_key,
                Body=json.dumps(batch_data),
                ContentType='application/json'
            )
            output_batches.append({'key': batch_key})

        output_files.append({
            'originalFileLocation': input_file['originalFileLocation'],
            'fileMetadata': file_metadata,
            'contentBatches': output_batches
        })

    return {'outputFiles': output_files}
