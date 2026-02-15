"""Data Routes - Main router for form submissions and data management"""
from fastapi import APIRouter

# Import sub-routers
from .data_submissions import router as submissions_router
from .data_files import router as files_router

# Main router
router = APIRouter(prefix="/api/data", tags=["data"])

# Include sub-routers
router.include_router(submissions_router, tags=["submissions"])
router.include_router(files_router, tags=["files"])
