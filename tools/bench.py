"""Prepare small mechanism benchmarks without provider or renderer dependencies."""
import argparse
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def softmax(values):
    maximum = max(values)
    masses = [math.exp(x - maximum) for x in values]
    return [x / math.fsum(masses) for x in masses]


def check(case):
    data = case["inputs"]
    if case["id"] == "softmax":
        p = softmax(data["logits"])
        shifted = softmax([x + 1000 for x in data["logits"]])
        error = max(abs(a - b) for a, b in zip(p, shifted))
        ok = abs(math.fsum(p) - 1) < 1e-12 and min(p) > 0 and error < 1e-12
        return {"passed": ok, "probabilities": p, "sum": math.fsum(p), "shift_error": error}
    if case["id"] == "residual":
        x, residual = data["x"], data["residual"]
        y = [a + b for a, b in zip(x, residual)]
        ok = all(abs(a - b - c) < 1e-12 for a, b, c in zip(y, x, residual))
        return {"passed": ok, "output": y, "zero_residual_output": [a + 0 for a in x]}
    old, candidate, gate = data["previous"], data["candidate"], data["update_gate"]
    y = [(1 - z) * a + z * b for a, b, z in zip(old, candidate, gate)]
    ok = all(0 <= z <= 1 and min(a, b) - 1e-12 <= c <= max(a, b) + 1e-12
             for a, b, c, z in zip(old, candidate, y, gate))
    return {"passed": ok, "output": y, "z0_output": old, "z1_output": candidate,
            "convention": "h = (1-z)*previous + z*candidate"}


def prepare(case, out):
    out.mkdir(parents=True, exist_ok=True)
    (out / "brief.json").write_text(json.dumps(case, indent=2) + "\n")
    (out / "math-reference.json").write_text(json.dumps(check(case), indent=2) + "\n")
    prompt = f"""Create a {case['duration_s']}-second silent mathematical animation for this benchmark.
Work only in this candidate directory: {out.resolve()}
Read the repository AGENTS.md and docs/architecture.md. Do not spawn agents.

Mechanism: {case['mechanism']}
Inputs: {json.dumps(case['inputs'])}
Visual requirements: {json.dumps(case['visual_checks'])}
Use stable object identities, minimal text, a dark background and intentional continuous motion.
Choose an available renderer and record the choice and versions. If unavailable, report the
dependency limitation; do not report a skipped render as success. Use deterministic frame time.
Begin with a short storyboard. Save source, attempt metadata, numerical outputs and rendered video.
Check the actual implemented numerical outputs against math-reference.json. The reference check
alone does not validate an animation. Sample at least four frames spanning the mechanism and inspect
them visually. Keep render errors separate from visual errors. Allow at most two technical repairs
and two visual revisions, retaining prior attempts. Write review.json with evidence and timestamps,
revision count, human interventions, renderer checks and unresolved issues. Do not equate render
success with artistic acceptance. Leave artistic_acceptance as pending_user_review.
"""
    (out / "prompt.md").write_text(prompt)
    return {"case": case["id"], "directory": str(out), "model_called": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["list", "check", "prepare"])
    parser.add_argument("case", nargs="?")
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    cases = json.loads((ROOT / "benchmarks/cases.json").read_text())
    if args.action == "list":
        print("\n".join(f"{c['id']}: {c['title']}" for c in cases))
        return
    if args.action == "check":
        results = {c["id"]: check(c) for c in cases}
        print(json.dumps(results, indent=2))
        raise SystemExit(0 if all(c["passed"] for c in results.values()) else 1)
    case = next((c for c in cases if c["id"] == args.case), None)
    if case is None:
        parser.error("prepare requires one of: " + ", ".join(c["id"] for c in cases))
    print(json.dumps(prepare(case, args.out or ROOT / "runs" / case["id"]), indent=2))


if __name__ == "__main__":
    main()
