"""
Roles Routes
CRUD pentru roles
"""
from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from datetime import datetime

from ..utils.db import get_db
from ..models.user_model import RoleCreate, RoleUpdate
from .auth import verify_admin

router = APIRouter(prefix="/api/roles", tags=["roles"])


@router.get("/")
async def list_roles(
    current_user: dict = Depends(verify_admin)
):
    """List all roles"""
    db = get_db()
    roles_collection = db['roles']
    
    roles = list(roles_collection.find().sort('name', 1))
    
    for role in roles:
        role['_id'] = str(role['_id'])
        if role.get('created_at'):
            role['created_at'] = role['created_at'].isoformat()
        if role.get('updated_at'):
            role['updated_at'] = role['updated_at'].isoformat()
    
    return {"results": roles}


@router.get("/permissions/items")
async def list_permission_items(
    current_user: dict = Depends(verify_admin)
):
    """List all available permission items from roles_items collection"""
    db = get_db()
    roles_items_collection = db['roles_items']
    
    items = list(roles_items_collection.find().sort('slug', 1))
    
    for item in items:
        item['_id'] = str(item['_id'])
    
    return {"results": items}


@router.get("/{role_id}")
async def get_role(
    role_id: str,
    current_user: dict = Depends(verify_admin)
):
    """Get role by ID"""
    db = get_db()
    roles_collection = db['roles']
    
    try:
        role = roles_collection.find_one({'_id': ObjectId(role_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid role ID")
    
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    role['_id'] = str(role['_id'])
    
    if role.get('created_at'):
        role['created_at'] = role['created_at'].isoformat()
    if role.get('updated_at'):
        role['updated_at'] = role['updated_at'].isoformat()
    
    return role


@router.post("/")
async def create_role(
    role_data: RoleCreate,
    current_user: dict = Depends(verify_admin)
):
    """Create new role"""
    db = get_db()
    roles_collection = db['roles']
    
    # Check if slug exists
    existing = roles_collection.find_one({'slug': role_data.slug})
    if existing:
        raise HTTPException(status_code=400, detail="Role with this slug already exists")
    
    # Create role
    role_doc = {
        'name': role_data.name,
        'slug': role_data.slug,
        'description': role_data.description,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    }
    
    result = roles_collection.insert_one(role_doc)
    role_doc['_id'] = str(result.inserted_id)
    role_doc['created_at'] = role_doc['created_at'].isoformat()
    role_doc['updated_at'] = role_doc['updated_at'].isoformat()
    
    return role_doc


@router.put("/{role_id}")
async def update_role(
    role_id: str,
    role_data: RoleUpdate,
    current_user: dict = Depends(verify_admin)
):
    """Update role"""
    db = get_db()
    roles_collection = db['roles']
    
    try:
        role_oid = ObjectId(role_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid role ID")
    
    # Check if exists
    existing = roles_collection.find_one({'_id': role_oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Check if slug is taken by another role
    if role_data.slug:
        slug_check = roles_collection.find_one({
            'slug': role_data.slug,
            '_id': {'$ne': role_oid}
        })
        if slug_check:
            raise HTTPException(status_code=400, detail="Role with this slug already exists")
    
    # Build update
    update_data = {'updated_at': datetime.utcnow()}
    
    if role_data.name is not None:
        update_data['name'] = role_data.name
    if role_data.slug is not None:
        update_data['slug'] = role_data.slug
    if role_data.description is not None:
        update_data['description'] = role_data.description
    if role_data.items is not None:
        update_data['items'] = role_data.items
    
    # Update
    roles_collection.update_one(
        {'_id': role_oid},
        {'$set': update_data}
    )
    
    # Get updated role
    return await get_role(role_id, current_user)


@router.delete("/{role_id}")
async def delete_role(
    role_id: str,
    current_user: dict = Depends(verify_admin)
):
    """Delete role"""
    db = get_db()
    roles_collection = db['roles']
    users_collection = db['users']
    
    try:
        role_oid = ObjectId(role_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid role ID")
    
    # Check if any users have this role
    users_with_role = users_collection.count_documents({'role_id': role_oid})
    if users_with_role > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete role. {users_with_role} user(s) have this role."
        )
    
    result = roles_collection.delete_one({'_id': role_oid})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Role not found")
    
    return {"success": True, "message": "Role deleted successfully"}
