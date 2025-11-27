"""
Job model for storing scheduled jobs configuration
"""
from typing import Dict, Any, Optional
from datetime import datetime


class JobModel:
    """Model for scheduled jobs (cron-like tasks)"""
    
    collection_name = "jobs"
    
    @staticmethod
    def create(name: str, frequency: str, enabled: bool = True,
               description: Optional[str] = None) -> Dict[Any, Any]:
        """
        Create a new job document
        
        Args:
            name: Job name (corresponds to script name without .py)
            frequency: Cron expression (e.g., "*/5 * * * *")
            enabled: Whether job is enabled
            description: Job description
            
        Returns:
            Job document
        """
        return {
            'name': name,
            'frequency': frequency,
            'enabled': enabled,
            'description': description,
            'last_run': None,
            'last_status': None,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
    
    @staticmethod
    def to_dict(job_doc: Dict[Any, Any]) -> Dict[Any, Any]:
        """
        Convert MongoDB document to dictionary
        
        Args:
            job_doc: MongoDB document
            
        Returns:
            Dictionary representation
        """
        if job_doc and '_id' in job_doc:
            job_doc['id'] = str(job_doc['_id'])
            del job_doc['_id']
        
        # Convert datetime to ISO format
        if 'created_at' in job_doc:
            job_doc['created_at'] = job_doc['created_at'].isoformat()
        if 'updated_at' in job_doc:
            job_doc['updated_at'] = job_doc['updated_at'].isoformat()
        if 'last_run' in job_doc and job_doc['last_run']:
            job_doc['last_run'] = job_doc['last_run'].isoformat()
            
        return job_doc
