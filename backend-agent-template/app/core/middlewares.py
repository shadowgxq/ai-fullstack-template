# app/core/middlewares.py

import logging
import time
import uuid
from collections.abc import Awaitable, Callable

from fastapi import Request
from starlette.responses import Response


request_logger = logging.getLogger("app.request")


async def request_log_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    """记录每个 HTTP 请求的基础信息。"""

    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request.state.request_id = request_id

    start_time = time.perf_counter()

    try:
        response = await call_next(request)

    except Exception:
        duration_ms = (time.perf_counter() - start_time) * 1000

        request_logger.exception(
            "request_id=%s method=%s path=%s status_code=500 duration_ms=%.2f",
            request_id,
            request.method,
            request.url.path,
            duration_ms,
        )

        raise

    duration_ms = (time.perf_counter() - start_time) * 1000

    response.headers["X-Request-ID"] = request_id

    request_logger.info(
        "request_id=%s method=%s path=%s status_code=%s duration_ms=%.2f",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )

    return response
