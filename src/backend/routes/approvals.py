"""
Approval System Routes
Global approval system for DataFlows Core
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

from ..utils.db import get_db
from ..routes.auth import verify_admin, verify_token
from ..models.approval_template_model import (
    ApprovalTemplateModel,
    ApprovalTemplateCreate,
    ApprovalTemplateUpdate,
    ApprovalOfficer
)
from ..models.approval_flow_model import (
    ApprovalFlowModel,
    ApprovalFlowCreate,
    ApprovalSignature,
    ApprovalSignatureCreate
)

router = APIRouter(prefix="/api/approvals", tags=["approvals"])


# ==================== APPROVAL TEMPLATES ====================

@router.get("/templates")
async def list_templates(
    object_type: Optional[str] = None,
    object_source: Optional[str] = None,
    active: Optional[bool] = None,
    current_user: dict = Depends(verify_admin)
):
    """List approval templates"""
    db = get_db()
    
    query = {}
    if object_type:
        query["object_type"] = object_type
    if object_source:
        query["object_source"] = object_source
    if active is not None:
        query["active"] = active
    
    templates = list(db.approval_templates.find(query))
    
    for template in templates:
        template["_id"] = str(template["_id"])
    
    return {"templates": templates}


@router.post("/templates")
async def create_template(
    template: ApprovalTemplateCreate,
    current_user: dict = Depends(verify_admin)
):
    """Create approval template"""
    db = get_db()
    
    # Check if template already exists
    existing = db.approval_templates.find_one({
        "object_type": template.object_type,
        "object_source": template.object_source
    })
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Template already exists for this object type and source"
        )
    
    template_data = template.dict()
    template_data["created_at"] = datetime.utcnow()
    template_data["updated_at"] = datetime.utcnow()
    
    result = db.approval_templates.insert_one(template_data)
    
    template_data["_id"] = str(result.inserted_id)
    
    return template_data


@router.get("/templates/{template_id}")
async def get_template(
    template_id: str,
    current_user: dict = Depends(verify_admin)
):
    """Get approval template"""
    db = get_db()
    
    template = db.approval_templates.find_one({"_id": ObjectId(template_id)})
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template["_id"] = str(template["_id"])
    
    return template


@router.put("/templates/{template_id}")
async def update_template(
    template_id: str,
    update: ApprovalTemplateUpdate,
    current_user: dict = Depends(verify_admin)
):
    """Update approval template"""
    db = get_db()
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updated_at"] = datetime.utcnow()
    
    result = db.approval_templates.update_one(
        {"_id": ObjectId(template_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template = db.approval_templates.find_one({"_id": ObjectId(template_id)})
    template["_id"] = str(template["_id"])
    
    return template


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: str,
    current_user: dict = Depends(verify_admin)
):
    """Delete approval template"""
    db = get_db()
    
    result = db.approval_templates.delete_one({"_id": ObjectId(template_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return {"message": "Template deleted successfully"}


# ==================== APPROVAL FLOWS ====================

@router.get("/flows")
async def list_flows(
    object_type: Optional[str] = None,
    object_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(verify_token)
):
    """List approval flows"""
    db = get_db()
    
    query = {}
    if object_type:
        query["object_type"] = object_type
    if object_id:
        query["object_id"] = object_id
    if status:
        query["status"] = status
    
    flows = list(db.approval_flows.find(query))
    
    for flow in flows:
        flow["_id"] = str(flow["_id"])
    
    return {"flows": flows}


@router.post("/flows")
async def create_flow(
    flow: ApprovalFlowCreate,
    current_user: dict = Depends(verify_token)
):
    """Create approval flow for an object"""
    db = get_db()
    
    # Get template
    template = db.approval_templates.find_one({"_id": ObjectId(flow.template_id)})
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Check if flow already exists
    existing = db.approval_flows.find_one({
        "object_type": flow.object_type,
        "object_source": flow.object_source,
        "object_id": flow.object_id
    })
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Approval flow already exists for this object"
        )
    
    # Separate required and optional officers
    required_officers = []
    optional_officers = []
    
    for officer in template.get("officers", []):
        if officer.get("action") == "must_sign":
            required_officers.append(officer)
        else:
            optional_officers.append(officer)
    
    flow_data = {
        "object_type": flow.object_type,
        "object_source": flow.object_source,
        "object_id": flow.object_id,
        "template_id": flow.template_id,
        "required_officers": required_officers,
        "optional_officers": optional_officers,
        "signatures": [],
        "status": "pending",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = db.approval_flows.insert_one(flow_data)
    
    flow_data["_id"] = str(result.inserted_id)
    
    return flow_data


@router.get("/flows/{flow_id}")
async def get_flow(
    flow_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get approval flow"""
    db = get_db()
    
    flow = db.approval_flows.find_one({"_id": ObjectId(flow_id)})
    
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    
    flow["_id"] = str(flow["_id"])
    
    return flow


