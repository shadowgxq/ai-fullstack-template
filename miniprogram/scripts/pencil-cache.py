"""Read the wardrobe document through a live Pencil MCP connection.

The installed design-to-code cache owns validation and storage. This adapter only
supplies native reads/exports; it never opens, saves or edits a design document.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys
import uuid


DOCUMENT = "miniprogram/design/wardrobe.pen"
LIBRARY = "frontend/design/core.lib.pen"
ROOTS = [
    "P9tls",
    "ZHXw9",
    "Q3U4y",
    "AvD3c",
    "ddC69",
    "zkPuC",
    "WV7wn",
    "StjQC",
    "Ro2vL",
    "FfxoI",
    "jxBYZ",
    "Y8xJCl",
    "HI38Z",
    "C0p2tC",
    "tz4GK",
    "RYACG",
    "ywaWl",
    "a7xEg",
    "OgxoN",
    "Z8EEvN",
    "QL83M",
    "JGka6",
    "fkIRs",
    "XzsEz",
    "LgGyr",
    "NLCY6",
    "mKPcR",
    "m0rZ7",
    "phKmP",
    "zXmjy",
    "kopCO",
    "SKORD",
    "w2ZdGv",
    "H9XUdW",
    "Ozfkk",
    "EI1eW",
    "q5sgBH",
]


def printed(result):
    if result.get("isError"):
        raise ValueError("Pencil read failed; inspect the retained MCP response")
    for block in result.get("content", []):
        if block.get("type") == "text" and "## Print output\n" in block["text"]:
            return json.loads(block["text"].split("## Print output\n", 1)[1].strip())
    raise ValueError("Pencil returned no native JSON; do not reuse a previous read")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skills-root", required=True, type=Path)
    parser.add_argument("--file-path", required=True)
    parser.add_argument("--export-path", required=True)
    parser.add_argument("--out", type=Path, default=Path(".design-cache/current"))
    parser.add_argument("--nodes", nargs="+", default=ROOTS)
    parser.add_argument("--verify-source", action="store_true")
    parser.add_argument("--server", nargs=argparse.REMAINDER, required=True)
    args = parser.parse_args()
    sys.path.insert(0, str(args.skills_root / "design-to-code/scripts"))
    from cache import Cache
    from cache_flow import Flow
    from cache_model import references, source_facts
    from mcp_probe import Client

    project = Path.cwd()
    output = args.out.resolve()
    output.mkdir(parents=True, exist_ok=True)
    client = Client(args.server, timeout=90)
    # This identity belongs to this actual MCP connection, not a made-up provider revision.
    session = f"stdio-{client.process.pid}-{uuid.uuid4().hex}"
    cache = Cache(project / ".design-cache")
    results = {}
    active_pins = set()

    def execute(program, label):
        result = client.call(
            "tools/call",
            {
                "name": "execute",
                "arguments": {
                    "description": label,
                    "filePath": args.file_path,
                    "input": program,
                },
            },
        )
        if result.get("isError"):
            raise ValueError("Pencil execute failed; no retry as a fresh snippet")
        return result

    def read(node_id):
        payload = printed(
            execute(
                "const target=" + json.dumps(node_id) + ";"
                "const native=Get(target); const components={}; const pending=[];"
                "function refs(v){if(!v||typeof v!=='object')return;"
                "if(v.ref&&!components[v.ref]&&!pending.includes(v.ref))pending.push(v.ref);"
                "for(const x of Object.values(v))if(x&&typeof x==='object')refs(x);}"
                "refs(native);while(pending.length){const id=pending.pop();"
                "components[id]=Get(id);refs(components[id]);}"
                "Print(JSON.stringify({node:native,components,variables:GetVariables(),"
                "geometry:Get(target,(n,c)=>c.depth===0?{width:c.bounds.width,height:c.bounds.height}:undefined)[0]}));",
                "Read wardrobe native design and dependencies",
            )
        )
        resources = {}
        for name, value in payload["variables"]["variables"].items():
            resources["variable:" + name] = {
                "document": LIBRARY if name.startswith("z:") else DOCUMENT,
                "id": name,
                "facts": value,
            }
            if not name.startswith("z:"):
                resources["variable:" + name]["sourceFacts"] = value
        pending = list(references(payload["node"], "pencil"))
        seen = set()
        while pending:
            ref = pending.pop()
            if ref in seen:
                continue
            seen.add(ref)
            if ref.startswith("component:"):
                name = ref.split(":", 1)[1]
                component = payload["components"][name]
                resources[ref] = {
                    "document": LIBRARY if name.startswith("z:") else DOCUMENT,
                    "id": name,
                    "facts": component,
                }
                # Imported instances are evidence of what this document loaded,
                # not proof that the separately owned library is synchronized.
                if not name.startswith("z:"):
                    resources[ref]["sourceFacts"] = component
            elif ref.startswith("image:"):
                name = ref.split(":", 1)[1]
                # Only local, document-relative assets can be verified by this adapter.
                asset = (project / DOCUMENT).parent / name
                if asset.is_file() and asset.resolve().is_relative_to(
                    (project / DOCUMENT).parent
                ):
                    facts = {
                        "url": name,
                        "sha256": hashlib.sha256(asset.read_bytes()).hexdigest(),
                        "size": asset.stat().st_size,
                    }
                    resources[ref] = {
                        "document": DOCUMENT,
                        "id": name,
                        "facts": facts,
                        "sourceFacts": facts,
                    }
            if ref in resources:
                pending.extend(references(resources[ref]["facts"], "pencil") - seen)
        node = payload["node"]
        # Resolved geometry is read from Pencil, never inferred from auto-height strings.
        geometry = payload["geometry"]
        return {
            "schema": "pencil-node-json",
            "page": {
                "provider": "pencil",
                "namespace": "wardrobe-full-flow",
                "document": DOCUMENT,
                "pageId": node_id,
            },
            "context": {"origin": "editor", "session": session},
            "variant": {"state": "default", "theme": "light", "viewport": geometry},
            "node": node,
            "resources": resources,
            "proof": {"mode": "observed"},
        }

    try:
        client.call(
            "initialize",
            {
                "protocolVersion": "2025-06-18",
                "capabilities": {},
                "clientInfo": {"name": "wardrobe-readonly-cache", "version": "1"},
            },
        )
        client.send({"method": "notifications/initialized"})
        tools = client.call("tools/list")["tools"]
        (output / "tools.json").write_text(
            json.dumps(tools, ensure_ascii=False, indent=2)
        )
        actual = {tool["name"]: tool for tool in tools}
        if not {"execute", "get_app_state"} <= actual.keys():
            raise ValueError("Connected server has no supported Pencil read tools")
        state = client.call("tools/call", {"name": "get_app_state", "arguments": {}})
        (output / "connection.json").write_text(
            json.dumps({"session": session, "state": state}, ensure_ascii=False)
        )
        for node_id in args.nodes:
            if args.verify_source:
                previous = json.loads((output / node_id / "native.json").read_text())
                source = {
                    "page": previous["page"],
                    "context": {"origin": "editor", "session": session},
                    "variant": previous["variant"],
                }
                ticket = cache.start_read(**source)
                current = read(node_id)
                observed = cache.observe(ticket, current)
                previous_facts, current_facts = (
                    source_facts(previous),
                    observed["facts"],
                )
                matches = (
                    previous_facts["designFingerprint"]
                    == current_facts["designFingerprint"]
                )
                results[node_id] = {
                    "unchanged": matches,
                    "designFingerprint": current_facts["designFingerprint"],
                    "missing": current_facts["unresolved"],
                    "observation": observed,
                }
                (output / "source-verification.json").write_text(
                    json.dumps(results, ensure_ascii=False, indent=2)
                )
                print(node_id, "unchanged" if matches else "CHANGED", flush=True)
                if not matches:
                    raise ValueError(
                        "Design changed; reconcile the affected page before claiming alignment"
                    )
                continue
            before = read(node_id)
            source = {name: before[name] for name in ("page", "context", "variant")}

            def runner(argv, **_):
                return read(node_id)

            demand = {
                "nodes": [node_id],
                "contexts": [node_id],
                "roles": ["structure", "baseline"],
                "consistency": "observed-consistent",
            }
            prepared = Flow(
                cache, source, ["live-pencil-read", node_id], cwd=project, runner=runner
            ).prepare(demand)
            if prepared["pin"]:
                active_pins.add(prepared["pin"])
            ticket = cache.start_read(**source)
            before = read(node_id)
            observation = cache.observe(ticket, before)
            node_dir = output / node_id
            node_dir.mkdir(exist_ok=True)
            (node_dir / "native.json").write_text(
                json.dumps(before, ensure_ascii=False, indent=2)
            )
            (node_dir / "structure.json").write_text(
                json.dumps(before["node"], ensure_ascii=False, indent=2)
            )
            resolved = printed(
                execute(
                    "Print(JSON.stringify(Get("
                    + json.dumps(node_id)
                    + ",{resolveInstances:true,resolveVariables:true})));",
                    "Read resolved wardrobe layout",
                )
            )
            (node_dir / "resolved.json").write_text(
                json.dumps(resolved, ensure_ascii=False, indent=2)
            )
            export = execute(
                "Export(["
                + json.dumps(node_id)
                + '],"png",'
                + json.dumps(args.export_path)
                + ",{scale:2});",
                "Export current wardrobe design baseline",
            )
            (node_dir / "export.mcp.json").write_text(
                json.dumps(export, ensure_ascii=False)
            )
            after = read(node_id)
            (node_dir / "after.json").write_text(
                json.dumps(after, ensure_ascii=False, indent=2)
            )
            incoming = output
            # Preserve incomplete snapshots as evidence; resolve must still refuse pins.
            png = output / "baseline" / (node_id + ".png")
            artifacts = [
                {
                    "name": node_id + "/structure.json",
                    "role": "structure",
                    "status": "available",
                },
                {
                    "name": node_id + "/native.json",
                    "role": "source",
                    "status": "available",
                },
                {
                    "name": "baseline/" + node_id + ".png",
                    "role": "baseline",
                    "status": "available" if png.is_file() else "missing",
                },
            ]
            for artifact in artifacts:
                artifact.update(
                    nodes=[node_id],
                    captureReceipt=observation["receiptId"],
                    captureSource=source,
                )
            snapshot = cache.publish(
                observation,
                after,
                {"nodes": [node_id], "contexts": [node_id]},
                {},
                artifacts,
                incoming,
            )
            final = Flow(
                cache, source, ["live-pencil-read", node_id], cwd=project, runner=runner
            ).prepare(demand)
            if final["pin"]:
                active_pins.add(final["pin"])
            if prepared["pin"]:
                cache.release(prepared["pin"])
                active_pins.discard(prepared["pin"])
            if final["pin"]:
                cache.release(final["pin"])
                active_pins.discard(final["pin"])
            results[node_id] = {
                "snapshot": snapshot,
                "resolution": final["resolution"],
                "pinReleased": bool(prepared["pin"] or final["pin"]),
                "runtime_checks": "not_run",
                "visual_checks": "not_run",
            }
            (node_dir / "prepare.result.json").write_text(
                json.dumps(results[node_id], ensure_ascii=False, indent=2)
            )
            print(
                node_id,
                final["resolution"]["action"],
                final["resolution"].get("missing", []),
                flush=True,
            )
            (output / "results.json").write_text(
                json.dumps(results, ensure_ascii=False, indent=2)
            )
    finally:
        try:
            for pin in active_pins:
                cache.release(pin)
        finally:
            client.close()
    # A successful read/export is not a successful strict prepare.
    return (
        0
        if args.verify_source
        or all(value["resolution"]["action"] == "reuse" for value in results.values())
        else 2
    )


if __name__ == "__main__":
    raise SystemExit(main())
