"""
Roles routes - for Firebase mode
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from bson import ObjectId
from datetime import datetime

from ..utils.db import get_db
from ..routes.auth import verify_admin
from ..utils.audit import log_action

router = APIRouter(prefix="/api/roles", tags=["roles"])


class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


@router.get("/")
async def list_roles(user = Depends(verify_admin)) -> List[Dict[str, Any]]:
    """
    List all roles (Firebase mode only)
    """
    db = get_db()
    roles_collection = db['roles']
    
    roles = list(roles_collection.find().sort('name', 1))
    
    result = []
    for role in roles:
        result.append({
            'id': str(role['_id']),
            'name': role.get('name', ''),
            'description': role.get('description', ''),
            'created_at': role.get('created_at').isoformat() if role.get('created_at') else None,
            'updated_at': role.get('updated_at').isoformat() if role.get('updated_at') else None
        })
    
    return result


@router.post("/")
async def create_role(role_data: RoleCreate, request: Request, current_user = Depends(verify_admin)) -> Dict[str, Any]:
    """
    Create a new role (admin only, Firebase mode)
    """
    db = get_db()
    roles_collection = db['roles']
    
    # Check if role name already exists
    existing = roles_collection.find_one({'name': role_data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Role name already exists")
    
    # Create role document
    role_doc = {
        'name': role_data.name,
        'description': role_data.description,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    }
    
    result = roles_collection.insert_one(role_doc)
    role_doc['id'] = str(result.inserted_id)
    del role_doc['_id']
    
    # Log action
    log_action(
        action='role_created',
        username=current_user['username'],
        request=request,
        resource_type='role',
        resource_id=role_doc['id'],
        resource_name=role_data.name,
        details={'description': role_data.description}
    )
    
    return role_doc


@router.get("/{role_id}")
async def get_role(role_id: str, current_user = Depends(verify_admin)) -> Dict[str, Any]:
    """
    Get role details (admin only)
    """
    db = get_db()
    roles_collection = db['roles']
    
    try:
        obj_id = ObjectId(role_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid role ID")
    
    role = roles_collection.find_one({'_id': obj_id})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    return {
        'id': str(role['_id']),
        'name': role.get('name', ''),
        'description': role.get('description', ''),
        'created_at': role.get('created_at').isoformat() if role.get('created_at') else None,
        'updated_at': role.get('updated_at').isoformat() if role.get('updated_at') else None
    }


@router.put("/{role_id}")
async def update_role(role_id: str, role_data: RoleUpdate, request: Request, current_user = Depends(verify_admin)) -> Dict[str, Any]:
    """
    Update role (admin only)
    """
    db = get_db()
    roles_collection = db['roles']
    
    try:
        obj_id = ObjectId(role_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid role ID")
    
    existing = roles_collection.find_one({'_id': obj_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Build update document
    update_doc = {}
    if role_data.name is not None:
        # Check if new name is taken
        if role_data.name != existing['name']:
            duplicate = roles_collection.find_one({'name': role_data.name})
            if duplicate:
                raise HTTPException(status_code=400, detail="Role name already exists")
        update_doc['name'] = role_data.name
    
    if role_data.description is not None:
        update_doc['description'] = role_data.description
    
    if update_doc:
        update_doc['updated_at'] = datetime.utcnow()
        roles_collection.update_one({'_id': obj_id}, {'$set': update_doc})
    
    # Log action
    log_action(
        action='role_updated',
        username=current_user['username'],
        request=request,
        resource_type='role',
        resource_id=role_id,
        resource_name=role_data.name or existing['name'],
        details={'updated_fields': list(update_doc.keys())}
    )
    
    return {"message": "Role updated successfully"}


@router.delete("/{role_id}")
async def delete_role(role_id: str, request: Request, current_user = Depends(verify_admin)) -> Dict[str, Any]:
    """
    Delete role (admin only)
    """
    db = get_db()
    roles_collection = db['roles']
    
    try:
        obj_id = ObjectId(role_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid role ID")
    
    role = roles_collection.find_one({'_id': obj_id})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    role_name = role['name']
    roles_collection.delete_one({'_id': obj_id})
    
    # Log action
    log_action(
        action='role_deleted',
        username=current_user['username'],
        request=request,
        resource_type='role',
        resource_id=role_id,
        resource_name=role_name
    )
    
    return {"message": "Role deleted successfully"}
