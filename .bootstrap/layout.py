"""One-time, branch-only migration. Removed before PR delivery."""
from pathlib import Path
import json
import shutil

ROOT = Path(__file__).resolve().parents[1]

def put(path, text):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")

def relocate(source, destination):
    source, destination = ROOT / source, ROOT / destination
    if not source.exists():
        return
    if source.is_file():
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists():
            shutil.copy2(source, destination)
        source.unlink()
        return
    for old in source.rglob("*"):
        if old.is_file():
            new = destination / old.relative_to(source)
            new.parent.mkdir(parents=True, exist_ok=True)
            if not new.exists():
                shutil.copy2(old, new)
    shutil.rmtree(source)

for source, destination in (
    ("frontend/docs/frontend", "docs/engineering/frontend"),
    ("backend/docs", "docs/engineering/backend"),
    ("ai-service/docs/architecture", "docs/architecture/ai-service"),
    ("frontend/docs/prd/features", "examples/personal-bookkeeping"),
    ("frontend/manager/plan.yaml", "examples/personal-bookkeeping/plan.yaml"),
    ("frontend/scripts", "scripts"),
    ("frontend/repairs", "repairs"),
    ("frontend/.agents", ".agents"),
):
    relocate(source, destination)
for old in ("frontend/docs", "frontend/manager", "frontend/openspec", "ai-service/docs"):
    if (ROOT / old).exists():
        shutil.rmtree(ROOT / old)
(ROOT / "backend/docker-compose.yml").unlink(missing_ok=True)

for folder in ("docs/engineering", "repairs", ".agents"):
    for path in (ROOT / folder).rglob("*.md"):
        text = path.read_text()
        for old, new in (
            ("docs/frontend/", "docs/engineering/frontend/"),
            ("docs/prd/", "docs/product/"),
            ("docs/api/", "docs/contracts/"),
            ("docs/ai/openspec-manager-flow.md", "docs/engineering/workflow/delivery.md"),
            ("docs/ai/ai-frontend-delivery-best-practice.md", "docs/engineering/workflow/delivery.md"),
        ):
            text = text.replace(old, new)
        path.write_text(text)
for path in (ROOT / "docs/architecture/ai-service").rglob("*.md"):
    text = path.read_text().replace("ai-server/", "ai-service/").replace("src/ai_server/", "src/ai_service/").replace("`ai-server`", "`ai-service`")
    if path.name == "agent-runtime-architecture.md":
        text = "> 本文是目标架构，不是完成清单；当前实现见 [落地边界](../README.md)。\n\n" + text
    path.write_text(text)

for name in ("frontend", "backend", "ai-service"):
    put(f"{name}/AGENTS.md", f"# {name} 协作入口\n\n先读 [根规则](../AGENTS.md)，此处只补充导航。\n\n- 实现前按 [专项规范](../docs/engineering/{name}/README.md) 选择必要文档。\n- 跨端变更先读 [契约](../docs/contracts/README.md) 与 [当前计划](../manager/plan.yaml)。\n- 安装、启动和检查命令只维护在 [README.md](README.md)。\n- 不新建端内 PRD、接口副本或独立任务台账。\n")
    put(f"{name}/CLAUDE.md", "# Claude 入口\n\n遵循 [AGENTS.md](AGENTS.md)，不维护第二份规则。\n")

path = ROOT / "frontend/package.json"
package = json.loads(path.read_text())
package["name"] = "fullstack-frontend"
package["scripts"].update({
    "manager:validate": "python3 ../scripts/manager/validate_plan.py ../manager/plan.yaml",
    "repairs:validate": "cd .. && python3 scripts/repairs/validate_repairs.py",
    "repairs:status": "cd .. && python3 scripts/repairs/validate_repairs.py --status-only",
    "format": "prettier \"src/**/*.{ts,tsx,css,json}\" \"*.{js,ts,json,html}\" --write",
    "format:check": "prettier \"src/**/*.{ts,tsx,css,json}\" \"*.{js,ts,json,html}\" --check",
})
path.write_text(json.dumps(package, indent=2) + "\n")
path = ROOT / "frontend/.env.example"
path.write_text(path.read_text().replace("http://localhost:3000", "http://localhost:8000"))
path = ROOT / "backend/main.py"
text = path.read_text()
if "health_router" not in text:
    text = "from app.api.v1.health import router as health_router\n" + text + "\napp.include_router(health_router)\n"
path.write_text(text)
path = ROOT / ".codex/config.toml"
if path.exists():
    text = path.read_text().replace('"docs/prd"', '"docs/product"').replace('"docs/technical"', '"docs/architecture"').replace('"docs/design/baselines"', '"docs/contracts"')
    path.write_text(text)
path = ROOT / "scripts/ralph/AGENT.md"
if path.exists():
    path.write_text(path.read_text().replace("this frontend repository", "this fullstack monorepo"))
print("Canonical layout and scoped navigation prepared")
