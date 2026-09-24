TOOLS_PYTHON := uv run --no-project --with PyYAML==6.0.3 python

.PHONY: manager-check manager-live install infra migrate dev-frontend dev-backend dev-ai worker up down check docs contracts contracts-check smoke up-web smoke-web architecture
install:
	pnpm --dir frontend install --frozen-lockfile
	cd backend && uv sync --locked
	cd ai-service && uv sync --locked
infra:
	docker compose up -d --wait postgres redis
migrate:
	cd backend && uv run --locked alembic upgrade head
	cd ai-service && uv run --locked python -m ai_service.infrastructure.migrate
dev-frontend:
	pnpm --dir frontend dev
dev-backend:
	cd backend && uv run --locked uvicorn main:app --reload --port 8000
dev-ai:
	cd ai-service && uv run --locked uvicorn ai_service.api.app:create_app --factory --reload --port 8001
worker:
	cd ai-service && uv run --locked python -m ai_service.worker
up:
	docker compose up --build -d --wait --wait-timeout 180
up-web:
	docker compose up --build -d --wait --wait-timeout 180 frontend
down:
	docker compose down
check: docs architecture
	pnpm --dir frontend check
	$(MAKE) -C backend check
	$(MAKE) -C ai-service check
	$(MAKE) contracts-check
docs:
	$(TOOLS_PYTHON) scripts/check_docs.py
	$(TOOLS_PYTHON) scripts/manager/validate_plan.py manager/plan.yaml
	python3 scripts/repairs/validate_repairs.py
	$(TOOLS_PYTHON) -m unittest discover -s scripts/tests -v
contracts:
	python3 scripts/export_contracts.py --service backend
	python3 scripts/export_contracts.py --service ai-service
contracts-check:
	python3 scripts/export_contracts.py --service backend --check
	python3 scripts/export_contracts.py --service ai-service --check
smoke:
	python3 scripts/smoke.py

smoke-web:
	python3 scripts/smoke.py --skip-ai
architecture:
	python3 scripts/check_architecture.py

manager-check:
	$(TOOLS_PYTHON) scripts/check_sources.py
	$(TOOLS_PYTHON) scripts/manager/plan_tool.py --capabilities
	$(TOOLS_PYTHON) scripts/manager/plan_tool.py doctor
	$(TOOLS_PYTHON) -m unittest discover -s .agents/skills/tests -v
manager-live:
	MANAGER_LIVE_OPENSPEC=1 OPENSPEC_TELEMETRY=0 CI=true $(MAKE) manager-check
