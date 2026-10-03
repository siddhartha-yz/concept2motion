"""Small frozen reviewer challenge, with held-out labels and repeat accounting."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import math
from pathlib import Path
import subprocess
import time
from types import SimpleNamespace

from batch import digest, model_call, save
from code2video_pilot import CONFIG, environment

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "evaluation/2026-10-02/reviewer-calibration-v1"
WORK = ROOT / "work/reviewer-calibration-v1"
CASES = {
    "K7": {"scene": "ProbeK7", "role": "reference", "support": "demonstrated", "consistency": "consistent", "order": "coherent"},
    "M2": {"scene": "ProbeM2", "role": "text_only", "support": "assertion_only", "consistency": "unverifiable", "order": "unverifiable"},
    "P9": {"scene": "ProbeP9", "role": "wrong_endpoint", "support": "demonstrated", "consistency": "inconsistent", "order": "coherent"},
    "R4": {"scene": "ProbeR4", "role": "shuffled", "support": "demonstrated", "consistency": "consistent", "order": "out_of_order"},
}
FIELDS = {"support": ["demonstrated", "assertion_only", "uncertain"],
          "consistency": ["consistent", "inconsistent", "unverifiable"],
          "order": ["coherent", "out_of_order", "unverifiable"]}
SCHEMA = {"type": "object", "additionalProperties": False, "properties": {
    **{k: {"type": "string", "enum": values} for k, values in FIELDS.items()},
    "reconstructed_mapping": {"type": "string"}, "uncertainty": {"type": "string"},
    "observations": {"type": "array", "items": {"type": "object", "additionalProperties": False,
        "properties": {"time_s": {"type": "number"}, "evidence": {"type": "string"}},
        "required": ["time_s", "evidence"]}}},
    "required": [*FIELDS, "reconstructed_mapping", "uncertainty", "observations"]}
TIMES = [.75, 2.75, 4.75, 6.75, 8.75, 10.75]


def prompt():
    return """This is an authorized visual evaluation experiment. Do not use tools, read files, browse, or delegate. All evidence is in the attached contact sheet, showing six chronological samples from one animation. Output concise Chinese evidence in the structured response. You do not know its source, intended control role, or expected verdict.

Report three separate properties:
support: 'demonstrated' only if diagrams visibly construct the stated operation; 'assertion_only' when only text/formulas state it; 'uncertain' for inadequate evidence. This is geometric support, not a judgement that text instruction cannot teach.
consistency: compare the text with the actual geometric endpoints, coordinate ticks, and component arrows. 'consistent' if they agree, 'inconsistent' if they visibly contradict, 'unverifiable' when no geometric check is possible. Correct formulas alone cannot establish agreement with a missing or wrong diagram.
order: the visible heading declares an input -> basis images -> combine -> result progression. Judge whether the sampled geometric construction follows that declared progression: 'coherent', 'out_of_order', or 'unverifiable' if there is no geometric sequence to check. Do not infer unseen transitions.

