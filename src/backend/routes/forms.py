"""
Forms routes
"""
from fastapi import APIRouter, HTTPException, Depends, Header, Request
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from bson import ObjectId
import qrcode
import qrcode.image.svg
from io import BytesIO

from ..utils.db import get_db
from ..models.form_model import FormModel
from ..routes.auth import verify_token, verify_admin
from ..utils.audit import log_action
from ..utils.slug_generator import generate_unique_slug
import yaml
import os

router = APIRouter(prefix="/api/forms", tags=["forms"])


class FormCreate(BaseModel):
    title: str
    description: Optional[str] = None
    json_schema: Dict[Any, Any]
    ui_schema: Optional[Dict[Any, Any]] = None
    is_public: bool = True
    template_codes: Optional[List[str]] = None
    notification_emails: Optional[List[str]] = None
    notification_template: str = 'default'


class FormUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    json_schema: Optional[Dict[Any, Any]] = None
    ui_schema: Optional[Dict[Any, Any]] = None
    active: Optional[bool] = None
    is_public: Optional[bool] = None
    template_codes: Optional[List[str]] = None
    notification_emails: Optional[List[str]] = None
    notification_template: Optional[str] = None


@router.get("/{slug}")
async def get_form_by_slug(slug: str, authorization: Optional[str] = Header(None)):
    """
    Get form definition by slug
    Public forms accessible to all, protected forms require authentication
    """
    from datetime import datetime
    db = get_db()
    forms_collection = db[FormModel.collection_name]
    
    # Only show forms that are not deleted or deleted in the future
    form = forms_collection.find_one({
        'slug': slug, 
        'active': True,
        '$or': [
            {'deleted': None},
            {'deleted': {'$gt': datetime.utcnow()}}
        ]
    })
    
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Check if form is protected
    if not form.get('is_public', True):
        # Require authentication for protected forms
        if not authorization:
            raise HTTPException(status_code=401, detail="Authentication required for this form")
        
        try:
            await verify_token(authorization)
        except HTTPException:
            raise HTTPException(status_code=401, detail="Authentication required for this form")
    
    return FormModel.to_dict(form)


@router.get("/")
async def list_forms(user = Depends(verify_admin)):
    """
    List all forms (requires administrator access)
    Only returns non-deleted forms or forms with future deletion date
    """
    from datetime import datetime
    db = get_db()
    forms_collection = db[FormModel.collection_name]
    
    # Only show forms that are not deleted or deleted in the future
    forms = list(forms_collection.find({
        '$or': [
            {'deleted': None},
            {'deleted': {'$gt': datetime.utcnow()}}
        ]
    }))
    
    return [FormModel.to_dict(form) for form in forms]


@router.post("/")
async def create_form(form_data: FormCreate, request: Request, user = Depends(verify_admin)):
    """
    Create a new form (requires administrator access)
    """
    db = get_db()
    
    # Generate unique slug
    slug = generate_unique_slug(db, length=8)
    
    # Create form document
    form_doc = FormModel.create(
        slug=slug,
        title=form_data.title,
        json_schema=form_data.json_schema,
        ui_schema=form_data.ui_schema,
        description=form_data.description,
        is_public=form_data.is_public,
        template_codes=form_data.template_codes,
        notification_emails=form_data.notification_emails,
        notification_template=form_data.notification_template
    )
    
    forms_collection = db[FormModel.collection_name]
    result = forms_collection.insert_one(form_doc)
    form_doc['_id'] = result.inserted_id
    
    # Log action
    log_action(
        action='form_created',
        username=user['username'],
        request=request,
        resource_type='form',
        resource_id=str(result.inserted_id),
        details={'title': form_data.title, 'slug': slug}
    )
    
    return FormModel.to_dict(form_doc)


