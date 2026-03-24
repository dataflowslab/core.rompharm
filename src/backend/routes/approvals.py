"""
Approval System Routes
Global approval system for DataFlows Core
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

from src.backend.utils.db import get_db
from src.backend.routes.auth import verify_token
from src.backend.utils.sections_permissions import require_section
from src.backend.utils.approval_helpers import normalize_officers
from src.backend.models.approval_template_model import (
    ApprovalTemplateModel,
    ApprovalTemplateCreate,
    ApprovalTemplateUpdate,
    ApprovalOfficer
)
from src.backend.models.approval_flow_model import (
    ApprovalFlowModel,
    ApprovalFlowCreate,
    ApprovalSignature,
    ApprovalSignatureCreate
)

router = APIRouter(prefix="/api/approvals", tags=["approvals"])


# ==================== APPROVAL TEMPLATES ====================

@router.get("/templates")
def list_templates(
    object_type: Optional[str] = None,
    object_source: Optional[str] = None,
    active: Optional[bool] = None,
    current_user: dict = Depends(require_section("approvals"))
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
def create_template(
    template: ApprovalTemplateCreate,
    current_user: dict = Depends(require_section("approvals"))
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
    if template_data.get("officers") is not None:
        template_data["officers"] = normalize_officers(db, template_data.get("officers") or [])
    template_data["created_at"] = datetime.utcnow()
    template_data["updated_at"] = datetime.utcnow()
    
    result = db.approval_templates.insert_one(template_data)
    
    template_data["_id"] = str(result.inserted_id)
    
    return template_data


@router.get("/templates/{template_id}")
def get_template(
    template_id: str,
    current_user: dict = Depends(require_section("approvals"))
):
    """Get approval template"""
    db = get_db()
    
    template = db.approval_templates.find_one({"_id": ObjectId(template_id)})
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template["_id"] = str(template["_id"])
    
    return template


@router.put("/templates/{template_id}")
def update_template(
    template_id: str,
    update: ApprovalTemplateUpdate,
    current_user: dict = Depends(require_section("approvals"))
):
    """Update approval template"""
    db = get_db()
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    if "officers" in update_data:
        update_data["officers"] = normalize_officers(db, update_data.get("officers") or [])
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
def delete_template(
    template_id: str,
    current_user: dict = Depends(require_section("approvals"))
):
    """Delete approval template"""
    db = get_db()
    
    result = db.approval_templates.delete_one({"_id": ObjectId(template_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return {"message": "Template deleted successfully"}


# ==================== APPROVAL FLOWS ====================

@router.get("/flows")
def list_flows(
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
def create_flow(
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
def get_flow(
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
def get_flow_by_object(
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
def sign_flow(
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
def remove_signature(
    flow_id: str,
    user_id: str,
    current_user: dict = Depends(require_section("approvals"))
):
    """Remove signature from flow"""
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

@router.get("/pending")
def get_pending_approvals(current_user: dict = Depends(verify_token)):
    """Get pending approvals for current user"""
    db = get_db()
    user_id = str(current_user["_id"])
    user_role = current_user.get("role")
    user_role = str(user_role) if user_role is not None else None

    def _safe_object_id(value):
        if not value:
            return None
        if isinstance(value, ObjectId):
            return value
        try:
            return ObjectId(str(value))
        except Exception:
            return None

    def _split_object_id(value):
        raw = str(value) if value is not None else ""
        if ":" in raw:
            base_id, suffix = raw.split(":", 1)
            return base_id, suffix
        return raw, None

    def _format_batch_codes(batch_codes):
        if not batch_codes:
            return None
        if isinstance(batch_codes, str):
            codes = [batch_codes.strip()]
        else:
            codes = [str(code).strip() for code in batch_codes if str(code).strip()]
        if not codes:
            return None
        if len(codes) == 1:
            return codes[0]
        return f"{codes[0]} +{len(codes) - 1}"
    
    # metrics for debugging
    # print(f"DEBUG: Finding pending approvals for user {user_id} (Role: {user_role})")

    # Find flows that are active
    active_flows = list(db.approval_flows.find({
        "status": {"$in": ["pending", "in_progress"]}
    }))
    
    pending_approvals = []
    
    for flow in active_flows:
        # Check if already signed
        if any(str(s.get("user_id")) == user_id for s in flow.get("signatures", [])):
            continue
            
        can_sign = False
        officer_type = "optional"
        required_officers = flow.get("must_sign_officers") or flow.get("required_officers") or []
        optional_officers = flow.get("can_sign_officers") or flow.get("optional_officers") or []
        
        # Check required officers
        for officer in required_officers:
            if officer.get("type") == "person" and str(officer.get("reference")) == user_id:
                can_sign = True
                officer_type = "required"
                break
            elif officer.get("type") == "role" and user_role and str(officer.get("reference")) == user_role:
                can_sign = True
                officer_type = "required"
                break
        
        # Check optional officers if not already found
        if not can_sign:
            for officer in optional_officers:
                if officer.get("type") == "person" and str(officer.get("reference")) == user_id:
                    can_sign = True
                    break
                elif officer.get("type") == "role" and user_role and str(officer.get("reference")) == user_role:
                    can_sign = True
                    break
        
        if can_sign:
            # Add metadata for frontend
            flow["_id"] = str(flow["_id"])
            flow["officer_type"] = officer_type
            if flow.get("object_id") is not None:
                flow["object_id"] = str(flow["object_id"])
            
            # Fetch object details for better UI context
            flow["object_details"] = {
                "reference": f"{flow['object_type']} #{flow['object_id']}",
                "description": "Waiting for approval",
                "supplier": "-"
            }

            object_type = flow.get("object_type")
            object_source = flow.get("object_source")
            base_object_id, series_batch = _split_object_id(flow.get("object_id"))

            if object_type == "procurement_order" and object_source == "depo_procurement":
                try:
                    order_oid = _safe_object_id(flow.get("object_id"))
                    order = db.depo_purchase_orders.find_one({"_id": order_oid}) if order_oid else None
                    if order:
                        flow["object_details"]["reference"] = order.get("reference", "Unknown")
                        flow["object_details"]["description"] = order.get("description", "")
                        # Try to get supplier name
                        if order.get("supplier_id"):
                             supplier = db.depo_companies.find_one({"_id": order["supplier_id"]})
                             if supplier:
                                 flow["object_details"]["supplier"] = supplier.get("name", "Unknown")
                except Exception as e:
                    print(f"Error fetching object details: {e}")

            elif object_type == "purchase_request" and object_source == "core":
                 try:
                    request_oid = _safe_object_id(flow.get("object_id"))
                    request = db.depo_purchase_requests.find_one({"_id": request_oid}) if request_oid else None
                    if request:
                        flow["object_details"]["reference"] = request.get("reference", f"Request #{request.get('number', '')}")
                        flow["object_details"]["description"] = request.get("notes", "")
                 except Exception as e:
                    print(f"Error fetching request details: {e}")

            elif object_type in {"stock_request", "stock_request_operations", "stock_request_reception", "stock_request_production", "stock_request_production_series"}:
                try:
                    request_oid = _safe_object_id(base_object_id)
                    request = db.depo_requests.find_one({"_id": request_oid}) if request_oid else None
                    if request:
                        request_reference = request.get("reference") or ""
                        request_notes = request.get("notes") or ""
                        batch_label = series_batch or _format_batch_codes(request.get("batch_codes"))

                        if object_type == "stock_request":
                            flow["object_details"]["reference"] = request_reference or flow["object_details"]["reference"]
                            flow["object_details"]["description"] = request_notes or flow["object_details"]["description"]
                        else:
                            if batch_label:
                                flow["object_details"]["reference"] = batch_label
                                flow["object_details"]["description"] = request_reference or request_notes or flow["object_details"]["description"]
                            else:
                                flow["object_details"]["reference"] = request_reference or flow["object_details"]["reference"]
                                flow["object_details"]["description"] = request_notes or flow["object_details"]["description"]
                except Exception as e:
                    print(f"Error fetching stock request details: {e}")

            elif object_type == "sales_order" and object_source == "depo_sales":
                try:
                    order_oid = _safe_object_id(flow.get("object_id"))
                    order = None
                    if order_oid:
                        order = db['depo_sales_ordes'].find_one({"_id": order_oid})
                        if not order:
                            order = db['depo_sales_orders'].find_one({"_id": order_oid})
                    if order:
                        flow["object_details"]["reference"] = order.get("reference", "Unknown")
                        flow["object_details"]["description"] = order.get("description", "") or order.get("notes", "")
                except Exception as e:
                    print(f"Error fetching sales order details: {e}")

            elif object_type == "return_order":
                try:
                    order_oid = _safe_object_id(flow.get("object_id"))
                    order = db['depo_return_orders'].find_one({"_id": order_oid}) if order_oid else None
                    if order:
                        flow["object_details"]["reference"] = order.get("reference", "Unknown")
                        flow["object_details"]["description"] = order.get("sales_order_reference", "") or order.get("notes", "")
                except Exception as e:
                    print(f"Error fetching return order details: {e}")

            elif object_type in {"build_order_production", "build_order_production_series"}:
                try:
                    build_oid = _safe_object_id(base_object_id)
                    build_order = db['depo_build_orders'].find_one({"_id": build_oid}) if build_oid else None
                    if build_order:
                        batch_code = build_order.get("batch_code_text") or build_order.get("batch_code")
                        flow["object_details"]["reference"] = batch_code or flow["object_details"]["reference"]
                        flow["object_details"]["description"] = build_order.get("reference", "") or flow["object_details"]["description"]
                except Exception as e:
                    print(f"Error fetching build order details: {e}")

            elif object_type == "stock_qc":
                try:
                    stock_oid = _safe_object_id(flow.get("object_id"))
                    stock = db.depo_stocks.find_one({"_id": stock_oid}) if stock_oid else None
                    if stock:
                        batch_code = stock.get("batch_code") or stock.get("supplier_batch_code")
                        flow["object_details"]["reference"] = batch_code or flow["object_details"]["reference"]
                        part_name = ""
                        part_id = stock.get("part_id")
                        if part_id:
                            part_oid = _safe_object_id(part_id)
                            part = db.depo_parts.find_one({"_id": part_oid}) if part_oid else None
                            if part:
                                part_name = part.get("name") or ""
                        if part_name:
                            flow["object_details"]["description"] = part_name
                except Exception as e:
                    print(f"Error fetching stock details: {e}")

            pending_approvals.append(flow)
            
    return {"approvals": pending_approvals}
