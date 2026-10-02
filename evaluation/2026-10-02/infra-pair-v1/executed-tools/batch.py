"""Sequential, checkpointed Codex generation → render → review benchmark."""
import argparse
import fcntl
import hashlib
import html
import importlib.util
import json
import math
import os
from pathlib import Path
import shutil
import signal
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
TERMINAL = {"passed", "budget_exhausted"}
AUTHOR_SCHEMA = {"type": "object", "additionalProperties": False,
                 "properties": {k: {"type": "string"} for k in ("html", "javascript", "storyboard")},
                 "required": ["html", "javascript", "storyboard"]}
REVIEW_SCHEMA = {"type": "object", "additionalProperties": False, "properties": {
    "decision": {"type": "string", "enum": ["pass", "revise"]},
    "revision_instruction": {"type": "string"},
    "observations": {"type": "array", "items": {"type": "object", "additionalProperties": False,
        "properties": {"time_s": {"type": "number"}, "evidence": {"type": "string"}, "description": {"type": "string"}},
        "required": ["time_s", "evidence", "description"]}}},
    "required": ["decision", "revision_instruction", "observations"]}
PLAN_SCHEMA = {"type": "object", "additionalProperties": False, "properties": {
    "question": {"type": "string"}, "takeaway": {"type": "string"},
    "beats": {"type": "array", "items": {"type": "object", "additionalProperties": False,
        "properties": {**{k: {"type": "string"} for k in
                         ("stage", "caption", "visual_action", "viewer_inference")},
                       "start_s": {"type": "number"}, "end_s": {"type": "number"}},
        "required": ["stage", "caption", "visual_action", "viewer_inference", "start_s", "end_s"]}}},
    "required": ["question", "takeaway", "beats"]}
BLIND_REVIEW_SCHEMA = {**REVIEW_SCHEMA,
    "properties": {**REVIEW_SCHEMA["properties"], "reconstructed_message": {"type": "string"},
                   "causal_explanation": {"type": "string"}},
    "required": [*REVIEW_SCHEMA["required"], "reconstructed_message", "causal_explanation"]}


def load(path):
    return json.loads(path.read_text())


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    temporary.replace(path)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run_process(command, cwd, directory, timeout, prompt=None):
    directory.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    env = dict(os.environ)
    # This runner is subscription-only. Authentication remains inside the official client.
    for name in ("OPENAI_API_KEY", "CODEX_API_KEY"):
        env.pop(name, None)
    with (directory / "stdout.log").open("w") as stdout, (directory / "stderr.log").open("w") as stderr:
        process = subprocess.Popen(command, cwd=cwd, env=env, stdin=subprocess.PIPE,
                                   stdout=stdout, stderr=stderr, start_new_session=True)
        try:
            process.communicate(prompt.encode() if prompt is not None else None, timeout=timeout)
            code, timed_out = process.returncode, False
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.communicate()
            code, timed_out = process.returncode, True
        except BaseException:
            os.killpg(process.pid, signal.SIGKILL)
            process.communicate()
            save(directory / "process.json", {"exit_code": process.returncode, "interrupted": True,
                                              "wall_s": round(time.monotonic()-started, 3)})
            raise
    result = {"exit_code": code, "timed_out": timed_out, "wall_s": round(time.monotonic()-started, 3)}
    save(directory / "process.json", result)
    return result


def event_summary(path):
    usage, threads, tools = [], [], []
    for line in path.read_text().splitlines():
        try:
            event = json.loads(line)
        except ValueError:
            continue
        if event.get("type") == "thread.started":
            threads.append(event.get("thread_id"))
        if event.get("type") == "turn.completed" and event.get("usage"):
            usage.append(event["usage"])
        item = event.get("item", {})
        if item.get("type") in {"command_execution", "file_change", "mcp_tool_call", "web_search", "plan_update"}:
            tools.append(item["type"])
    return {"usage": usage, "thread_ids": threads, "tool_types": sorted(set(tools))}


