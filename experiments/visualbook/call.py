"""One immutable, serial official Codex call. Raw provider logs stay ignored."""
import argparse
import fcntl
import hashlib
import json
import os
import re
import signal
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
BASE = Path(os.environ.get("VISUALBOOK_EVIDENCE_DIR", ROOT / "evaluation/2026-10-10/d2l-visualbook-v1")).resolve()


def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def write_json(file, value):
    file.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("section")
    parser.add_argument("attempt")
    parser.add_argument("--feedback", type=Path)
    parser.add_argument("--guide", type=Path, default=HERE / "generation-guide-v2.md")
    parser.add_argument("--image", type=Path, action="append", default=[])
    args = parser.parse_args()
    if not all(re.fullmatch(r"[a-z][a-z0-9-]*", s) for s in [args.section, args.attempt]):
        raise SystemExit("Invalid section/attempt")
    candidate = HERE / "candidates" / args.section / args.attempt
    raw = BASE / "raw" / args.section / args.attempt
    if raw.exists() or candidate.exists():
        raise SystemExit("Refuse to overwrite an attempt or candidate")
    book = json.loads((ROOT / "outputs/visualbook" / f"{args.section}.source.json").read_text())
    guide = args.guide.read_text()
    blocks = [{k: b[k] for k in ("id", "sha256", "type", "raw")} for b in book["blocks"]]
    prompt = guide + "\n原文（每块含可引用 id）：\n" + json.dumps(blocks, ensure_ascii=False)
    published = ROOT / "work/visualbook/source-snapshots" / f"{args.section}.outputs.json"
    if published.exists():
        prompt += "\n原版已有公开代码输出（含未匹配项，不是本机执行；注意不要把已有静态图的价值算成新增图解的收益）：\n" + published.read_text()
    if args.feedback:
        prompt += "\n本次是修订。保持无关图不变。前次输出与具体反馈：\n" + args.feedback.read_text()
    images = [img.resolve(strict=True) for img in args.image]
    env = dict(os.environ)
    for key in ("OPENAI_API_KEY", "CODEX_API_KEY"):
        env.pop(key, None)
    version = subprocess.check_output(["codex", "--version"], env=env, text=True).strip()
    login = subprocess.run(["codex", "login", "status"], env=env, capture_output=True, text=True)
    if login.returncode or "Logged in using ChatGPT" not in login.stdout + login.stderr:
        raise SystemExit("This experiment requires the user's official ChatGPT login")
    (BASE / "raw").mkdir(parents=True, exist_ok=True)
    lock_file = ROOT / "work/visualbook/codex-serial.lock"
    lock_file.parent.mkdir(parents=True, exist_ok=True)
    with lock_file.open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        attempts = {p.parent for name in ("invocation.json", "process.json") for p in (BASE / "raw").glob(f"*/*/{name}")}
        if len(attempts) >= 8:
            raise SystemExit("Eight-call scope reached. Plan a separate bounded experiment before more generation")
        results = sorted((BASE / "calls").glob("*.json"), key=lambda p: p.stat().st_mtime)
        if len(results) >= 3 and all(json.loads(p.read_text())["exit_code"] != 0 for p in results[-3:]):
            raise SystemExit("Three consecutive failures: diagnose before spending more calls")
        raw.mkdir(parents=True)
        context = raw / "context"
        context.mkdir()
        (raw / "prompt.md").write_text(prompt)
        write_json(raw / "invocation.json", {"cliVersion": version, "runnerSha256": sha(Path(__file__)), "guideSha256": sha(args.guide), "images": [{"sha256": sha(p)} for p in images]})
        cmd = ["codex", "exec", "--ephemeral", "--skip-git-repo-check", "--sandbox", "read-only", "--json", "--output-schema", str(HERE / "response.schema.json"), "--output-last-message", str(raw / "response.json"), "--cd", str(context)]
        for image in images:
            cmd += ["--image", str(image)]
        cmd += ["-"]
        started = time.monotonic()
        interrupted = False
        timed_out = False
        with (raw / "stdout.jsonl").open("w") as out, (raw / "stderr.log").open("w") as err:
            proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=out, stderr=err, env=env, start_new_session=True)
            try:
                proc.communicate(prompt.encode(), timeout=900)
            except subprocess.TimeoutExpired:
                timed_out = True
                os.killpg(proc.pid, signal.SIGKILL)
                proc.communicate()
            except (KeyboardInterrupt, SystemExit):
                interrupted = True
                os.killpg(proc.pid, signal.SIGKILL)
                proc.communicate()
        tool_types, usage = [], []
        for line in (raw / "stdout.jsonl").read_text().splitlines():
            try:
                event = json.loads(line)
            except ValueError:
                continue
            if event.get("type") == "turn.completed":
                usage.append(event.get("usage"))
            kind = event.get("item", {}).get("type")
            if kind in ("command_execution", "file_change", "mcp_tool_call", "web_search"):
                tool_types.append(kind)
        response_file = raw / "response.json"
        result = dict(section=args.section, attempt=args.attempt, exit_code=proc.returncode, timed_out=timed_out, interrupted=interrupted, wall_s=round(time.monotonic()-started, 3), prompt_sha256=sha(raw/"prompt.md"), response_sha256=sha(response_file) if response_file.exists() else None, tool_types=tool_types, usage=usage, auth="official Codex; existing ChatGPT login", images=len(images), cliVersion=version, runnerSha256=sha(Path(__file__)))
        write_json(raw / "process.json", result)
        public = BASE / "calls"
        public.mkdir(exist_ok=True)
        write_json(public / f"{args.section}-{args.attempt}.json", result)
        print(json.dumps(result, ensure_ascii=False))
        if proc.returncode or timed_out or interrupted or tool_types or not response_file.exists():
            raise SystemExit("Generation not accepted; raw evidence retained")
        response = json.loads(response_file.read_text())
        candidate.mkdir(parents=True)
        write_json(candidate / "response.json", response)
        write_json(candidate / "brief.json", dict(sourceCommit=book["sourceCommit"], sourceSha256=book["sourceSha256"], adaptedSha256=book["adaptedSha256"], source=book["source"], sourceUrl=book["sourceUrl"], guideSha256=sha(args.guide), anchorHashes=[{"id": b["id"], "sha256": b["sha256"]} for b in book["blocks"]], **result))


if __name__ == "__main__":
    main()
