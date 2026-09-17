#!/bin/sh
set -eu
# Schema migrations run as an explicit, separate deployment task.
exec uv run --locked --no-dev uvicorn main:app --host 0.0.0.0 --port 8000