def model_call(args, directory, prompt, schema, images=()):
    directory.mkdir(parents=True, exist_ok=False)
    (directory / "prompt.md").write_text(prompt)
    save(directory / "schema.json", schema)
    context = directory / "context"
    context.mkdir()
    command = [args.codex, "exec", "--ephemeral", "--skip-git-repo-check", "--sandbox", "read-only",
               "--json", "--output-schema", str(directory / "schema.json"),
               "--output-last-message", str(directory / "response.json"), "--cd", str(context)]
    for override in getattr(args, "codex_config", ()):
        command.extend(["-c", override])
    for image in images:
        command.extend(["--image", str(image)])
    command.append("-")
    print(f"  model {directory.name}: {len(images)} images", flush=True)
    result = run_process(command, context, directory, args.model_timeout, prompt)
    result.update(event_summary(directory / "stdout.log"))
    save(directory / "process.json", result)
    if result["exit_code"] != 0 or result["timed_out"] or not (directory / "response.json").exists():
        raise RuntimeError(f"Model call failed; inspect {directory}/process.json and private logs")
    if result["tool_types"]:
        raise RuntimeError(f"Tool use contaminated a source-isolated model call: {result['tool_types']}")
    return load(directory / "response.json")


def next_call(attempt, role):
    calls = attempt / "calls"
    calls.mkdir(parents=True, exist_ok=True)
    index = 1
    while (calls / f"{role}-{index:02d}").exists():
        index += 1
    return calls / f"{role}-{index:02d}"


def author_prompt(case, protocol):
    return f"""You are the author of an original silent mathematical animation.
This is an authorized benchmark generation, not a repository editing task.
Return ONLY the structured response. Do not call tools, read files, browse, copy fixtures,
spawn agents or invoke another model. All required material is in this prompt.
Create self-contained index.html referencing scene.js, and the complete scene.js.
Use Canvas2D, 1920x1080, 60fps, exactly {case['duration_s']} seconds, dark background,
minimal readable labels, continuous intentional movement, and stable component colors.
Use no imports or external assets. The HTML must contain canvas#scene at its intrinsic size.
Set meta.caseId to '{case['id']}' exactly, regardless of the protocol's example metadata.
Pause automatic playback for ?export=1. Explicit render(t) must redraw the entire frame.
Return a short storyboard as the third field. Do not edit the validator or relax its constraints.
Keep instrumentation truthful: register every visible shape and measured text bound.
Text must clear shape bounds throughout motion; avoid captions placed inside shapes.
Mechanism and geometry fields must exist as specified at every applicable stage.
Use the exact stage names and order in the protocol. Do not claim trained weights.
The residual output vectors must use six-digit solid colors at their sampled midpoints.
The normalized Softmax segments must have six-digit solid colors at their centers.
{('This is a Chinese explanation for a newcomer. Follow the saved teaching plan. Each visual action must support its caption and a viewer inference. Establish what the objects mean and the problem before introducing notation. Keep the concluding answer readable. Decorative motion cannot stand in for an explanation.' if case.get('communication') else '')}

Frozen brief:
{json.dumps(case, indent=2)}

Frozen scene protocol:
{protocol}
"""


def validate_plan(plan, brief):
    """Validate timing/coverage only; this does not prove pedagogical quality."""
    if not plan.get("question", "").strip() or not plan.get("takeaway", "").strip():
        raise ValueError("Teaching plan needs a question and takeaway")
    expected = {"softmax": ["logits", "exponential", "shared-total", "normalizing", "normalized"],
                "residual": ["input", "branches", "merging", "output"]}[brief["id"]]
    beats = plan.get("beats", [])
    if [b.get("stage") for b in beats] != expected:
        raise ValueError("Teaching plan must preserve mechanism stages")
    cursor = 0
    for beat in beats:
        start, end = beat.get("start_s"), beat.get("end_s")
        if (not isinstance(start, (int, float)) or not isinstance(end, (int, float)) or
                not math.isfinite(start) or not math.isfinite(end) or
                abs(start-cursor) > 1e-6 or end-start < 3):
            raise ValueError("Teaching plan needs contiguous beats with reading time")
        if any(not beat.get(k, "").strip() for k in ("caption", "visual_action", "viewer_inference")):
            raise ValueError("Each beat needs a caption, action and inference")
        cursor = end
    if abs(cursor-brief["duration_s"]) > 1e-6:
        raise ValueError("Teaching plan must cover the complete duration")


