"""Collect selected local candidate evidence without copying provider transcripts.

This makes research results inspectable; it neither approves a candidate nor scans
for secrets. Audit the intended publication separately. Raw HTML and media remain
in the original ignored run; their hashes are retained.
"""
import argparse
import hashlib
import json
import shutil
from pathlib import Path


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def collect(job, out):
    job, out = job.resolve(), out.resolve()
    if out.exists():
        raise ValueError("Evidence destination exists; do not overwrite history")
    required = ["book.json", "source.json", "result.json", "invocation.json"]
    if any(not (job / name).is_file() for name in required):
        raise ValueError("Candidate inputs and invocation/result are required")
    source = json.loads((job / "source.json").read_text())
    plan = json.loads((job / "book.json").read_text())
    out.mkdir(parents=True)
    files = []

    def copy(relative):
        path = job / relative
        if not path.is_file():
            return
        target = out / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
        files.append({"path": relative, "sha256": digest(path)})

    for name in ["book.json", "source.md", "source-map.json", "prompt.md", "AUTHOR.md", "review.json", "result.json", "invocation.json", "export-gate.json"]:
        copy(name)
    # Keep raw text and source identities; omit precompiled fonts/images/HTML.
    source_data = {k: v for k, v in source.items() if k != "blocks"}
    source_data["blocks"] = [{k: v for k, v in b.items() if k != "html"} for b in source["blocks"]]
    (out / "source-data.json").write_text(json.dumps(source_data, ensure_ascii=False, indent=2) + "\n")
    for path in sorted(job.glob("math-check*.json")):
        copy(path.name)
    for directory_name in ['drawing-gaps','annotation-edits','plan-edits','math-results']:
        for path in sorted((job / directory_name).rglob('*.json')):
            copy(str(path.relative_to(job)))
    revisions = []
    for directory in sorted((job / "builds").glob("build-*")):
        for name in ["book.json", "plan.json", "result.json", "receipt.json", "build-receipt.json", "resolved-plan.json"]:
            copy(str((directory / name).relative_to(job)))
        revisions.append({"path": str(directory.relative_to(job)), "files": sorted(p.name for p in directory.iterdir() if p.is_file())})
    previews = sorted(job.glob("preview-*"), key=lambda p: p.stat().st_mtime)
    for directory in previews:
        for name in ["attempt.json", "report.json", "parameters/report.json", "parameters/attempt.json", "interactions/report.json", "interactions/attempt.json"]:
            copy(str((directory / name).relative_to(job)))
    sampled = []
    if previews:
        latest = previews[-1]
        for index, figure in enumerate(plan.get("figures", [])):
            names = [f"375-{figure['id']}-0.5.png"]
            if index == 0:
                names.append(f"1280-{figure['id']}-0.5.png")
            for name in names:
                path = latest / name
                if path.is_file():
                    relative = str(path.relative_to(job))
                    copy(relative)
                    sampled.append(relative)
    identity = {
        "kind": "Selected candidate inputs, revisions, real browser facts and sampled frames; provider transcripts excluded",
        "sourceJsonSha256": digest(job / "source.json"),
        "planSha256": digest(job / "book.json"),
        "rawHtmlSha256": digest(job / "book.html") if (job / "book.html").exists() else None,
        "sourceDataSha256": digest(out / "source-data.json"),
        "sourceUrl": source.get("sourceUrl"),
        "sourceSha256": source.get("sourceSha256"),
        "sourceCommit": source.get("sourceCommit"),
        "sourceAdaptation": source.get("adaptation"),
        "sampledFrames": sampled,
        "revisions": revisions,
        "files": files,
        "limits": "Selection is not artistic review, approval or a secret scan. Full raw run stays local in ignored work/. source-data omits compiled HTML; its hash differs from the original source JSON.",
    }
    (out / "identity.json").write_text(json.dumps(identity, ensure_ascii=False, indent=2) + "\n")
    return identity


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("job", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    result = collect(args.job, args.output)
    print(json.dumps({"files": len(result["files"]), "sampledFrames": len(result["sampledFrames"]), "output": str(args.output)}, ensure_ascii=False))
