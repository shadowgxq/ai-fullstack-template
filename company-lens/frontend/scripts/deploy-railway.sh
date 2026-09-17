#!/usr/bin/env bash
# Deploy the current linked Railway service. Docker builds and starts remotely.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v railway >/dev/null 2>&1; then
  echo "Railway CLI was not found. Install it with: npm install -g @railway/cli" >&2
  exit 1
fi

cd "${PROJECT_ROOT}"

deploy_args=(up --ci)

if [[ -n "${RAILWAY_SERVICE:-}" ]]; then
  deploy_args+=(--service "${RAILWAY_SERVICE}")
fi

if [[ -n "${RAILWAY_ENVIRONMENT:-}" ]]; then
  deploy_args+=(--environment "${RAILWAY_ENVIRONMENT}")
fi

exec railway "${deploy_args[@]}" "$@"
