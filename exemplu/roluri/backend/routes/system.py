"""
System status and configuration routes
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List
from pydantic import BaseModel
from datetime import datetime

from ..utils.dataflows_docu import DataFlowsDocuClient
from ..utils.db import get_db
from ..utils.config import load_config
from ..models.job_model import JobModel
from ..scheduler import get_scheduler
from ..routes.auth import verify_admin, verify_token
from ..modules import get_module_menu_items

router = APIRouter(prefix="/api/system", tags=["system"])


class JobCreate(BaseModel):
    name: str
    frequency: str
    enabled: bool = True
    description: str = None


class JobUpdate(BaseModel):
    frequency: str = None
    enabled: bool = None
    description: str = None


def _get_identity_provider(config: Dict[str, Any]) -> str:
    identity_config = config.get('identity_server')

    if isinstance(identity_config, dict):
        provider = identity_config.get('provider', 'internal')
    elif isinstance(identity_config, str):
        provider = identity_config
    else:
        provider = 'internal'

    return provider


@router.get("/years")
async def get_procurement_years(user = Depends(verify_token)) -> List[Dict[str, Any]]:
    """
    Get procurement years for budget-related selects.
    Requires authentication.
    """
    db = get_db()
    try:
        items = list(db.procurement_years.find().sort('year', 1))
        options: List[Dict[str, Any]] = []
        for item in items:
            year = item.get('year')
            if year is None:
                continue
            try:
                year_int = int(year)
            except (TypeError, ValueError):
                continue
            options.append({
                'value': str(year_int),
                'label': str(year_int),
                'year': year_int
            })
        return options
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load years: {str(e)}")


@router.get("/identity-server")
async def get_identity_server() -> Dict[str, Any]:
    """
    Get identity server configuration
    Public endpoint
    """
    config = load_config()
    provider = _get_identity_provider(config)
    
    return {
        'provider': provider,
        'firebase_enabled': provider == 'firebase'
    }


@router.get("/status")
async def get_system_status() -> Dict[str, Any]:
    """
    Get system status and configuration
    Public endpoint
    """
    config = load_config()
    
    # Check if DataFlows Docu is configured
    docu_config = config.get('dataflows_docu', {})
    docu_url = docu_config.get('url', '')
    docu_token = docu_config.get('token', '')
    
    docu_configured = bool(docu_url and docu_token and docu_token != 'changeme')
    docu_available = False
    
    if docu_configured:
        try:
            client = DataFlowsDocuClient()
            docu_available = client.health_check()
        except:
            docu_available = False
    
    return {
        'dataflows_docu': {
            'configured': docu_configured,
            'available': docu_available,
            'url': docu_url if docu_configured else None
        },
        'document_generation': {
            'max_revisions': config.get('document_generation', {}).get('max_revisions', 3)
        },
        'identity_server': config.get('identity_server', 'local')
    }


@router.get("/modules/menu")
async def get_modules_menu() -> List[Dict[str, Any]]:
    """
    Get menu structure from config collection
    Public endpoint - returns base menu structure
    """
    db = get_db()
    
    try:
        # Get menu structure from config collection
        menu_config = db.config.find_one({'slug': 'menu_structure'})
        
        if menu_config and 'value' in menu_config:
            return menu_config['value']
        
        # Fallback to empty menu if not found
        return {}
        
    except Exception as e:
        print(f"Error loading menu structure: {e}")
        return {}


@router.get("/menu/user")
async def get_user_menu(user = Depends(verify_token)) -> Dict[str, Any]:
    """
    Get menu items for current user based on their role
    Returns menu_items directly from role (already filtered)
    Requires authentication
    """
    from bson import ObjectId
    import traceback
    
    db = get_db()
    
    try:
        # Get user's role
        user_role_id = user.get('local_role') or user.get('role')
        
        if not user_role_id:
            # No role assigned - return empty menu
            return {'menu_items': [], 'sections': [], 'role_name': ''}
        
        # Get role document
        try:
            role = db.roles.find_one({'_id': ObjectId(user_role_id)})
        except:
            role = db.roles.find_one({'_id': user_role_id})
        
        if not role:
            return {'menu_items': [], 'sections': [], 'role_name': ''}
        
        # Return menu_items and sections directly from role
        # They are already in the correct format (list of objects)
        menu_items = role.get('menu_items', [])
        sections = role.get('sections', [])
        
        # Ensure they are lists
        if not isinstance(menu_items, list):
            menu_items = []
        if not isinstance(sections, list):
            sections = []
        
        return {
            'menu_items': menu_items,
            'sections': sections,
            'role_name': role.get('name', '')
        }
        
    except Exception as e:
        print(f"Error loading user menu: {e}")
        traceback.print_exc()
        return {'menu_items': [], 'sections': [], 'role_name': ''}


@router.get("/notifications")
async def get_system_notifications() -> Dict[str, Any]:
    """
    Get system notifications (warnings, errors, info)
    Public endpoint
    """
    notifications = []
    
    config = load_config()
    
    # Check DataFlows Docu configuration
    docu_config = config.get('dataflows_docu', {})
    docu_url = docu_config.get('url', '')
    docu_token = docu_config.get('token', '')
    
    if not docu_url or not docu_token or docu_token == 'changeme':
        notifications.append({
            'type': 'warning',
            'title': 'DataFlows Docu Not Configured',
            'message': 'Document generation features are disabled. Please configure DataFlows Docu URL and token in config.yaml.',
            'action': None
        })
    else:
        # Check if service is available
        try:
            client = DataFlowsDocuClient()
            if not client.health_check():
                notifications.append({
                    'type': 'error',
                    'title': 'DataFlows Docu Unavailable',
                    'message': f'Cannot connect to DataFlows Docu at {docu_url}. Document generation features may not work.',
                    'action': None
                })
        except Exception as e:
            notifications.append({
                'type': 'error',
                'title': 'DataFlows Docu Connection Error',
                'message': f'Error connecting to DataFlows Docu: {str(e)}',
                'action': None
            })
    
    return {
        'notifications': notifications,
        'count': len(notifications)
    }


@router.get("/jobs")
async def list_jobs(user = Depends(verify_admin)) -> List[Dict[str, Any]]:
    """
    List all configured jobs
    Requires admin access
    """
    db = get_db()
    jobs_collection = db[JobModel.collection_name]
    
    jobs = list(jobs_collection.find())
    return [JobModel.to_dict(job) for job in jobs]


@router.post("/jobs")
async def create_job(job_data: JobCreate, user = Depends(verify_admin)) -> Dict[str, Any]:
    """
    Create a new job configuration
    Requires admin access
    """
    db = get_db()
    jobs_collection = db[JobModel.collection_name]
    
    # Check if job already exists
    existing = jobs_collection.find_one({'name': job_data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Job with this name already exists")
    
    # Create job document
    job_doc = JobModel.create(
        name=job_data.name,
        frequency=job_data.frequency,
        enabled=job_data.enabled,
        description=job_data.description
    )
    
    result = jobs_collection.insert_one(job_doc)
    job_doc['_id'] = result.inserted_id
    
    # Reload scheduler to pick up new job
    if job_data.enabled:
        try:
            scheduler = get_scheduler()
            scheduler.load_jobs_from_db()
        except Exception as e:
            print(f"Warning: Failed to reload scheduler: {e}")
    
    return JobModel.to_dict(job_doc)


@router.put("/jobs/{job_name}")
async def update_job(job_name: str, job_data: JobUpdate, user = Depends(verify_admin)) -> Dict[str, Any]:
    """
    Update job configuration
    Requires admin access
    """
    db = get_db()
    jobs_collection = db[JobModel.collection_name]
    
    # Build update document
    update_doc = {}
    if job_data.frequency is not None:
        update_doc['frequency'] = job_data.frequency
    if job_data.enabled is not None:
        update_doc['enabled'] = job_data.enabled
    if job_data.description is not None:
        update_doc['description'] = job_data.description
    
    if not update_doc:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_doc['updated_at'] = datetime.utcnow()
    
    result = jobs_collection.update_one(
        {'name': job_name},
        {'$set': update_doc}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Reload scheduler
    try:
        scheduler = get_scheduler()
        scheduler.load_jobs_from_db()
    except Exception as e:
        print(f"Warning: Failed to reload scheduler: {e}")
    
    updated_job = jobs_collection.find_one({'name': job_name})
    return JobModel.to_dict(updated_job)


@router.post("/jobs/{job_name}/run")
async def run_job_now(job_name: str, user = Depends(verify_admin)) -> Dict[str, Any]:
    """
    Manually trigger a job to run immediately
    Requires admin access
    """
    db = get_db()
    jobs_collection = db[JobModel.collection_name]
    
    # Check if job exists
    job = jobs_collection.find_one({'name': job_name})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Run job
    try:
        scheduler = get_scheduler()
        scheduler.run_job_now(job_name)
        return {'message': f'Job {job_name} triggered successfully'}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Script not found for job {job_name}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to run job: {str(e)}")


@router.delete("/jobs/{job_name}")
async def delete_job(job_name: str, user = Depends(verify_admin)) -> Dict[str, Any]:
    """
    Delete a job configuration
    Requires admin access
    """
    db = get_db()
    jobs_collection = db[JobModel.collection_name]
    
    result = jobs_collection.delete_one({'name': job_name})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Reload scheduler
    try:
        scheduler = get_scheduler()
        scheduler.load_jobs_from_db()
    except Exception as e:
        print(f"Warning: Failed to reload scheduler: {e}")
    
    return {'message': 'Job deleted successfully'}
