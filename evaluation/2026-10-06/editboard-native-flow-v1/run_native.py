"""Unmodified EditBoard CLI and separate native scalar boundary controls."""
import ast
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
SOURCE = ROOT / 'work/full-reproduction-v1/upstreams/EditBoard'
WORK = ROOT / 'work/full-reproduction-v1/editboard-native-flow-v1'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def clean(value):
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items()}
    if isinstance(value, list):
        return [clean(v) for v in value]
    if isinstance(value, np.generic):
        value = value.item()
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def save(name, value):
    with (OUT / name).open('x') as file:
        file.write(json.dumps(clean(value), indent=2, allow_nan=False) + '\n')


def run(command, name, timeout=180):
    env = dict(os.environ, EDITBOARD_CACHE_DIR=str(WORK / 'cache'), CUDA_VISIBLE_DEVICES='')
    start = time.perf_counter()
    result = subprocess.run(command, cwd=SOURCE, env=env, capture_output=True, text=True, timeout=timeout)
    (WORK / f'{name}.stdout.log').write_text(result.stdout)
    (WORK / f'{name}.stderr.log').write_text(result.stderr)
    return {'exit_code': result.returncode, 'elapsed_s': time.perf_counter() - start,
            'stdout_sha256': sha(WORK / f'{name}.stdout.log'),
            'stderr_sha256': sha(WORK / f'{name}.stderr.log')}


def main():
    assert not (OUT / 'results.json').exists(), 'New version required'
    for row in json.loads((OUT / 'design-frozen.json').read_text()):
        assert sha(OUT / row['path']) == row['sha256']
    for row in json.loads((OUT / 'source-pin.json').read_text())['files']:
        assert sha(SOURCE / row['path']) == row['sha256']
    WORK.mkdir(exist_ok=True)
    fixtures = WORK / 'inputs'
    fixtures.mkdir()
    controls = json.loads((OUT / 'inputs.json').read_text())['controls']
    exports = []
    for control in controls:
        directory = fixtures / control['name']
        directory.mkdir()
        for side in ('original', 'edited'):
            video = directory / f'{side}.mp4'
            writer = cv2.VideoWriter(str(video), cv2.VideoWriter_fourcc(*'mp4v'), 8, (512, 512))
            assert writer.isOpened()
            for i in range(8):
                if control['name'] == 'static-identical':
                    frame = np.full((512, 512, 3), 64, np.uint8)
                else:
                    frame = np.full((512, 512, 3), 32, np.uint8)
                    x = 152 - 8*i if control['name'] == 'moving-reversed' and side == 'edited' else 96 + 8*i
                    frame[160:256, x:x+96] = 224
                writer.write(frame)
            writer.release()
        record = run([sys.executable, str(SOURCE / 'preprocess.py'), '--input_path', str(directory),
                      '--output_path', str(directory / 'frames')], control['name'] + '-preprocess')
        counts = {side: len(list((directory / 'frames' / side).glob('*.png'))) for side in ('original', 'edited')}
        assert record['exit_code'] == 0 and counts == {'original': 8, 'edited': 8}
        exports.append(dict(name=control['name'], encoded_frames_per_video=8, decoded_frame_counts=counts,
            preprocess=record, video_hashes={side: sha(directory / f'{side}.mp4') for side in ('original', 'edited')}))
    pairs = [('upstream-bear-white', SOURCE / 'sample/bear', SOURCE / 'sample/bear_white')]
    pairs += [(c['name'], fixtures / c['name'] / 'frames/original', fixtures / c['name'] / 'frames/edited') for c in controls]
    cli = []
    for name, original, edited in pairs:
        output = WORK / 'outputs' / name
        record = run([sys.executable, str(SOURCE / 'evaluate.py'), '--dimension', 'ff_alpha', 'ff_beta',
            '--original_video_path', str(original), '--edited_video_path', str(edited),
            '--output_path', str(output), '--result_name', name], name)
        result_file = output / f'{name}_eval_results.json'
        record.update(name=name, native_results=json.loads(result_file.read_text()) if result_file.exists() else None)
        cli.append(record)
        print(name, record['exit_code'], flush=True)
    # Exact native modules, not AST-rewritten formula substitutes.
    sys.path.insert(0, str(SOURCE))
    os.environ['EDITBOARD_CACHE_DIR'] = str(WORK / 'cache')
    from editboard.ff_alpha import calculate_ff_alpha
    from editboard.ff_beta import ff_beta_for_one
    zero = np.zeros((256, 256, 3), dtype=np.uint8)
    full = np.zeros((512, 512, 3), dtype=np.uint8)
    invalid_warp = np.full_like(full, 255)
    no_valid = calculate_ff_alpha(full, invalid_warp, full, full)
    vector = np.ones((4, 4, 2), dtype=np.float32)
    zflow = np.zeros_like(vector)
    scalar = {'alpha_256_identical': list(calculate_ff_alpha(zero, zero, zero, zero)),
              'alpha_no_valid_pixels': list(no_valid), 'alpha_no_valid_finite': bool(np.isfinite(no_valid[0])),
              'beta_zero_zero': ff_beta_for_one(zflow, zflow),
              'beta_same_nonzero': ff_beta_for_one(vector, vector),
              'beta_opposite_nonzero': ff_beta_for_one(vector, -vector)}
    single = fixtures / 'single-frame'
    single.mkdir()
    cv2.imwrite(str(single / 'frame_0000.png'), full)
    failures = []
    for dimension in ['ff_alpha', 'ff_beta']:
        record = run([sys.executable, str(SOURCE / 'evaluate.py'), '--dimension', dimension,
            '--original_video_path', str(single), '--edited_video_path', str(single),
            '--output_path', str(WORK / 'outputs/single-frame'), '--result_name', dimension], 'single-' + dimension)
        record.update(dimension=dimension, boundary='one-frame input')
        failures.append(record)
    frame_hashes = [{'path': str(p.relative_to(ROOT)), 'sha256': sha(p)}
                    for p in sorted(fixtures.rglob('*.png'))]
    save('results.json', {'original_cli': cli, 'control_video_exports': exports,
        'scalar_native_controls': scalar, 'single_frame_cli': failures,
        'decoded_control_frame_hashes': frame_hashes, 'model_calls': 0,
        'weight_fetch_requests': 0, 'source_changed': bool(subprocess.check_output(
            ['git', 'diff', '--name-only'], cwd=SOURCE, text=True).strip()),
        'device': 'native CLI forced CPU; Farneback optical flow itself is OpenCV CPU',
        'limits': '2/9 original dimensions; published sample frames, hand-coded controls, no model generation, learned metrics, full paper comparisons or human correlation.'})
    print(json.dumps(clean(scalar)), flush=True)


if __name__ == '__main__':
    main()
