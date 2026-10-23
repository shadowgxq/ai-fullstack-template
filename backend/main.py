from app.api.v1.health import router as health_router
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.auth import router as auth_router
from app.api.v1.profile import router as profile_router
from app.api.v1.garments import router as garments_router
from app.api.v1.media import router as media_router
from app.api.v1.wear_records import router as wear_router
from app.api.v1.statistics import router as statistics_router
from app.api.v1.preferences import router as preferences_router
from app.api.v1.cities import router as cities_router
from app.api.v1.weather import router as weather_router
from app.api.v1.recommendations import router as recommendations_router
from app.core.exception_handlers import (
    business_exception_handler,
    http_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.core.exceptions import BusinessException

from app.core.logging import setup_logging
from app.core.middlewares import request_log_middleware

setup_logging()
app = FastAPI(title="Backend Agent Template API")

app.middleware("http")(request_log_middleware)

# 注册统一异常处理器
app.add_exception_handler(BusinessException, business_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(profile_router, prefix="/api/v1")
app.include_router(garments_router, prefix="/api/v1")
app.include_router(media_router, prefix="/api/v1")
app.include_router(wear_router, prefix="/api/v1")
app.include_router(statistics_router, prefix="/api/v1")
app.include_router(preferences_router, prefix="/api/v1")
app.include_router(cities_router, prefix="/api/v1")
app.include_router(weather_router, prefix="/api/v1")
app.include_router(recommendations_router, prefix="/api/v1")


@app.get("/health")
def health_check():
    return {"status": "ok"}


app.include_router(health_router)