def plan_samples(plan):
    return sorted({round(t, 2) for b in plan["beats"] for t in
                   (b["start_s"]+.35, (b["start_s"]+b["end_s"])/2, b["end_s"]-.35)})


def reviewer_prompt(brief, images):
    evidence = json.dumps([p.name for p in images])
    if brief.get("communication"):
        # Intentionally exclude the intended message, mechanism, plan and check verdict.
        return f"""You are viewing keyframes of an unfamiliar silent Chinese explainer.
Audience: {brief['communication']['audience']}
Use only visible images. Do not call tools, browse, read source or use an author's account.
Reconstruct in plain Chinese what this film asks and answers (reconstructed_message).
Explain the cause-and-effect steps communicated by the pictures (causal_explanation).
Do not fill missing exposition from your prior mathematical knowledge. Naming a known
formula is insufficient. If a newcomer cannot identify the objects, purpose, causal steps
or conclusion from the supplied stills, request a concrete revision. Captions must have
visible demonstrations; attractive motion alone does not communicate a mechanism.
Return pass or revise, timestamped observations and an actionable revision instruction
(empty for pass). A pass requires a visible question, defined objects, a supported causal
chain and a readable answer. This is a model's reconstruction of sampled stills, not a
human comprehension study or a judgement of full-video motion. Never grant user acceptance.
Evidence filenames: {evidence}
"""
    return f"""Review the attached mathematical animation keyframes independently of its author.
Use only the supplied brief and images. Do not call tools, browse, read source, spawn agents or models.
The deterministic mathematical, pixel, timing and layout checks passed; visually inspect readability,
mechanism correspondence, identities, signed direction, continuity and pacing visible in these stills.
This is sampled-frame review, not a claim to have watched the entire video. No numeric quality score.
Return pass or revise, concrete timestamped observations, and an actionable local revision instruction
(empty string for pass). Never grant the user's artistic acceptance. Evidence filenames must match:
{evidence}
Frozen brief: {json.dumps(brief)}
"""


def initialize(out, args):
    out.mkdir(parents=True, exist_ok=False)
    runtime = out / "runtime"
    for relative in ("tools/batch.py", "tools/render_scene.mjs", "tools/contracts.mjs", "tools/review_run.py", "benchmarks/cases.json"):
        target = runtime / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / relative, target)
    cases = load(getattr(args, "briefs", ROOT / "benchmarks/cases.json"))
    save(runtime / "benchmarks/cases.json", cases)
    protocol = (ROOT / "docs/scene-protocol.md").read_text()
    # Supply only protocol contracts, not existing scene examples or historical review narratives.
    protocol = protocol.split("## Run a candidate")[0]
    (out / "protocol.md").write_text(protocol)
    for case_id in args.cases:
        case = next(c for c in cases if c["id"] == case_id)
        save(out / f"brief-{case_id}.json", case)
        (out / f"prompt-{case_id}.md").write_text(author_prompt(case, protocol))
    frozen = [p for p in out.rglob("*") if p.is_file()]
    config = {"version": 1, "cases": args.cases, "trials": args.trials,
              "coordinator_sha256": digest(ROOT / "tools/batch.py"),
              "budgets": {"technical": 2, "visual": 2}, "artistic_acceptance": "pending_user_review",
              "created_at_unix": time.time(), "frozen": [{"path": str(p.relative_to(out)), "sha256": digest(p)} for p in frozen]}
    save(out / "batch.json", config)


