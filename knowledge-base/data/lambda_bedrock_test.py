import boto3
import json
import os

# Initialize the Bedrock Agent Runtime client outside the handler for reuse
# (The Lambda execution environment will automatically use the Lambda's IAM role permissions)
client = boto3.client('bedrock-agent-runtime')

def lambda_handler(event, context):
    """
    AWS Lambda function to test the Amazon Bedrock Knowledge Base with Metadata Filtering.
    
    Expected Event Payload:
    {
        "kb_id": "YOUR_KB_ID",
        "prompt": "What are the recommended lifestyle modifications for Type 2 Diabetes?",
        "patient_category": "adult" 
    }
    """
    
    # Extract parameters from the event, with fallbacks
    # In a real app, kb_id would likely be an environment variable.
    kb_id = event.get('kb_id')
    prompt = event.get('prompt', "What are the recommended lifestyle modifications and dietary advice for Type 2 Diabetes?")
    patient_category = event.get('patient_category', 'adult')
    
    # We use Amazon Nova Pro as requested by the user
    model_arn = os.environ.get('MODEL_ARN', 'arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-pro-v1:0')
    
    if not kb_id:
        return {
            'statusCode': 400,
            'body': json.dumps('Error: kb_id is required in the event payload.')
        }

    try:
        # Construct the API call with the strict Staged Hybrid Filter
        response = client.retrieve_and_generate(
            input={
                'text': prompt
            },
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
                                    'value': patient_category
                                }
                            }
                        }
                    }
                }
            }
        )
        
        # Extract the LLM answer
        output_text = response['output']['text']
        
        # Extract citations so you can verify the exact source documents used
        citations = []
        for citation in response.get('citations', []):
            for ref in citation.get('retrievedReferences', []):
                s3_uri = ref.get('location', {}).get('s3Location', {}).get('uri', 'Unknown URI')
                chunk_text = ref.get('content', {}).get('text', '')
                
                citations.append({
                    "source_uri": s3_uri,
                    "chunk": chunk_text[:200] + "..." # Truncate for readability
                })
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                "prompt": prompt,
                "filter_applied": patient_category,
                "answer": output_text,
                "citations": citations
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps(f"Failed to query Bedrock: {str(e)}")
        }
