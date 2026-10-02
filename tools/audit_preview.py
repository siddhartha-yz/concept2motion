"""Independently probe and fully decode retained studio previews; never edit results."""
import argparse
import hashlib
import json
import math
import os
from fractions import Fraction
from pathlib import Path
import subprocess
import time


def finite(value, name):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{name} must be a finite number")
    return float(value)


def expected_request(request):
    if not isinstance(request, dict):
        raise ValueError("result.request must be an object")
    start, stop = finite(request.get("from"), "from"), finite(request.get("to"), "to")
    fps = finite(request.get("fps"), "fps")
    width = finite(request.get("width"), "width")
    height = finite(request.get("height", width * 9 / 16), "height")
    if not 0 <= start < stop <= 10 or fps <= 0 or fps != int(fps):
        raise ValueError("Invalid interval or fps")
    if width <= 0 or height <= 0 or width != int(width) or height != int(height):
        raise ValueError("Dimensions must be positive integers")
    frame_count = (stop - start) * fps
    if abs(frame_count - round(frame_count)) > 1e-7:
        raise ValueError("Interval must contain an integral number of frames")
    if "frames" in request and request["frames"] != round(frame_count):
        raise ValueError("Request frames disagree with interval and fps")
    return {"width": int(width), "height": int(height), "fps": int(fps),
            "frames": round(frame_count), "duration_s": stop - start,
            "from_s": start, "to_s": stop}


def rate(value):
    try:
        result = float(Fraction(str(value)))
    except (ValueError, ZeroDivisionError, TypeError) as error:
        raise ValueError(f"Invalid frame rate: {value!r}") from error
    if not math.isfinite(result) or result <= 0:
        raise ValueError(f"Invalid frame rate: {value!r}")
    return result


def compare_probe(probe, expected):
    streams = probe.get("streams") if isinstance(probe, dict) else None
    if not isinstance(streams, list) or len(streams) != 1 or not isinstance(streams[0], dict):
        raise ValueError("Probe must contain one selected video stream")
    stream = streams[0]
    try:
        frames = int(stream["nb_read_frames"])
        duration = float(stream.get("duration", probe.get("format", {}).get("duration")))
        width, height = int(stream["width"]), int(stream["height"])
        fps, nominal_fps = rate(stream["avg_frame_rate"]), rate(stream["r_frame_rate"])
    except (KeyError, ValueError, TypeError) as error:
        raise ValueError(f"Incomplete or invalid probe metadata: {error}") from error
    if not math.isfinite(duration) or duration <= 0 or frames <= 0:
        raise ValueError("Invalid duration or decoded frame count")
    observed = {"width": width, "height": height, "fps": fps, "nominal_fps": nominal_fps,
                "frames": frames, "duration_s": duration, "codec": stream.get("codec_name")}
    issues = []
    for field in ("width", "height", "frames"):
        if observed[field] != expected[field]:
            issues.append({"code": f"{field}_mismatch", "expected": expected[field], "observed": observed[field]})
    for field in ("fps", "nominal_fps"):
        if abs(observed[field] - expected["fps"]) > 1e-6:
            issues.append({"code": f"{field}_mismatch", "expected": expected["fps"], "observed": observed[field]})
    if abs(duration - expected["duration_s"]) > 0.002:
        issues.append({"code": "duration_mismatch", "expected": expected["duration_s"], "observed": duration})
    if stream.get("codec_name") != "h264":
        issues.append({"code": "codec_mismatch", "expected": "h264", "observed": stream.get("codec_name")})
    return observed, issues


def check_state_times(path, expected):
    value = json.loads(path.read_text())
    frames = value.get("frames") if isinstance(value, dict) else None
    if not isinstance(frames, list) or len(frames) != expected["frames"]:
        raise ValueError("Saved states frame count disagrees with interval")
    for index, frame in enumerate(frames):
        if not isinstance(frame, dict) or frame.get("frame") != index:
            raise ValueError(f"Saved frame index mismatch at {index}")
        actual = finite(frame.get("time_s"), "frame.time_s")
        wanted = expected["from_s"] + index / expected["fps"]
        if abs(actual - wanted) > 1e-9:
            raise ValueError(f"Source sample time mismatch at frame {index}")
    return {"passed": True, "frames": len(frames), "first_source_time_s": frames[0]["time_s"],
            "last_source_time_s": frames[-1]["time_s"],
            "scope": "Saved source-time schedule, not proof of visible scene content"}


