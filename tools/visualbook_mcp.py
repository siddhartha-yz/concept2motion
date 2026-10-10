"""Local stdio MCP: compile authorized candidates and return actual PNG content.

No credentials, HTTP server, remote calls or arbitrary shell arguments. Every
candidate and its revision evidence stays in the supplied local workspace.
"""

import argparse
import base64
import hashlib
import json
import re
import shutil
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
    components = json.loads((ROOT / "packages/visualbook/components.json").read_text())["components"]
    calculation_metadata = json.loads(subprocess.check_output(['node',str(ROOT/'tools/visualbook_math.mjs'),'list'],text=True,timeout=30)) if not args.direct else {}

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
                "name":"describe_design_inputs",
                "description":"Inspect the actual replaceable scene data and default controls of one named design, without drawing or copying its code. Use figure.design and explicit overrides to reuse its implementation. Replacements must exist; still review math/teaching fit and actual PNGs.",
                "inputSchema":{"type":"object","properties":{"id":{"type":"string","enum":[d['id'] for d in catalog]}},"required":["id"],"additionalProperties":False},
            },
            {
                "name":"search_designs",
                "description":"Search reusable designs and composable components by concept in Chinese or English. Returns at most six matching entries with limits, not all source code.",
                "inputSchema":{"type":"object","properties":{"query":{"type":"string","maxLength":120}},"required":["query"],"additionalProperties":False},
            },
            {
                "name":"describe_component",
                "description":"Retrieve one component's actual input keys, outputs, limits and matching executable examples. Connect its real outputs to other components using $result.",
                "inputSchema":{"type":"object","properties":{"id":{"type":"string"}},"required":["id"],"additionalProperties":False},
            },
            {
                "name":"compute_math",
                "description":"Call the same canonical probability/learning numerical kernels used by drawings; no DOM, network or model calls. This helps inspect values but is not independent math review. Allowed input keys are returned on error.",
                "inputSchema":{"type":"object","properties":{"operation":{"type":"string","enum":list(calculation_metadata)},"inputs":{"type":"object"}},"required":["operation","inputs"],"additionalProperties":False},
            },
            {
                'name':'describe_calculation',
                'description':'Inspect allowed input keys, required fields and actual output fields of one canonical calculation. Use compose.calculations to wire its results into visual components without custom drawing code.',
                'inputSchema':{'type':'object','properties':{'operation':{'type':'string'}},'required':['operation'],'additionalProperties':False}
            },
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

    definitions += [
        {
            "name": "export_motion",
            "description": "Optional GIF/MP4 of a reviewed figure, with fixed-progress frames, repeat checks and actual decode verification. Requires matching final review. No automatic playback in the book. Two motion attempts per session, including failed captures; frames stay in ignored work.",
            "inputSchema": {
                "type":"object", "properties": {
                    "label":{"type":"string"}, "id":{"type":"string"},
                    "width":{"type":"integer","enum":[375,1280]},
                    "fps":{"type":"integer","enum":[5,10,20,25]},
                    "duration":{"type":"integer","minimum":1,"maximum":20},
                    "formats":{"type":"array","items":{"type":"string","enum":["gif","mp4"]},"minItems":1,"maxItems":2,"uniqueItems":True},
                    "params":{"type":"object"},
                    "sweep":{"type":"object","properties":{"key":{"type":"string"},"from":{"type":"number"},"to":{"type":"number"}},"required":["key","from","to"],"additionalProperties":False},
                    "from":{"type":"number","minimum":0,"maximum":1},
                    "to":{"type":"number","minimum":0,"maximum":1},
                }, "required":["label","id"], "additionalProperties":False,
            },
        },
        {
            "name": "inspect_frame",
            "description": "Return one real start/end PNG from the latest matching candidate preview. Review both widths for every figure before finalizing; it reuses rendered frames and does not spend a new preview.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "width": {"type": "integer", "enum": [375, 1280]},
                    "progress": {"type": "number", "enum": [0, 0.5, 1]},
                },
                "required": ["id", "width", "progress"],
                "additionalProperties": False,
            },
        },
        {
            "name": "finalize_book",
            "description": "Record unresolved visual/math/teaching issues after actually inspecting endpoints. Known issues stop export; this is not a quality score. Does not modify candidate source.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "issues": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "figureId": {"type": "string"},
                                "condition": {"type": "string"},
                                "description": {"type": "string"},
                            },
                            "required": ["figureId", "condition", "description"],
                            "additionalProperties": False,
                        },
                    },
                    "mathCheckNote": {"type": "string"},
                    "limits": {"type": "string"},
                },
                "required": ["issues", "mathCheckNote", "limits"],
                "additionalProperties": False,
            },
        },
    ]

    def digest(path):
        return hashlib.sha256(path.read_bytes()).hexdigest()

    def tool_fingerprint():
        library=ROOT/'packages/visualbook'
        modules=json.loads((library/'bundle.json').read_text())['modules']
        files=[library/n for n in modules+['bundle.json','runtime.js','theme.css','math.mjs','components.json','catalog.json']]+[tool,Path(__file__).resolve(),ROOT/'tools/audit_visualbook_parameters.mjs',ROOT/'tools/visualbook_math.mjs',ROOT/'tools/visualbook_inspection.mjs',ROOT/'tools/export_visualbook_motion.mjs',ROOT/'tools/build_visualbook_catalog.mjs']
        return hashlib.sha256(json.dumps({str(p.relative_to(ROOT)):digest(p) for p in files},sort_keys=True).encode()).hexdigest()

    def build_inputs():
        return {'source_sha256':digest(inside('source.json')),'plan_sha256':digest(inside('book.json')),'tools_sha256':tool_fingerprint(),'arm':'direct' if args.direct else 'harness'}

    def require_current_build():
        receipt=inside('build-receipt.json')
        if not receipt.exists():raise ValueError('Build the current plan successfully before preview or review')
        record=json.loads(receipt.read_text())
        if record.get('status') != 'success' or any(record.get(k)!=v for k,v in build_inputs().items()) or record.get('html_sha256')!=digest(inside('book.html')):
            raise ValueError('Current source/plan/tools do not match a successful build; build_book first. An older HTML is not the revised candidate')
        return record

    def snapshot_build(receipt):
        builds=inside('builds')
        builds.mkdir(exist_ok=True)
        index=1
        while (builds/f'build-{index:03d}').exists():index+=1
        snapshot=builds/f'build-{index:03d}'
        snapshot.mkdir()
        for name in ['source.json','book.json']:shutil.copyfile(inside(name),snapshot/name)
        receipt['snapshot']=str(snapshot.relative_to(workspace))
        (snapshot/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
        return snapshot

    def latest_preview():
        require_current_build()
        reports = sorted(
            workspace.glob("preview-*/report.json"), key=lambda p: p.stat().st_mtime
        )
        if not reports:
            raise ValueError("No candidate preview")
        report = json.loads(reports[-1].read_text())
        if (
            hashlib.sha256(inside("book.html").read_bytes()).hexdigest()
            != report["sha256"]
        ):
            raise ValueError("Candidate changed after preview; preview it again")
        return reports[-1].parent, report

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
        elif name == "describe_design_inputs":
            design=next((d for d in catalog if d['id']==arguments.get('id')),None)
            if design is None:raise ValueError('Unknown design')
            slots=[]
            def collect(node,pointer):
                for key,value in node.get('props',{}).items():
                    slots.append({'path':pointer+'/props/'+key,'currentValue':value})
                for index,calculation in enumerate(node.get('calculations',[])):
                    for key,value in calculation['inputs'].items():
                        slots.append({'path':pointer+'/calculations/'+str(index)+'/inputs/'+key,'currentValue':value})
                for index,child in enumerate(node.get('children',[])):collect(child,pointer+'/children/'+str(index))
                if node.get('visual'):collect(node['visual'],pointer+'/visual')
            if design.get('scene'):collect(design['scene'],'/scene')
            result={'id':design['id'],'title':design['title'],'limits':design['limits'],'params':design.get('params',[]),'state':design.get('state',{}),'slots':slots[:64],'truncated':len(slots)>64,'usesCode':bool(design.get('code')),'usage':{'design':design['id'],'id':'your-figure-id','afterAnchor':'a-real-source-anchor','overrides':[]},'scope':'Existing data replacement paths only; not a suitability or quality verdict'}
        elif name == "search_designs":
            query=arguments.get("query")
            if not isinstance(query,str) or not query.strip() or len(query)>120:
                raise ValueError("Provide a short concept query")
            terms=set(re.findall(r"[a-z0-9]+|[\u4e00-\u9fff]",query.lower()))
            matches=[]
            for entry in components:
                text=" ".join([entry["id"],entry["title"],entry["keywords"],entry["limits"]]).lower()
                score=sum(term in text for term in terms)
                if score:
                    matches.append((score,{k:entry[k] for k in ["id","title","limits","examples"]}))
            matches.sort(key=lambda item:(-item[0],item[1]["id"]))
            selected=[item[1] for item in matches[:6]]
            example_ids={ident for item in selected for ident in item["examples"]}
            designs=[]
            for design in catalog:
                text=" ".join(str(design.get(k,"")) for k in ["id","title","topic","limits","keywords"]).lower()
                score=sum(term in text for term in terms)+(1 if design["id"] in example_ids else 0)
                if score:designs.append((score,{k:design[k] for k in ["id","title","topic","limits"]}))
            designs.sort(key=lambda item:(-item[0],item[1]["id"]))
            result={"components":selected,"designs":[item[1] for item in designs[:6]],"scope":"Simple deterministic keyword lookup; no embedding model or quality ranking"}
        elif name == "describe_component":
            result=next((entry for entry in components if entry["id"]==arguments.get("id")),None)
            if result is None:raise ValueError("Unknown component")
        elif name == 'describe_calculation':
            operation=arguments.get('operation')
            process=subprocess.run(['node',str(ROOT/'tools/visualbook_math.mjs'),'describe',str(operation)],capture_output=True,text=True,timeout=30,cwd=workspace)
            if process.returncode:raise ValueError(process.stderr[-3000:])
            result=json.loads(process.stdout)
        elif name == "compute_math":
            request=json.dumps({"operation":arguments.get("operation"),"inputs":arguments.get("inputs")})
            if len(request.encode())>65536:raise ValueError("Numeric input exceeds 64 KiB")
            process=subprocess.run(["node",str(ROOT/"tools/visualbook_math.mjs")],input=request,cwd=workspace,capture_output=True,text=True,timeout=30)
            if process.returncode:raise ValueError(process.stderr[-3000:])
            result=json.loads(process.stdout)
        elif name == "inspect_frame":
            directory, report = latest_preview()
            ident = arguments.get("id")
            width = arguments.get("width")
            progress = arguments.get("progress")
            plan = json.loads(inside("book.json").read_text())
            if (
                ident not in [f["id"] for f in plan["figures"]]
                or width not in [375, 1280]
                or progress not in [0, 0.5, 1]
            ):
                raise ValueError("Unknown figure or frame")
            filename = directory / f"{width}-{ident}-{progress:g}.png"
            result = {
                "screenshots": [str(filename)],
                "frame": arguments,
                "findings": [],
                "candidateSha256": report["sha256"],
            }
        elif name == "export_motion":
            directory, report = latest_preview()
            label = arguments.get('label','')
            if not re.fullmatch(r'[a-z][a-z0-9-]{0,40}',label):
                raise ValueError('Use a fresh short motion label')
            review_file=inside('review.json')
            if not review_file.exists():raise ValueError('Finalize the inspected candidate first')
            review=json.loads(review_file.read_text())
            if not review.get('ready_for_export') or review.get('issues') or review.get('html_sha256')!=digest(inside('book.html')) or review.get('plan_sha256')!=digest(inside('book.json')):
                raise ValueError('Matching issue-free final review required')
            if len([p for p in workspace.glob('motion-*') if p.is_dir()])>=2:
                raise ValueError('Two motion attempts reached; retain failures')
            out=inside('motion-'+label)
            request=inside('motion-request-'+label+'.json')
            if out.exists() or request.exists():raise ValueError('Motion label already used')
            request.write_text(json.dumps({k:v for k,v in arguments.items() if k!='label'},ensure_ascii=False,indent=2)+'\n')
            process=subprocess.run(['node',str(ROOT/'tools/export_visualbook_motion.mjs'),str(inside('book.html')),str(directory),str(out),str(request)],cwd=workspace,capture_output=True,text=True,timeout=180)
            if not (out/'report.json').exists():raise ValueError(process.stderr[-6000:] or process.stdout[-6000:])
            motion=json.loads((out/'report.json').read_text())
            result={'status':motion['status'],'report':str(out/'report.json'),'outputs':motion['outputs'],'findings':motion['findings'],'candidateSha256':report['sha256'],'screenshots':[s['file'] for s in motion['outputs'][0]['sampledFrames']] if motion['outputs'] else []}
        elif name == "finalize_book":
            directory, report = latest_preview()
            issues = arguments.get("issues")
            if not isinstance(issues, list) or any(
                not isinstance(i, dict)
                or set(i) != {"figureId", "condition", "description"}
                or not all(isinstance(v, str) and v for v in i.values())
                for i in issues
            ):
                raise ValueError("Describe every known unresolved issue")
            if not all(
                isinstance(arguments.get(k), str) for k in ["mathCheckNote", "limits"]
            ):
                raise ValueError("Missing final review notes")
            plan = json.loads(inside("book.json").read_text())
            seen = set()
            evidence = inside("mcp-evidence.jsonl")
            if evidence.exists():
                for line in evidence.read_text().splitlines():
                    item = json.loads(line)
                    if (
                        item["tool"] == "inspect_frame"
                        and item.get("candidateSha256") == report["sha256"]
                    ):
                        a = item["arguments"]
                        seen.add((a["id"], a["width"], a["progress"]))
            missing = [
                {"id": f["id"], "width": w, "progress": p}
                for f in plan["figures"]
                for w in [1280, 375]
                for p in [0, 1]
                if (f["id"], w, p) not in seen
            ]
            if missing:
                raise ValueError(
                    "Inspect actual endpoint PNGs first: " + json.dumps(missing)
                )
            result = {
                **arguments,
                "html_sha256": report["sha256"],
                "plan_sha256": hashlib.sha256(
                    inside("book.json").read_bytes()
                ).hexdigest(),
                "ready_for_export": not issues and not report["findings"],
                "scope": "Known-issue review plus render gate; no independent artistic certification.",
            }
            inside("review.json").write_text(
                json.dumps(result, ensure_ascii=False, indent=2) + "\n"
            )
        elif name == "show_design":
            design = next((d for d in catalog if d["id"] == arguments.get("id")), None)
            if design is None:
                raise ValueError("Unknown design")
            out = inside("design-" + design["id"])
            if (
                not out.exists()
                and len([p for p in workspace.glob("design-*") if p.is_dir()]) >= 2
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
                receipt={**build_inputs(),'status':'building'}
                snapshot=snapshot_build(receipt)
                inside('build-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
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
                require_current_build()
                label = arguments.get("label", "")
                if not re.fullmatch(r"[a-z][a-z0-9-]{0,40}", label):
                    raise ValueError("Invalid preview label")
                if len([p for p in workspace.glob("preview-*") if p.is_dir()]) >= 3:
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
            try:
                process = subprocess.run(command, cwd=workspace, capture_output=True, text=True, timeout=180)
            except Exception as error:
                if name=='build_book':
                    failed={**receipt,'status':'failed','error':str(error)}
                    for destination in [inside('build-receipt.json'),snapshot/'receipt.json']:destination.write_text(json.dumps(failed,indent=2)+'\n')
                raise
            if name=='build_book':
                (snapshot/'stdout.txt').write_text(process.stdout)
                (snapshot/'stderr.txt').write_text(process.stderr)
            if process.returncode:
                if name == 'build_book':
                    for destination in [inside('build-receipt.json'),snapshot/'receipt.json']:destination.write_text(json.dumps({**receipt,'status':'failed'},indent=2)+'\n')
                raise ValueError(process.stderr[-6000:] or process.stdout[-6000:])
            result = json.loads(process.stdout.splitlines()[-1])
            if name == 'build_book':
                receipt={**receipt,'status':'success','html_sha256':digest(inside('book.html'))}
                shutil.copyfile(inside('book.html'),snapshot/'book.html')
                if inside('resolved-plan.json').exists():
                    shutil.copyfile(inside('resolved-plan.json'),snapshot/'resolved-plan.json')
                    receipt['resolved_plan_sha256']=digest(inside('resolved-plan.json'))
                for destination in [inside('build-receipt.json'),snapshot/'receipt.json']:destination.write_text(json.dumps(receipt,indent=2)+'\n')
                result['buildReceipt']=receipt
        content = [{"type": "text", "text": json.dumps(result, ensure_ascii=False)}]
        if name in ["preview_book", "show_design", "inspect_frame", "export_motion"]:
            screenshots = result["screenshots"]
            selected = [
                p
                for p in screenshots
                if Path(p).name.endswith("-0.5.png")
                or Path(p).name.endswith("-context.png")
            ]
            if not selected:
                selected = screenshots
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
            "candidateSha256": (
                result.get("candidateSha256") if isinstance(result, dict) else None
            ),
        }
        with (workspace / "mcp-evidence.jsonl").open("a") as stream:
            stream.write(json.dumps(entry, ensure_ascii=False) + "\n")
        return {"content": content, "isError": name == "export_motion" and result.get("status") != "completed"}

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
                    "serverInfo": {"name": "visualbook-local", "version": "0.7.0"},
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
