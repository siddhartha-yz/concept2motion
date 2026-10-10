"""Local stdio MCP: compile authorized candidates and return actual PNG content.

No credentials, HTTP server, remote calls or arbitrary shell arguments. Every
candidate and its revision evidence stays in the supplied local workspace.
"""

import argparse
import base64
import hashlib
import json
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--direct", action="store_true")
    args = parser.parse_args()
    workspace = args.workspace.resolve(strict=True)
    tool = ROOT / "tools/visualbook.mjs"
    catalog = json.loads((ROOT / "packages/visualbook/catalog.json").read_text())[
        "designs"
    ]

    def inside(name):
        path = (workspace / name).resolve()
        if not path.is_relative_to(workspace):
            raise ValueError("Path outside current workspace")
        return path

    definitions = [
        {
            "name": "build_book",
            "description": "Compile source.json and book.json into book.html. Keep original prose and formulas. No artistic quality verdict.",
            "inputSchema": {
                "type": "object",
                "properties": {},
                "additionalProperties": False,
            },
        },
        {
            "name": "preview_book",
            "description": "Render desktop/mobile views, fractional progress AND parameter extremes. Return render findings and real PNG image content for every figure at mid-progress. Use a fresh label; at most three candidate previews.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "description": "Fresh preview label, e.g. first or revised",
                    }
                },
                "required": ["label"],
                "additionalProperties": False,
            },
        },
    ]
    if not args.direct:
        definitions += [
            {
                "name": "list_designs",
                "description": "List reusable mathematical/ML/programming designs and their limits. Select suitable ones; do not force every concept into a template.",
                "inputSchema": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": False,
                },
            },
            {
                "name": "show_design",
                "description": "Return executable example and real desktop/mobile PNG of one reusable design. Does not modify your book. At most two different examples per author session.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string", "enum": [d["id"] for d in catalog]}
                    },
                    "required": ["id"],
                    "additionalProperties": False,
                },
            },
        ]

    def call(name, arguments):
        started = time.monotonic()
        image_metadata = []
        if name not in [d["name"] for d in definitions]:
            raise ValueError("Unknown tool")
        required = next(d for d in definitions if d["name"] == name)["inputSchema"][
            "properties"
        ]
        if any(k not in required for k in arguments):
            raise ValueError("Unknown argument")
        result = None
        if name == "list_designs":
            result = [
                {k: d[k] for k in ["id", "title", "topic", "limits"]} for d in catalog
            ]
        elif name == "show_design":
            design = next((d for d in catalog if d["id"] == arguments.get("id")), None)
            if design is None:
                raise ValueError("Unknown design")
            out = inside("design-" + design["id"])
            if (
                not out.exists()
                and len(list(workspace.glob("design-*/catalog-record.json"))) >= 2
            ):
                raise ValueError("Two different design examples reached")
            if not (out / "catalog-record.json").exists():
                command = [
                    "node",
                    str(ROOT / "tools/build_visualbook_catalog.mjs"),
                    str(out),
                    design["id"],
                ]
                process = subprocess.run(
                    command, cwd=workspace, capture_output=True, text=True, timeout=180
                )
                if process.returncode:
                    raise ValueError(process.stderr[-6000:] or process.stdout[-6000:])
            report = json.loads(
                (out / "evidence" / design["id"] / "report.json").read_text()
            )
            result = {
                "design": design,
                "findings": report["findings"],
                "screenshots": report["screenshots"],
                "kind": "maintenance-authored reusable design, not your generated textbook",
            }
        else:
            if name == "build_book":
                command = [
                    "node",
                    str(tool),
                    "build",
                    str(inside("source.json")),
                    str(inside("book.json")),
                    str(inside("book.html")),
                ]
                if args.direct:
                    command.append("--direct")
            else:
                label = arguments.get("label", "")
                if not re.fullmatch(r"[a-z][a-z0-9-]{0,40}", label):
                    raise ValueError("Invalid preview label")
                if len(list(workspace.glob("preview-*/report.json"))) >= 3:
                    raise ValueError(
                        "Three-preview budget reached; retain final issues"
                    )
                out = inside("preview-" + label)
                if out.exists():
                    raise ValueError("Preview directory already exists")
                command = [
                    "node",
                    str(tool),
                    "preview",
                    str(inside("book.html")),
                    str(out),
                ]
            process = subprocess.run(
                command, cwd=workspace, capture_output=True, text=True, timeout=180
            )
            if process.returncode:
                raise ValueError(process.stderr[-6000:] or process.stdout[-6000:])
            result = json.loads(process.stdout.splitlines()[-1])
        content = [{"type": "text", "text": json.dumps(result, ensure_ascii=False)}]
        if name in ["preview_book", "show_design"]:
            screenshots = result["screenshots"]
            selected = [p for p in screenshots if Path(p).name.endswith("-0.5.png")]
            if not selected:
                selected = screenshots[:1]
            for path in selected:
                file = Path(path).resolve()
                if not file.is_relative_to(workspace):
                    raise ValueError("Screenshot outside workspace")
                data = file.read_bytes()
                content += [
                    {"type": "text", "text": "真实预览 " + file.name},
                    {
                        "type": "image",
                        "mimeType": "image/png",
                        "data": base64.b64encode(data).decode(),
                    },
                ]
                image_metadata.append(
                    {
                        "name": file.name,
                        "sha256": hashlib.sha256(data).hexdigest(),
                        "bytes": len(data),
                        "mimeType": "image/png",
                    }
                )
        entry = {
            "tool": name,
            "arguments": arguments,
            "wall_s": round(time.monotonic() - started, 3),
            "images": image_metadata,
            "findings": result.get("findings", []) if isinstance(result, dict) else [],
            "arm": "direct" if args.direct else "harness",
        }
        with (workspace / "mcp-evidence.jsonl").open("a") as stream:
            stream.write(json.dumps(entry, ensure_ascii=False) + "\n")
        return {"content": content, "isError": False}

    for line in sys.stdin:
        ident = None
        request = None
        try:
            request = json.loads(line)
            method = request.get("method")
            ident = request.get("id")
            if ident is None:
                continue
            if method == "initialize":
                result = {
                    "protocolVersion": request.get("params", {}).get(
                        "protocolVersion", "2024-11-05"
                    ),
                    "capabilities": {"tools": {}},
                    "serverInfo": {"name": "visualbook-local", "version": "0.3.0"},
                }
            elif method == "ping":
                result = {}
            elif method == "tools/list":
                result = {"tools": definitions}
            elif method in [
                "resources/list",
                "resources/templates/list",
                "prompts/list",
            ]:
                result = {
                    (
                        "resourceTemplates"
                        if method == "resources/templates/list"
                        else "resources" if method == "resources/list" else "prompts"
                    ): []
                }
            elif method == "tools/call":
                params = request.get("params", {})
                result = call(params.get("name"), params.get("arguments", {}))
            else:
                raise ValueError("Unsupported method")
            response = {"jsonrpc": "2.0", "id": ident, "result": result}
        except Exception as error:
            with (workspace / "mcp-failures.jsonl").open("a") as stream:
                stream.write(
                    json.dumps(
                        {
                            "method": (
                                request.get("method")
                                if isinstance(request, dict)
                                else None
                            ),
                            "error": str(error),
                        },
                        ensure_ascii=False,
                    )
                    + "\n"
                )
            response = {
                "jsonrpc": "2.0",
                "id": ident,
                "result": {
                    "content": [{"type": "text", "text": str(error)}],
                    "isError": True,
                },
            }
        sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
