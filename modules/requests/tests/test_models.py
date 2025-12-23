"""
Unit tests for requests module Pydantic models
"""
import pytest
from pydantic import ValidationError

from modules.requests.models import RequestItemCreate, RequestCreate, RequestUpdate


class TestRequestItemCreate:
    """Tests for RequestItemCreate model"""
    
    def test_should_create_valid_item_with_required_fields(self):
        """Should create item with only required fields"""
        item = RequestItemCreate(part=100, quantity=10.5)
        
        assert item.part == 100
        assert item.quantity == 10.5
        assert item.notes is None
        assert item.series is None
        assert item.batch_code is None
    
    def test_should_create_item_with_all_fields(self):
        """Should create item with all optional fields"""
        item = RequestItemCreate(
            part=100,
            quantity=10.5,
            notes="Test notes",
            series="S001",
            batch_code="BATCH001"
        )
        
        assert item.part == 100
        assert item.quantity == 10.5
        assert item.notes == "Test notes"
        assert item.series == "S001"
        assert item.batch_code == "BATCH001"
    
    def test_should_raise_error_when_part_missing(self):
        """Should raise ValidationError when part is missing"""
        with pytest.raises(ValidationError) as exc_info:
            RequestItemCreate(quantity=10.5)
        
        assert "part" in str(exc_info.value)
    
    def test_should_raise_error_when_quantity_missing(self):
        """Should raise ValidationError when quantity is missing"""
        with pytest.raises(ValidationError) as exc_info:
            RequestItemCreate(part=100)
        
        assert "quantity" in str(exc_info.value)
    
    def test_should_accept_integer_quantity(self):
        """Should accept integer values for quantity"""
        item = RequestItemCreate(part=100, quantity=10)
        
        assert item.quantity == 10.0


class TestRequestCreate:
    """Tests for RequestCreate model"""
    
    def test_should_create_valid_request_with_required_fields(self):
        """Should create request with only required fields"""
        request = RequestCreate(
            source=1,
            destination=2,
            items=[RequestItemCreate(part=100, quantity=10)]
        )
        
        assert request.source == 1
        assert request.destination == 2
        assert len(request.items) == 1
        assert request.notes is None
        assert request.product_id is None
        assert request.product_quantity is None
        assert request.recipe_id is None
        assert request.recipe_part_id is None
    
    def test_should_create_request_with_recipe_fields(self):
        """Should create request with recipe-related fields"""
        request = RequestCreate(
            source=1,
            destination=2,
            items=[RequestItemCreate(part=100, quantity=10)],
            product_id=200,
            product_quantity=5.0,
            recipe_id="507f1f77bcf86cd799439011",
            recipe_part_id="507f1f77bcf86cd799439012"
        )
        
        assert request.product_id == 200
        assert request.product_quantity == 5.0
        assert request.recipe_id == "507f1f77bcf86cd799439011"
        assert request.recipe_part_id == "507f1f77bcf86cd799439012"
    
    def test_should_raise_error_when_source_missing(self):
        """Should raise ValidationError when source is missing"""
        with pytest.raises(ValidationError) as exc_info:
            RequestCreate(
                destination=2,
                items=[RequestItemCreate(part=100, quantity=10)]
            )
        
        assert "source" in str(exc_info.value)
    
    def test_should_raise_error_when_destination_missing(self):
        """Should raise ValidationError when destination is missing"""
        with pytest.raises(ValidationError) as exc_info:
            RequestCreate(
                source=1,
                items=[RequestItemCreate(part=100, quantity=10)]
            )
        
        assert "destination" in str(exc_info.value)
    
    def test_should_raise_error_when_items_missing(self):
        """Should raise ValidationError when items list is missing"""
        with pytest.raises(ValidationError) as exc_info:
            RequestCreate(source=1, destination=2)
        
        assert "items" in str(exc_info.value)
    
    def test_should_accept_empty_items_list(self):
        """Should accept empty items list"""
        request = RequestCreate(source=1, destination=2, items=[])
        
        assert request.items == []


class TestRequestUpdate:
    """Tests for RequestUpdate model"""
    
    def test_should_create_empty_update(self):
        """Should create update with all fields as None"""
        update = RequestUpdate()
        
        assert update.source is None
        assert update.destination is None
        assert update.notes is None
        assert update.batch_codes is None
        assert update.status is None
        assert update.issue_date is None
        assert update.items is None
    
    def test_should_update_only_source(self):
        """Should allow updating only source field"""
        update = RequestUpdate(source=5)
        
        assert update.source == 5
        assert update.destination is None
    
    def test_should_update_status(self):
        """Should allow updating status field"""
        update = RequestUpdate(status="Approved")
        
        assert update.status == "Approved"
    
    def test_should_update_batch_codes(self):
        """Should allow updating batch codes list"""
        update = RequestUpdate(batch_codes=["BATCH001", "BATCH002"])
        
        assert update.batch_codes == ["BATCH001", "BATCH002"]
    
    def test_should_update_items(self):
        """Should allow updating items list"""
        items = [RequestItemCreate(part=100, quantity=10)]
        update = RequestUpdate(items=items)
        
        assert len(update.items) == 1
        assert update.items[0].part == 100
    
    def test_should_update_issue_date(self):
        """Should allow updating issue date as string"""
        update = RequestUpdate(issue_date="2024-01-15T10:30:00Z")
        
        assert update.issue_date == "2024-01-15T10:30:00Z"
    
    def test_should_update_multiple_fields(self):
        """Should allow updating multiple fields at once"""
        update = RequestUpdate(
            source=3,
            destination=4,
            status="In Progress",
            notes="Updated notes"
        )
        
        assert update.source == 3
        assert update.destination == 4
        assert update.status == "In Progress"
        assert update.notes == "Updated notes"
