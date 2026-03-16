"""
Main FastAPI application
"""
import sys
import io

# Fix UTF-8 encoding for Windows console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
import os
import re
from typing import Optional

from src.backend.routes import auth
from src.backend.routes import forms
from src.backend.routes import data
from src.backend.routes import config
from src.backend.routes import documents
from src.backend.routes import users
from src.backend.routes import users_local
from src.backend.routes import roles
from src.backend.routes import audit
from src.backend.routes import system
from src.backend.routes import external
from src.backend.routes import approvals
from src.backend.routes import recipes
from src.backend.routes import sales
from src.backend.routes import returns
from src.backend.utils.db import close_db
from src.backend.utils.audit import log_action
from src.backend.routes.auth import verify_token
from src.backend.scheduler import get_scheduler

# Import modules from root
import sys
# Ensure root is in path to import 'modules'
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from modules import register_modules

# Create FastAPI app
app = FastAPI(
    title="DataFlows Core API",
    description="API for managing dynamic forms and submissions",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Audit logging middleware for all mutating requests
AUDIT_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
AUDIT_SKIP_PREFIXES = (
    "/api/audit",
    "/api/auth/login",
    "/health",
    "/web",
    "/media"
)

def _extract_resource_type(path: str) -> Optional[str]:
    segments = [seg for seg in path.strip("/").split("/") if seg]
    if not segments:
        return None
    if segments[0] == "modules" and len(segments) > 1:
        return segments[1]
    if segments[0] == "api" and len(segments) > 1:
        return segments[1]
    return segments[0]

def _extract_resource_id(path: str) -> Optional[str]:
    match = re.search(r"[0-9a-fA-F]{24}", path)
    return match.group(0) if match else None

def _map_action(method: str, path: str) -> str:
    lowered = path.lower()
    if "approve" in lowered or "/sign" in lowered or "approval" in lowered:
        return "approve"
    if method == "POST":
        return "create"
    if method in {"PUT", "PATCH"}:
        return "update"
    if method == "DELETE":
        return "delete"
    return "action"

@app.middleware("http")
async def audit_log_middleware(request: Request, call_next):
    response = await call_next(request)

    if request.method in AUDIT_METHODS and response.status_code < 400:
        path = request.url.path
        if path.startswith(AUDIT_SKIP_PREFIXES):
            return response
        if not (path.startswith("/api") or path.startswith("/modules")):
            return response

        username = None
        auth_header = request.headers.get("authorization")
        if auth_header:
            try:
                user = verify_token(auth_header)
                username = user.get("username")
            except Exception:
                username = None

        log_action(
            action=_map_action(request.method, path),
            username=username,
            request=request,
            resource_type=_extract_resource_type(path),
            resource_id=_extract_resource_id(path),
            details={
                "method": request.method,
                "path": path,
                "status_code": response.status_code
            }
        )

    return response

# Include core routers
app.include_router(auth.router)
app.include_router(forms.router)
app.include_router(data.router)
app.include_router(config.router)
app.include_router(documents.router)
app.include_router(users.router)
app.include_router(users_local.router)
app.include_router(roles.router)
app.include_router(audit.router)
app.include_router(system.router)
app.include_router(external.router)
app.include_router(approvals.router)
app.include_router(recipes.router)
app.include_router(sales.router)
app.include_router(returns.router)

# Register modules dynamically
print("\n=== Loading Modules ===")
# Pass the absolute path to app if needed, or valid object
# register_modules expects app instance
register_modules(app)
print("=== Modules Loaded ===\n")

# Mount media directory
media_path = os.path.join(os.path.dirname(__file__), '..', '..', 'media')
if os.path.exists(media_path):
    app.mount("/media", StaticFiles(directory=media_path), name="media")


@app.get("/")
def root():
    """
    Root endpoint - redirect to /web
    """
    return RedirectResponse(url="/web/")


# Serve frontend for all /web/* routes (SPA support)
from fastapi.responses import FileResponse

frontend_dist = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist')

@app.get("/web/{full_path:path}")
def serve_frontend(full_path: str):
    """
    Serve frontend static files with SPA fallback to index.html
    """
    file_path = os.path.join(frontend_dist, full_path)
    
    # If file exists, serve it
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    
    # Otherwise, serve index.html (SPA fallback)
    index_path = os.path.join(frontend_dist, 'index.html')
    if os.path.exists(index_path):
        return FileResponse(index_path)
    
    # If index.html doesn't exist, return 404
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Frontend not built")


@app.get("/health")
def health_check():
    """
    Health check endpoint
    """
    return {"status": "healthy", "version": "1.0.0"}


@app.on_event("startup")
def startup_event():
    """
    Initialize services on startup
    """
    # Start job scheduler
    try:
        scheduler = get_scheduler()
        scheduler.start()
        print("Job scheduler started")
    except Exception as e:
        print(f"Warning: Failed to start scheduler: {e}")


@app.on_event("shutdown")
def shutdown_event():
    """
    Cleanup on shutdown
    """
    # Stop scheduler
    try:
        scheduler = get_scheduler()
        scheduler.shutdown()
    except:
        pass
    
    close_db()


if __name__ == "__main__":
    import uvicorn
    import yaml
    
    # Load config
    config_path = os.path.join(os.path.dirname(__file__), '..', '..', 'config.yaml')
    try:
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
        
        host = config.get('web', {}).get('host', '0.0.0.0')
        port = config.get('web', {}).get('port', 8000)
        
        print(f"Starting server on {host}:{port}")
        uvicorn.run(app, host=host, port=port)
    except FileNotFoundError:
        print("Warning: config.yaml not found, using default settings")
        uvicorn.run(app, host="0.0.0.0", port=8000)
