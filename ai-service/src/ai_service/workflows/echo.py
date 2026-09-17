"""A deterministic workflow: validates graph/checkpoint wiring without paid calls."""

from typing import TypedDict

from langgraph.graph import END, START, StateGraph


class EchoState(TypedDict, total=False):
    text: str
    result: dict[str, str]


def echo(state: EchoState) -> dict:
    return {"result": {"text": state["text"]}}


def build_graph(checkpointer):
    builder = StateGraph(EchoState)
    builder.add_node("echo", echo)
    builder.add_edge(START, "echo")
    builder.add_edge("echo", END)
    return builder.compile(checkpointer=checkpointer)


def execute_echo(run_id: str, text: str, checkpointer) -> dict[str, str]:
    graph = build_graph(checkpointer)
    config = {"configurable": {"thread_id": run_id}, "recursion_limit": 10}
    snapshot = graph.get_state(config)
    if not snapshot.values:
        values = graph.invoke({"text": text}, config)
    elif snapshot.next:
        values = graph.invoke(None, config)
    else:
        values = snapshot.values
    if values.get("result") != {"text": text}:
        raise ValueError("Deterministic completion gate rejected the result")
    return values["result"]
