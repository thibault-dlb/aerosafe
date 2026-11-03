import httpx


async def test_health_returns_ok(client: httpx.AsyncClient) -> None:
    response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_request_gets_an_id_header(client: httpx.AsyncClient) -> None:
    response = await client.get("/health")

    assert response.headers["X-Request-ID"]
