"""
Config routes
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from ..utils.db import get_db
from ..models.config_model import ConfigModel
from ..routes.auth import verify_token, verify_admin
from typing import Any

router = APIRouter(prefix="/api/config", tags=["config"])


class ConfigUpdate(BaseModel):
    company_name: Optional[str] = None
    company_logo: Optional[str] = None


class ConfigValueUpdate(BaseModel):
    value: Any


@router.get("/")
async def get_config():
    """
    Get application configuration (public endpoint)
    """
    db = get_db()
    config_collection = db[ConfigModel.collection_name]
    
    config = config_collection.find_one()
    
    if not config:
        # Return default config if none exists
        return {
            'company_name': 'DataFlows Core',
            'company_logo': '/media/img/logo.svg'
        }
    
    return ConfigModel.to_dict(config)


@router.post("/")
async def create_or_update_config(config_data: ConfigUpdate, user = Depends(verify_token)):
    """
    Create or update application configuration (requires authentication)
    """
    db = get_db()
    config_collection = db[ConfigModel.collection_name]
    
    existing_config = config_collection.find_one()
    
    if existing_config:
        # Update existing config
        update_doc = {}
        if config_data.company_name is not None:
            update_doc['company_name'] = config_data.company_name
        if config_data.company_logo is not None:
            update_doc['company_logo'] = config_data.company_logo
        
        if update_doc:
            update_doc['updated_at'] = datetime.utcnow()
            config_collection.update_one(
                {'_id': existing_config['_id']},
                {'$set': update_doc}
            )
        
        updated_config = config_collection.find_one({'_id': existing_config['_id']})
        return ConfigModel.to_dict(updated_config)
    else:
        # Create new config
        config_doc = ConfigModel.create(
            company_name=config_data.company_name or 'DataFlows Core',
            company_logo=config_data.company_logo or '/media/img/logo.svg'
        )
        result = config_collection.insert_one(config_doc)
        config_doc['_id'] = result.inserted_id
        
        return ConfigModel.to_dict(config_doc)


@router.get("/entries/all")
async def list_all_config(user = Depends(verify_admin)):
    """
    List all configuration entries (admin only)
    Returns all documents with 'slug' field as key
    """
    db = get_db()
    config_collection = db[ConfigModel.collection_name]
    
    # Get all documents that have a 'slug' field
    configs = list(config_collection.find({'slug': {'$exists': True}}))
    
    result = []
    for config in configs:
        # Use slug as key
        key = config.get('slug', 'undefined')
        
        # Determine value from content, items, or other fields
        # Exclude _id, slug, created_at, updated_at from value
        value = None
        if 'content' in config:
            value = config['content']
        elif 'items' in config:
            value = config['items']
        else:
            # Get all fields except metadata
            value_dict = {k: v for k, v in config.items() 
                         if k not in ['_id', 'slug', 'created_at', 'updated_at']}
            value = value_dict if value_dict else 'undefined'
        
        entry = {
            'id': str(config['_id']),
            'key': key,
            'value': value,
        }
        if 'updated_at' in config:
            entry['updated_at'] = config['updated_at'].isoformat()
        result.append(entry)
    
    return result


@router.get("/entry/{key}")
async def get_config_value(key: str, user = Depends(verify_admin)):
    """
    Get a specific configuration value (admin only)
    """
    db = get_db()
    config_collection = db[ConfigModel.collection_name]
    
    config = config_collection.find_one({'key': key})
    
    if not config:
        raise HTTPException(status_code=404, detail="Configuration key not found")
    
    config['id'] = str(config['_id'])
    del config['_id']
    if 'created_at' in config:
        config['created_at'] = config['created_at'].isoformat()
    if 'updated_at' in config:
        config['updated_at'] = config['updated_at'].isoformat()
    
    return config


@router.put("/entry/{key}")
async def update_config_value(key: str, data: ConfigValueUpdate, user = Depends(verify_admin)):
    """
    Update a specific configuration value (admin only)
    """
    db = get_db()
    config_collection = db[ConfigModel.collection_name]
    
    # Check if config entry exists
    existing = config_collection.find_one({'key': key})
    
    if existing:
        # Update existing
        config_collection.update_one(
            {'key': key},
            {'$set': {
                'value': data.value,
                'updated_at': datetime.utcnow()
            }}
        )
    else:
        # Create new entry
        config_doc = {
            'key': key,
            'value': data.value,
            'description': '',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        config_collection.insert_one(config_doc)
    
    return {"message": "Configuration updated successfully", "key": key}
