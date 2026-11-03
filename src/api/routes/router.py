from fastapi import APIRouter

from routes.health import router as health_router

# Versioned API router. Feature routers are included here.
api_router = APIRouter(prefix="/api/v1")

__all__ = ["api_router", "health_router"]
