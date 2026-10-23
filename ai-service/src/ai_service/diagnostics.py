"""Exercise the installed package offline; this is not a PostgreSQL readiness probe."""

from functools import partial
from importlib.metadata import version
from importlib.resources import files

from langgraph.checkpoint.memory import InMemorySaver

from ai_service.agent_core.model import ExecutionFailure
from ai_service.agent_core.runtime import UnsupportedWorkflow
from ai_service.api.app import create_app
from ai_service.bootstrap import create_runner
from ai_service.config import Settings
from ai_service.infrastructure.execution import resources
from ai_service.workflows.echo import execute_echo


def check_offline() -> dict[str, object]:
    """Verify API schema, graph recovery and installed resources without external connections."""

    def disabled(_run_id, _payload):
        raise ExecutionFailure("model_not_configured")

    runner = create_runner(
        partial(execute_echo, checkpointer=InMemorySaver()), disabled
    )
    expected = {"text": "runtime-self-check"}
    for _ in range(2):
        if runner.run("echo.v1", "offline-self-check", expected) != expected:
            raise RuntimeError("Workflow output or Checkpoint reuse failed")
    try:
        runner.run("unregistered.v1", "offline-reject", expected)
    except UnsupportedWorkflow:
        pass
    else:
        raise RuntimeError("Unregistered workflow was accepted")

    settings = Settings(
        _env_file=None,
        database_url="postgresql://offline:offline@127.0.0.1:1/offline_test",
        api_key="offline-self-check-not-a-real-secret",
        scope="offline",
        poll_interval=0.5,
        model_enabled=False,
        model_name=None,
        model_api_key=None,
    )
    schema = create_app(settings).openapi()
    workflow = schema["components"]["schemas"]["CreateRun"]["properties"]["workflow"]
    public_ids = workflow.get("enum", [workflow.get("const")])
    if set(public_ids) != set(runner.workflow_ids):
        raise RuntimeError("Public workflow schema and registration disagree")
    migrations = files("ai_service.infrastructure").joinpath("migrations")
    sql_files = sorted(p.name for p in migrations.iterdir() if p.name.endswith(".sql"))
    if not sql_files or not all(
        migrations.joinpath(p).read_text().strip() for p in sql_files
    ):
        raise RuntimeError("Installed package is missing application migrations")
    prompt, output_schema = resources()
    if not prompt.strip() or output_schema.get("additionalProperties") is not False:
        raise RuntimeError("Installed package is missing model resources")
    return {
        "status": "ok",
        "mode": "offline",
        "version": version("fullstack-ai-service"),
        "workflows": list(runner.workflow_ids),
        "checks": [
            "openapi",
            "workflow",
            "checkpoint_reuse",
            "allowlist",
            "sql_resources",
            "model_resources",
        ],
        "postgresql": "not_checked",
        "external_calls": "not_enabled",
    }
