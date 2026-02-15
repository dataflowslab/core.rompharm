"""
Main FastAPI application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
import os

from .routes import auth
from .routes import data
from .routes import config as config_routes
from .routes import documents
from .routes import users
from .routes import roles
from .routes import audit
from .routes import system
from .routes import external
from .routes import library
from .routes import notifications
from .routes import buget
from .routes import angajamente_bugetare
from .routes import angajamente_legale
from .routes import rapoarte
from .utils.db import close_db
from .utils.config import load_config
from .scheduler import get_scheduler
from .modules import register_modules

# Create FastAPI app
app = FastAPI(
    title="DataFlows Core API",
    description="API for procurement and document management with role-based permissions",
    version="1.0.0"
)

# CORS middleware
app_config = load_config()
cors_origins = app_config.get('web', {}).get('cors_origins', ['*'])

if isinstance(cors_origins, str):
    cors_origins = [origin.strip() for origin in cors_origins.split(',') if origin.strip()]

if not cors_origins:
    cors_origins = ['*']

allow_credentials = False if '*' in cors_origins else True

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(data.router)
app.include_router(config_routes.router)
app.include_router(documents.router)
app.include_router(users.router)
app.include_router(roles.router)
app.include_router(audit.router)
app.include_router(system.router)
app.include_router(external.router)
app.include_router(library.router)
app.include_router(notifications.router)
app.include_router(buget.router)
app.include_router(angajamente_bugetare.router)
app.include_router(angajamente_legale.router)
app.include_router(rapoarte.router)

# Register dynamic modules
register_modules(app)

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
    from datetime import datetime
    
    # Print startup timestamp
    startup_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"\n{'='*60}")
    print(f">> DataFlows Core API - Starting up")
    print(f">> Timestamp: {startup_time}")
    print(f"{'='*60}\n")
    
    # Start job scheduler
    try:
        scheduler = get_scheduler()
        scheduler.start()
        print(f"[OK] Job scheduler started at {datetime.now().strftime('%H:%M:%S')}")
    except Exception as e:
        print(f"[WARNING] Failed to start scheduler: {e}")
    
    print(f"\n{'='*60}")
    print(f"[OK] Application startup complete at {datetime.now().strftime('%H:%M:%S')}")
    print(f"{'='*60}\n")


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
    config_path = os.path.join(os.path.dirname(__file__), '..', '..', 'config', 'config.yaml')
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
