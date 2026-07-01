"""
Backend reverse-proxy for the TanStack Start application.

The Kubernetes ingress redirects every request prefixed with `/api` to this
service on port 8001. The actual TanStack Start application (which owns the
`/api/*` route handlers, e.g. `/api/ai-chat`) runs on the Vite dev server on
port 3000. This file simply proxies `/api/*` traffic back to the Vite server.
"""

import os

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.responses import StreamingResponse

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

app = FastAPI(title="Adala Mulerun KSA - API Proxy")

# Reusable client (streaming-capable).
_client = httpx.AsyncClient(base_url=FRONTEND_URL, timeout=None)


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "service": "adala-mulerun-ksa-proxy"}


@app.api_route(
    "/api/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
)
async def proxy(path: str, request: Request) -> Response:
    """Forward every `/api/*` request to the Vite dev server."""

    # Pass through headers but drop hop-by-hop ones.
    skip_request_headers = {"host", "content-length", "connection"}
    headers = {
        k: v
        for k, v in request.headers.items()
        if k.lower() not in skip_request_headers
    }

    url = f"/api/{path}"
    body = await request.body()

    upstream = await _client.send(
        _client.build_request(
            method=request.method,
            url=url,
            params=dict(request.query_params),
            headers=headers,
            content=body,
        ),
        stream=True,
    )

    skip_response_headers = {
        "content-encoding",
        "transfer-encoding",
        "connection",
        "content-length",
    }
    response_headers = {
        k: v
        for k, v in upstream.headers.items()
        if k.lower() not in skip_response_headers
    }

    # Stream SSE / chunked responses transparently.
    content_type = upstream.headers.get("content-type", "")
    if "text/event-stream" in content_type or "stream" in content_type:

        async def stream_gen():
            try:
                async for chunk in upstream.iter_raw():
                    yield chunk
            finally:
                await upstream.aclose()

        return StreamingResponse(
            stream_gen(),
            status_code=upstream.status_code,
            headers=response_headers,
        )

    # Non-streaming: buffer the full body.
    full_body = await upstream.aread()
    await upstream.aclose()
    return Response(
        content=full_body,
        status_code=upstream.status_code,
        headers=response_headers,
    )
