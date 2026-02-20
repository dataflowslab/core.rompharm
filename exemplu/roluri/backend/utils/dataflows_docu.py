"""
DataFlows Docu (OfficeClerk) API Client
"""
import requests
from typing import Optional, Dict, Any, List


from .config import load_config


class DataFlowsDocuClient:
    """Client for DataFlows Docu API"""
    
    def __init__(self):
        config = load_config()
        self.base_url = config['dataflows_docu']['url'].rstrip('/')
        self.token = config['dataflows_docu']['token']
        self.headers = {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        }

    def _with_request_context(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Ensure template context provides a request-like object for Jinja"""
        if not isinstance(data, dict):
            return data
        if 'request' in data:
            return data
        request_stub = {
            'args': {},
            'form': {},
            'path': '',
            'url': '',
            'headers': {},
            'method': ''
        }
        return {**data, 'request': request_stub}
    
    def get_templates(self) -> List[Dict[str, Any]]:
        """
        Get list of all available templates
        
        Returns:
            List of template metadata
        """
        try:
            response = requests.get(
                f"{self.base_url}/templates",
                headers=self.headers,
                timeout=30
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"Failed to get templates: {response.status_code}")
                return []
        except Exception as e:
            print(f"Error getting templates: {e}")
            return []
    
    def get_template(self, template_code: str) -> Optional[Dict[str, Any]]:
        """
        Get template bundle details
        
        Args:
            template_code: Template code (12 characters)
            
        Returns:
            Template bundle data or None
        """
        try:
            response = requests.get(
                f"{self.base_url}/templates/{template_code}",
                headers=self.headers,
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"Failed to get template {template_code}: {response.status_code}")
                return None
        except Exception as e:
            print(f"Error getting template {template_code}: {e}")
            return None
    
    def create_job(
        self,
        template_code: str,
        data: Dict[str, Any],
        format: str = "pdf",
        filename: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Create a document generation job
        
        Args:
            template_code: Template code to use
            data: Data to populate the template
            format: Output format (pdf, html, text)
            filename: Optional filename (without extension)
            
        Returns:
            Job details including job_id or None
        """
        try:
            data = self._with_request_context(data)
            payload = {
                'template_code': template_code,
                'data': data,
                'format': format
            }
            
            if filename:
                payload['filename'] = filename
            
            response = requests.post(
                f"{self.base_url}/jobs",
                headers=self.headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code in [200, 201, 202]:
                return response.json()
            else:
                print(f"Failed to create job: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"Error creating job: {e}")
            return None
    
    def create_realtime_job(
        self,
        template_code: str,
        data: Dict[str, Any],
        format: str = "pdf",
        filename: Optional[str] = None
    ) -> Optional[bytes]:
        """
        Create a document generation job and wait for completion (realtime)
        
        Args:
            template_code: Template code to use
            data: Data to populate the template
            format: Output format (pdf, html, text)
            filename: Optional filename (without extension)
            
        Returns:
            Document bytes or None
        """
        try:
            data = self._with_request_context(data)
            payload = {
                'template_code': template_code,
                'data': data,
                'format': format
            }
            
            if filename:
                payload['filename'] = filename
            
            response = requests.post(
                f"{self.base_url}/jobs/realtime",
                headers=self.headers,
                json=payload,
                timeout=60
            )
            
            if response.status_code == 200:
                return response.content
            else:
                print(f"Failed to create realtime job: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"Error creating realtime job: {e}")
            return None
    
    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get job status
        
        Args:
            job_id: Job ID
            
        Returns:
            Job status data or None
        """
        try:
            response = requests.get(
                f"{self.base_url}/jobs/{job_id}",
                headers=self.headers,
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"Failed to get job status: {response.status_code}")
                return None
        except Exception as e:
            print(f"Error getting job status: {e}")
            return None
    
    def download_document(self, job_id: str) -> Optional[bytes]:
        """
        Download generated document
        
        Args:
            job_id: Job ID
            
        Returns:
            Document bytes or None
        """
        try:
            response = requests.get(
                f"{self.base_url}/download/{job_id}",
                headers=self.headers,
                timeout=30
            )
            
            if response.status_code == 200:
                return response.content
            else:
                print(f"Failed to download document: {response.status_code}")
                return None
        except Exception as e:
            print(f"Error downloading document: {e}")
            return None
    
    def health_check(self) -> bool:
        """
        Check if DataFlows Docu service is available
        
        Returns:
            True if service is healthy, False otherwise
        """
        try:
            response = requests.get(
                f"{self.base_url}/health",
                timeout=5
            )
            return response.status_code == 200
        except Exception as e:
            print(f"Health check failed: {e}")
            return False
