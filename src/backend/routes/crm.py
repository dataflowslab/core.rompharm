"""
CRM routes - Subscribers, Segments, Campaigns
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from bson import ObjectId
from datetime import datetime
import requests

from ..utils.db import get_db
from ..utils.anaf import verify_tax_id
from ..models.subscriber_model import SubscriberModel
from ..models.segment_model import SegmentModel
from ..models.campaign_model import CampaignModel
from .auth import verify_token
import yaml
import os


router = APIRouter(prefix="/api/crm", tags=["crm"])


def load_config():
    """Load configuration from config.yaml"""
    config_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'config', 'config.yaml')
    with open(config_path, 'r') as f:
        return yaml.safe_load(f)


# ============= SUBSCRIBERS =============

class SubscriberCreate(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    tax_id: Optional[str] = None
    email_marketing_consent: bool = False
    sms_marketing_consent: bool = False
    segments: Optional[List[str]] = []


class SubscriberUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    tax_id: Optional[str] = None
    email_marketing_consent: Optional[bool] = None
    sms_marketing_consent: Optional[bool] = None
    segments: Optional[List[str]] = None


@router.get("/subscribers")
async def get_subscribers(user = Depends(verify_token)):
    """Get all subscribers"""
    db = get_db()
    subscribers_collection = db[SubscriberModel.collection_name]
    
    subscribers = list(subscribers_collection.find().sort('created_at', -1))
    
    for subscriber in subscribers:
        subscriber['id'] = str(subscriber['_id'])
        del subscriber['_id']
        if 'created_at' in subscriber:
            subscriber['created_at'] = subscriber['created_at'].isoformat()
        if 'updated_at' in subscriber:
            subscriber['updated_at'] = subscriber['updated_at'].isoformat()
    
    return subscribers


@router.post("/subscribers")
async def create_subscriber(subscriber: SubscriberCreate, user = Depends(verify_token)):
    """Create a new subscriber"""
    db = get_db()
    subscribers_collection = db[SubscriberModel.collection_name]
    
    # Check for duplicates
    query = []
    if subscriber.tax_id:
        query.append({'tax_id': subscriber.tax_id})
    if subscriber.email:
        query.append({'email': subscriber.email})
    if subscriber.phone:
        query.append({'phone': subscriber.phone})
    
    if query:
        existing = subscribers_collection.find_one({'$or': query})
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Subscriber with this tax ID, email, or phone already exists"
            )
    
    # Verify tax ID with ANAF if provided
    anaf_data = None
    if subscriber.tax_id:
        anaf_data = verify_tax_id(subscriber.tax_id)
    
    # Create subscriber
    subscriber_doc = SubscriberModel.create(
        name=subscriber.name,
        email=subscriber.email,
        phone=subscriber.phone,
        tax_id=subscriber.tax_id,
        anaf_data=anaf_data,
        email_marketing_consent=subscriber.email_marketing_consent,
        sms_marketing_consent=subscriber.sms_marketing_consent,
        segments=subscriber.segments
    )
    
    result = subscribers_collection.insert_one(subscriber_doc)
    subscriber_doc['id'] = str(result.inserted_id)
    del subscriber_doc['_id']
    
    return subscriber_doc


@router.put("/subscribers/{subscriber_id}")
async def update_subscriber(
    subscriber_id: str,
    subscriber: SubscriberUpdate,
    user = Depends(verify_token)
):
    """Update a subscriber"""
    db = get_db()
    subscribers_collection = db[SubscriberModel.collection_name]
    
    existing = subscribers_collection.find_one({'_id': ObjectId(subscriber_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    
    # Check for duplicates (excluding current subscriber)
    query = []
    if subscriber.tax_id:
        query.append({'tax_id': subscriber.tax_id, '_id': {'$ne': ObjectId(subscriber_id)}})
    if subscriber.email:
        query.append({'email': subscriber.email, '_id': {'$ne': ObjectId(subscriber_id)}})
    if subscriber.phone:
        query.append({'phone': subscriber.phone, '_id': {'$ne': ObjectId(subscriber_id)}})
    
    if query:
        duplicate = subscribers_collection.find_one({'$or': query})
        if duplicate:
            raise HTTPException(
                status_code=400,
                detail="Another subscriber with this tax ID, email, or phone already exists"
            )
    
    # Verify tax ID with ANAF if changed
    update_data = subscriber.dict(exclude_unset=True)
    if subscriber.tax_id and subscriber.tax_id != existing.get('tax_id'):
        anaf_data = verify_tax_id(subscriber.tax_id)
        update_data['anaf'] = anaf_data
    
    update_data['updated_at'] = datetime.utcnow()
    
    subscribers_collection.update_one(
        {'_id': ObjectId(subscriber_id)},
        {'$set': update_data}
    )
    
    return {"message": "Subscriber updated successfully"}


@router.delete("/subscribers/{subscriber_id}")
async def delete_subscriber(subscriber_id: str, user = Depends(verify_token)):
    """Delete a subscriber"""
    db = get_db()
    subscribers_collection = db[SubscriberModel.collection_name]
    
    result = subscribers_collection.delete_one({'_id': ObjectId(subscriber_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    
    return {"message": "Subscriber deleted successfully"}


@router.post("/subscribers/import-inventree")
async def import_from_inventree(user = Depends(verify_token)):
    """Import customers from InvenTree"""
    db = get_db()
    subscribers_collection = db[SubscriberModel.collection_name]
    config = load_config()
    
    inventree_url = config.get('inventree', {}).get('url', '').rstrip('/')
    
    if not inventree_url:
        raise HTTPException(status_code=400, detail="InvenTree URL not configured")
    
    try:
        # Get user's token from database
        users_collection = db['users']
        user_doc = users_collection.find_one({'username': user['username']})
        
        if not user_doc or 'token' not in user_doc:
            raise HTTPException(status_code=401, detail="User token not found")
        
        token = user_doc['token']
        
        # Fetch customers from InvenTree
        headers = {'Authorization': f'Token {token}'}
        response = requests.get(
            f"{inventree_url}/api/company/",
            headers=headers,
            params={'is_customer': 'true'},
            timeout=30
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Failed to fetch customers from InvenTree: {response.text}"
            )
        
        customers = response.json()
        imported_count = 0
        skipped_count = 0
        
        for customer in customers:
            # Check for duplicates
            tax_id = customer.get('tax_id')
            email = customer.get('email')
            phone = customer.get('phone')
            
            query = []
            if tax_id:
                query.append({'tax_id': tax_id})
            if email:
                query.append({'email': email})
            if phone:
                query.append({'phone': phone})
            
            if query:
                existing = subscribers_collection.find_one({'$or': query})
                if existing:
                    skipped_count += 1
                    continue
            
            # Verify tax ID with ANAF if available
            anaf_data = None
            if tax_id:
                anaf_data = verify_tax_id(tax_id)
            
            # Create subscriber
            subscriber_doc = SubscriberModel.create(
                name=customer.get('name', 'Unknown'),
                email=email,
                phone=phone,
                tax_id=tax_id,
                anaf_data=anaf_data,
                email_marketing_consent=False,
                sms_marketing_consent=False,
                segments=[]
            )
            
            subscribers_collection.insert_one(subscriber_doc)
            imported_count += 1
        
        return {
            "message": "Import completed",
            "imported": imported_count,
            "skipped": skipped_count
        }
        
    except requests.RequestException as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error connecting to InvenTree: {str(e)}"
        )


# ============= SEGMENTS =============

class SegmentCreate(BaseModel):
    name: str
    description: Optional[str] = None


class SegmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


@router.get("/segments")
async def get_segments(user = Depends(verify_token)):
    """Get all segments"""
    db = get_db()
    segments_collection = db[SegmentModel.collection_name]
    
    segments = list(segments_collection.find().sort('name', 1))
    
    for segment in segments:
        segment['id'] = str(segment['_id'])
        del segment['_id']
        if 'created_at' in segment:
            segment['created_at'] = segment['created_at'].isoformat()
        if 'updated_at' in segment:
            segment['updated_at'] = segment['updated_at'].isoformat()
    
    return segments


@router.post("/segments")
async def create_segment(segment: SegmentCreate, user = Depends(verify_token)):
    """Create a new segment"""
    db = get_db()
    segments_collection = db[SegmentModel.collection_name]
    
    # Check for duplicate name
    existing = segments_collection.find_one({'name': segment.name})
    if existing:
        raise HTTPException(status_code=400, detail="Segment with this name already exists")
    
    segment_doc = SegmentModel.create(
        name=segment.name,
        description=segment.description
    )
    
    result = segments_collection.insert_one(segment_doc)
    segment_doc['id'] = str(result.inserted_id)
    del segment_doc['_id']
    
    return segment_doc


@router.put("/segments/{segment_id}")
async def update_segment(
    segment_id: str,
    segment: SegmentUpdate,
    user = Depends(verify_token)
):
    """Update a segment"""
    db = get_db()
    segments_collection = db[SegmentModel.collection_name]
    
    existing = segments_collection.find_one({'_id': ObjectId(segment_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    # Check for duplicate name
    if segment.name:
        duplicate = segments_collection.find_one({
            'name': segment.name,
            '_id': {'$ne': ObjectId(segment_id)}
        })
        if duplicate:
            raise HTTPException(status_code=400, detail="Segment with this name already exists")
    
    update_data = segment.dict(exclude_unset=True)
    update_data['updated_at'] = datetime.utcnow()
    
    segments_collection.update_one(
        {'_id': ObjectId(segment_id)},
        {'$set': update_data}
    )
    
    return {"message": "Segment updated successfully"}


@router.delete("/segments/{segment_id}")
async def delete_segment(segment_id: str, user = Depends(verify_token)):
    """Delete a segment"""
    db = get_db()
    segments_collection = db[SegmentModel.collection_name]
    
    result = segments_collection.delete_one({'_id': ObjectId(segment_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    return {"message": "Segment deleted successfully"}


# ============= CAMPAIGNS =============

class CampaignCreate(BaseModel):
    type: str  # 'email'
    title: str
    message: str
    segment_id: str
    image: Optional[str] = None
    link: Optional[str] = None
    delivery_date: Optional[datetime] = None
    scheduled_at: Optional[datetime] = None


class CampaignUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    segment_id: Optional[str] = None
    image: Optional[str] = None
    link: Optional[str] = None
    delivery_date: Optional[datetime] = None
    scheduled_at: Optional[datetime] = None


@router.get("/campaigns")
async def get_campaigns(user = Depends(verify_token)):
    """Get all campaigns"""
    db = get_db()
    campaigns_collection = db[CampaignModel.collection_name]
    
    campaigns = list(campaigns_collection.find().sort('created_at', -1))
    
    for campaign in campaigns:
        campaign['id'] = str(campaign['_id'])
        del campaign['_id']
        if 'created_at' in campaign:
            campaign['created_at'] = campaign['created_at'].isoformat()
        if 'updated_at' in campaign:
            campaign['updated_at'] = campaign['updated_at'].isoformat()
        if 'sent_at' in campaign and campaign['sent_at']:
            campaign['sent_at'] = campaign['sent_at'].isoformat()
        if 'delivery_date' in campaign and campaign['delivery_date']:
            campaign['delivery_date'] = campaign['delivery_date'].isoformat()
        if 'scheduled_at' in campaign and campaign['scheduled_at']:
            campaign['scheduled_at'] = campaign['scheduled_at'].isoformat()
    
    return campaigns


@router.post("/campaigns")
async def create_campaign(campaign: CampaignCreate, user = Depends(verify_token)):
    """Create a new campaign"""
    db = get_db()
    campaigns_collection = db[CampaignModel.collection_name]
    segments_collection = db[SegmentModel.collection_name]
    
    # Verify segment exists
    segment = segments_collection.find_one({'_id': ObjectId(campaign.segment_id)})
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    campaign_doc = CampaignModel.create(
        type=campaign.type,
        title=campaign.title,
        message=campaign.message,
        segment_id=campaign.segment_id,
        image=campaign.image,
        link=campaign.link,
        delivery_date=campaign.delivery_date,
        scheduled_at=campaign.scheduled_at
    )
    
    result = campaigns_collection.insert_one(campaign_doc)
    campaign_doc['id'] = str(result.inserted_id)
    del campaign_doc['_id']
    
    return campaign_doc


@router.put("/campaigns/{campaign_id}")
async def update_campaign(
    campaign_id: str,
    campaign: CampaignUpdate,
    user = Depends(verify_token)
):
    """Update a campaign"""
    db = get_db()
    campaigns_collection = db[CampaignModel.collection_name]
    
    existing = campaigns_collection.find_one({'_id': ObjectId(campaign_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if existing.get('status') == 'sent':
        raise HTTPException(status_code=400, detail="Cannot edit a sent campaign")
    
    # Verify segment exists if changed
    if campaign.segment_id:
        segments_collection = db[SegmentModel.collection_name]
        segment = segments_collection.find_one({'_id': ObjectId(campaign.segment_id)})
        if not segment:
            raise HTTPException(status_code=404, detail="Segment not found")
    
    update_data = campaign.dict(exclude_unset=True)
    update_data['updated_at'] = datetime.utcnow()
    
    campaigns_collection.update_one(
        {'_id': ObjectId(campaign_id)},
        {'$set': update_data}
    )
    
    return {"message": "Campaign updated successfully"}


@router.delete("/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str, user = Depends(verify_token)):
    """Delete a campaign"""
    db = get_db()
    campaigns_collection = db[CampaignModel.collection_name]
    
    existing = campaigns_collection.find_one({'_id': ObjectId(campaign_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if existing.get('status') == 'sent':
        raise HTTPException(status_code=400, detail="Cannot delete a sent campaign")
    
    campaigns_collection.delete_one({'_id': ObjectId(campaign_id)})
    
    return {"message": "Campaign deleted successfully"}


@router.post("/campaigns/{campaign_id}/send")
async def send_campaign(campaign_id: str, user = Depends(verify_token)):
    """Mark campaign as ready to send (actual sending will be done by cron)"""
    db = get_db()
    campaigns_collection = db[CampaignModel.collection_name]
    
    campaign = campaigns_collection.find_one({'_id': ObjectId(campaign_id)})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign.get('status') == 'sent':
        raise HTTPException(status_code=400, detail="Campaign already sent")
    
    # Mark as ready to send
    campaigns_collection.update_one(
        {'_id': ObjectId(campaign_id)},
        {'$set': {
            'status': 'sending',
            'updated_at': datetime.utcnow()
        }}
    )
    
    return {"message": "Campaign marked for sending. It will be processed by the cron job."}