def invoke(command, timeout=90):
    began = time.perf_counter()
    try:
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                text=True, timeout=timeout, check=False)
        return {"exit_code": result.returncode, "wall_s": time.perf_counter() - began,
                "stdout": result.stdout, "stderr": result.stderr[-4000:]}
    except (OSError, subprocess.TimeoutExpired) as error:
        return {"exit_code": None, "wall_s": time.perf_counter() - began,
                "stdout": "", "stderr": str(error), "error": type(error).__name__}


def digest(path):
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def audit_one(video, root, ffmpeg, ffprobe):
    begun = time.perf_counter()
    record = {"video": str(video.relative_to(root)), "passed": False, "findings": []}
    try:
        result_path = video.parent / "result.json"
        result_before = digest(result_path)
        video_before = digest(video)
        result = json.loads(result_path.read_text())
        expected = expected_request(result.get("request"))
        record.update({"expected": expected, "video_sha256": video_before, "result_sha256": result_before})
        if result.get("status") != "preview_ready":
            record["findings"].append({"code": "source_result_not_ready", "status": result.get("status")})
        probe = invoke([ffprobe, "-v", "error", "-select_streams", "v:0", "-count_frames",
                        "-show_entries", "stream=codec_name,width,height,avg_frame_rate,r_frame_rate,nb_read_frames,duration:format=duration",
                        "-of", "json", str(video)])
        record["probe"] = {key: value for key, value in probe.items() if key != "stdout"}
        if probe["exit_code"] != 0:
            record["findings"].append({"code": "probe_failed", "detail": probe["stderr"]})
        else:
            parsed = json.loads(probe["stdout"])
            observed, findings = compare_probe(parsed, expected)
            record["observed"] = observed
            record["probe_metadata"] = parsed
            record["findings"].extend(findings)
        decode = invoke([ffmpeg, "-hide_banner", "-v", "error", "-nostdin", "-xerror", "-i", str(video),
                         "-map", "0:v:0", "-an", "-f", "null", "-"])
        record["decode"] = {key: value for key, value in decode.items() if key != "stdout"}
        record["decode"]["passed"] = decode["exit_code"] == 0
        if decode["exit_code"] != 0:
            record["findings"].append({"code": "full_decode_failed", "detail": decode["stderr"]})
        try:
            record["source_times"] = check_state_times(video.parent / "states.json", expected)
        except (ValueError, OSError, TypeError) as error:
            record["findings"].append({"code": "source_time_check_failed", "detail": str(error)})
        if digest(video) != video_before or digest(result_path) != result_before:
            record["findings"].append({"code": "source_changed_during_audit"})
        record["passed"] = not record["findings"]
    except (ValueError, OSError, TypeError, AttributeError) as error:
        record["findings"].append({"code": "invalid_audit_input", "detail": str(error)})
    record["wall_s"] = time.perf_counter() - begun
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", type=Path, required=True)
    args = parser.parse_args()
    root = args.run.resolve(strict=True)
    if not root.is_dir():
        parser.error("--run must be a directory")
    started = time.perf_counter()
    ffmpeg, ffprobe = os.environ.get("C2M_FFMPEG", "ffmpeg"), os.environ.get("C2M_FFPROBE", "ffprobe")
    videos = sorted(video for video in root.rglob("preview.mp4") if video.parent.name.startswith("preview"))
    records = [audit_one(video, root, ffmpeg, ffprobe) for video in videos]
    report = {"version": 1, "scope": "Independent media decode, metadata and saved source-time schedule; no artistic judgement",
              "run": str(root), "tools": {"ffmpeg": ffmpeg, "ffprobe": ffprobe},
              "previews": records, "passed": bool(records) and all(record["passed"] for record in records),
              "wall_s": time.perf_counter() - started}
    if not records:
        report["error"] = "No preview*/preview.mp4 found"
    (root / "audit.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"audit": str(root / "audit.json"), "previews": len(records), "passed": report["passed"], "wall_s": report["wall_s"]}))
    raise SystemExit(0 if report["passed"] else 1)


if __name__ == "__main__":
    main()
