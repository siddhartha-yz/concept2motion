"""Evaluate an isolated upstream renderer and frame sampler with a fixed fixture."""
import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--upstream", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    upstream, out = args.upstream.resolve(), args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(upstream))
    from paper2manim.sandbox.render import render
    from paper2manim.utils.frame_sampler import sample_frames_montage

    source = (ROOT / "benchmarks/fixtures/softmax_manim.py").read_text()
    (out / "candidate.py").write_text(source)
    start = time.monotonic()
    # Deliberate fault injection tests runtime error reporting, not AI repair.
    broken = source.replace("self.camera.background_color", "undefined_symbol.background_color")
    rejected = render(broken, "SharedDenominator", quality="l", workdir=out / "injected-error")
    valid = render(source, "SharedDenominator", quality="l", workdir=out / "valid")
    montage = None
    sample_error = None
    if valid["status"] == "success" and valid["video_path"]:
        shutil.copy2(valid["video_path"], out / "softmax.mp4")
        try:
            montage = str(sample_frames_montage(out / "softmax.mp4", out / "montage.png"))
        except Exception as error:
            sample_error = f"{type(error).__name__}: {error}"
    result = {
        "upstream_commit": subprocess.check_output(["git", "-C", str(upstream), "rev-parse", "HEAD"], text=True).strip(),
        "fixture_sha256": hashlib.sha256(source.encode()).hexdigest(),
        "author": "current Codex session, original fixed fixture",
        "upstream_model_calls": 0,
        "ai_repair_tested": False,
        "live_vlm_tested": False,
        "fault_injection": rejected,
        "valid_render": valid,
        "montage": montage,
        "sample_error": sample_error,
        "wall_seconds": round(time.monotonic() - start, 3),
        "artistic_acceptance": "pending_user_review"
    }
    (out / "result.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if rejected["status"] == "error" and valid["status"] == "success" and montage else 1)


if __name__ == "__main__":
    main()
