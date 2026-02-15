"""
Job scheduler for running recurring tasks
Uses APScheduler with cron-like scheduling
"""
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime
import subprocess
import sys
import os
from .utils.db import get_db
from .models.job_model import JobModel


class JobScheduler:
    """Manages scheduled jobs"""
    
    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self.jobs = {}
    
    def load_jobs_from_db(self):
        """Load job configurations from database"""
        db = get_db()
        jobs_collection = db[JobModel.collection_name]
        
        jobs = list(jobs_collection.find({'enabled': True}))
        
        for job_doc in jobs:
            job_name = job_doc['name']
            frequency = job_doc['frequency']
            
            # Parse cron expression
            parts = frequency.split()
            if len(parts) != 5:
                print(f"WARNING: Invalid cron expression for job {job_name}: {frequency}")
                continue
            
            minute, hour, day, month, day_of_week = parts
            
            # Create cron trigger
            trigger = CronTrigger(
                minute=minute,
                hour=hour,
                day=day,
                month=month,
                day_of_week=day_of_week
            )
            
            # Add job to scheduler
            self.add_job(job_name, trigger)
    
    def add_job(self, job_name: str, trigger):
        """Add a job to the scheduler"""
        script_path = os.path.join(
            os.path.dirname(__file__),
            '..',
            'scripts',
            f'{job_name}.py'
        )
        
        if not os.path.exists(script_path):
            print(f"WARNING: Script not found for job {job_name}: {script_path}")
            return
        
        # Add job to scheduler
        job = self.scheduler.add_job(
            func=self.run_script,
            trigger=trigger,
            args=[job_name, script_path],
            id=job_name,
            name=job_name,
            replace_existing=True
        )
        
        self.jobs[job_name] = job
        print(f"Scheduled job: {job_name}")
    
    def run_script(self, job_name: str, script_path: str):
        """Execute a job script"""
        print(f"[{datetime.now().isoformat()}] Running job: {job_name}")
        
        try:
            # Run script as subprocess
            result = subprocess.run(
                [sys.executable, script_path],
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            # Update job status in database
            db = get_db()
            jobs_collection = db[JobModel.collection_name]
            
            status = 'success' if result.returncode == 0 else 'failed'
            
            jobs_collection.update_one(
                {'name': job_name},
                {
                    '$set': {
                        'last_run': datetime.utcnow(),
                        'last_status': status,
                        'last_output': result.stdout if result.returncode == 0 else result.stderr
                    }
                }
            )
            
            if result.returncode == 0:
                print(f"[{datetime.now().isoformat()}] Job {job_name} completed successfully")
                if result.stdout:
                    print(result.stdout)
            else:
                print(f"[{datetime.now().isoformat()}] Job {job_name} failed with code {result.returncode}")
                if result.stderr:
                    print(result.stderr)
        
        except subprocess.TimeoutExpired:
            print(f"[{datetime.now().isoformat()}] Job {job_name} timed out")
            
            # Update status
            db = get_db()
            jobs_collection = db[JobModel.collection_name]
            jobs_collection.update_one(
                {'name': job_name},
                {
                    '$set': {
                        'last_run': datetime.utcnow(),
                        'last_status': 'timeout'
                    }
                }
            )
        
        except Exception as e:
            print(f"[{datetime.now().isoformat()}] Error running job {job_name}: {str(e)}")
            
            # Update status
            db = get_db()
            jobs_collection = db[JobModel.collection_name]
            jobs_collection.update_one(
                {'name': job_name},
                {
                    '$set': {
                        'last_run': datetime.utcnow(),
                        'last_status': 'error',
                        'last_output': str(e)
                    }
                }
            )
    
    def start(self):
        """Start the scheduler"""
        self.load_jobs_from_db()
        self.scheduler.start()
        print("Job scheduler started")
    
    def shutdown(self):
        """Shutdown the scheduler"""
        self.scheduler.shutdown()
        print("Job scheduler stopped")
    
    def run_job_now(self, job_name: str):
        """Manually trigger a job to run immediately"""
        script_path = os.path.join(
            os.path.dirname(__file__),
            '..',
            'scripts',
            f'{job_name}.py'
        )
        
        if not os.path.exists(script_path):
            raise FileNotFoundError(f"Script not found: {script_path}")
        
        self.run_script(job_name, script_path)


# Global scheduler instance
_scheduler = None


def get_scheduler() -> JobScheduler:
    """Get or create scheduler instance"""
    global _scheduler
    if _scheduler is None:
        _scheduler = JobScheduler()
    return _scheduler
