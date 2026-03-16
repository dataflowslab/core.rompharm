"""
Helpers for build orders creation and batch code normalization
"""
from datetime import datetime
from typing import Any, List, Tuple
from bson import ObjectId


BUILD_STATE_ID = "67890abc1234567890abcde1"


def normalize_batch_code(value: Any) -> Tuple[str, int | None, str]:
    """
    Normalize batch code for storage and prefix matching.
    Returns: (text, numeric_or_none, prefix)
    """
    text = str(value).strip()
    digits = "".join(ch for ch in text if ch.isdigit())
    prefix = digits[:6] if digits else text[:6]
    numeric = int(text) if text.isdigit() else None
    return text, numeric, prefix


def _to_object_id(value: Any) -> Any:
    if not value:
        return value
    try:
        return ObjectId(value) if isinstance(value, str) else value
    except Exception:
        return value


def ensure_build_orders_for_request(
    db,
    request_doc: dict,
    timestamp: datetime | None = None
) -> List[str]:
    """
    Create/ensure build orders for a request that has batch codes.
    Returns list of build order IDs created/updated.
    """
    if not request_doc:
        return []

    batch_codes = request_doc.get("batch_codes") or []
    if not batch_codes:
        return []

    timestamp = timestamp or datetime.utcnow()

    # Use product_id if available, fallback to recipe_part_id
    product_id = request_doc.get("product_id") or request_doc.get("recipe_part_id")
    product_id = _to_object_id(product_id)

    location_id = _to_object_id(request_doc.get("destination"))

    batch_codes_text = [str(code).strip() for code in batch_codes if str(code).strip()]
    if not batch_codes_text:
        return []

    build_orders_collection = db["depo_build_orders"]
    created_or_updated = []

    for code in batch_codes_text:
        text, numeric, prefix = normalize_batch_code(code)

        existing = build_orders_collection.find_one({"batch_code_text": text})

        build_data = {
            "batch_code": numeric if numeric is not None else text,
            "batch_code_text": text,
            "batch_prefix": prefix,
            "grup": {"batch_codes": batch_codes_text},
            "state_id": _to_object_id(BUILD_STATE_ID),
            "product_id": product_id,
            "location_id": location_id,
            "updated_at": timestamp
        }

        if existing:
            # Merge group batch codes
            existing_group = existing.get("grup", {}).get("batch_codes") or []
            merged_group = list({*(str(x).strip() for x in existing_group if str(x).strip()), *batch_codes_text})
            build_data["grup"] = {"batch_codes": merged_group}

            build_orders_collection.update_one(
                {"_id": existing["_id"]},
                {"$set": build_data}
            )
            created_or_updated.append(str(existing["_id"]))
        else:
            build_data["created_at"] = timestamp
            result = build_orders_collection.insert_one(build_data)
            created_or_updated.append(str(result.inserted_id))

    return created_or_updated

