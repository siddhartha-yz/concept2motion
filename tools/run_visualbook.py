"""One-command serial VisualBook authoring; uses official signed-in Codex only.

A manifest is a list of already imported source JSON chapters. Every chapter gets
one independent model session, shared executable designs, real PNG feedback and
up to three internal revisions. Failed chapters stay diagnostic; they are not
quietly published as ready books. Raw provider output remains in ignored work/.
"""

import argparse, hashlib, json, os, re, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def inspect(job):
    result = (
        json.loads((job / "result.json").read_text())
        if (job / "result.json").exists()
        else {}
    )
    html = job / "book.html"
    reports = sorted(job.glob("preview-*/report.json"), key=lambda p: p.stat().st_mtime)
    reasons = []
    if result.get("exit_code") != 0 or result.get("timed_out"):
        reasons.append("author-session-incomplete")
    if not result.get("source_unchanged"):
        reasons.append("source-was-modified")
    if not result.get("tool_sources_unchanged"):
        reasons.append("shared-tools-were-modified")
    if not result.get("returned_candidate_png_count", result.get("returned_png_count")):
        reasons.append("no-image-feedback")
    plan = job / "book.json"
    if not plan.exists() or digest(plan) != result.get("plan_sha256"):
        reasons.append("plan-was-modified-after-authoring")
    latest = None
    if not reports:
        reasons.append("no-preview")
    else:
        latest = json.loads(reports[-1].read_text())
        if not html.exists() or digest(html) != latest["sha256"]:
            reasons.append("preview-is-stale")
        if latest["findings"]:
            reasons.append("unresolved-render-findings")
    review_file = job / "review.json"
    if not review_file.exists():
        reasons.append("no-final-issue-review")
    else:
        review = json.loads(review_file.read_text())
        if review.get("issues") or not review.get("ready_for_export"):
            reasons.append("known-unresolved-issues")
        if (
            not html.exists()
            or review.get("html_sha256") != digest(html)
            or review.get("plan_sha256") != result.get("plan_sha256")
        ):
            reasons.append("final-review-is-stale")
    return {
        "ready_for_export": not reasons,
        "reasons": reasons,
        "latest_preview": str(reports[-1].parent) if reports else None,
        "render_findings": latest["findings"] if latest else None,
        "quality": "Engineering gate only; does not establish teaching or aesthetic quality.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--timeout", type=int, default=1200)
    parser.add_argument("--model", help="Optional explicit official CLI model")
    parser.add_argument("--reasoning-effort", choices=["low", "medium", "high", "xhigh", "max", "ultra"])
    parser.add_argument(
        "--max-chapters",
        type=int,
        default=3,
        help="Explicit bounded batch size; default 3.",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Reuse completed sessions; never overwrite or repeat model calls.",
    )
    parser.add_argument(
        "--source-url",
        default="",
        help="Original textbook URL for ordinary Markdown input.",
    )
    parser.add_argument(
        "--source-name",
        default="输入教材",
        help="Attribution name for ordinary Markdown.",
    )
    args = parser.parse_args()
    output = args.output.resolve()
    work = (ROOT / "work").resolve()
    if not output.is_relative_to(work):
        raise SystemExit(
            "Raw generation output must be in ignored work/ to keep provider logs out of Git"
        )
    if output.exists() and not args.resume:
        raise SystemExit("Output exists; use a fresh directory or --resume")
    output.mkdir(parents=True, exist_ok=True)
    identity = {
        "input_sha256": digest(args.manifest),
        "source_url": args.source_url,
        "source_name": args.source_name,
    }
    identity_path = output / "input-identity.json"
    if identity_path.exists() and json.loads(identity_path.read_text()) != identity:
        raise SystemExit("Resume input changed; use a fresh run")
    save(identity_path, identity)
    if args.manifest.suffix.lower() == ".md":
        source = output / "imported.source.json"
        if not source.exists():
            options = json.dumps(
                {
                    "id": "chapter",
                    "sourceUrl": args.source_url,
                    "sourceName": args.source_name,
                },
                ensure_ascii=False,
            )
            p = subprocess.run(
                [
                    "node",
                    str(ROOT / "packages/visualbook/import.mjs"),
                    str(args.manifest.resolve()),
                    str(source),
                    options,
                ],
                cwd=ROOT,
            )
            if p.returncode:
                raise SystemExit(p.returncode)
        imported = json.loads(source.read_text())
        manifest = {
            "title": imported["title"],
            "chapters": [{"id": imported["id"], "source": str(source)}],
        }
    else:
        manifest = json.loads(args.manifest.read_text())
        if "blocks" in manifest:
            manifest = {
                "title": manifest["title"],
                "chapters": [
                    {"id": manifest["id"], "source": str(args.manifest.resolve())}
                ],
            }
    chapters = manifest.get("chapters", [])
    if not 1 <= len(chapters) <= args.max_chapters:
        raise SystemExit("Chapter count outside explicit batch budget")
    ids = [c.get("id", "") for c in chapters]
    if len(set(ids)) != len(ids) or any(
        not re.fullmatch(r"[a-z][a-z0-9-]*", i) for i in ids
    ):
        raise SystemExit("Invalid or duplicate chapter id")
    if not 60 <= args.timeout <= 1800:
        raise SystemExit("Timeout must be 60..1800 seconds")
    records = []
    started = time.monotonic()
    for c in chapters:
        chapter_id = c["id"]
        source = Path(c["source"])
        if not source.is_absolute():
            source = (args.manifest.parent / source).resolve()
        job = output / "sessions" / chapter_id
        if not (job / "result.json").exists():
            command = [
                sys.executable,
                str(ROOT / "tools/author_book.py"),
                chapter_id,
                "harness",
                "--source",
                str(source),
                "--job",
                str(job),
                "--timeout",
                str(args.timeout),
                "--mcp",
                "--campaign",
                str(output),
                "--attempt-limit",
                str(args.max_chapters),
            ]
            if args.model:
                command += ["--model", args.model]
            if args.reasoning_effort:
                command += ["--reasoning-effort", args.reasoning_effort]
            p = subprocess.run(command, cwd=ROOT)
            if p.returncode and not (job / "result.json").exists():
                records.append(
                    {
                        "id": chapter_id,
                        "state": "session-start-failed",
                        "exit_code": p.returncode,
                    }
                )
                break
        gate = inspect(job)
        if (job / "source.json").exists() and digest(source) != digest(
            job / "source.json"
        ):
            gate["ready_for_export"] = False
            gate["reasons"].append("input-source-changed")
        save(job / "export-gate.json", gate)
        records.append(
            {
                "id": chapter_id,
                "source": str(source),
                "plan": str(job / "book.json"),
                "arm": "harness",
                "gate": gate,
            }
        )
        if not gate["ready_for_export"]:
            break
    save(
        output / "pipeline-record.json",
        {
            "chapters": records,
            "wall_s": round(time.monotonic() - started, 3),
            "max_chapters": args.max_chapters,
            "automatic_user_feedback": 0,
            "ready_chapters": sum(
                r.get("gate", {}).get("ready_for_export", False) for r in records
            ),
        },
    )
    if len(records) != len(chapters) or any(
        not r.get("gate", {}).get("ready_for_export") for r in records
    ):
        print(
            "Stopped with retained diagnostics: " + str(output / "pipeline-record.json")
        )
        raise SystemExit(2)
    assembly = output / "assembly.json"
    save(
        assembly,
        {
            "title": manifest.get("title", "VisualBook"),
            "description": manifest.get("description"),
            "chapters": [
                {k: r[k] for k in ["id", "source", "plan", "arm"]} for r in records
            ],
        },
    )
    if (output / "book/index.html").exists() and args.resume:
        built = json.loads((output / "book/build-record.json").read_text())
        if built.get("indexSha256") != digest(output / "book/index.html") or any(
            r.get("finalHtmlSha256") != digest(output / "book" / r["file"])
            for r in built["records"]
        ):
            raise SystemExit(
                "Assembled book identity changed or predates export hashes; rebuild into a fresh directory"
            )
        print("Existing book: " + str(output / "book/index.html"))
        return
    p = subprocess.run(
        [
            "node",
            str(ROOT / "tools/assemble_visualbook.mjs"),
            str(assembly),
            str(output / "book"),
        ],
        cwd=ROOT,
    )
    if p.returncode:
        raise SystemExit(p.returncode)
    print("Book: " + str(output / "book/index.html"))


if __name__ == "__main__":
    main()
