"""
Pytest configuration and fixtures for requests module tests
"""
import pytest
from unittest.mock import Mock, MagicMock
from datetime import datetime
from bson import ObjectId


@pytest.fixture
def mock_db():
    """Mock MongoDB database"""
    db = MagicMock()
    
    # Mock collections
    db.depo_requests = MagicMock()
    db.depo_parts = MagicMock()
    db.depo_stocks = MagicMock()
    db.depo_recipes = MagicMock()
    db.approval_flows = MagicMock()
    db.config = MagicMock()
    db.users = MagicMock()
    
    return db


@pytest.fixture
def mock_user():
    """Mock authenticated user"""
    return {
        "_id": ObjectId("507f1f77bcf86cd799439011"),
        "username": "test_user",
        "token": "test_token_123",
        "roles": ["admin"]
    }


@pytest.fixture
def sample_part():
    """Sample part document"""
    return {
        "_id": ObjectId("507f1f77bcf86cd799439012"),
        "id": 100,
        "name": "Test Part",
        "ipn": "TP-001"
    }


@pytest.fixture
def sample_stock():
    """Sample stock document"""
    return {
        "_id": ObjectId("507f1f77bcf86cd799439013"),
        "part_id": ObjectId("507f1f77bcf86cd799439012"),
        "state_id": ObjectId("694322878728e4d75ae72790"),
        "quantity": 50,
        "batch_code": "BATCH001",
        "supplier_batch_code": "SUP-BATCH001",
        "location_id": ObjectId("507f1f77bcf86cd799439014")
    }


@pytest.fixture
def sample_request():
    """Sample request document"""
    return {
        "_id": ObjectId("507f1f77bcf86cd799439015"),
        "reference": "REQ-0001",
        "source": 1,
        "destination": 2,
        "items": [
            {
                "part": 100,
                "quantity": 10,
                "notes": "Test item",
                "batch_code": "BATCH001"
            }
        ],
        "line_items": 1,
        "status": "Pending",
        "notes": "Test request",
        "issue_date": datetime.utcnow(),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "created_by": "test_user"
    }


@pytest.fixture
def sample_recipe():
    """Sample recipe document"""
    return {
        "_id": ObjectId("507f1f77bcf86cd799439016"),
        "part_id": ObjectId("507f1f77bcf86cd799439012"),
        "items": [
            {
                "type": 1,
                "part_id": ObjectId("507f1f77bcf86cd799439017"),
                "q": 5,
                "mandatory": True,
                "notes": "Component 1"
            }
        ]
    }


@pytest.fixture
def mock_config():
    """Mock configuration"""
    return {
        "inventree": {
            "url": "http://localhost:8000",
            "token": "test_token"
        }
    }


@pytest.fixture
def mock_approval_config():
    """Mock approval flow configuration"""
    return {
        "_id": ObjectId("507f1f77bcf86cd799439018"),
        "slug": "requests_operations_flow",
        "items": [
            {
                "slug": "operations",
                "enabled": True,
                "min_signatures": 1,
                "can_sign": [
                    {
                        "user_id": "507f1f77bcf86cd799439011",
                        "username": "test_user"
                    }
                ],
                "must_sign": []
            }
        ]
    }
