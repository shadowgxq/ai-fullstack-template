#!/usr/bin/env python3
"""Bounded HTTP startup checks against local disposable development services."""
import argparse
import json
import os
import re
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4


def request(base, path, *, method="GET", payload=None, headers=None, expected=200):
    data = None if payload is None else json.dumps(payload).encode()
    req = Request(base + path, data=data, method=method,
                  headers={"Content-Type": "application/json", **(headers or {})})
    try:
        with urlopen(req, timeout=10) as response:
            status, body = response.status, response.read().decode()
    except HTTPError as error:
        status, body = error.code, error.read().decode()
    if status != expected:
        raise AssertionError(f"{method} {path}: expected {expected}, got {status}")
    try:
        return json.loads(body)
    except ValueError:
        return body


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--frontend", default="http://127.0.0.1:8080")
    parser.add_argument("--backend", default="http://127.0.0.1:8000")
    parser.add_argument("--ai", default="http://127.0.0.1:8001")
    parser.add_argument("--skip-ai", action="store_true", help="Verify frontend/backend only; do not contact AI service")
    args = parser.parse_args()
    for base in (args.frontend, args.backend) + (() if args.skip_ai else (args.ai,)):
        if not re.fullmatch(r"http://(?:127\.0\.0\.1|localhost):[0-9]+", base):
            raise ValueError("Smoke tests create data; only loopback development URLs are allowed")
    html = request(args.frontend, "/")
    assert '<div id="root">' in html
    assets = re.findall(r'(?:src|href)="(/assets/[^" ]+)"', html)
    assert assets, "Production assets missing"
    for asset in assets:
        request(args.frontend, asset)
    print("PASS frontend HTML and bundled assets")
    for base in (args.backend,) + (() if args.skip_ai else (args.ai,)):
        assert request(base, "/health")["status"] == "ok"
        assert request(base, "/ready")["status"] == "ready"
    print("PASS API process and dependency readiness")
    credentials = {"username": "smoke_" + uuid4().hex, "password": "smoke-only-password"}
    request(args.frontend, "/api/v1/auth/register", method="POST", payload=credentials)
    login = request(args.frontend, "/api/v1/auth/login", method="POST", payload=credentials)
    auth = {"Authorization": "Bearer " + login["data"]["access_token"]}
    assert request(args.frontend, "/api/v1/auth/me", headers=auth)["data"]["username"] == credentials["username"]
    request(args.frontend, "/api/v1/auth/logout", method="POST", headers=auth)
    request(args.frontend, "/api/v1/auth/me", headers=auth, expected=401)
    print("PASS frontend proxy, backend auth, Redis token revocation")
    # Exercise the real Redis MULTI failure counter and lockout, not just the fake.
    for attempt in range(5):
        wrong = {**credentials, "password": "wrong-password"}
        request(args.frontend, "/api/v1/auth/login", method="POST", payload=wrong,
                expected=429 if attempt == 4 else 401)
    request(args.frontend, "/api/v1/auth/login", method="POST", payload=credentials, expected=429)
    print("PASS real Redis login failure counter and lockout")
    if args.skip_ai:
        return
    token = os.environ.get("AI_API_KEY")
    if not token:
        from pathlib import Path
        env_file = Path(__file__).resolve().parents[1] / ".env"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if line.startswith("AI_API_KEY="):
                    token = line.split("=", 1)[1].strip().strip("\"'")
    token = token or "local-ai-service-key-change-before-deploy"
    headers = {"Authorization": "Bearer " + token, "Idempotency-Key": uuid4().hex}
    payload = {"workflow": "echo.v1", "input": {"text": "fullstack-smoke"}}
    request(args.ai, "/api/v1/runs", method="POST", payload=payload, expected=401)
    run = request(args.ai, "/api/v1/runs", method="POST", payload=payload, headers=headers, expected=202)
    duplicate = request(args.ai, "/api/v1/runs", method="POST", payload=payload, headers=headers, expected=202)
    assert run["run_id"] == duplicate["run_id"]
    request(args.ai, "/api/v1/runs", method="POST", headers=headers,
            payload={"input": {"text": "conflict"}}, expected=409)
    path = "/api/v1/runs/" + run["run_id"]
    deadline = time.monotonic() + 40
    while time.monotonic() < deadline:
        snapshot = request(args.ai, path, headers=headers)
        if snapshot["status"] == "completed":
            break
        assert snapshot["status"] != "failed", "Deterministic workflow failed"
        time.sleep(0.5)
    else:
        raise AssertionError("Worker did not publish within the bounded deadline")
    assert request(args.ai, path + "/result", headers=headers) == payload["input"]
    events = request(args.ai, path + "/events", headers=headers)
    assert [event["event_type"] for event in events] == ["queued", "running", "completed"]
    assert request(args.ai, path + "/events?after=3", headers=headers) == []
    print("PASS authenticated API -> PostgreSQL command -> Worker -> LangGraph -> immutable result")


if __name__ == "__main__":
    main()