def verify_frozen(out, config):
    for item in config["frozen"]:
        if digest(out / item["path"]) != item["sha256"]:
            raise ValueError(f"Frozen benchmark material changed: {item['path']}")


def repair_counts(attempts):
    return {kind: sum(a.get("review", {}).get("decision") == "revise" and
                      a["review"]["kind"] == kind for a in attempts) for kind in ("technical", "visual")}


def can_revise(attempts, budgets):
    last = attempts[-1].get("review", {})
    return last.get("decision") == "revise" and repair_counts(attempts)[last["kind"]] <= budgets[last["kind"]]


def deterministic_findings(manifest):
    checks = manifest.get("checks", {})
    findings = list(checks.get("findings", []))
    findings.extend(checks.get("full_video_frame_checks", {}).get("findings", []))
    findings.extend({"code": "video_"+code, "detail": "Encoded video contract failed"}
                    for code in manifest.get("video", {}).get("findings", []))
    return findings


def validate_candidate(candidate):
    if set(candidate) != {"html", "javascript", "storyboard"} or not all(isinstance(v, str) and v.strip() for v in candidate.values()):
        raise ValueError("Author response must contain nonempty html, javascript and storyboard strings")


def trial(out, case_id, number, args, policy):
    directory = out / f"{case_id}-{number:02d}"
    directory.mkdir(exist_ok=True)
    state_file = directory / "state.json"
    state = load(state_file) if state_file.exists() else {"case": case_id, "trial": number, "status": "running", "attempts": []}
    if state["status"] in TERMINAL:
        if state.get("plan_response") and digest(out / state["plan_response"]) != state["plan_sha256"]:
            raise ValueError("Teaching plan changed after checkpoint")
        for completed in state.get("attempts", []):
            response = out / completed["generation"]
            if digest(response) != completed["generation_sha256"]:
                raise ValueError("Completed generation changed after checkpoint")
            candidate = load(response)
            source = directory / f"attempt-{completed['index']:02d}/candidate"
            for name, field in (("index.html", "html"), ("scene.js", "javascript"), ("STORYBOARD.md", "storyboard")):
                if (source / name).read_text() != candidate[field]:
                    raise ValueError("Completed candidate source changed after checkpoint")
            rendered = out / completed["render"]
            policy.validate_review(completed["review"], load(rendered / "manifest.json"), rendered)
        print(f"{directory.name}: already {state['status']}", flush=True)
        return
    state["status"] = "running"
    state.pop("error", None)
    save(state_file, state)
    brief = load(out / f"brief-{case_id}.json")
    base_prompt = (out / f"prompt-{case_id}.md").read_text()
    try:
        plan = None
        if brief.get("communication"):
            if "plan_response" not in state:
                prompt = ("Plan a Chinese mathematical explainer before any rendering code. Return only JSON; "
                          "do not call tools, read files, browse or invoke models. State a question and the answer "
                          "a newcomer should remember. Each beat needs a short on-screen Chinese caption, "
                          "one visible demonstration and its viewer inference. Preserve the required stages "
                          "in order, with contiguous beats of at least 3 seconds covering the full duration. "
                          "Opening: concrete question and object meanings. Ending: explicit answer. "
                          "No decorative action without meaning. Frozen brief: " + json.dumps(brief) +
                          "\nStage contract: " + (out / "protocol.md").read_text())
                call = next_call(directory / "planning", "planner")
                plan = model_call(args, call, prompt, PLAN_SCHEMA)
                validate_plan(plan, brief)
                state.update(plan_response=str((call / "response.json").relative_to(out)),
                             plan_sha256=digest(call / "response.json"))
                save(state_file, state)
            plan_file = out / state["plan_response"]
            if digest(plan_file) != state["plan_sha256"]:
                raise ValueError("Teaching plan changed after checkpoint")
            plan = load(plan_file)
            validate_plan(plan, brief)
            base_prompt += "\nSaved teaching plan (write code to realize this):\n" + json.dumps(plan)
        while True:
            if not state["attempts"] or state["attempts"][-1].get("review"):
                if state["attempts"]:
                    previous = state["attempts"][-1]
                    if previous["review"]["decision"] == "pass":
                        state["status"] = "passed"; break
                    if not can_revise(state["attempts"], load(out / "batch.json")["budgets"]):
                        state["status"] = "budget_exhausted"; break
                state["attempts"].append({"index": len(state["attempts"])+1})
                save(state_file, state)
            entry = state["attempts"][-1]
            attempt = directory / f"attempt-{entry['index']:02d}"
            attempt.mkdir(exist_ok=True)
            print(f"{directory.name}/{attempt.name}", flush=True)
            if "generation" not in entry:
                prompt = base_prompt
                if len(state["attempts"]) > 1:
                    prior = state["attempts"][-2]
                    prompt += "\nRevise this candidate locally; preserve unaffected details:\n" + json.dumps(load(out / prior["generation"]))
                    prompt += "\nRequired repair:\n" + json.dumps(prior["review"])
                call = next_call(attempt, "author")
                candidate = model_call(args, call, prompt, AUTHOR_SCHEMA)
                validate_candidate(candidate)
                entry["generation"] = str((call / "response.json").relative_to(out))
                entry["generation_sha256"] = digest(call / "response.json")
                save(state_file, state)
            response_file = out / entry["generation"]
            if digest(response_file) != entry["generation_sha256"]:
                raise ValueError("Completed generation changed after checkpoint")
            candidate = load(response_file)
            source = attempt / "candidate"
            source.mkdir(exist_ok=True)
            for filename, field in (("index.html", "html"), ("scene.js", "javascript"), ("STORYBOARD.md", "storyboard")):
                path = source / filename
                if path.exists() and path.read_text() != candidate[field]:
                    raise ValueError("Candidate source changed after generation")
                path.write_text(candidate[field])
            if "render" not in entry:
                index = 1
                while (attempt / f"render-{index:02d}").exists():
                    prior_run = attempt / f"render-{index:02d}"
                    if (prior_run / "manifest.json").exists() and load(prior_run / "manifest.json")["status"] != "started":
                        break
                    index += 1
                rendered = attempt / f"render-{index:02d}"
                if not rendered.exists():
                    command = [args.node, str(out / "runtime/tools/render_scene.mjs"), "--scene", str(source / "index.html"),
                               "--out", str(rendered), "--brief", str(out / f"brief-{case_id}.json"),
                               "--author", "official Codex CLI; fresh context"]
                    if plan:
                        command.extend(["--samples", ",".join(map(str, plan_samples(plan)))])
                    result = run_process(command, directory, attempt / f"render-process-{index:02d}", args.render_timeout)
                    if result["timed_out"]:
                        raise RuntimeError("Renderer timed out; process tree stopped, incomplete evidence retained")
                if not (rendered / "manifest.json").exists():
                    raise RuntimeError("Renderer did not create a manifest; inspect private render logs")
                if not (rendered / "brief.json").exists():
                    save(rendered / "brief.json", brief)
                entry["render"] = str(rendered.relative_to(out))
                save(state_file, state)
            rendered = out / entry["render"]
            manifest = load(rendered / "manifest.json")
            if "review_response" not in entry:
                if manifest["status"] != "render_passed":
                    findings = deterministic_findings(manifest)
                    layout = {"text_overlap", "text_shape_overlap", "clipped"}
                    kind = "visual" if findings and all(f["code"] in layout for f in findings) else "technical"
                    review = {"kind": kind, "decision": "revise", "reviewer": "independent deterministic checker",
                              "independent_of_author": True, "observations": [{"time_s": 0, "evidence": "manifest.json",
                              "description": json.dumps({"errors": manifest.get("errors"), "findings": findings[:20]})}],
                              "revision_instruction": "Repair these concrete checks without changing the brief or weakening evidence: " +
                              json.dumps({"errors": manifest.get("errors"), "findings": findings[:20]})}
                else:
                    images = sorted(rendered.glob("frame-*.jpg"), key=lambda p: float(p.stem[6:]))
                    prompt = reviewer_prompt(brief, images)
                    call = next_call(attempt, "reviewer")
                    review = model_call(args, call, prompt,
                                        BLIND_REVIEW_SCHEMA if plan else REVIEW_SCHEMA, images)
                    if plan and any(not review.get(k, "").strip() for k in
                                    ("reconstructed_message", "causal_explanation")):
                        raise ValueError("Blind review needs a reconstruction and causal explanation")
                    review.update(kind="visual", reviewer="official Codex CLI; separate fresh context",
                                  independent_of_author=True, review_scope="sampled_frames",
                                  review_mode="blind_reconstruction" if plan else "brief_informed")
                review["artistic_acceptance"] = "pending_user_review"
                policy.validate_review(review, manifest, rendered)
                save(attempt / "review-response.json", review)
                entry["review_response"] = str((attempt / "review-response.json").relative_to(out))
                save(state_file, state)
            review = load(out / entry["review_response"])
            policy.validate_review(review, manifest, rendered)
            save(rendered / "review.json", review)
            entry["review"] = review
            save(state_file, state)
        save(state_file, state)
        print(f"{directory.name}: {state['status']}", flush=True)
    except Exception as error:
        state.update(status="blocked", error=str(error))
        save(state_file, state)
        raise


