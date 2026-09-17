"""就绪探针：检查业务表和 Redis，不改变存活接口。"""
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from redis.exceptions import RedisError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from app.core.session import engine
from app.core.redis_client import redis_client

router = APIRouter()

@router.get("/ready", responses={503: {"description": "Dependency unavailable"}})
def readiness():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1 FROM users LIMIT 1"))
        redis_client.ping()
    except (SQLAlchemyError, RedisError):
        return JSONResponse(status_code=503, content={"status": "not_ready"})
    return {"status": "ready"}
