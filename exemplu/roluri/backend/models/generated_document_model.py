"""
Generated Document Model
"""
from datetime import datetime
from typing import Optional


class GeneratedDocumentModel:
    collection_name = "generated_documents"
    
    @staticmethod
    def create(
        submission_id: str,
        form_id: str,
        template_code: str,
        template_name: str,
        job_id: str,
        filename: str,
        file_url: Optional[str] = None,
        status: str = "pending",
        version: int = 1
    ) -> dict:
        """
        Create a new generated document record
        
        Args:
            submission_id: ID of the form submission
            form_id: ID of the form
            template_code: DataFlows Depo template code
            template_name: Human-readable template name
            job_id: DataFlows Depo job ID
            filename: Generated filename
            file_url: URL to download the file (optional)
            status: Generation status (pending, completed, failed)
            version: Document version number
            
        Returns:
            Document dictionary ready for MongoDB insertion
        """
        return {
            'submission_id': submission_id,
            'form_id': form_id,
            'template_code': template_code,
            'template_name': template_name,
            'job_id': job_id,
            'filename': filename,
            'file_url': file_url,
            'status': status,
            'version': version,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
    
    @staticmethod
    def get_next_version(db, submission_id: str, template_code: str) -> int:
        """
        Get the next version number for a document
        
        Args:
            db: MongoDB database instance
            submission_id: ID of the form submission
            template_code: Template code
            
        Returns:
            Next version number
        """
        collection = db[GeneratedDocumentModel.collection_name]
        
        # Find the highest version for this submission and template
        latest = collection.find_one(
            {
                'submission_id': submission_id,
                'template_code': template_code
            },
            sort=[('version', -1)]
        )
        
        if latest:
            return latest['version'] + 1
        return 1
    
    @staticmethod
    def cleanup_old_versions(db, submission_id: str, template_code: str, max_revisions: int):
        """
        Remove old document versions, keeping only the latest N revisions
        
        Args:
            db: MongoDB database instance
            submission_id: ID of the form submission
            template_code: Template code
            max_revisions: Maximum number of revisions to keep
        """
        collection = db[GeneratedDocumentModel.collection_name]
        
        # Get all documents for this submission and template, sorted by version descending
        documents = list(collection.find(
            {
                'submission_id': submission_id,
                'template_code': template_code
            },
            sort=[('version', -1)]
        ))
        
        # If we have more than max_revisions, delete the oldest ones
        if len(documents) > max_revisions:
            docs_to_delete = documents[max_revisions:]
            ids_to_delete = [doc['_id'] for doc in docs_to_delete]
            
            collection.delete_many({'_id': {'$in': ids_to_delete}})
            
            return len(ids_to_delete)
        
        return 0
