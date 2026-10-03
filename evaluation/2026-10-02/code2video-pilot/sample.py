"""Deterministic decoded-frame sampling for this diagnostic experiment only."""
import hashlib
import json
from pathlib import Path
import sys

import cv2
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
RUN = ROOT / "work/code2video-reproduction/runs" / (sys.argv[1] if len(sys.argv) > 1 else "pilot-01")
OUT = RUN / "samples"
OUT.mkdir(exist_ok=True)
STATE = json.loads((RUN / "pilot.json").read_text())
SCENES = next((RUN / "CASES").iterdir())
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
records = []
for i in range(1, 7):
    section = f"section_{i}"
    videos = sorted((SCENES / "media/videos" / section).glob(f"*/Section{i}Scene.mp4"),
                    key=lambda p: p.stat().st_mtime)
    if not videos:
        records.append({"section": section, "status": "no_video", "frames": []})
        continue
    video = videos[-1]
    cap = cv2.VideoCapture(str(video))
    fps = cap.get(cv2.CAP_PROP_FPS)
    count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    assert fps > 0 and count > 0, video
    indices = [round((count-1)*fraction) for fraction in (.04, .20, .38, .56, .76, .94)]
    sheet = Image.new("RGB", (1708, 3*508), "#202020")
    frames = []
    for j, index in enumerate(indices):
        cap.set(cv2.CAP_PROP_POS_FRAMES, index)
        ok, frame = cap.read()
        assert ok, (video, index)
        picture = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        path = OUT / f"{section}-frame-{index:05d}.png"
        picture.save(path)
        frames.append({"index": index, "time_s": index/fps,
                       "path": str(path.relative_to(ROOT)),
                       "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
        picture.thumbnail((854, 480))
        px, py = (j % 2)*854, (j // 2)*508
        sheet.paste(picture, (px+(854-picture.width)//2, py+28+(480-picture.height)//2))
        ImageDraw.Draw(sheet).text((px+8, py+4), f"{section}: {index/fps:.2f}s", font=font, fill="white")
    # Decode every frame independently: container metadata alone is insufficient.
    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
    decoded = 0
    while cap.read()[0]:
        decoded += 1
    width, height = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()
    assert decoded == count, (video, decoded, count)
    contact = OUT / f"{section}-contact.png"
    sheet.save(contact)
    source = SCENES / f"{section}.py"
    records.append({"section": section, "status": "video_decoded", "video": str(video.relative_to(ROOT)),
                    "video_sha256": hashlib.sha256(video.read_bytes()).hexdigest(),
                    "source": str(source.relative_to(ROOT)),
                    "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                    "registered_in_final_port": section in STATE.get("section_videos", {}),
                    "width": width, "height": height, "fps": fps, "frame_count": count,
                    "duration_s": count/fps, "decoded_frames": decoded,
                    "frames": frames, "contact": str(contact.relative_to(ROOT))})
result = {"run": str(RUN.relative_to(ROOT)), "frame_selection_fractions": [.04,.20,.38,.56,.76,.94],
          "scope": "six deterministic stills per section; not full motion review", "sections": records,
          "total_duration_s": sum(s.get("duration_s", 0) for s in records)}
(OUT / "samples.json").write_text(json.dumps(result, indent=2)+"\n")
print(json.dumps({"sections": len(records), "duration_s": result["total_duration_s"]}))
