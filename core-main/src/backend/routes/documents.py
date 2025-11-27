"""
Document generation routes
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from bson import ObjectId
from datetime import datetime
import io

from ..utils.db import get_db
from ..utils.dataflows_docu import DataFlowsDocuClient
from ..models.generated_document_model import GeneratedDocumentModel
from ..models.data_model import DataModel
from ..models.form_model import FormModel
from .auth import verify_token
import yaml
import os


router = APIRouter(prefix="/api/documents", tags=["documents"])


def load_config():
    """Load configuration from config.yaml"""
    config_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'config', 'config.yaml')
    with open(config_path, 'r') as f:
        return yaml.safe_load(f)


class GenerateDocumentRequest(BaseModel):
    submission_id: str
    template_code: str
    template_name: str


class TemplateInfo(BaseModel):
    code: str
    name: str


@router.get("/templates")
async def get_available_templates():
    """
    Get list of available document templates from MongoDB config
    Templates are stored in config collection with slug = 'docu_templates'
    """
    try:
        db = get_db()
        
        # Check if service is available
        client = DataFlowsDocuClient()
        if not client.health_check():
            raise HTTPException(
                status_code=503,
                detail="DataFlows Docu service is not available"
            )
        
        # Get template codes from MongoDB config collection
        config_collection = db['config']
        docu_templates_config = config_collection.find_one({'slug': 'docu_templates'})
        
        if not docu_templates_config or 'templates' not in docu_templates_config:
            return []
        
        template_codes = docu_templates_config.get('templates', [])
        
        if not template_codes:
            return []
        
        # Fetch details for each template
        templates = []
        for code in template_codes:
            template = client.get_template(code)
            if template:
                # Extract name from parts if available
                name = code
                if template.get('parts') and len(template['parts']) > 0:
                    name = template['parts'][0].get('name', code)
                
                templates.append({
                    'code': code,
                    'name': name,
                    'parts': template.get('parts', [])
                })
            else:
                # If template not found, still return the code
                templates.append({
                    'code': code,
                    'name': code,
                    'parts': []
                })
        
        return templates
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get templates: {str(e)}"
        )


@router.post("/generate")
async def generate_document(
    request: GenerateDocumentRequest,
    user = Depends(verify_token)
):
    """
    Generate a document from a form submission (async job)
    Creates a job in OfficeClerk and saves it to submission
    """
    print(f"[DOCUMENT] Generate request: submission_id={request.submission_id}, template_code={request.template_code}")
    print(f"[DOCUMENT] User: {user.get('username')}")
    
    db = get_db()
    
    # Get the submission
    data_collection = db[DataModel.collection_name]
    
    try:
        submission_obj_id = ObjectId(request.submission_id)
    except Exception as e:
        print(f"[DOCUMENT] Invalid submission ID: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid submission ID: {str(e)}")
    
    submission = data_collection.find_one({'_id': submission_obj_id})
    
    if not submission:
        print(f"[DOCUMENT] Submission not found: {request.submission_id}")
        raise HTTPException(status_code=404, detail="Submission not found")
    
    print(f"[DOCUMENT] Submission found: form_id={submission.get('form_id')}")
    
    # Get the form
    forms_collection = db[FormModel.collection_name]
    form = forms_collection.find_one({'_id': ObjectId(submission['form_id'])})
    
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Check if template is in form's template_codes
    if request.template_code not in form.get('template_codes', []):
        raise HTTPException(
            status_code=400,
            detail="Template not associated with this form"
        )
    
    try:
        print(f"[DOCUMENT] Initializing DataFlows Docu client...")
        client = DataFlowsDocuClient()
        
        print(f"[DOCUMENT] Getting next version number...")
        version = GeneratedDocumentModel.get_next_version(
            db,
            request.submission_id,
            request.template_code
        )
        print(f"[DOCUMENT] Version: {version}")
        
        # Generate filename
        filename = f"{form['slug']}-{request.submission_id[:8]}-v{version}"
        print(f"[DOCUMENT] Filename: {filename}")
        
        print(f"[DOCUMENT] Preparing document data...")
        # Prepare data with metadata
        # Keep submission data under 'data' key to match template structure
        document_data = {
            'data': submission['data'],  # Form data under 'data' key
            'submitted_at': submission.get('submitted_at', datetime.utcnow()).isoformat() if isinstance(submission.get('submitted_at'), datetime) else str(submission.get('submitted_at', '')),
            'state': submission.get('state', 'new'),
            'state_updated_by': submission.get('state_updated_by', ''),
            'state_updated_at': submission.get('state_updated_at', datetime.utcnow()).isoformat() if isinstance(submission.get('state_updated_at'), datetime) else str(submission.get('state_updated_at', ''))
        }
        
        print(f"[DOCUMENT] Creating async job in OfficeClerk...")
        # Create async job
        job_response = client.create_job(
            template_code=request.template_code,
            data=document_data,
            format='pdf',
            filename=filename
        )
        
        if not job_response or 'id' not in job_response:
            print(f"[DOCUMENT] ERROR: Failed to create job")
            raise HTTPException(
                status_code=500,
                detail="Failed to create document generation job"
            )
        
        job_id = job_response['id']
        print(f"[DOCUMENT] Job created: {job_id}, status: {job_response.get('status')}")
        
        # Initialize jobs array if not exists
        if 'jobs' not in submission:
            submission['jobs'] = []
        
        # Add job to submission
        job_entry = {
            'job_id': job_id,
            'template_code': request.template_code,
            'template_name': request.template_name,
            'status': job_response.get('status', 'queued'),
            'filename': f"{filename}.pdf",
            'version': version,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'created_by': user.get('username'),
            'local_file': None,  # Will be set when downloaded
            'error': None
        }
        
        # Update submission with new job
        data_collection.update_one(
            {'_id': submission_obj_id},
            {
                '$push': {'jobs': job_entry}
            }
        )
        
        print(f"[DOCUMENT] Job saved to submission")
        
        return {
            'job_id': job_id,
            'status': job_response.get('status'),
            'message': 'Document generation job created',
            'filename': f"{filename}.pdf"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[DOCUMENT] ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error generating document: {str(e)}"
        )


@router.get("/job/{submission_id}/{job_id}/status")
async def get_job_status(
    submission_id: str,
    job_id: str,
    user = Depends(verify_token)
):
    """
    Check status of a document generation job
    """
    print(f"[DOCUMENT] Checking job status: {job_id}")
    
    db = get_db()
    data_collection = db[DataModel.collection_name]
    
    try:
        submission_obj_id = ObjectId(submission_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid submission ID")
    
    submission = data_collection.find_one({'_id': submission_obj_id})
    
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Find job in submission
    jobs = submission.get('jobs', [])
    job_entry = next((j for j in jobs if j['job_id'] == job_id), None)
    
    if not job_entry:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Check status from OfficeClerk
    client = DataFlowsDocuClient()
    job_status = client.get_job_status(job_id)
    
    if not job_status:
        return {
            'job_id': job_id,
            'status': job_entry.get('status', 'unknown'),
            'error': 'Failed to get status from OfficeClerk'
        }
    
    current_status = job_status.get('status')
    print(f"[DOCUMENT] Job {job_id} status: {current_status}")
    
    # Update job status in submission if changed
    if current_status != job_entry.get('status'):
        data_collection.update_one(
            {'_id': submission_obj_id, 'jobs.job_id': job_id},
            {
                '$set': {
                    'jobs.$.status': current_status,
                    'jobs.$.updated_at': datetime.utcnow(),
                    'jobs.$.error': job_status.get('error')
                }
            }
        )
    
    return {
        'job_id': job_id,
        'status': current_status,
        'filename': job_entry.get('filename'),
        'template_name': job_entry.get('template_name'),
        'created_at': job_entry.get('created_at').isoformat() if isinstance(job_entry.get('created_at'), datetime) else str(job_entry.get('created_at')),
        'error': job_status.get('error'),
        'has_local_file': job_entry.get('local_file') is not None
    }


@router.get("/job/{submission_id}/{job_id}/download")
async def download_job_document(
    submission_id: str,
    job_id: str,
    user = Depends(verify_token)
):
    """
    Download document from completed job and save locally
    """
    print(f"[DOCUMENT] Download request for job: {job_id}")
    
    db = get_db()
    data_collection = db[DataModel.collection_name]
    
    try:
        submission_obj_id = ObjectId(submission_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid submission ID")
    
    submission = data_collection.find_one({'_id': submission_obj_id})
    
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Find job in submission
    jobs = submission.get('jobs', [])
    job_entry = next((j for j in jobs if j['job_id'] == job_id), None)
    
    if not job_entry:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Check if already downloaded
    if job_entry.get('local_file'):
        print(f"[DOCUMENT] File already downloaded: {job_entry['local_file']}")
        # Serve from local file
        from ..utils.file_handler import get_file_path
        file_path = get_file_path(job_entry['local_file'])
        
        if file_path and os.path.exists(file_path):
            from fastapi.responses import FileResponse
            return FileResponse(
                file_path,
                media_type='application/pdf',
                filename=job_entry.get('filename', 'document.pdf')
            )
    
    # Download from OfficeClerk
    client = DataFlowsDocuClient()
    document_bytes = client.download_document(job_id)
    
    if not document_bytes:
        raise HTTPException(
            status_code=500,
            detail="Failed to download document from OfficeClerk"
        )
    
    print(f"[DOCUMENT] Downloaded {len(document_bytes)} bytes")
    
    # Save to local filesystem
    from ..utils.file_handler import save_document_file
    file_hash = save_document_file(
        document_bytes,
        job_entry.get('filename', 'document.pdf')
    )
    
    print(f"[DOCUMENT] Saved to local file: {file_hash}")
    
    # Update job with local file path
    data_collection.update_one(
        {'_id': submission_obj_id, 'jobs.job_id': job_id},
        {
            '$set': {
                'jobs.$.local_file': file_hash,
                'jobs.$.updated_at': datetime.utcnow()
            }
        }
    )
    
    # Return document
    return StreamingResponse(
        io.BytesIO(document_bytes),
        media_type='application/pdf',
        headers={
            'Content-Disposition': f'attachment; filename="{job_entry.get("filename", "document.pdf")}"'
        }
    )


@router.get("/submission/{submission_id}")
async def get_submission_documents(
    submission_id: str,
    user = Depends(verify_token)
):
    """
    Get all document generation jobs for a submission
    """
    db = get_db()
    data_collection = db[DataModel.collection_name]
    
    try:
        submission_obj_id = ObjectId(submission_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid submission ID")
    
    submission = data_collection.find_one({'_id': submission_obj_id})
    
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    jobs = submission.get('jobs', [])
    
    # Convert datetime to ISO format
    for job in jobs:
        if 'created_at' in job and isinstance(job['created_at'], datetime):
            job['created_at'] = job['created_at'].isoformat()
        if 'updated_at' in job and isinstance(job['updated_at'], datetime):
            job['updated_at'] = job['updated_at'].isoformat()
    
    return jobs


@router.get("/form/{form_id}/templates")
async def get_form_templates(form_id: str):
    """
    Get templates associated with a form (public endpoint)
    """
    db = get_db()
    forms_collection = db[FormModel.collection_name]
    
    form = forms_collection.find_one({'_id': ObjectId(form_id)})
    
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    template_codes = form.get('template_codes', [])
    
    if not template_codes:
        return []
    
    # Get template details from DataFlows Docu
    client = DataFlowsDocuClient()
    templates = []
    
    for code in template_codes:
        template = client.get_template(code)
        if template:
            templates.append({
                'code': code,
                'name': template.get('name', code),
                'parts': template.get('parts', [])
            })
        else:
            # If template not found, still return the code
            templates.append({
                'code': code,
                'name': code,
                'parts': []
            })
    
    return templates