Reconstruct the mapping using only visible evidence. Cite exact supplied times. Do not supply a numerical quality score, infer student learning, or fill gaps with prior mathematical knowledge. Small sample coverage and scaling are limitations; explicitly state uncertainty.\n"""


def validate(response):
    for key, values in FIELDS.items():
        if response.get(key) not in values:
            raise ValueError(f"Missing/invalid {key}")
    if not response.get("observations"):
        raise ValueError("Verdict without frame evidence")
    for observation in response["observations"]:
        seconds = observation.get("time_s")
        if (type(seconds) not in (int, float) or not math.isfinite(seconds)
                or min(abs(seconds-t) for t in TIMES) > .01
                or not isinstance(observation.get("evidence"), str) or not observation["evidence"].strip()):
            raise ValueError("Observation must cite a supplied frame")


def prepare():
    import cv2
    from PIL import Image, ImageDraw, ImageFont
    WORK.mkdir(parents=True, exist_ok=False)
    REPORT.mkdir(parents=True, exist_ok=True)
    save(REPORT / "oracle.json", {"cases": CASES, "times_s": TIMES, "repeats": 2,
        "purpose": "synthetic factual-support challenge, not human learning or artistic benchmark",
        "no_claim": "Reference is hand-authored mathematically controlled stimulus, not a validated exemplar of teaching quality",
        "scoring": "exact per-axis labels; missing/failed review is unknown, never accepted; no quality average"})
    (REPORT / "prompt.txt").write_text(prompt())
    save(REPORT / "schema.json", SCHEMA)
    save(WORK / "frozen.json", {"prompt_sha256": digest(REPORT / "prompt.txt"), "schema_sha256": digest(REPORT / "schema.json"),
                              "source_sha256": digest(ROOT / "tools/review_controls_scene.py"), "oracle_sha256": digest(REPORT / "oracle.json")})
    # Separate algebra truth from deliberately incorrect drawing and artistic quality.
    save(REPORT / "math-checks.json", {"input": [1, 2], "matrix": [[2, 1], [0, 1]],
        "column_sum": [2+2, 0+2], "true_result": [4, 2], "wrong_drawn_result": [3, 2],
        "checks": {"column_sum_equals_matrix_product": [2+2, 0+2]==[4,2], "negative_endpoint_differs": [3,2]!=[4,2]},
        "scope": "controlled fixture algebra; deliberate wrong geometry is expected, not a mathematical pass"})
    environment()
    command = ["manim", "-ql", str(ROOT / "tools/review_controls_scene.py"),
               *[c["scene"] for c in CASES.values()], "--media_dir", str(WORK / "media")]
    start = time.monotonic()
    result = subprocess.run(command, capture_output=True, text=True, timeout=180)
    (WORK / "render.stdout.log").write_text(result.stdout)
    (WORK / "render.stderr.log").write_text(result.stderr)
    save(REPORT / "render.json", {"kind": "actual_render_of_hand_authored_controls_no_model_generation", "command": command,
                                  "exit_code": result.returncode, "wall_s": time.monotonic()-start})
    if result.returncode:
        raise RuntimeError("Control render failed; inspect private logs")
    samples = []
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
    for case_id, case in CASES.items():
        video = next((WORK / "media/videos").glob(f"*/480p15/{case['scene']}.mp4"))
        cap = cv2.VideoCapture(str(video))
        fps, count = cap.get(cv2.CAP_PROP_FPS), int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        sheet = Image.new("RGB", (1708, 1524), "#202020")
        frames = []
        directory = WORK / "stimuli" / case_id
        directory.mkdir(parents=True)
        for index, seconds in enumerate(TIMES):
            frame_index = round(seconds*fps)
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
            ok, frame = cap.read()
            if not ok:
                raise RuntimeError(f"Cannot decode {case_id} at {seconds}")
            picture = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            path = directory / f"frame-{index}.png"
            picture.save(path)
            frames.append({"path": str(path.relative_to(ROOT)), "sha256": digest(path), "time_s": seconds,
                           "decoded_frame_time_s": frame_index/fps})
            x, y = index%2*854, index//2*508
            sheet.paste(picture, (x, y+28))
            ImageDraw.Draw(sheet).text((x+8, y+4), f"{case_id}: {seconds:.2f}s", font=font, fill="white")
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        decoded = 0
        while cap.read()[0]:
            decoded += 1
        cap.release()
        if count != decoded or fps != 15 or count != 180:
            raise RuntimeError(f"Unexpected format/duration for {case_id}")
        contact = directory / "contact.png"
        sheet.save(contact)
        samples.append({"id": case_id, "video": str(video.relative_to(ROOT)), "video_sha256": digest(video),
                        "duration_s": count/fps, "decoded_frames": decoded, "frames": frames,
                        "contact": str(contact.relative_to(ROOT)), "contact_sha256": digest(contact)})
    save(REPORT / "stimuli.json", samples)
    print(f"Prepared {len(samples)} controlled clips, 24 frames, 0 model calls")


def check_frozen():
    frozen = json.loads((WORK / "frozen.json").read_text())
    for name, path in (("prompt", REPORT/"prompt.txt"), ("schema", REPORT/"schema.json"),
                       ("source", ROOT/"tools/review_controls_scene.py"), ("oracle", REPORT/"oracle.json")):
        if digest(path) != frozen[name+"_sha256"]:
            raise ValueError(f"Frozen {name} changed; use a new calibration version")
    samples = json.loads((REPORT / "stimuli.json").read_text())
    for sample in samples:
        if digest(ROOT / sample["contact"]) != sample["contact_sha256"]:
            raise ValueError("Stimulus changed after freezing")
    return samples


def run():
    samples = check_frozen()
    config = ['model="gpt-6.1-sol"', *CONFIG]
    save(REPORT / "run-config.json", {"model": "gpt-6.1-sol", "config": config,
        "repeats": 2, "max_workers": 4, "timeout_s": 300,
        "harness_sha256": digest(Path(__file__)), "frozen": json.loads((WORK / "frozen.json").read_text()),
        "input_scope": "one synthetic contact sheet per isolated call; no oracle or source attached"})
    outcomes = []
    def task(sample, repeat):
        directory = WORK / "calls" / f"r{repeat}-{sample['id']}"
        if directory.exists():
            raise ValueError("Cannot silently rerun or omit an existing review")
        record = {"id": sample["id"], "repeat": repeat, "status": "started"}
        try:
            response = model_call(SimpleNamespace(codex="/usr/lib/chatgpt/resources/codex", model_timeout=300,
                                                  codex_config=config), directory,
                                  (REPORT / "prompt.txt").read_text(), SCHEMA,
                                  images=[ROOT/sample["contact"]])
            validate(response)
            process = json.loads((directory / "process.json").read_text())
            record.update(status="reviewed", response=response, process={k: process[k] for k in
                          ("exit_code", "timed_out", "wall_s", "usage", "tool_types")})
        except Exception as exc:
            record.update(status="unknown", error=str(exc))
        save(REPORT / "reviews" / f"r{repeat}-{sample['id']}.json", record)
        return record
    with ThreadPoolExecutor(max_workers=4) as executor:
        pending = [executor.submit(task, sample, repeat) for repeat in (1, 2) for sample in samples]
        for future in as_completed(pending):
            outcomes.append(future.result())
            save(REPORT / "outcomes.json", sorted(outcomes, key=lambda x:(x["id"],x["repeat"])))
    print(f"Finished {len(outcomes)} review attempts; failures kept as unknown")


def summarize():
    records = json.loads((REPORT / "outcomes.json").read_text())
    if len(records) != 8 or {(r['id'],r['repeat']) for r in records} != {(k,r) for k in CASES for r in (1,2)}:
        raise ValueError("Incomplete experiment: every case/repeat must be accounted for")
    counts, per_case = {k:{"matched":0,"mismatched":0,"unknown":0} for k in FIELDS}, []
    for case_id, case in CASES.items():
        group = [r for r in records if r["id"] == case_id]
        for record in group:
            for axis in FIELDS:
                status = "unknown" if record["status"] != "reviewed" else (
                    "matched" if record["response"][axis] == case[axis] else "mismatched")
                counts[axis][status] += 1
        agreement = {axis: (group[0]["response"][axis] == group[1]["response"][axis])
                     if all(r["status"] == "reviewed" for r in group) else None for axis in FIELDS}
        per_case.append({"id":case_id,"role":case["role"],"expected":{k:case[k] for k in FIELDS},"repeat_agreement":agreement})
    false_acceptances = [r for r in records if r['status']=='reviewed' and r['id'] != 'K7'
                         and all(r['response'][axis] == CASES['K7'][axis] for axis in FIELDS)]
    save(REPORT / "summary.json", {"per_axis":counts,"cases":per_case,"false_all_axis_acceptances":len(false_acceptances),
        "screening_only":True,"limits":"4 synthetic stimuli, 2 repeats, one model and prompt. No human learning measure or robust variance estimate. No tuning on these outputs."})


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=["prepare", "run", "summarize"])
    args = parser.parse_args()
    {"prepare": prepare, "run": run, "summarize": summarize}[args.phase]()
