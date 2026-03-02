import boto3
import json
import os
import sys

# Replace this with the actual path to the processed RAG folder
DATA_DIR = r"C:\Users\haswa.HASWANTH\Downloads\processed_rag"

TABLE_NAME = "vaidyavaani-drug-db"

def load_data(filename):
    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return []
        
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def import_to_dynamodb():
    try:
        # Initialize boto3 DynamoDB resource
        dynamodb = boto3.resource('dynamodb', region_name='eu-north-1')
        table = dynamodb.Table(TABLE_NAME)
        
        imci_meds = load_data("imci_medicines.json")
        imai_meds = load_data("imai_medicines.json")
        all_meds = imci_meds + imai_meds
        
        if not all_meds:
            print("No data found to insert.")
            return

        # Filtering logic
        cleaned = []
        seen = set()

        for med in all_meds:
            drug = med.get("drug_name", "").strip().lower()

            # Skip common non-drug terms that slipped through the heuristic extraction
            if drug in ["then", "amount", "moderate", "potent", "uncomplicated", "analgesics", "very potent", "mild", "see table in", "no common"]:
                continue
                
            # Skip if it is definitely a sentence or too short
            if drug == "" or len(drug) < 3 or len(drug.split()) > 4:
                continue

            # In DynamoDB, Partition Key (drug_name) + Sort Key (patient_category) must be unique!
            # So the seen check should rely on this composite key:
            patient_cat = med.get("patient_category", "general")
            composite_key = f"{drug}-{patient_cat}"
            
            if composite_key not in seen:
                # Update the drug name back in the object to be clean lowercase
                med["drug_name"] = drug 
                seen.add(composite_key)
                cleaned.append(med)

        print(f"Found {len(all_meds)} total raw records.")
        print(f"Reduced to {len(cleaned)} perfectly clean medicine records (Adult + Pediatric). Starting batch write...")
        
        # DynamoDB batch_writer automatically chunks requests into groups of 25
        inserted = 0
        with table.batch_writer() as batch:
            for med in cleaned:
                # Ensure patient_category exists for our Sort Key
                if not med.get("patient_category"):
                    med["patient_category"] = "general"
                    
                item = {}
                for key, value in med.items():
                    if value == "":
                        item[key] = "N/A"
                    else:
                        item[key] = str(value)
                
                batch.put_item(Item=item)
                inserted += 1
                
        print(f"\nSuccessfully inserted {inserted} clean records into '{TABLE_NAME}'.")
        print("Note: You need to have created this table with: Partition Key = 'drug_name' (String) AND Sort Key = 'patient_category' (String)")
        
    except Exception as e:
        print(f"An error occurred: {e}")
        print("Make sure you have run 'aws configure' with your credentials and 'boto3' installed.")

if __name__ == "__main__":
    import_to_dynamodb()