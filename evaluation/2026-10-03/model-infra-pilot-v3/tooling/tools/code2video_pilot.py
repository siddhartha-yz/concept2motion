"""Bounded diagnostic port of pinned Code2Video; never an original-paper result.

Upstream sources and model logs live in ignored work/. This imports upstream
methods unchanged, substituting official Codex transport and serial rendering.
"""
import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import threading
import time
from types import SimpleNamespace

from batch import model_call, save, digest

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "work/code2video-reproduction"
UPSTREAM = WORK / "upstream"
PIN = "1142d8e14cdc2806df85aedb0fbb5dca474caa0f"
CONFIG = ['model_reasoning_effort="low"',
          'mcp_servers.cua_repl={command="true",enabled=false}',
          'mcp_servers.node_repl={command="true",enabled=false}']
SCHEMA = {"type": "object", "additionalProperties": False,
          "properties": {"content": {"type": "string"}}, "required": ["content"]}


def matching_artifact(source, records, videos):
    """Reuse only a successful render with matching source and video bytes."""
    source_hash = digest(source)
    for record in reversed(records):
        if (record.get("exit_code") != 0 or record.get("interrupted")
                or record.get("source") != source.name
                or record.get("source_sha256") != source_hash
                or not record.get("video_sha256")):
            continue
        for video in videos:
            if digest(video) == record["video_sha256"]:
                return record, video
    return None


def environment():
    tex = WORK / "tex/root"
    tree = tex / "usr/share/texlive/texmf-dist"
    os.environ.update({
        "PATH": f"{WORK / 'venv/bin'}:{tex / 'usr/bin'}:/home/yang-zhi/.local/bin:{os.environ['PATH']}",
        "LD_LIBRARY_PATH": f"{tex / 'usr/lib/x86_64-linux-gnu'}:{os.environ.get('LD_LIBRARY_PATH', '')}",
        "TEXMFCNF": str(tree / "web2c"),
        "TEXMF": "{" + str(tex / "usr/share/texmf") + "," + str(tree) + "}",
        "TEXFORMATS": str(WORK / "tex/formats") + ":",
        "TEXMFVAR": str(WORK / "tex/var"),
        "TEXMFCONFIG": str(WORK / "tex/config"),
    })


def upstream():
    manifest = json.loads((UPSTREAM / "SOURCE_MANIFEST.json").read_text())
    assert manifest["commit"] == PIN
    for item in manifest["files"]:
        assert digest(UPSTREAM / item["path"]) == item["sha256"], item["path"]
    sys.path[:0] = [str(UPSTREAM / "src"), str(UPSTREAM)]
    import agent
    return agent


def agent_for(module, directory, api, tries=2):
    (directory / "assets").mkdir(parents=True, exist_ok=True)
    if not (directory / "json_files").exists():
        shutil.copytree(UPSTREAM / "json_files", directory / "json_files")
    module.api = api  # upstream constructor reads CLI module-global api
    cfg = module.RunConfig(api=api, use_feedback=False, use_assets=False,
                           max_regenerate_tries=tries, max_fix_bug_tries=3)
    return module.TeachingVideoAgent(9, "Linear transformations and matrices",
                                    folder=str(directory / "CASES"), cfg=cfg)


def smoke(module, directory):
    calls = []
    def forbidden(*args, **kwargs):
        calls.append("unexpected_api")
        raise RuntimeError("Fixture forbids model requests")
    obj = agent_for(module, directory, forbidden, tries=1)
    section = module.Section("section_1", "Fixture", [], [])
    source = 'from manim import *\nclass Section1Scene(Scene):\n def construct(self):\n  self.add(Text("A", font_size=32), MathTex(r"A\\mathbf{x}=\\mathbf{y}").shift(DOWN))\n  self.wait(0.2)\n'
    (obj.output_dir / "section_1.py").write_text(source)
    obj.section_codes[section.id] = source
    before = time.monotonic()
    worker = obj.render_section_worker((section, module.TeachingVideoAgent, obj.get_serializable_state()))
    native = {"result": worker, "wall_s": time.monotonic()-before,
              "model_calls": calls.copy(), "source_exists": True,
              "serialized_state_keys": list(obj.get_serializable_state())}
    parent = obj.debug_and_fix_code(section.id, max_fix_attempts=1)
    # Inject a deterministic video-service failure; no external request is sent.
    def unavailable(*args, **kwargs):
        raise RuntimeError("fixture_video_service_unavailable")
    original_video_api = module.request_gemini_video_img
    module.request_gemini_video_img = unavailable
    from PIL import Image
    obj.GRID_IMG_PATH.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (6, 6), "white").save(obj.GRID_IMG_PATH)
    try:
        feedback = obj.get_mllm_feedback(section, obj.section_videos.get(section.id, "missing"))
    finally:
        module.request_gemini_video_img = original_video_api
    result = {"kind": "fixture_workflow_and_actual_fixture_render_not_model_generation",
              "native_worker": native, "parent_actual_render_succeeded": parent,
              "video": obj.section_videos.get(section.id),
              "critic_failure": vars(feedback), "unexpected_api_calls": calls}
    save(directory / "smoke.json", result)
    assert worker[1] is False and parent is True and not calls
    assert feedback.has_issues is False and feedback.raw_response.startswith("Error:")
    return result


