"""
Global Workflow Level System

This module provides a reusable workflow management system based on incremental levels.
Each workflow stage is assigned a numeric level with gaps (0, 50, 100, 150...) to allow
future insertions without breaking existing logic.

Usage:
    from src.backend.utils.workflow import WorkflowManager
    
    # Define workflow for a specific module
    wf = WorkflowManager({
        'DRAFT': 0,
        'PENDING': 50,
        'APPROVED': 100,
        'COMPLETED': 200
    })
    
    # Get current level
    level = wf.get_level('Pending')  # Returns 50
    
    # Navigate workflow
    next_level = wf.get_next_level(50)  # Returns 100
    prev_level = wf.get_previous_level(100)  # Returns 50
    
    # Check permissions
    can_edit = wf.is_at_or_before(current_level, 'APPROVED')
"""

from typing import Dict, List, Optional, Tuple


class WorkflowManager:
    """
    Manages workflow levels and transitions for any module
    
    Attributes:
        levels: Dictionary mapping status names to numeric levels
        stepper: Ordered list of levels for navigation
        level_to_name: Reverse mapping from level to status name
        status_names: Display names for each level
    """
    
    def __init__(self, levels: Dict[str, int], status_names: Optional[Dict[int, str]] = None):
        """
        Initialize workflow manager
        
        Args:
            levels: Dictionary of status_name -> level (e.g., {'PENDING': 50, 'APPROVED': 100})
            status_names: Optional display names for levels (defaults to keys from levels)
        """
        self.levels = levels
        
        # Create ordered stepper (only positive levels)
        self.stepper = sorted([v for v in levels.values() if v >= 0])
        
        # Reverse mapping
        self.level_to_name = {v: k for k, v in levels.items() if v >= 0}
        
        # Status names for display
        if status_names:
            self.status_names = status_names
        else:
            # Convert UPPER_CASE to Title Case
            self.status_names = {
                v: k.replace('_', ' ').title() 
                for k, v in levels.items()
            }
    
    def get_level(self, status: str) -> int:
        """
        Get workflow level from status string
        
        Args:
            status: Status string (e.g., 'Pending', 'Approved')
        
        Returns:
            Workflow level integer, or first level if not found
        """
        status_upper = status.upper().replace(' ', '_')
        return self.levels.get(status_upper, self.stepper[0] if self.stepper else 0)
    
    def get_status_name(self, level: int) -> str:
        """
        Get status name from workflow level
        
        Args:
            level: Workflow level integer
        
        Returns:
            Status name string
        """
        return self.status_names.get(level, 'Unknown')
    
    def get_next_level(self, current_level: int) -> int:
        """
        Get next workflow level
        
        Args:
            current_level: Current workflow level
        
        Returns:
            Next workflow level, or current if at end
        """
        try:
            current_index = self.stepper.index(current_level)
            if current_index < len(self.stepper) - 1:
                return self.stepper[current_index + 1]
        except ValueError:
            pass
        return current_level
    
    def get_previous_level(self, current_level: int) -> int:
        """
        Get previous workflow level (for signature removal/rollback)
        
        Args:
            current_level: Current workflow level
        
        Returns:
            Previous workflow level, or current if at start
        """
        try:
            current_index = self.stepper.index(current_level)
            if current_index > 0:
                return self.stepper[current_index - 1]
        except ValueError:
            pass
        return current_level
    
    def is_at_or_before(self, current_level: int, target_status: str) -> bool:
        """
        Check if current level is at or before target status
        
        Args:
            current_level: Current workflow level
            target_status: Target status name
        
        Returns:
            True if current <= target
        """
        target_level = self.get_level(target_status)
        return current_level <= target_level
    
    def is_at_or_after(self, current_level: int, target_status: str) -> bool:
        """
        Check if current level is at or after target status
        
        Args:
            current_level: Current workflow level
            target_status: Target status name
        
        Returns:
            True if current >= target
        """
        target_level = self.get_level(target_status)
        return current_level >= target_level
    
    def is_between(self, current_level: int, start_status: str, end_status: str) -> bool:
        """
        Check if current level is between two statuses (inclusive)
        
        Args:
            current_level: Current workflow level
            start_status: Start status name
            end_status: End status name
        
        Returns:
            True if start <= current <= end
        """
        start_level = self.get_level(start_status)
        end_level = self.get_level(end_status)
        return start_level <= current_level <= end_level
    
    def get_all_levels(self) -> List[Tuple[int, str]]:
        """
        Get all workflow levels with their names
        
        Returns:
            List of (level, name) tuples, sorted by level
        """
        return [(level, self.get_status_name(level)) for level in self.stepper]


# Pre-configured workflow for Requests module
REQUESTS_WORKFLOW = WorkflowManager(
    levels={
        'DRAFT': 0,
        'PENDING': 50,
        'APPROVED': 100,
        'IN_OPERATIONS': 150,
        'OPERATIONS_SIGNED': 200,
        'FINISHED': 250,
        'IN_RECEPTION': 300,
        'RECEPTION_SIGNED': 350,
        'COMPLETED': 400,
        'REFUSED': -1,
        'CANCELED': -2
    },
    status_names={
        0: 'Draft',
        50: 'Pending',
        100: 'Approved',
        150: 'In Operations',
        200: 'Operations Signed',
        250: 'Finished',
        300: 'In Reception',
        350: 'Reception Signed',
        400: 'Completed',
        -1: 'Refused',
        -2: 'Canceled'
    }
)


# Helper functions for Requests module
def get_requests_tab_visibility(workflow_level: int) -> dict:
    """
    Get tab visibility for Requests module based on workflow level
    
    Args:
        workflow_level: Current workflow level
    
    Returns:
        Dictionary with tab visibility flags
    """
    return {
        'details': True,
        'approval': workflow_level >= REQUESTS_WORKFLOW.get_level('PENDING'),
        'items': True,
        'operations': workflow_level >= REQUESTS_WORKFLOW.get_level('APPROVED'),
        'reception': workflow_level >= REQUESTS_WORKFLOW.get_level('FINISHED')
    }


def get_requests_edit_permissions(workflow_level: int) -> dict:
    """
    Get edit permissions for Requests module based on workflow level
    
    Args:
        workflow_level: Current workflow level
    
    Returns:
        Dictionary with edit permission flags
    """
    return {
        'items': workflow_level < REQUESTS_WORKFLOW.get_level('APPROVED'),
        'operations': REQUESTS_WORKFLOW.is_between(
            workflow_level, 
            'APPROVED', 
            'OPERATIONS_SIGNED'
        ),
        'reception': REQUESTS_WORKFLOW.is_between(
            workflow_level,
            'FINISHED',
            'RECEPTION_SIGNED'
        )
    }
