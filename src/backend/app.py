"""
Main FastAPI application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
import os

from .routes import auth
from .routes import forms
from .routes import data
from .routes import config
from .routes import documents
from .routes import users
from .routes import audit
from .routes import system
from .routes import external
from .routes import approvals
from .routes import procurement
from .utils.db import close_db
from .scheduler import get_scheduler
from .modules import register_modules

# Create FastAPI app
app = FastAPI(
    title="DataFlows Core API",
    description="API for managing dynamic forms and submissions with InvenTree authentication",
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

# Include core routers
app.include_router(auth.router)
app.include_router(forms.router)
app.include_router(data.router)
app.include_router(config.router)
app.include_router(documents.router)
app.include_router(users.router)
app.include_router(audit.router)
app.include_router(system.router)
app.include_router(external.router)
app.include_router(approvals.router)
app.include_router(procurement.router)

# Register modules dynamically
print("\n=== Loading Modules ===")
register_modules(app)
print("=== Modules Loaded ===\n")

# Mount media directory
media_path = os.path.join(os.path.dirname(__file__), '..', '..', 'media')
if os.path.exists(media_path):
    app.mount("/media", StaticFiles(directory=media_path), name="media")


@app.get("/")
async def root():
    """
    Root endpoint - redirect to /web
    """
    return RedirectResponse(url="/web/")


# Serve frontend for all /web/* routes (SPA support)
from fastapi.responses import FileResponse

frontend_dist = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist')

@app.get("/web/{full_path:path}")
async def serve_frontend(full_path: str):
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
async def health_check():
    """
    Health check endpoint
    """
    return {"status": "healthy", "version": "1.0.0"}


@app.on_event("startup")
async def startup_event():
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
async def shutdown_event():
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
