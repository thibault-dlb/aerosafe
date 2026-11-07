from fastapi import APIRouter

from routes.health import router as health_router
from routes.v1.aircraft import router as aircraft_router
from routes.v1.alerts import router as alerts_router
from routes.v1.auth import router as auth_router
from routes.v1.collection import router as collection_router
from routes.v1.dashboard import router as dashboard_router
from routes.v1.flights import router as flights_router
from routes.v1.rules import router as rules_router
from routes.v1.users import router as users_router

# Versioned API router. Every work package already has its router here:
# add endpoints to the file in `routes/v1/`, not to this file.
api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(aircraft_router)
api_router.include_router(flights_router)
api_router.include_router(rules_router)
api_router.include_router(alerts_router)
api_router.include_router(dashboard_router)
api_router.include_router(collection_router)

__all__ = ["api_router", "health_router"]
