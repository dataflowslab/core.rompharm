"""
Config routes
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from src.backend.utils.db import get_db
from src.backend.models.config_model import ConfigModel
from src.backend.routes.auth import verify_token

router = APIRouter(prefix="/api/config", tags=["config"])


class ConfigUpdate(BaseModel):
    company_name: Optional[str] = None
    company_logo: Optional[str] = None


@router.get("/")
def get_config():
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
def create_or_update_config(config_data: ConfigUpdate, user = Depends(verify_token)):
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
