PORT := 8000

.DEFAULT_GOAL := help

.PHONY: help
help: ## 显示帮助
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

.PHONY: install
install: ## 安装依赖
	uv sync

.PHONY: dev
dev: ## 启动开发服务器
	uv run uvicorn main:app --reload --host 0.0.0.0 --port $(PORT)

.PHONY: lint
lint: ## 代码检查 + 格式化
	uv run ruff check --fix .
	uv run ruff format .

.PHONY: test
test: ## 运行测试
	uv run pytest

.PHONY: migrate
migrate: ## 创建迁移（make migrate m="描述"）
ifndef m
	$(error 请提供描述: make migrate m="add users table")
endif
	uv run alembic revision --autogenerate -m "$(m)"

.PHONY: upgrade
upgrade: ## 执行迁移
	uv run alembic upgrade head

.PHONY: clean
clean: ## 清理缓存
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	rm -rf .pytest_cache .ruff_cache htmlcov .coverage
