from fastapi.routing import APIRouter

from routes import router as router_module


def test_every_work_package_has_a_router() -> None:
    routers = [
        value
        for name, value in vars(router_module).items()
        if name.endswith("_router") and name not in {"api_router", "health_router"}
    ]

    assert {router.prefix for router in routers if isinstance(router, APIRouter)} == {
        "/auth",
        "/users",
        "/aircraft",
        "/flights",
        "/rules",
        "/alerts",
        "/dashboard",
        "/collection",
        "/replay",
    }
