"""HTTP command/read API; synchronous DB work runs in FastAPI's thread pool."""
import hmac
from typing import Annotated
from uuid import UUID
import psycopg
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from ai_service.agent_core.contracts import IdempotencyConflict, ResultPending, RunNotFound
from ai_service.api.schemas import CreateRun, EchoInput, EventView, RunView
from ai_service.application.runs import RunService
from ai_service.config import Settings
from ai_service.infrastructure.store import Store

def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or Settings()
    store = Store(config.database_url)
    service = RunService(store, config.scope)
    app = FastAPI(title="AI Runtime", version="0.1.0")
    bearer = HTTPBearer(auto_error=False)

    def authorize(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]) -> None:
        if credentials is None or not hmac.compare_digest(
            credentials.credentials.encode(), config.api_key.get_secret_value().encode()
        ):
            raise HTTPException(401, "Unauthorized", headers={"WWW-Authenticate": "Bearer"})

    for exception, status, detail in (
        (RunNotFound, 404, "Run not found"),
        (IdempotencyConflict, 409, "Idempotency-Key already binds a different request"),
        (ResultPending, 409, "Result is not available"),
        (psycopg.Error, 503, "Storage unavailable"),
    ):
        def handler(request: Request, exc: Exception, code=status, message=detail):
            return JSONResponse(status_code=code, content={"detail": message})
        app.add_exception_handler(exception, handler)

    @app.get("/health", operation_id="aiHealth")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/ready", operation_id="aiReady", responses={503: {"description": "Storage not initialized or unavailable"}})
    def ready() -> dict[str, str]:
        store.ready()
        return {"status": "ready"}

    errors = {401: {"description": "Unauthorized"}, 503: {"description": "Storage unavailable"}}
    dependency = [Depends(authorize)]

    @app.post("/api/v1/runs", response_model=RunView, status_code=202, dependencies=dependency,
              operation_id="createRun", responses={**errors, 409: {"description": "Idempotency conflict"}})
    def create_run(body: CreateRun, idempotency_key: Annotated[str, Header(min_length=1, max_length=128, pattern=r"^[!-~]+$")]):
        return service.create(idempotency_key, body.workflow, body.input.model_dump())

    @app.get("/api/v1/runs/{run_id}", response_model=RunView, dependencies=dependency,
             operation_id="getRun", responses={**errors, 404: {"description": "Run not found"}})
    def get_run(run_id: UUID):
        return service.get(str(run_id))

    @app.get("/api/v1/runs/{run_id}/result", response_model=EchoInput, dependencies=dependency,
             operation_id="getRunResult", responses={**errors, 404: {"description": "Run not found"}, 409: {"description": "Result unavailable"}})
    def result(run_id: UUID):
        return service.result(str(run_id))

    @app.get("/api/v1/runs/{run_id}/events", response_model=list[EventView], dependencies=dependency,
             operation_id="getRunEvents", responses={**errors, 404: {"description": "Run not found"}})
    def events(run_id: UUID, after: Annotated[int, Query(ge=0)] = 0):
        return service.events(str(run_id), after)

    return app