def summarize(out):
    config = load(out / "batch.json")
    trials = []
    for case in config["cases"]:
        for number in range(1, config["trials"]+1):
            path = out / f"{case}-{number:02d}/state.json"
            state = load(path) if path.exists() else {"case": case, "trial": number, "status": "not_started", "attempts": []}
            first = state["attempts"][0] if state["attempts"] else {}
            first_manifest = load(out / first["render"] / "manifest.json") if first.get("render") else {}
            trials.append({"case": case, "trial": number, "status": state["status"],
                           "generated_attempts": sum("generation" in a for a in state["attempts"]),
                           "first_render_passed": first_manifest.get("status") == "render_passed" if first_manifest else None,
                           "first_review_passed": first.get("review", {}).get("decision") == "pass" if first.get("review") else None,
                           "revision_requests": repair_counts(state["attempts"]), "error": state.get("error")})
    usage = [load(p) for pattern in ("*-*/attempt-*/calls/*/process.json", "*-*/planning/calls/*/process.json")
             for p in out.glob(pattern)]
    result = {"trials": trials, "planned_trials": len(trials), "completed_trials": sum(t["status"] in TERMINAL for t in trials),
              "passed_trials": sum(t["status"] == "passed" for t in trials), "model_calls": len(usage),
              "usage": [u for call in usage for u in call.get("usage", [])],
              "human_scene_interventions": 0, "cost_measured": False, "artistic_acceptance": "pending_user_review",
              "limits": ["exploratory small sample", "same configured model, fresh contexts", "sampled-frame visual review",
                         "context isolation is not a filesystem security boundary", "no human artistic acceptance"]}
    save(out / "summary.json", result)
    lines = ["# Fresh generation benchmark", "", "| Case | Trial | Status | First render | First review | Technical requests | Visual requests |",
             "|---|---:|---|---|---|---:|---:|"]
    for t in trials:
        lines.append(f"| {t['case']} | {t['trial']} | {t['status']} | {t['first_render_passed']} | {t['first_review_passed']} | {t['revision_requests']['technical']} | {t['revision_requests']['visual']} |")
    lines += ["", "Fresh author and reviewer sessions. No fixture source supplied. Source, renderer evidence, reviews and private model logs are retained locally.",
              "Small exploratory sample; no production reliability or artistic acceptance claim. Token usage is recorded when the CLI reports it; cost is not measured."]
    (out / "REPORT.md").write_text("\n".join(lines)+"\n")
    cards = []
    for t in trials:
        directory = out / f"{t['case']}-{t['trial']:02d}"
        state = load(directory / "state.json") if (directory / "state.json").exists() else {"attempts": []}
        attempts = []
        for a in state["attempts"]:
            if not a.get("render"):
                continue
            render = out / a["render"]
            manifest = load(render / "manifest.json")
            video = f'<video controls preload="metadata" src="{a["render"]}/video.mp4"></video>' if (render / "video.mp4").exists() else '<p>没有完整视频</p>'
            codes = sorted(set(f["code"] for f in deterministic_findings(manifest)))
            outcome = ", ".join(codes) or ("确定性检查通过" if manifest["status"] == "render_passed" else "检查或执行未通过，见详细记录")
            check_file = "checks.json" if (render / "checks.json").exists() else "manifest.json"
            review_link = f'<a href="{a["render"]}/review.json">审看记录</a>' if (render / "review.json").exists() else "等待审看"
            attempts.append(f'<section><h3>候选 {a["index"]} · {html.escape(manifest["status"])}</h3>{video}'
                            f'<p>{html.escape(outcome)}</p>'
                            f'<a href="{a["render"]}/{check_file}">检查</a> · {review_link}</section>')
        cards.append(f'<article><h2>{t["case"]} {t["trial"]} · {t["status"]}</h2>{"".join(attempts) or "尚未渲染"}</article>')
    (out / "index.html").write_text('''<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<title>Concept2Motion · 生成评测</title><style>
body{background:#0e1521;color:#dce6f6;font:16px system-ui;margin:0;padding:32px}header,main{max-width:1500px;margin:auto}
main{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:24px}article{background:#172235;padding:22px;border-radius:12px}
h1{font-size:30px}h2{font-size:21px}h3{font-size:16px;color:#aabbd4}p{line-height:1.7}video{width:100%;background:#080d15}a{color:#83dcd2}
</style><header><h1>Concept2Motion · 新上下文生成评测</h1>
<p>固定 brief，保留初稿与修订。通过表示确定性检查与采样帧审看通过；最终艺术接受仍待用户判断。</p>
<p><a href="REPORT.md">汇总报告</a> · <a href="summary.json">机器可读结果</a></p></header><main>''' + "".join(cards) + '</main></html>\n')
    return result


