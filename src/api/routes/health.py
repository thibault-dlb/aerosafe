from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    """Liveness probe, used by the container health check. No authentication."""
    return {"status": "ok"}
