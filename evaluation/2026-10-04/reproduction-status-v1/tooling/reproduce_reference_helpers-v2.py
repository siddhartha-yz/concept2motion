"""Run selected unmodified TEA/PhyEduVideo helpers, without loading models."""
import ast
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import shutil
import tempfile
from typing import Dict, List, Union

import cv2
import numpy as np
from PIL import Image, ImageOps
from moviepy import VideoFileClip

import reference_screening as screen
from batch import save, digest


def definitions(path, names, namespace):
    nodes = [n for n in ast.parse(path.read_text()).body if isinstance(n, ast.FunctionDef) and n.name in names]
    if {n.name for n in nodes} != set(names):
        raise ValueError('Native definition missing')
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(path), 'exec'), namespace)
    return [{'file': str(path.relative_to(screen.ROOT)), 'function': n.name,
             'start_line': n.lineno, 'end_line': n.end_lineno, 'source_sha256': digest(path)} for n in nodes]


def run():
    out = screen.OUT
    frozen = json.loads((out / 'helper-frozen-v2.json').read_text())
    for item in frozen:
        if digest(out / item['path']) != item['sha256']:
            raise ValueError('Frozen helper experiment changed')
    if digest(Path(__file__)) != digest(out / 'tooling/reproduce_reference_helpers-v2.py'):
        raise ValueError('Runtime differs from frozen helper')
    screen.verify_sources()
    screen.verify_pack(screen.PACK, screen.ROOT)
    plan = json.loads((out / 'helper-plan.json').read_text())
    work = screen.ROOT / 'work/reference-helper-v2'
    work.mkdir(exist_ok=False)
    namespace = dict(np=np, cv2=cv2, Image=Image, ImageOps=ImageOps, VideoFileClip=VideoFileClip,
                     os=os, tempfile=tempfile, Dict=Dict, List=List, Union=Union)
    selected = []
    for name, names in [('tea/src/core/parse_video.py', ['image_with_most_non_black_space']),
                        ('tea/eval_suite/image_utils.py', ['extract_key_frames']),
                        ('tea/eval_suite/video_utils.py', ['reduce_video_framerate']),
                        ('phy/scripts/multiimage.py', ['sample_frames', 'get_middle_frame', 'get_video_frame_count'])]:
        selected += definitions(screen.SOURCE / name, names, namespace)
    gm = screen.tea_utils()['calculate_geometric_mean']
    rows = []
    for case in plan['controls'][:4]:
        value = gm(case['input'])
        expected = math.sqrt(15) if case['id'] == 'tea-gm-positive' else case['expected']
        rows.append(dict(case, observed=value, expected_behavior=abs(value-expected) < 1e-10))

    video = screen.ROOT / plan['video']
    cap = cv2.VideoCapture(str(video))
    count, fps = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)), cap.get(cv2.CAP_PROP_FPS)
    # Actual derivative input for the short-video boundary; no new generated animation.
    short = work / 'short-5s.mp4'
    writer = cv2.VideoWriter(str(short), cv2.VideoWriter_fourcc(*'mp4v'), fps,
                             (int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))))
    if not writer.isOpened():
        raise RuntimeError('Short-video fixture codec unavailable')
    for _ in range(75):
        ok, frame = cap.read()
        if not ok: raise RuntimeError('Source video shorter than frozen fixture')
        writer.write(frame)
    writer.release(); cap.release()

    frames = namespace['extract_key_frames'](str(video), str(work / 'tea-keys'), 10)
    clip = VideoFileClip(str(video))
    source_frames = list(clip.iter_frames(fps=1)); clip.close()
    expected_hashes = []
    for i, frame in enumerate(source_frames[:10]):
        p = work / f'expected-{i}.jpg'; Image.fromarray(frame).save(p)
        expected_hashes.append(digest(p))
    actual_hashes = [digest(p) for p in frames]
    rows.append({'id': 'tea-image-ten-chunks', 'source_frames_at_1fps': len(source_frames),
                 'samples': len(frames), 'sampled_times_s': list(range(10)),
                 'excluded_times_s': list(range(10, len(source_frames))),
                 'output_sha256': actual_hashes, 'expected_behavior': actual_hashes == expected_hashes and len(source_frames) == 18})
    try:
        namespace['extract_key_frames'](str(short), str(work / 'tea-short'), 10)
        error = None
    except Exception as e:
        error = type(e).__name__
    rows.append({'id': 'tea-image-short', 'error': error, 'expected_behavior': error == 'ZeroDivisionError'})
    for target in (1, 7, 30):
        ident = f'tea-downsample-{target}'
        try:
            path = namespace['reduce_video_framerate'](str(video), target, str(work / f'down-{target}.mp4'))
            cap = cv2.VideoCapture(path)
            actual_fps = cap.get(cv2.CAP_PROP_FPS); actual_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            decoded = 0
            while cap.read()[0]: decoded += 1
            cap.release()
            expected_count = 18 if target == 1 else 135
            rows.append({'id': ident, 'fps': actual_fps, 'frames': actual_count, 'decoded_frames': decoded,
                         'duration_s': actual_count/actual_fps, 'output_sha256': digest(path),
                         'expected_behavior': target != 30 and actual_count == expected_count and decoded == expected_count})
        except Exception as error:
            rows.append({'id': ident, 'error': type(error).__name__,
                         'expected_behavior': target == 30 and isinstance(error, ZeroDivisionError)})
    sampled = namespace['sample_frames'](str(video), 32)
    indices = [int(index) for _, index in sampled]
    for i, (frame, _) in enumerate(sampled): frame.save(work / f'phy-{i:02}.jpg')
    rows.append({'id': 'phy-sample-32', 'indices': indices, 'samples': len(sampled),
                 'expected_behavior': indices == np.linspace(0, count-1, 32, dtype=int).tolist() and count == 270})
    mid = namespace['get_middle_frame'](str(video))
    cap = cv2.VideoCapture(str(video)); cap.set(cv2.CAP_PROP_POS_FRAMES, 135)
    ok, frame = cap.read(); cap.release()
    rows.append({'id': 'phy-middle', 'index': 135,
                 'expected_behavior': ok and np.array_equal(np.array(mid), cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))})
    missing = namespace['sample_frames'](str(work / 'missing.mp4'), 32)
    rows.append({'id': 'phy-missing-video', 'samples': len(missing), 'expected_behavior': missing == []})

    assets = []
    for project, relative in [('tea', 'data'), ('phy', 'Prompts')]:
        for p in sorted((screen.SOURCE / project / relative).rglob('*.json')):
            data = json.loads(p.read_text())
            asset = {'project': project, 'path': str(p.relative_to(screen.SOURCE / project)),
                     'sha256': digest(p), 'rows': len(data), 'json_type': type(data).__name__}
            if project == 'phy' and isinstance(data, list) and 'concept_id' in data[0]:
                keys = [(r['concept_id'], r['teaching_point_id']) for r in data]
                asset.update(unique_concepts=len({r['concept_id'] for r in data}), unique_teaching_points=len(set(keys)),
                             duplicate_keys=len(keys)-len(set(keys)))
            assets.append(asset)
    screen.verify_sources()
    versions = {}
    for package in ['numpy', 'opencv-python', 'pillow', 'moviepy', 'scipy']:
        try: versions[package] = importlib.metadata.version(package)
        except importlib.metadata.PackageNotFoundError: versions[package] = 'not installed under this package name'
    save(out / 'helper-results-v2.json', {'controls': rows, 'matched': sum(r['expected_behavior'] for r in rows),
         'denominator': len(rows), 'source_video_sha256': digest(video), 'source_frames': count, 'source_fps': fps,
         'selected_native_definitions': selected, 'assets': assets, 'packages': versions,
         'model_calls': 0, 'full_upstream_installation': False, 'generated_animation_renders': 0,
         'actual_video_preprocessing': True, 'neural_metric_scores': None, 'artistic_review': None})


if __name__ == '__main__':
    run()
