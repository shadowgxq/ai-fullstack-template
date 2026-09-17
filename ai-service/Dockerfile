FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.8.22 /uv /uvx /bin/
WORKDIR /app
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --locked --no-dev --no-install-project
COPY src ./src
RUN uv sync --locked --no-dev && useradd --create-home app && chown -R app:app /app
USER app
EXPOSE 8001
CMD ["uv", "run", "--locked", "--no-dev", "uvicorn", "ai_service.api.app:create_app", "--factory", "--host", "0.0.0.0", "--port", "8001"]
