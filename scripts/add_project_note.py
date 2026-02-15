
import os
import sys
from pymongo import MongoClient
import datetime

# Add project root to path
# Assuming script is in scripts/ folder, root is one level up
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(project_root)

from src.backend.utils.db import get_db

def add_note():
    db = get_db()
    collection = db['_notes']
    
    note_content = f"""
# Labeling System Implementation

**Date**: {datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
**Modules Affected**: Inventory, Procurement

**Summary**:
Implemented a comprehensive labeling system allowing users to generate and print labels with QR codes for Articles, Stocks, and Locations.

**Key Features**:
1.  **Backend (`modules/inventory/routes/labels.py`)**:
    *   `GET /label-templates`: Lists available templates.
    *   `POST /generate-labels`: Generates PDF using ReportLab.
    *   `GET /read-label`: Parses QR codes (`table:id`) and returns expanded object details.

2.  **QR Code Format**:
    *   **Articles**: `depo_parts:{{oid}}---ipn:{{ipn}}`
    *   **Stocks**: `depo_stocks:{{oid}}---depo_parts:{{part_id}}---ipn:{{ipn}}`
    *   **Locations**: `depo_locations:{{oid}}`

3.  **Frontend**:
    *   **PrintLabelsModal**: Reusable component for template/quantity selection.
    *   **Integrations**:
        *   Articles Page (Bulk Select + Print)
        *   Stocks Page (Bulk Select + Print)
        *   Locations Page (Bulk Select + Print)
        *   Procurement -> Received Stock Tab (Select + Print)

4.  **Database**:
    *   Initialized `label_templates` collection with standard 50x30mm templates.
    """

    note = {
        "title": "Labeling System Implementation Details",
        "content": note_content,
        "created_at": datetime.datetime.utcnow(),
        "tags": ["implementation", "labels", "inventory", "procurement"],
        "type": "system_log" 
    }

    result = collection.insert_one(note)
    print(f"Note created successfully with ID: {result.inserted_id}")

if __name__ == "__main__":
    add_note()
