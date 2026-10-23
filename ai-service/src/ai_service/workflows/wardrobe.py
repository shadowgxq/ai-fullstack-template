"""Three nodes: durable preparation, a fenced single call, local validation.

Only request/evidence references and bounded frozen input enter State. Provider raw
responses stay in the operation store. No retries or output repair are configured.
"""

import hashlib
import json
from copy import deepcopy
from typing import TypedDict
from uuid import UUID, uuid5

from langgraph.graph import END, START, StateGraph

from ai_service.agent_core.model import ExecutionFailure, ModelCall, ModelCallUncertain


class WardrobeState(TypedDict, total=False):
    payload: dict
    execution: dict
    prepared: dict
    response_ref: str
    result: dict


def canonical(value):
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    ).encode()


def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()


def checked_identity(run_id, state):
    prepared = state["prepared"]
    if (
        prepared["operation_id"]
        != str(uuid5(UUID(run_id), "wardrobe.recommend.v1:model:1"))
        or prepared["input_hash"] != digest(state["payload"])
        or prepared["execution_hash"] != digest(state["execution"])
        or prepared["request_hash"]
        != hashlib.sha256(prepared["request_body"].encode()).hexdigest()
    ):
        raise ExecutionFailure("operation_mismatch")
    request = json.loads(prepared["request_body"])
    if (
        request["model"] != state["execution"]["model"]
        or json.loads(request["input"][1]["content"][0]["text"]) != state["payload"]
    ):
        raise ExecutionFailure("operation_mismatch")
    return prepared


def same_operation(row, prepared):
    return (
        all(
            str(row[k]) == prepared[k]
            for k in ("operation_id", "input_hash", "execution_hash", "request_hash")
        )
        and bytes(row["request_body"]) == prepared["request_body"].encode()
    )


def execute_wardrobe(
    run_id,
    payload,
    execution,
    checkpointer,
    operations,
    model_port,
    request_builder,
    input_validator,
    choice_validator,
    output_validator,
):
    payload = input_validator(deepcopy(payload))
    if not isinstance(execution, dict):
        raise ExecutionFailure("execution_descriptor_mismatch")

    def verified_preparation(state):
        prepared = checked_identity(run_id, state)
        # A checkpoint hash alone is not authority to change prompts, schema or
        # token limits. Rebuild only from the frozen server descriptor/resources.
        if prepared["request_body"].encode() != request_builder(
            state["payload"], state["execution"]
        ):
            raise ExecutionFailure("operation_mismatch")
        return prepared

    def prepare(state):
        body = request_builder(state["payload"], state["execution"])
        prepared = {
            "operation_id": str(uuid5(UUID(run_id), "wardrobe.recommend.v1:model:1")),
            "input_hash": digest(state["payload"]),
            "execution_hash": digest(state["execution"]),
            "request_hash": hashlib.sha256(body).hexdigest(),
            "request_body": body.decode(),
        }
        return {"prepared": prepared}

    def invoke(state):
        prepared = verified_preparation(state)
        existing = operations.lookup(run_id)
        if existing is not None:
            if not same_operation(existing, prepared):
                raise ExecutionFailure("operation_mismatch")
            if existing["state"] == "responded":
                return {"response_ref": str(existing["response_ref"])}
            operations.begin(run_id, prepared)
            raise ExecutionFailure("call_outcome_unknown")
        spec = state["execution"]
        call = ModelCall(
            spec["adapter"],
            spec["endpoint"],
            spec["model"],
            prepared["request_body"].encode(),
            spec["timeout_seconds"],
            spec["max_response_bytes"],
            spec.get("response_transport", "responses-json.v1"),
        )
        # Configuration checks are offline and precede consuming the one send slot.
        model_port.validate_configuration(call)
        row = operations.begin(run_id, prepared)
        if row["state"] == "responded":
            return {"response_ref": str(row["response_ref"])}
        if row["state"] != "sending":
            raise ExecutionFailure("call_outcome_unknown")
        operations.assert_authority()
        try:
            reply = model_port.invoke(call)
        except ModelCallUncertain:
            operations.unknown(prepared["operation_id"])
            raise ExecutionFailure("call_outcome_unknown") from None
        except Exception:
            # An unexpected adapter failure cannot prove that the provider saw no request.
            operations.unknown(prepared["operation_id"])
            raise ExecutionFailure("call_outcome_unknown") from None
        row = operations.respond(prepared["operation_id"], reply)
        return {"response_ref": str(row["response_ref"])}

    def final_result(state):
        prepared = verified_preparation(state)
        row = operations.load(prepared["operation_id"])
        if (
            not same_operation(row, prepared)
            or row["state"] != "responded"
            or str(row["response_ref"]) != state["response_ref"]
        ):
            raise ExecutionFailure("operation_mismatch")
        if row["error_code"]:
            raise ExecutionFailure(
                row["error_code"]
                if row["error_code"] in {"invalid_output", "provider_error"}
                else "invalid_output"
            )
        try:
            choice = choice_validator(row["output_json"])
            selected = set(choice["selected_ids"])
            candidates = {item["id"] for item in state["payload"]["candidates"]}
            refs = {item["ref_id"]: item for item in state["payload"]["fact_refs"]}
            if not selected <= candidates or any(
                ref not in refs
                or (
                    refs[ref]["subject_id"] is not None
                    and refs[ref]["subject_id"] not in selected
                )
                for ref in choice["fact_refs"]
            ):
                raise ValueError()
            return output_validator(
                {
                    **choice,
                    "call_evidence": {
                        "operation_id": str(row["operation_id"]),
                        "response_ref": str(row["response_ref"]),
                        "adapter": state["execution"]["adapter"],
                        "requested_model": state["execution"]["model"],
                        "returned_model": row["returned_model"],
                        "request_id": row["provider_request_id"],
                        "usage": row["usage"],
                        "prompt_version": state["execution"]["prompt_version"],
                        "schema_version": state["execution"]["schema_version"],
                    },
                }
            )
        except (ValueError, TypeError, KeyError):
            raise ExecutionFailure("invalid_output") from None

    def validate(state):
        return {"result": final_result(state)}

    builder = StateGraph(WardrobeState)
    for name, node in [
        ("prepare", prepare),
        ("invoke", invoke),
        ("validate", validate),
    ]:
        builder.add_node(name, node)
    builder.add_edge(START, "prepare")
    builder.add_edge("prepare", "invoke")
    builder.add_edge("invoke", "validate")
    builder.add_edge("validate", END)
    graph = builder.compile(checkpointer=checkpointer)
    config = {"configurable": {"thread_id": run_id}, "recursion_limit": 10}
    snapshot = graph.get_state(config)
    if snapshot.values and (
        snapshot.values.get("payload") != payload
        or snapshot.values.get("execution") != execution
    ):
        raise ExecutionFailure("checkpoint_input_mismatch")
    if not snapshot.values:
        values = graph.invoke(
            {"payload": payload, "execution": deepcopy(execution)},
            config,
            durability="sync",
        )
    elif snapshot.next:
        values = graph.invoke(None, config, durability="sync")
    else:
        values = snapshot.values
    expected = final_result(values)
    if values.get("result") != expected:
        raise ExecutionFailure("invalid_output")
    return expected