@router.put("/{form_id}")
async def update_form(form_id: str, form_data: FormUpdate, request: Request, user = Depends(verify_admin)):
    """
    Update an existing form (requires administrator access)
    """
    db = get_db()
    forms_collection = db[FormModel.collection_name]
    
    try:
        obj_id = ObjectId(form_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid form ID")
    
    # Build update document
    update_doc = {}
    if form_data.title is not None:
        update_doc['title'] = form_data.title
    if form_data.description is not None:
        update_doc['description'] = form_data.description
    if form_data.json_schema is not None:
        update_doc['json_schema'] = form_data.json_schema
    if form_data.ui_schema is not None:
        update_doc['ui_schema'] = form_data.ui_schema
    if form_data.active is not None:
        update_doc['active'] = form_data.active
    if form_data.is_public is not None:
        update_doc['is_public'] = form_data.is_public
    if form_data.template_codes is not None:
        update_doc['template_codes'] = form_data.template_codes
    if form_data.notification_emails is not None:
        update_doc['notification_emails'] = form_data.notification_emails
    if form_data.notification_template is not None:
        update_doc['notification_template'] = form_data.notification_template
    
    if not update_doc:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    from datetime import datetime
    update_doc['updated_at'] = datetime.utcnow()
    
    result = forms_collection.update_one(
        {'_id': obj_id},
        {'$set': update_doc}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Log action
    log_action(
        action='form_updated',
        username=user['username'],
        request=request,
        resource_type='form',
        resource_id=form_id,
        details={'updated_fields': list(update_doc.keys())}
    )
    
    updated_form = forms_collection.find_one({'_id': obj_id})
    return FormModel.to_dict(updated_form)


@router.delete("/{form_id}")
async def delete_form(form_id: str, request: Request, user = Depends(verify_admin)):
    """
    Soft delete a form (requires administrator access)
    Sets deleted timestamp instead of removing from database
    """
    from datetime import datetime
    db = get_db()
    forms_collection = db[FormModel.collection_name]
    
    try:
        obj_id = ObjectId(form_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid form ID")
    
    # Soft delete: set deleted timestamp
    result = forms_collection.update_one(
        {'_id': obj_id},
        {'$set': {'deleted': datetime.utcnow(), 'updated_at': datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Log action
    log_action(
        action='form_deleted',
        username=user['username'],
        request=request,
        resource_type='form',
        resource_id=form_id
    )
    
    return {'message': 'Form deleted successfully'}


@router.get("/{slug}/qr")
async def get_form_qr_code(slug: str):
    """
    Generate QR code SVG for form URL
    """
    from datetime import datetime
    db = get_db()
    forms_collection = db[FormModel.collection_name]
    
    # Only show forms that are not deleted or deleted in the future
    form = forms_collection.find_one({
        'slug': slug, 
        'active': True,
        '$or': [
            {'deleted': None},
            {'deleted': {'$gt': datetime.utcnow()}}
        ]
    })
    
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Load config to get base URL
    config_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'config', 'config.yaml')
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
    
    base_url = config.get('web', {}).get('base_url', 'http://localhost:8000')
    form_url = f"{base_url}/web/forms/{slug}"
    
    # Generate QR code as SVG
    factory = qrcode.image.svg.SvgPathImage
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
        image_factory=factory
    )
    qr.add_data(form_url)
    qr.make(fit=True)
    
    # Create SVG
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Save to BytesIO
    buffer = BytesIO()
    img.save(buffer)
    buffer.seek(0)
    
    return Response(
        content=buffer.getvalue(),
        media_type="image/svg+xml",
        headers={
            "Content-Disposition": f'attachment; filename="form-{slug}-qr.svg"'
        }
    )


@router.get("/mail-templates/list")
async def list_mail_templates(user = Depends(verify_admin)):
    """
    List available email notification templates
    """
    import glob
    
    # Get templates directory
    templates_dir = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'media', 'mail_templates')
    
    if not os.path.exists(templates_dir):
        return []
    
    # Find all .html files
    template_files = glob.glob(os.path.join(templates_dir, '*.html'))
    
    templates = []
    for template_path in template_files:
        template_name = os.path.splitext(os.path.basename(template_path))[0]
        templates.append({
            'value': template_name,
            'label': template_name.replace('_', ' ').title()
        })
    
    return templates
