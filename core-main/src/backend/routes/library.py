"""
Library routes for file management
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Request
from pydantic import BaseModel
from typing import Optional, List
from bson import ObjectId
from datetime import datetime

from ..utils.db import get_db
from ..models.file_model import FileModel
from ..routes.auth import verify_token
from ..utils.audit import log_action
from ..utils.file_handler import save_upload_file, get_file_path
import os

router = APIRouter(prefix="/api/library", tags=["library"])


class FileUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    shared_with: Optional[List[str]] = None
    tags: Optional[List[str]] = None


@router.post("/upload")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    title: Optional[str] = None,
    description: Optional[str] = None,
    main: Optional[str] = None,
    user = Depends(verify_token)
):
    """
    Upload a file to the library
    main: 'false' to hide from main library (for module-specific files)
    """
    try:
        # Save file using existing secure system
        file_metadata = await save_upload_file(file)
        
        # Create file document in database
        db = get_db()
        files_collection = db[FileModel.collection_name]
        
        file_doc = FileModel.create(
            filename=file_metadata['filename'],
            original_filename=file_metadata['original_filename'],
            hash=file_metadata['hash'],
            size=file_metadata['size'],
            mime_type=file.content_type or 'application/octet-stream',
            owner=user['username'],
            title=title,
            description=description,
        )
        
        # Add main flag if specified
        if main == 'false':
            file_doc['main'] = False
        
        result = files_collection.insert_one(file_doc)
        file_doc['_id'] = result.inserted_id
        
        # Log action
        log_action(
            action='file_uploaded',
            username=user['username'],
            request=request,
            resource_type='file',
            resource_id=str(result.inserted_id),
            resource_name=file_doc['title'],
            details={'filename': file_doc['original_filename'], 'size': file_doc['size'], 'main': main != 'false'}
        )
        
        return FileModel.to_dict(file_doc)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")


@router.get("/my-files")
async def get_my_files(
    skip: int = 0,
    limit: int = 20,
    search: str = None,
    user = Depends(verify_token)
):
    """
    Get files owned by current user with pagination and search
    Excludes module-specific files (main=false)
    """
    db = get_db()
    files_collection = db[FileModel.collection_name]
    
    # Build query - exclude files with main=false
    query = {
        'owner': user['username'],
        'deleted': {'$ne': True},
        'main': {'$ne': False}
    }
    
    # Add search if provided
    if search:
        query['$or'] = [
            {'title': {'$regex': search, '$options': 'i'}},
            {'description': {'$regex': search, '$options': 'i'}},
            {'original_filename': {'$regex': search, '$options': 'i'}}
        ]
    
    # Get total count
    total = files_collection.count_documents(query)
    
    # Get files with pagination
    files = list(files_collection.find(query).sort('created_at', -1).skip(skip).limit(limit))
    
    return {
        'files': [FileModel.to_dict(f) for f in files],
        'total': total,
        'skip': skip,
        'limit': limit,
        'has_more': (skip + limit) < total
    }


@router.get("/shared-with-me")
async def get_shared_files(
    skip: int = 0,
    limit: int = 20,
    search: str = None,
    user = Depends(verify_token)
):
    """
    Get files shared with current user with pagination and search
    """
    db = get_db()
    files_collection = db[FileModel.collection_name]
    
    # Get user's role
    users_collection = db['users']
    user_doc = users_collection.find_one({'username': user['username']})
    user_role = user_doc.get('role', '') if user_doc else ''
    
    # Build base query
    base_query = {
        '$or': [
            {'shared_with': user['username']},
            {'shared_with': user_role},
            {'tags': 'shared'},
            {'is_shared': True, 'shared_with': {'$size': 0}}
        ],
        'owner': {'$ne': user['username']},
        'deleted': {'$ne': True}
    }
    
    # Add search if provided
    if search:
        base_query['$and'] = [{
            '$or': [
                {'title': {'$regex': search, '$options': 'i'}},
                {'description': {'$regex': search, '$options': 'i'}},
                {'original_filename': {'$regex': search, '$options': 'i'}}
            ]
        }]
    
    # Get total count
    total = files_collection.count_documents(base_query)
    
    # Get files with pagination
    files = list(files_collection.find(base_query).sort('created_at', -1).skip(skip).limit(limit))
    
    return {
        'files': [FileModel.to_dict(f) for f in files],
        'total': total,
        'skip': skip,
        'limit': limit,
        'has_more': (skip + limit) < total
    }


@router.get("/files/{file_id}")
async def get_file_details(file_id: str, user = Depends(verify_token)):
    """
    Get file details
    """
    db = get_db()
    files_collection = db[FileModel.collection_name]
    
    try:
        obj_id = ObjectId(file_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid file ID")
    
    file_doc = files_collection.find_one({'_id': obj_id})
    
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Check access: owner or shared with user
    username = user['username']
    users_collection = db['users']
    user_doc = users_collection.find_one({'username': username})
    user_role = user_doc.get('role', '') if user_doc else ''
    
    is_owner = file_doc['owner'] == username
    is_shared = (
        username in file_doc.get('shared_with', []) or
        user_role in file_doc.get('shared_with', []) or
        'shared' in file_doc.get('tags', []) or
        file_doc.get('is_shared', False)
    )
    
    if not (is_owner or is_shared):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return FileModel.to_dict(file_doc)


@router.put("/files/{file_id}")
async def update_file(
    file_id: str,
    file_update: FileUpdate,
    request: Request,
    user = Depends(verify_token)
):
    """
    Update file metadata (only owner can update)
    """
    db = get_db()
    files_collection = db[FileModel.collection_name]
    
    try:
        obj_id = ObjectId(file_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid file ID")
    
    file_doc = files_collection.find_one({'_id': obj_id})
    
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Only owner can update
    if file_doc['owner'] != user['username']:
        raise HTTPException(status_code=403, detail="Only file owner can update metadata")
    
    # Prepare update
    update_data = {
        'updated_at': datetime.utcnow(),
        'updated_by': user['username']
    }
    
    if file_update.title is not None:
        update_data['title'] = file_update.title
    
    if file_update.description is not None:
        update_data['description'] = file_update.description
    
    if file_update.shared_with is not None:
        update_data['shared_with'] = file_update.shared_with
        update_data['is_shared'] = len(file_update.shared_with) > 0
    
    if file_update.tags is not None:
        update_data['tags'] = file_update.tags
    
    # Update document
    files_collection.update_one(
        {'_id': obj_id},
        {'$set': update_data}
    )
    
    # Log action
    log_action(
        action='file_updated',
        username=user['username'],
        request=request,
        resource_type='file',
        resource_id=file_id,
        resource_name=file_update.title or file_doc['title'],
        details={'updates': list(update_data.keys())}
    )
    
    # Return updated document
    updated_doc = files_collection.find_one({'_id': obj_id})
    return FileModel.to_dict(updated_doc)


@router.delete("/files/{file_id}")
async def delete_file(
    file_id: str,
    request: Request,
    user = Depends(verify_token)
):
    """
    Soft delete a file (only owner can delete)
    """
    db = get_db()
    files_collection = db[FileModel.collection_name]
    
    try:
        obj_id = ObjectId(file_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid file ID")
    
    file_doc = files_collection.find_one({'_id': obj_id})
    
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Only owner can delete
    if file_doc['owner'] != user['username']:
        raise HTTPException(status_code=403, detail="Only file owner can delete")
    
    # Soft delete - mark as deleted
    files_collection.update_one(
        {'_id': obj_id},
        {
            '$set': {
                'deleted': True,
                'deleted_at': datetime.utcnow(),
                'deleted_by': user['username']
            }
        }
    )
    
    # Log action
    log_action(
        action='file_deleted',
        username=user['username'],
        request=request,
        resource_type='file',
        resource_id=file_id,
        resource_name=file_doc['title'],
        details={'filename': file_doc['original_filename']}
    )
    
    return {'message': 'File deleted successfully'}


@router.post("/files/bulk-delete")
async def bulk_delete_files(
    file_ids: List[str],
    request: Request,
    user = Depends(verify_token)
):
    """
    Soft delete multiple files at once
    """
    db = get_db()
    files_collection = db[FileModel.collection_name]
    
    deleted_count = 0
    errors = []
    
    for file_id in file_ids:
        try:
            obj_id = ObjectId(file_id)
            file_doc = files_collection.find_one({'_id': obj_id})
            
            if not file_doc:
                errors.append(f"File {file_id} not found")
                continue
            
            if file_doc['owner'] != user['username']:
                errors.append(f"File {file_id}: access denied")
                continue
            
            # Soft delete
            files_collection.update_one(
                {'_id': obj_id},
                {
                    '$set': {
                        'deleted': True,
                        'deleted_at': datetime.utcnow(),
                        'deleted_by': user['username']
                    }
                }
            )
            
            deleted_count += 1
            
            # Log action
            log_action(
                action='file_deleted',
                username=user['username'],
                request=request,
                resource_type='file',
                resource_id=file_id,
                resource_name=file_doc['title'],
                details={'filename': file_doc['original_filename'], 'bulk': True}
            )
            
        except Exception as e:
            errors.append(f"File {file_id}: {str(e)}")
    
    return {
        'deleted': deleted_count,
        'errors': errors,
        'message': f'{deleted_count} file(s) deleted successfully'
    }


@router.get("/files/all")
async def get_all_files(
    skip: int = 0,
    limit: int = 20,
    search: str = None,
    user = Depends(verify_token)
):
    """
    Get all accessible files (own + shared) for file picker
    Excludes module-specific files (main=false)
    """
    db = get_db()
    files_collection = db[FileModel.collection_name]
    users_collection = db['users']
    
    # Get user's role
    user_doc = users_collection.find_one({'username': user['username']})
    user_role = user_doc.get('role', '') if user_doc else ''
    
    # Build query for accessible files - exclude files with main=false
    query = {
        '$or': [
            {'owner': user['username']},
            {'shared_with': user['username']},
            {'shared_with': user_role},
            {'tags': 'shared'},
            {'is_shared': True}
        ],
        'deleted': {'$ne': True},
        'main': {'$ne': False}
    }
    
    # Add search if provided
    if search:
        query['$and'] = [{
            '$or': [
                {'title': {'$regex': search, '$options': 'i'}},
                {'description': {'$regex': search, '$options': 'i'}},
                {'original_filename': {'$regex': search, '$options': 'i'}}
            ]
        }]
    
    # Get total count
    total = files_collection.count_documents(query)
    
    # Get files with pagination
    files = list(files_collection.find(query).sort('created_at', -1).skip(skip).limit(limit))
    
    return {
        'files': [FileModel.to_dict(f) for f in files],
        'total': total,
        'skip': skip,
        'limit': limit,
        'has_more': (skip + limit) < total
    }


@router.get("/files/{file_id}/download")
async def download_file(file_id: str, user = Depends(verify_token)):
    """
    Get download URL for a file
    """
    from fastapi.responses import FileResponse
    
    db = get_db()
    files_collection = db[FileModel.collection_name]
    
    try:
        obj_id = ObjectId(file_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid file ID")
    
    file_doc = files_collection.find_one({'_id': obj_id})
    
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Check access
    username = user['username']
    users_collection = db['users']
    user_doc = users_collection.find_one({'username': username})
    user_role = user_doc.get('role', '') if user_doc else ''
    
    is_owner = file_doc['owner'] == username
    is_shared = (
        username in file_doc.get('shared_with', []) or
        user_role in file_doc.get('shared_with', []) or
        'shared' in file_doc.get('tags', []) or
        file_doc.get('is_shared', False)
    )
    
    if not (is_owner or is_shared):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get file path
    file_path = get_file_path(file_doc['hash'])
    
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Physical file not found")
    
    return FileResponse(
        file_path,
        media_type=file_doc['mime_type'],
        filename=file_doc['original_filename']
    )
