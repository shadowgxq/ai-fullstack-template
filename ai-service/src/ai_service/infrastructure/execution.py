"""Freeze server-owned parameters and package resources without reading credentials."""

import hashlib
import json
import math
from importlib.resources import files

from ai_service.agent_core.model import ExecutionFailure
from ai_service.config import Settings, model_base_url

PROMPT_VERSION = "wardrobe.recommend.prompt.v1"
SCHEMA_VERSION = "wardrobe.recommend.output.v1"
REASON_POLICY_VERSION = "wardrobe.reason-evidence.v1"


def canonical(value: object) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode()


def resources():
    directory = files("ai_service.resources.wardrobe")
    prompt = directory.joinpath("prompt.v1.txt").read_text(encoding="utf-8")
    schema = json.loads(
        directory.joinpath("output.v1.json").read_text(encoding="utf-8")
    )
    return prompt, schema


def reason_policy() -> str:
    return (
        files("ai_service.resources.wardrobe")
        .joinpath("reason-evidence.v1.txt")
        .read_text(encoding="utf-8")
    )


def execution_descriptor(settings: Settings) -> dict:
    prompt, schema = resources()
    return {
        "adapter": "openai.responses.v1",
        "endpoint": settings.model_base_url + "/responses",
        "response_transport": settings.model_response_transport,
        "reasoning_effort": settings.model_reasoning_effort,
        "reason_policy_version": REASON_POLICY_VERSION,
        "reason_policy_sha256": hashlib.sha256(reason_policy().encode()).hexdigest(),
        "model": settings.model_name,
        "enabled": settings.model_enabled,
        "timeout_seconds": settings.model_timeout_seconds,
        "max_response_bytes": settings.model_max_response_bytes,
        "max_request_bytes": 600 * 1024,
        "max_output_tokens": settings.model_max_output_tokens,
        "prompt_version": PROMPT_VERSION,
        "schema_version": SCHEMA_VERSION,
        "prompt_sha256": hashlib.sha256(prompt.encode()).hexdigest(),
        "schema_sha256": hashlib.sha256(canonical(schema)).hexdigest(),
    }


def request_builder(payload: dict, execution: dict) -> bytes:
    prompt, schema = resources()
    required = {
        "adapter",
        "endpoint",
        "model",
        "enabled",
        "timeout_seconds",
        "max_response_bytes",
        "max_request_bytes",
        "max_output_tokens",
        "prompt_version",
        "schema_version",
        "prompt_sha256",
        "schema_sha256",
    }
    if (
        not required <= set(execution)
        or not set(execution)
        <= required
        | {
            "response_transport",
            "reasoning_effort",
            "reason_policy_version",
            "reason_policy_sha256",
        }
        or execution["prompt_version"] != PROMPT_VERSION
        or execution["schema_version"] != SCHEMA_VERSION
        or execution["prompt_sha256"] != hashlib.sha256(prompt.encode()).hexdigest()
        or execution["schema_sha256"] != hashlib.sha256(canonical(schema)).hexdigest()
    ):
        raise ExecutionFailure("execution_descriptor_mismatch")
    try:
        endpoint = execution["endpoint"]
        if not isinstance(endpoint, str) or not endpoint.endswith("/responses"):
            raise ValueError()
        if (
            model_base_url(endpoint.removesuffix("/responses")) + "/responses"
            != endpoint
        ):
            raise ValueError()
    except ValueError:
        raise ExecutionFailure("execution_descriptor_mismatch") from None
    if (
        execution["adapter"] != "openai.responses.v1"
        or execution.get("response_transport", "responses-json.v1")
        not in ("responses-json.v1", "responses-sse.v1")
        or execution.get("reasoning_effort")
        not in (None, "none", "minimal", "low", "medium", "high", "xhigh")
        or type(execution["enabled"]) is not bool
        or type(execution["timeout_seconds"]) not in (int, float)
        or not math.isfinite(execution["timeout_seconds"])
        or not 0 < execution["timeout_seconds"] <= 60
        or type(execution["max_response_bytes"]) is not int
        or not 1024 <= execution["max_response_bytes"] <= 1048576
        or type(execution["max_request_bytes"]) is not int
        or execution["max_request_bytes"] != 600 * 1024
        or type(execution["max_output_tokens"]) is not int
        or not 64 <= execution["max_output_tokens"] <= 4096
        or (
            execution["model"] is not None
            and (
                not isinstance(execution["model"], str)
                or not 1 <= len(execution["model"]) <= 128
            )
        )
    ):
        raise ExecutionFailure("execution_descriptor_mismatch")
    policy_keys = {"reason_policy_version", "reason_policy_sha256"} & set(execution)
    if policy_keys:
        policy = reason_policy()
        if (
            policy_keys != {"reason_policy_version", "reason_policy_sha256"}
            or execution["reason_policy_version"] != REASON_POLICY_VERSION
            or execution["reason_policy_sha256"]
            != hashlib.sha256(policy.encode()).hexdigest()
        ):
            raise ExecutionFailure("execution_descriptor_mismatch")
        prompt += "\n\n" + policy
    if not execution["enabled"] or not execution["model"]:
        raise ExecutionFailure("model_not_configured")
    data = {
        "model": execution["model"],
        "input": [
            {"role": "system", "content": [{"type": "input_text", "text": prompt}]},
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": canonical(payload).decode()}
                ],
            },
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "wardrobe_recommend_v1",
                "strict": True,
                "schema": schema,
            }
        },
        "max_output_tokens": execution["max_output_tokens"],
        "store": False,
        "stream": execution.get("response_transport", "responses-json.v1")
        == "responses-sse.v1",
    }
    if execution.get("reasoning_effort") is not None:
        data["reasoning"] = {"effort": execution["reasoning_effort"]}
    body = canonical(data)
    if len(body) > execution["max_request_bytes"]:
        raise ExecutionFailure("input_too_large")
    return body
