# app/core/exception_handlers.py

import logging

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.exceptions import BusinessException


error_logger = logging.getLogger("app.error")


def get_request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


async def business_exception_handler(
    request: Request,
    exc: BusinessException,
) -> JSONResponse:
    request_id = get_request_id(request)

    error_logger.warning(
        "business_exception request_id=%s method=%s path=%s code=%s message=%s",
        request_id,
        request.method,
        request.url.path,
        exc.code,
        exc.message,
    )

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": exc.code,
            "message": exc.message,
            "data": None,
        },
    )


async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    request_id = get_request_id(request)

    error_logger.warning(
        "validation_error request_id=%s method=%s path=%s errors=%s",
        request_id,
        request.method,
        request.url.path,
        exc.errors(),
    )

    return JSONResponse(
        status_code=422,
        content={
            "code": 42200,
            "message": "Validation error",
            "data": exc.errors(),
        },
    )


async def http_exception_handler(
    request: Request,
    exc: StarletteHTTPException,
) -> JSONResponse:
    request_id = get_request_id(request)

    error_logger.warning(
        "http_exception request_id=%s method=%s path=%s status_code=%s detail=%s",
        request_id,
        request.method,
        request.url.path,
        exc.status_code,
        exc.detail,
    )

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": exc.status_code * 100,
            "message": exc.detail,
            "data": None,
        },
    )


async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    request_id = get_request_id(request)

    error_logger.error(
        "unhandled_exception request_id=%s method=%s path=%s error=%s",
        request_id,
        request.method,
        request.url.path,
        str(exc),
        exc_info=True,
    )

    return JSONResponse(
        status_code=500,
        content={
            "code": 50000,
            "message": "Internal server error",
            "data": None,
        },
    )
