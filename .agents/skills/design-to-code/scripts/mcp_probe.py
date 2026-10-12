#!/usr/bin/env python3
"""Explicit stdio MCP connectivity probe: discovery and state read only, no execute."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import queue
import subprocess
import threading
import time

SUPPORTED = {'2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25'}


class Client:
    def __init__(self, command, timeout=15):
        if not command or not all(isinstance(a, str) and a for a in command):
            raise ValueError('explicit server argv required')
        self.process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                        text=True, encoding='utf-8', bufsize=1)
        self.timeout, self.number, self.messages = timeout, 0, queue.Queue(maxsize=128)
        def reader():
            try:
                while True:
                    line = self.process.stdout.readline(4 * 1024 * 1024 + 1)
                    if not line:
                        self.messages.put(None, timeout=1); return
                    if len(line) > 4 * 1024 * 1024:
                        self.messages.put(ValueError('oversized MCP message'), timeout=1); return
                    self.messages.put(json.loads(line), timeout=1)
            except Exception as exc:
                try: self.messages.put(exc, timeout=1)
                except queue.Full: pass
        self.thread = threading.Thread(target=reader, daemon=True); self.thread.start()

    def send(self, message):
        self.process.stdin.write(json.dumps({'jsonrpc':'2.0', **message}, ensure_ascii=False) + '\n'); self.process.stdin.flush()

    def call(self, method, params=None):
        self.number += 1; number = self.number
        self.send({'id':number, 'method':method, 'params':params or {}})
        deadline = time.monotonic() + self.timeout
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0: raise TimeoutError('MCP response timed out')
            try: msg = self.messages.get(timeout=remaining)
            except queue.Empty as exc: raise TimeoutError('MCP response timed out') from exc
            if msg is None: raise ValueError('MCP server ended before response')
            if isinstance(msg, Exception): raise ValueError('invalid MCP transport message') from msg
            if not isinstance(msg, dict) or msg.get('jsonrpc') != '2.0': raise ValueError('invalid JSON-RPC envelope')
            if 'method' in msg:
                if 'id' in msg:
                    self.send({'id':msg['id'], **({'result':{}} if msg['method'] == 'ping' else {'error':{'code':-32601,'message':'Client capability not provided'}})})
                continue
            if msg.get('id') != number: continue
            if 'error' in msg: raise ValueError('MCP returned a protocol error')
            if 'result' not in msg: raise ValueError('missing MCP result')
            return msg['result']

    def close(self):
        try: self.process.stdin.close()
        except (OSError, BrokenPipeError): pass
        try: self.process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            self.process.terminate()
            try: self.process.wait(timeout=2)
            except subprocess.TimeoutExpired: self.process.kill(); self.process.wait(timeout=2)
        self.process.stdout.close()


def probe(command, arguments=None, timeout=15, fixture=False):
    client = Client(command, timeout)
    try:
        init = client.call('initialize', {'protocolVersion':'2025-06-18', 'capabilities':{}, 'clientInfo':{'name':'design-readonly-probe','version':'1'}})
        version = init.get('protocolVersion')
        if version not in SUPPORTED: raise ValueError('unsupported negotiated protocol version')
        client.send({'method':'notifications/initialized'})
        tools, cursor, seen = [], None, set()
        for _ in range(20):
            response = client.call('tools/list', {'cursor':cursor} if cursor else {})
            if not isinstance(response.get('tools'), list): raise ValueError('invalid tools/list response')
            tools.extend(response['tools']); cursor = response.get('nextCursor')
            if not cursor: break
            if cursor in seen: raise ValueError('repeated tools pagination cursor')
            seen.add(cursor)
        else: raise ValueError('tools pagination limit exceeded')
        report = {'transport':'stdio', 'protocolVersion':version, 'tools':[t['name'] for t in tools],
                  'evidenceLevel':'fixture' if fixture else 'live-connection', 'state_read':'not_run',
                  'design_read':'not_run', 'visual_checks':'not_run', 'writesPerformed':False}
        candidates = [t for t in tools if t.get('name') in ('get_app_state', 'get_editor_state')]
        if not candidates:
            return {**report, 'reason':'no recognized state read tool; do not substitute execute'}
        tool = candidates[0]
        if tool.get('annotations', {}).get('destructiveHint') is True:
            return {**report, 'reason':'state tool marked destructive'}
        try:
            from jsonschema import Draft202012Validator
        except ImportError:
            return {**report, 'reason':'install jsonschema in the test environment to validate live input schema'}
        schema = tool.get('inputSchema')
        if not isinstance(schema, dict): raise ValueError('missing tool input schema')
        Draft202012Validator.check_schema(schema)
        # Do not resolve network $refs from untrusted servers.
        if '"$ref"' in json.dumps(schema):
            return {**report, 'reason':'schema references require caller review'}
        args = arguments or {}
        if not Draft202012Validator(schema).is_valid(args):
            return {**report, 'reason':'state arguments do not match discovered schema'}
        result = client.call('tools/call', {'name':tool['name'], 'arguments':args})
        if result.get('isError') is True: raise ValueError('state read tool returned isError')
        if not result.get('content') and not result.get('structuredContent'):
            return {**report, 'reason':'empty state evidence'}
        report.update(state_read='passed', stateTool=tool['name'], stateEvidenceHash=hashlib.sha256(json.dumps(result, sort_keys=True).encode()).hexdigest())
        return report
    finally:
        client.close()


def main():
    p = argparse.ArgumentParser(description=__doc__); p.add_argument('--args-file'); p.add_argument('--timeout', type=float, default=15)
    p.add_argument('--fixture', action='store_true'); p.add_argument('command', nargs=argparse.REMAINDER)
    args = p.parse_args(); command = args.command[1:] if args.command[:1] == ['--'] else args.command
    if not command:
        print(json.dumps({'live_mcp':'not_run','reason':'no connected Pencil host/server command supplied'})); return 2
    try:
        if not 0 < args.timeout <= 300: raise ValueError('invalid timeout')
        report = probe(command, json.loads(Path(args.args_file).read_text(encoding='utf-8-sig')) if args.args_file else {}, args.timeout, args.fixture)
        print(json.dumps(report, ensure_ascii=False, indent=2)); return 0 if report['state_read'] == 'passed' else 2
    except (ValueError, OSError, TimeoutError, KeyError, TypeError) as exc:
        print(json.dumps({'ok':False,'state_read':'failed','errorType':type(exc).__name__,'design_read':'not_run','visual_checks':'not_run'})); return 1


if __name__ == '__main__':
    raise SystemExit(main())
