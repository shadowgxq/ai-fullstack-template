.PHONY: install dev worker migrate test check format
install:
	uv sync --locked
dev:
	uv run --locked uvicorn ai_service.api.app:create_app --factory --reload --host 127.0.0.1 --port 8001
worker:
	uv run --locked python -m ai_service.worker
migrate:
	uv run --locked python -m ai_service.infrastructure.migrate
test:
	uv run --locked pytest
check:
	uv run --locked ruff check .
	uv run --locked ruff format --check .
	uv run --locked pytest
format:
	uv run --locked ruff check --fix .
	uv run --locked ruff format .