def main():
    def interrupted(signum, frame):
        raise KeyboardInterrupt(f"Received signal {signum}")
    signal.signal(signal.SIGTERM, interrupted)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["run", "report"])
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--cases", nargs="+", choices=["softmax", "residual"], default=["softmax", "residual"])
    parser.add_argument("--briefs", type=Path, default=ROOT / "benchmarks/cases.json")
    parser.add_argument("--trials", type=int, default=3)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--codex", default="codex")
    parser.add_argument("--node", default="node")
    parser.add_argument("--model-timeout", type=int, default=600)
    parser.add_argument("--render-timeout", type=int, default=240)
    args = parser.parse_args()
    out = args.out.resolve()
    if args.action == "report":
        with (out / ".lock").open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            print(json.dumps(summarize(out), indent=2)); return
    if not 1 <= args.trials <= 20:
        parser.error("--trials must be between 1 and 20")
    if args.resume:
        config = load(out / "batch.json")
        args.cases, args.trials = config["cases"], config["trials"]
    else:
        initialize(out, args)
    with (out / ".lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        config = load(out / "batch.json")
        verify_frozen(out, config)
        if config.get("coordinator_sha256") and digest(ROOT / "tools/batch.py") != config["coordinator_sha256"]:
            raise ValueError("Coordinator changed; resume using this batch's frozen runtime/tools/batch.py")
        spec = importlib.util.spec_from_file_location("frozen_review", out / "runtime/tools/review_run.py")
        policy = importlib.util.module_from_spec(spec); spec.loader.exec_module(policy)
        try:
            for case in args.cases:
                for number in range(1, args.trials+1):
                    trial(out, case, number, args, policy)
                    summarize(out)
        finally:
            summarize(out)


if __name__ == "__main__":
    main()
