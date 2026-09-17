.PHONY: install dev migrate upgrade test check lint format
install:
	uv sync --locked
dev:
	uv run --locked uvicorn main:app --reload --host 127.0.0.1 --port 8000
migrate:
ifndef m
	$(error Provide a migration description: make migrate m="add resource")
endif
	uv run --locked alembic revision --autogenerate -m "$(m)"
upgrade:
	uv run --locked alembic upgrade head
test:
	uv run --locked pytest
check:
	uv run --locked ruff check .
	uv run --locked ruff format --check .
	uv run --locked pytest
lint:
	uv run --locked ruff check .
format:
	uv run --locked ruff check --fix .
	uv run --locked ruff format .
