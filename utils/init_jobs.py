"""
Initialize jobs in database
Run this once to set up the update_roles job
"""
import sys
import os

# Add src to path
sys.path.insert(0, os.path.dirname(__file__))

from src.backend.utils.db import get_db, close_db
from src.backend.models.job_model import JobModel


def init_jobs():
    """Initialize default jobs in database"""
    print("Initializing jobs...")
    
    db = get_db()
    jobs_collection = db[JobModel.collection_name]
    
    # Define default jobs
    default_jobs = [
        {
            'name': 'update_roles',
            'frequency': '*/5 * * * *',  # Every 5 minutes
            'enabled': True,
            'description': 'Synchronize roles from InvenTree'
        }
    ]
    
    for job_data in default_jobs:
        # Check if job already exists
        existing = jobs_collection.find_one({'name': job_data['name']})
        
        if existing:
            print(f"  Job '{job_data['name']}' already exists, skipping...")
        else:
            # Create job
            job_doc = JobModel.create(
                name=job_data['name'],
                frequency=job_data['frequency'],
                enabled=job_data['enabled'],
                description=job_data['description']
            )
            jobs_collection.insert_one(job_doc)
            print(f"  Created job: {job_data['name']} ({job_data['frequency']})")
    
    print("\nJobs initialized successfully!")
    print("\nTo run a job manually:")
    print("  invoke job-run --name=update_roles")
    print("\nTo list all jobs:")
    print("  invoke job-list")
    print("\nThe scheduler will run automatically when you start the application:")
    print("  invoke dev")
    
    close_db()


if __name__ == "__main__":
    init_jobs()