@router.get("/flows/object/{object_type}/{object_id}")
async def get_flow_by_object(
    object_type: str,
    object_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get approval flow for specific object"""
    db = get_db()
    
    flow = db.approval_flows.find_one({
        "object_type": object_type,
        "object_id": object_id
    })
    
    if not flow:
        return {"flow": None}
    
    flow["_id"] = str(flow["_id"])
    
    return {"flow": flow}


@router.post("/flows/{flow_id}/sign")
async def sign_flow(
    flow_id: str,
    signature_data: ApprovalSignatureCreate,
    request: Request,
    current_user: dict = Depends(verify_token)
):
    """Sign approval flow"""
    db = get_db()
    
    # Get flow
    flow = db.approval_flows.find_one({"_id": ObjectId(flow_id)})
    
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    
    # Check if already signed
    existing_signature = next(
        (s for s in flow.get("signatures", []) if s["user_id"] == current_user["user_id"]),
        None
    )
    
    if existing_signature:
        raise HTTPException(status_code=400, detail="You have already signed this flow")
    
    # Check if user is authorized to sign
    user_id = current_user["user_id"]
    username = current_user["username"]
    
    can_sign = False
    
    # Check required officers
    for officer in flow.get("required_officers", []):
        if officer["type"] == "person" and officer["reference"] == user_id:
            can_sign = True
            break
        # TODO: Check role-based authorization
    
    # Check optional officers
    if not can_sign:
        for officer in flow.get("optional_officers", []):
            if officer["type"] == "person" and officer["reference"] == user_id:
                can_sign = True
                break
            # TODO: Check role-based authorization
    
    if not can_sign:
        raise HTTPException(status_code=403, detail="You are not authorized to sign this flow")
    
    # Generate signature
    timestamp = datetime.utcnow()
    signature_hash = ApprovalFlowModel.generate_signature_hash(
        user_id=user_id,
        object_type=flow["object_type"],
        object_id=flow["object_id"],
        timestamp=timestamp
    )
    
    signature = {
        "user_id": user_id,
        "username": username,
        "signed_at": timestamp,
        "signature_hash": signature_hash,
        "ip_address": signature_data.ip_address or request.client.host,
        "user_agent": signature_data.user_agent or request.headers.get("user-agent")
    }
    
    # Add signature to flow
    db.approval_flows.update_one(
        {"_id": ObjectId(flow_id)},
        {
            "$push": {"signatures": signature},
            "$set": {
                "status": "in_progress",
                "updated_at": timestamp
            }
        }
    )
    
    # Check if all required signatures are collected
    updated_flow = db.approval_flows.find_one({"_id": ObjectId(flow_id)})
    required_count = len(updated_flow.get("required_officers", []))
    signature_count = len(updated_flow.get("signatures", []))
    
    # Count how many required officers have signed
    required_signed = 0
    for officer in updated_flow.get("required_officers", []):
        if officer["type"] == "person":
            if any(s["user_id"] == officer["reference"] for s in updated_flow.get("signatures", [])):
                required_signed += 1
    
    # If all required officers have signed, mark as approved
    if required_signed == required_count:
        db.approval_flows.update_one(
            {"_id": ObjectId(flow_id)},
            {
                "$set": {
                    "status": "approved",
                    "completed_at": timestamp,
                    "updated_at": timestamp
                }
            }
        )
    
    # Get updated flow
    flow = db.approval_flows.find_one({"_id": ObjectId(flow_id)})
    flow["_id"] = str(flow["_id"])
    
    return flow


@router.delete("/flows/{flow_id}/signatures/{user_id}")
async def remove_signature(
    flow_id: str,
    user_id: str,
    current_user: dict = Depends(verify_admin)
):
    """Remove signature from flow (admin only)"""
    db = get_db()
    
    # Get flow
    flow = db.approval_flows.find_one({"_id": ObjectId(flow_id)})
    
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    
    # Remove signature
    result = db.approval_flows.update_one(
        {"_id": ObjectId(flow_id)},
        {
            "$pull": {"signatures": {"user_id": user_id}},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Signature not found")
    
    # Update status back to pending if no signatures left
    updated_flow = db.approval_flows.find_one({"_id": ObjectId(flow_id)})
    if len(updated_flow.get("signatures", [])) == 0:
        db.approval_flows.update_one(
            {"_id": ObjectId(flow_id)},
            {"$set": {"status": "pending"}}
        )
    
    return {"message": "Signature removed successfully"}
