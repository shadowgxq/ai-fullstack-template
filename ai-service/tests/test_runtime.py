"""Framework-independent dispatch rules; no database or paid adapter needed."""

import unittest

from ai_service.agent_core.runtime import UnsupportedWorkflow, WorkflowRunner
from ai_service.bootstrap import create_runner


class RuntimeTests(unittest.TestCase):
    def test_registry_is_a_snapshot_and_does_not_guess_unknown_versions(self):
        calls = []

        def execute(run_id, payload):
            calls.append((run_id, dict(payload)))
            return {"ok": True}

        source = {"fixed.v1": execute}
        runner = WorkflowRunner(source)
        source["fixed.v2"] = execute
        self.assertEqual(runner.run("fixed.v1", "run-1", {"value": 1}), {"ok": True})
        with self.assertRaises(UnsupportedWorkflow):
            runner.run("fixed.v2", "run-2", {})
        self.assertEqual(calls, [("run-1", {"value": 1})])

    def test_executor_cannot_mutate_input_mapping(self):
        payload = {"text": "original"}

        def mutate(_run_id, data):
            data["text"] = "changed"
            return data

        with self.assertRaises(TypeError):
            WorkflowRunner({"mutate.v1": mutate}).run("mutate.v1", "run", payload)
        self.assertEqual(payload["text"], "original")

    def test_invalid_registry_or_run_identity_is_rejected(self):
        with self.assertRaises(ValueError):
            WorkflowRunner({})
        runner = create_runner(lambda _run_id, text: {"text": text})
        with self.assertRaises(ValueError):
            runner.run("echo.v1", " ", {"text": "hi"})

    def test_bootstrap_validates_persisted_input_before_executor(self):
        calls = []
        runner = create_runner(
            lambda run_id, text: calls.append(run_id) or {"text": text}
        )
        for payload in (
            {},
            {"text": 1},
            {"text": ""},
            {"text": "x" * 2001},
            {"text": "hi", "scope": "other"},
        ):
            with self.subTest(payload_type=type(payload.get("text")).__name__):
                with self.assertRaises(ValueError):
                    runner.run("echo.v1", "run", payload)
        self.assertEqual(calls, [])
        self.assertEqual(runner.run("echo.v1", "run", {"text": "hi"}), {"text": "hi"})

    def test_executor_failure_is_not_converted_to_success(self):
        def fail(_run_id, _payload):
            raise RuntimeError("failure")

        with self.assertRaises(RuntimeError):
            WorkflowRunner({"fail.v1": fail}).run("fail.v1", "run", {})
