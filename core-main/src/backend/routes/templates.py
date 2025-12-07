"""
Template management routes for OfficeClerk/DataFlows Docu integration
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from bson import ObjectId
from datetime import datetime

from ..utils.db import get_db
from ..utils.dataflows_docu import DataFlowsDocuClient
from ..models.template_model import TemplateModel
from ..routes.auth import verify_admin
from ..utils.audit import log_action


router = APIRouter(prefix="/api/templates", tags=["templates"])


class TemplatePartData(BaseModel):
    type: str  # base, header, footer, css, code
    content: str
    name: Optional[str] = None


class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    part_data: TemplatePartData


class TemplatePartCreate(BaseModel):
    type: str  # base, header, footer, css, code
    content: str
    name: Optional[str] = None


class TemplatePartUpdate(BaseModel):
    content: Optional[str] = None
    name: Optional[str] = None


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


@router.get("/")
async def list_templates(user = Depends(verify_admin)):
    """
    List all templates from DataFlows Docu
    """
    try:
        client = DataFlowsDocuClient()
        
        # Get all templates from DataFlows Docu
        docu_templates = client.get_templates()
        
        if not docu_templates:
            return []
        
        # Get all local metadata in one query
        db = get_db()
        templates_collection = db[TemplateModel.collection_name]
        codes = [t.get('code') for t in docu_templates if t.get('code')]
        local_templates_list = list(templates_collection.find({'code': {'$in': codes}}))
        local_templates_map = {t['code']: t for t in local_templates_list}
        
        # Enrich with local metadata if available
        templates = []
        for docu_template in docu_templates:
            code = docu_template.get('code')
            if not code:
                continue
            
            local_template = local_templates_map.get(code)
            
            templates.append({
                'code': code,
                'name': local_template.get('name') if local_template else docu_template.get('name', code),
                'description': local_template.get('description') if local_template else None,
                'parts': docu_template.get('parts', 0),
                'types': docu_template.get('types', []),
                'created_at': local_template.get('created_at') if local_template else None,
                'updated_at': docu_template.get('updated_at')
            })
        
        return templates
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list templates: {str(e)}"
        )


@router.post("/")
async def create_template(
    template_data: TemplateCreate,
    request: Request,
    user = Depends(verify_admin)
):
    """
    Create a new template by creating its first part (usually base)
    Returns template code from OfficeClerk
    """
    try:
        client = DataFlowsDocuClient()
        
        # Create first part in OfficeClerk
        part_data = template_data.part_data
        payload = {
            'type': part_data.type,
            'content': part_data.content,
            'name': part_data.name or template_data.name
        }
        
        import requests
        response = requests.post(
            f"{client.base_url}/templates",
            headers=client.headers,
            json=payload,
            timeout=30
        )
        
        if response.status_code not in [200, 201]:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Failed to create template in OfficeClerk: {response.text}"
            )
        
        result = response.json()
        template_code = result.get('code')
        
        if not template_code:
            raise HTTPException(
                status_code=500,
                detail="No template code returned from OfficeClerk"
            )
        
        # Store template reference in local database
        db = get_db()
        templates_collection = db[TemplateModel.collection_name]
        
        template_doc = TemplateModel.create(
            code=template_code,
            name=template_data.name,
            description=template_data.description
        )
        
        templates_collection.insert_one(template_doc)
        
        # Log action
        log_action(
            action='template_created',
            username=user['username'],
            request=request,
            resource_type='template',
            resource_id=template_code,
            details={'name': template_data.name, 'type': part_data.type}
        )
        
        return {
            'code': template_code,
            'name': template_data.name,
            'description': template_data.description,
            'parts': result.get('parts', [])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error creating template: {str(e)}"
        )


@router.get("/{template_code}")
async def get_template(template_code: str, user = Depends(verify_admin)):
    """
    Get template bundle with all parts from OfficeClerk
    """
    try:
        client = DataFlowsDocuClient()
        template = client.get_template(template_code)
        
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # Get local metadata if available
        db = get_db()
        templates_collection = db[TemplateModel.collection_name]
        local_template = templates_collection.find_one({'code': template_code})
        
        if local_template:
            template['name'] = local_template.get('name', template_code)
            template['description'] = local_template.get('description')
            template['created_at'] = local_template.get('created_at')
            template['updated_at'] = local_template.get('updated_at')
        
        return template
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting template: {str(e)}"
        )


@router.put("/{template_code}")
async def update_template(
    template_code: str,
    template_data: TemplateUpdate,
    request: Request,
    user = Depends(verify_admin)
):
    """
    Update template metadata (name, description) in local database
    """
    try:
        db = get_db()
        templates_collection = db[TemplateModel.collection_name]
        
        # Build update document
        update_doc = {}
        if template_data.name is not None:
            update_doc['name'] = template_data.name
        if template_data.description is not None:
            update_doc['description'] = template_data.description
        
        if not update_doc:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        update_doc['updated_at'] = datetime.utcnow()
        
        result = templates_collection.update_one(
            {'code': template_code},
            {'$set': update_doc}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # Log action
        log_action(
            action='template_updated',
            username=user['username'],
            request=request,
            resource_type='template',
            resource_id=template_code,
            details={'updated_fields': list(update_doc.keys())}
        )
        
        updated_template = templates_collection.find_one({'code': template_code})
        return TemplateModel.to_dict(updated_template)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error updating template: {str(e)}"
        )


@router.delete("/{template_code}")
async def delete_template(
    template_code: str,
    request: Request,
    user = Depends(verify_admin)
):
    """
    Delete entire template bundle from OfficeClerk and local database
    """
    try:
        client = DataFlowsDocuClient()
        
        # Delete from OfficeClerk
        import requests
        response = requests.delete(
            f"{client.base_url}/templates/{template_code}",
            headers=client.headers,
            timeout=30
        )
        
        if response.status_code not in [200, 204]:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Failed to delete template from OfficeClerk: {response.text}"
            )
        
        # Delete from local database
        db = get_db()
        templates_collection = db[TemplateModel.collection_name]
        templates_collection.delete_one({'code': template_code})
        
        # Log action
        log_action(
            action='template_deleted',
            username=user['username'],
            request=request,
            resource_type='template',
            resource_id=template_code
        )
        
        return {'message': 'Template deleted successfully'}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting template: {str(e)}"
        )


@router.post("/{template_code}/parts")
async def add_template_part(
    template_code: str,
    part_data: TemplatePartCreate,
    request: Request,
    user = Depends(verify_admin)
):
    """
    Add a new part (header, footer, css, code) to existing template
    """
    try:
        client = DataFlowsDocuClient()
        
        # Add part to OfficeClerk
        payload = {
            'code': template_code,
            'type': part_data.type,
            'content': part_data.content,
            'name': part_data.name
        }
        
        import requests
        response = requests.post(
            f"{client.base_url}/templates",
            headers=client.headers,
            json=payload,
            timeout=30
        )
        
        if response.status_code == 409:
            raise HTTPException(
                status_code=409,
                detail=f"Part type '{part_data.type}' already exists for this template"
            )
        elif response.status_code not in [200, 201]:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Failed to add part: {response.text}"
            )
        
        result = response.json()
        
        # Update local template timestamp
        db = get_db()
        templates_collection = db[TemplateModel.collection_name]
        templates_collection.update_one(
            {'code': template_code},
            {'$set': {'updated_at': datetime.utcnow()}}
        )
        
        # Log action
        log_action(
            action='template_part_added',
            username=user['username'],
            request=request,
            resource_type='template',
            resource_id=template_code,
            details={'part_type': part_data.type}
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error adding template part: {str(e)}"
        )


@router.get("/{template_code}/{part_type}")
async def get_template_part(
    template_code: str,
    part_type: str,
    user = Depends(verify_admin)
):
    """
    Get metadata for specific template part
    """
    try:
        client = DataFlowsDocuClient()
        
        import requests
        response = requests.get(
            f"{client.base_url}/templates/{template_code}/{part_type}",
            headers=client.headers,
            timeout=10
        )
        
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="Template part not found")
        elif response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Failed to get template part: {response.text}"
            )
        
        return response.json()
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting template part: {str(e)}"
        )


@router.get("/{template_code}/{part_type}/raw")
async def get_template_part_content(
    template_code: str,
    part_type: str,
    user = Depends(verify_admin)
):
    """
    Get raw content of template part for editing
    """
    try:
        client = DataFlowsDocuClient()
        
        import requests
        response = requests.get(
            f"{client.base_url}/templates/{template_code}/{part_type}/raw",
            headers=client.headers,
            timeout=30
        )
        
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="Template part not found")
        elif response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Failed to get template part content: {response.text}"
            )
        
        return {
            'content': response.text,
            'type': part_type
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting template part content: {str(e)}"
        )


@router.put("/{template_code}/{part_type}")
async def update_template_part(
    template_code: str,
    part_type: str,
    part_data: TemplatePartUpdate,
    request: Request,
    user = Depends(verify_admin)
):
    """
    Update template part content and/or name
    """
    try:
        client = DataFlowsDocuClient()
        
        # Build update payload
        payload = {}
        if part_data.content is not None:
            payload['content'] = part_data.content
        if part_data.name is not None:
            payload['name'] = part_data.name
        
        if not payload:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        import requests
        response = requests.put(
            f"{client.base_url}/templates/{template_code}/{part_type}",
            headers=client.headers,
            json=payload,
            timeout=30
        )
        
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="Template part not found")
        elif response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Failed to update template part: {response.text}"
            )
        
        # Update local template timestamp
        db = get_db()
        templates_collection = db[TemplateModel.collection_name]
        templates_collection.update_one(
            {'code': template_code},
            {'$set': {'updated_at': datetime.utcnow()}}
        )
        
        # Log action
        log_action(
            action='template_part_updated',
            username=user['username'],
            request=request,
            resource_type='template',
            resource_id=template_code,
            details={'part_type': part_type, 'updated_fields': list(payload.keys())}
        )
        
        return response.json()
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error updating template part: {str(e)}"
        )


@router.delete("/{template_code}/{part_type}")
async def delete_template_part(
    template_code: str,
    part_type: str,
    request: Request,
    user = Depends(verify_admin)
):
    """
    Delete a specific part from template
    Cannot delete base part if it's the only part
    """
    try:
        client = DataFlowsDocuClient()
        
        import requests
        response = requests.delete(
            f"{client.base_url}/templates/{template_code}/{part_type}",
            headers=client.headers,
            timeout=30
        )
        
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="Template part not found")
        elif response.status_code not in [200, 204]:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Failed to delete template part: {response.text}"
            )
        
        # Update local template timestamp
        db = get_db()
        templates_collection = db[TemplateModel.collection_name]
        templates_collection.update_one(
            {'code': template_code},
            {'$set': {'updated_at': datetime.utcnow()}}
        )
        
        # Log action
        log_action(
            action='template_part_deleted',
            username=user['username'],
            request=request,
            resource_type='template',
            resource_id=template_code,
            details={'part_type': part_type}
        )
        
        return {'message': 'Template part deleted successfully'}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting template part: {str(e)}"
        )
