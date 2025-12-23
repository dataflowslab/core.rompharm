"""
Unit tests for requests module utilities
"""
import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException

from modules.requests.utils import get_inventree_headers, generate_request_reference


class TestGetInventreeHeaders:
    """Tests for get_inventree_headers function"""
    
    def test_should_return_headers_with_valid_token(self):
        """Should return proper headers when user has valid token"""
        user = {"token": "test_token_123"}
        
        headers = get_inventree_headers(user)
        
        assert headers["Authorization"] == "Token test_token_123"
        assert headers["Content-Type"] == "application/json"
    
    def test_should_raise_401_when_token_missing(self):
        """Should raise HTTPException 401 when token is missing"""
        user = {}
        
        with pytest.raises(HTTPException) as exc_info:
            get_inventree_headers(user)
        
        assert exc_info.value.status_code == 401
        assert "Not authenticated with InvenTree" in str(exc_info.value.detail)
    
    def test_should_raise_401_when_token_is_none(self):
        """Should raise HTTPException 401 when token is None"""
        user = {"token": None}
        
        with pytest.raises(HTTPException) as exc_info:
            get_inventree_headers(user)
        
        assert exc_info.value.status_code == 401
    
    def test_should_handle_empty_string_token(self):
        """Should raise HTTPException 401 when token is empty string"""
        user = {"token": ""}
        
        with pytest.raises(HTTPException) as exc_info:
            get_inventree_headers(user)
        
        assert exc_info.value.status_code == 401


class TestGenerateRequestReference:
    """Tests for generate_request_reference function"""
    
    def test_should_generate_req_0001_when_no_requests_exist(self, mock_db):
        """Should generate REQ-0001 when no previous requests exist"""
        mock_db.__getitem__.return_value.find_one.return_value = None
        
        reference = generate_request_reference(mock_db)
        
        assert reference == "REQ-0001"
    
    def test_should_increment_from_last_request(self, mock_db):
        """Should increment reference number from last request"""
        mock_db.__getitem__.return_value.find_one.return_value = {
            "reference": "REQ-0005"
        }
        
        reference = generate_request_reference(mock_db)
        
        assert reference == "REQ-0006"
    
    def test_should_handle_large_numbers(self, mock_db):
        """Should handle large reference numbers correctly"""
        mock_db.__getitem__.return_value.find_one.return_value = {
            "reference": "REQ-9999"
        }
        
        reference = generate_request_reference(mock_db)
        
        assert reference == "REQ-10000"
    
    def test_should_handle_invalid_reference_format(self, mock_db):
        """Should default to REQ-0001 when last reference has invalid format"""
        mock_db.__getitem__.return_value.find_one.return_value = {
            "reference": "INVALID"
        }
        
        reference = generate_request_reference(mock_db)
        
        assert reference == "REQ-0001"
    
    def test_should_pad_numbers_with_zeros(self, mock_db):
        """Should pad reference numbers with leading zeros"""
        mock_db.__getitem__.return_value.find_one.return_value = {
            "reference": "REQ-0042"
        }
        
        reference = generate_request_reference(mock_db)
        
        assert reference == "REQ-0043"
        assert len(reference) == 8  # REQ- + 4 digits
    
    def test_should_query_with_correct_regex(self, mock_db):
        """Should query database with correct regex pattern"""
        mock_collection = MagicMock()
        mock_db.__getitem__.return_value = mock_collection
        mock_collection.find_one.return_value = None
        
        generate_request_reference(mock_db)
        
        # Verify the query was called with correct parameters
        call_args = mock_collection.find_one.call_args
        assert call_args[0][0] == {'reference': {'$regex': '^REQ-'}}
        assert call_args[1]['sort'] == [('reference', -1)]