def pilot(module, directory, phase, max_calls):
    directory.mkdir(parents=True, exist_ok=True)
    start = time.monotonic()
    state_path = directory / "pilot.json"
    state = json.loads(state_path.read_text()) if state_path.exists() else {
        "upstream": {"url": "https://github.com/showlab/Code2Video", "commit": PIN},
        "kind": "codex_transport_serial_render_no_assets_no_feedback_diagnostic_port",
        "topic": "Linear transformations and matrices", "topic_list_index": 9,
        "differences": ["Codex configured model replaces provider model/API",
                        "structured content envelope; upstream prompt preserved verbatim inside",
                        "requested max_tokens recorded but not enforced by Codex CLI",
                        "upstream supported no_assets/no_feedback ablation",
                        "serial parent methods avoid upstream worker state loss",
                        "bounded 2 regenerations, 3 bug-fix attempts; no paper timing comparison"],
        "codex_config": CONFIG, "calls": [], "renders": [], "phases": [],
        "versions": {k: importlib.metadata.version(k) for k in
                     ("manim", "numpy", "openai", "ManimPango", "pycairo")}}
    save(directory / "brief.json", {"topic": state["topic"], "source_commit": PIN,
                                     "outline_duration_minutes": 5, "selection": "upstream topic index 9"})
    lock = threading.Lock()
    state["generation_workers"] = 6
    state["model_timeout_s"] = 300
    def api(prompt, max_tokens=10000):
        with lock:
            number = len(state["calls"])+1
            if number > max_calls:
                raise RuntimeError("Model-call budget exhausted")
            call_dir = directory / "calls" / f"call-{number:02d}"
            entry = {"id": number, "upstream_prompt_sha256": hashlib.sha256(prompt.encode()).hexdigest(),
                     "requested_max_tokens": max_tokens, "status": "started"}
            state["calls"].append(entry)
            save(state_path, state)
        wrapped = ("This is a source-isolated generation experiment. All material is below. "
                   "Do not use tools, read files, browse, or delegate. Answer the upstream request "
                   "verbatim in the content string of the required JSON envelope.\n\n" + prompt)
        args = SimpleNamespace(codex="/usr/lib/chatgpt/resources/codex", model_timeout=300,
                               codex_config=CONFIG)
        try:
            response = model_call(args, call_dir, wrapped, SCHEMA)
            (call_dir / "upstream-prompt.txt").write_text(prompt)
            process = json.loads((call_dir / "process.json").read_text())
            entry.update(status="completed", wall_s=process["wall_s"], usage=process["usage"],
                         tool_types=process["tool_types"])
            return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=response["content"]))]), None
        except BaseException as exc:
            entry.update(status="failed", error=str(exc))
            raise
        finally:
            with lock:
                save(state_path, state)
    obj = agent_for(module, directory, api)
    original_run = subprocess.run
    def logged_run(command, *args, **kwargs):
        if command[0] != "manim":
            return original_run(command, *args, **kwargs)
        index = len(state["renders"])+1
        attempt = directory / "render-attempts" / f"attempt-{index:02d}"
        attempt.mkdir(parents=True)
        source = Path(kwargs["cwd"]) / command[2]
        shutil.copyfile(source, attempt / source.name)
        started = time.monotonic()
        record = {"attempt": index, "source": source.name,
                  "source_sha256": digest(attempt / source.name), "command": command,
                  "exit_code": None, "timed_out": False}
        try:
            result = original_run(command, *args, **kwargs)
            (attempt / "stdout.log").write_text(result.stdout)
            (attempt / "stderr.log").write_text(result.stderr)
            record.update(exit_code=result.returncode, timed_out=False)
            if result.returncode == 0:
                outputs = sorted((source.parent / "media/videos" / source.stem).glob(f"*/{command[3]}.mp4"),
                                 key=lambda p: p.stat().st_mtime)
                if outputs:
                    shutil.copyfile(outputs[-1], attempt / "video.mp4")
                    record["video_sha256"] = digest(attempt / "video.mp4")
                    if phase == "render-discovered":
                        expected = source.parent / "media/videos" / source.stem / "480p15" / f"{command[3]}.mp4"
                        if outputs[-1].resolve() != expected.resolve():
                            expected.parent.mkdir(parents=True, exist_ok=True)
                            if expected.is_symlink():
                                expected.unlink()
                            if not expected.exists():
                                expected.symlink_to(outputs[-1].resolve())
                                record["artifact_path_alias"] = str(expected)
            return result
        except subprocess.TimeoutExpired as exc:
            def as_text(value):
                return value.decode(errors="replace") if isinstance(value, bytes) else value or ""
            (attempt / "stdout.log").write_text(as_text(exc.stdout))
            (attempt / "stderr.log").write_text(as_text(exc.stderr))
            record.update(exit_code=None, timed_out=True)
            raise
        except BaseException as exc:
            record.update(interrupted=True, error=type(exc).__name__)
            raise
        finally:
            record["wall_s"] = time.monotonic()-started
            state["renders"].append(record)
            save(state_path, state)
    subprocess.run = logged_run
    try:
        obj.generate_outline()
        obj.generate_storyboard()
        if phase in {"generate", "all"}:
            obj.generate_codes()  # upstream's six-thread generation
            if set(obj.section_codes) != {s.id for s in obj.sections}:
                raise RuntimeError("At least one section did not generate code")
        if phase in {"render", "render-discovered", "all"}:
            for section in obj.sections:
                obj.generate_section_code(section)  # loads checkpointed source
                accepted = False
                if phase == "render-discovered":
                    source = obj.output_dir / f"{section.id}.py"
                    videos = sorted((obj.output_dir / "media/videos" / source.stem).glob(
                        f"*/{section.id.title().replace('_', '')}Scene.mp4"), key=lambda p: p.stat().st_mtime)
                    match = matching_artifact(source, state["renders"], videos)
                    if match:
                        previous, video = match
                        obj.section_videos[section.id] = str(video)
                        state.setdefault("discovered_artifact_acceptances", []).append({
                            "section": section.id, "source_sha256": digest(source),
                            "previous_attempt": previous["attempt"], "video": str(video)})
                        accepted = True
                if not accepted:
                    if phase == "render-discovered":
                        alias = obj.output_dir / "media/videos" / section.id / "480p15" / f"{section.id.title().replace('_', '')}Scene.mp4"
                        if alias.is_symlink():
                            alias.unlink()  # a new source must never reuse an old alias
                    obj.render_section(section)
            state["section_videos"] = obj.section_videos
            state["complete_topic_render"] = len(obj.section_videos) == len(obj.sections)
            if phase == "render-discovered":
                state["differences"].append("Separate rescue phase accepts source-matched successfully rendered artifacts outside fixed 480p15 path; mixed-format clips kept separate")
                state["merged_video"] = None
                state["merge_status"] = "not_run_in_rescue_phase; verify stream compatibility before merging"
            else:
                state["merged_video"] = obj.merge_videos() if state["complete_topic_render"] else None
        state["sections"] = [vars(s) for s in obj.sections]
        state["output_dir"] = str(obj.output_dir)
        state["phases"].append({"phase": phase, "wall_s": time.monotonic()-start, "status": "completed"})
    except BaseException as exc:
        state["phases"].append({"phase": phase, "wall_s": time.monotonic()-start,
                                "status": "failed", "error": str(exc)})
        raise
    finally:
        subprocess.run = original_run
        save(state_path, state)
    return state


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=["smoke", "generate", "render", "render-discovered", "all"])
    parser.add_argument("--run", default="pilot-01")
    parser.add_argument("--max-calls", type=int, default=20)
    args = parser.parse_args()
    if not args.run or Path(args.run).name != args.run or args.run in {".", ".."}:
        parser.error("run must be a single directory name")
    environment()
    module = upstream()
    directory = WORK / "runs" / args.run
    result = smoke(module, directory) if args.phase == "smoke" else pilot(module, directory, args.phase, args.max_calls)
    print(json.dumps({k: v for k, v in result.items() if k in
                      {"output_dir", "complete_topic_render", "merged_video", "parent_actual_render_succeeded"}}, indent=2))
