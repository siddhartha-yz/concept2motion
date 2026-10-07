"""Original VideoScore regression/selection protocol, explicit device adaptation."""
import ast
from contextlib import contextmanager
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import sys
from threading import Timer
import time
from typing import List

ROOT = Path(__file__).resolve().parents[3]
BASE = Path(__file__).resolve().parent
FROZEN_INPUT = ROOT / 'evaluation/2026-10-07/videoscore-validation-v1'
OUT = BASE / 'repeat' if '--repeat' in sys.argv else BASE
OUT.mkdir(exist_ok=True)
NATIVE = ROOT / 'evaluation/2026-10-06/videoscore-native-v1'
WORK = ROOT / 'work/videoscore-validation-v2'
WORK.mkdir(exist_ok=True)
MODEL = ROOT / 'work/full-reproduction-v1/videoscore-native-v1/model-complete-v3'
UPSTREAM = ROOT / 'work/full-reproduction-v1/upstreams/VideoScore'
os.environ.update(HF_HUB_DISABLE_IMPLICIT_TOKEN='1', HF_HUB_OFFLINE='1',
                  TRANSFORMERS_OFFLINE='1', HF_HOME=str(WORK / 'hf-cache'),
                  TOKENIZERS_PARALLELISM='false')


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as file:
        for block in iter(lambda: file.read(4*1024**2), b''):
            value.update(block)
    return value.hexdigest()


def save(name, data):
    with (OUT / name).open('x') as file:
        file.write(json.dumps(data, indent=2, allow_nan=False) + '\n')


@contextmanager
def bounded(stage):
    def expire():
        save(stage + '-timeout.json', {'stage': stage, 'timeout_s': 600})
        os._exit(124)
    timer = Timer(600, expire)
    timer.daemon = True
    timer.start()
    try:
        yield
    finally:
        timer.cancel()


def main():
    assert not (OUT / 'inference-results.json').exists(), 'New version required'
    for row in json.loads((BASE / 'runner-frozen.json').read_text()):
        assert digest(BASE / row['path']) == row['sha256']
    for row in json.loads((FROZEN_INPUT / 'preflight-frozen.json').read_text()):
        assert digest(FROZEN_INPUT / row['path']) == row['sha256']
    acquisition = json.loads((NATIVE / 'acquisition-complete-v3.json').read_text())
    assert acquisition['all_verified']
    for row in acquisition['files']:
        path = MODEL / row['file']
        assert path.stat().st_size == row['bytes']
        assert digest(path) == row['sha256']
    implementation = json.loads((NATIVE / 'implementation-pin.json').read_text())
    example = UPSTREAM / 'examples/run_videoscore.py'
    assert digest(example) == implementation['native_example_sha256']
    import av
    import numpy as np
    from PIL import Image
    import torch
    from transformers import AutoProcessor
    from mantis.models.idefics2 import Idefics2ForSequenceClassification
    import mantis.models.idefics2.modeling_idefics2 as original_model
    assert digest(Path(original_model.__file__)) == implementation['modeling_idefics2_sha256']
    assert torch.cuda.is_available(), 'No GPU; no silent CPU-only protocol fallback'
    tree = ast.parse(example.read_text())
    helper = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == '_read_video_pyav')
    prompt = next(ast.literal_eval(n.value) for n in tree.body if isinstance(n, ast.Assign)
                  and any(isinstance(t, ast.Name) and t.id == 'REGRESSION_QUERY_PROMPT' for t in n.targets))
    versions = {name: importlib.metadata.version(name) for name in
                ['torch', 'torchvision', 'transformers', 'accelerate', 'av', 'mantis-vl', 'numpy', 'datasets']}
    save('runtime.json', {'python': sys.version, 'packages': versions,
        'mantis_source_hash_verified': True, 'weights_hash_verified_before_load': True,
        'offline': True, 'GPU': torch.cuda.get_device_name(0),
        'GPU_total_bytes': torch.cuda.get_device_properties(0).total_memory})
    start = time.perf_counter()
    try:
        with bounded('load'):
            processor = AutoProcessor.from_pretrained(str(MODEL), local_files_only=True, torch_dtype=torch.bfloat16)
            model = Idefics2ForSequenceClassification.from_pretrained(
                str(MODEL), local_files_only=True, torch_dtype=torch.bfloat16,
                device_map='auto', max_memory={0: '4GiB', 'cpu': '14GiB'},
                low_cpu_mem_usage=True, offload_folder=str(WORK / 'offload')).eval()
        save('load-result.json', {'loaded': True, 'wall_s': time.perf_counter()-start,
            'device_map': {k: str(v) for k, v in model.hf_device_map.items()},
            'parameters': sum(p.numel() for p in model.parameters()),
            'parameter_dtypes': sorted({str(p.dtype) for p in model.parameters()}),
            'weight_updates': 0, 'quantized': False})
    except Exception as error:
        save('load-result.json', {'loaded': False, 'wall_s': time.perf_counter()-start,
            'error_type': type(error).__name__, 'error': str(error)})
        raise
    rows = []
    cases = json.loads((FROZEN_INPUT / ('repeat-inputs-v2.json' if '--repeat' in sys.argv else 'inputs-v2.json')).read_text())
    for case in cases:
        ident = case['id']
        start = time.perf_counter()
        try:
            with bounded(ident):
                video = ROOT / case['video']
                assert digest(video) == case['video_sha256']
                container = av.open(str(video))
                total = container.streams.video[0].frames
                indices = np.arange(0, total, total/case['max_frames']).astype(int) if total > case['max_frames'] else np.arange(total)
                context = {'List': List, 'np': np, 'container': container, 'indices': indices}
                exec(compile(ast.Module(body=[helper], type_ignores=[]), str(example), 'exec'), context)
                frames = [Image.fromarray(x) for x in context['_read_video_pyav'](container, indices)]
                container.close()
                assert len(frames) == case['expected_selected_frames']
                frame_dir = WORK / ident
                frame_dir.mkdir()
                evidence = []
                for i, frame in enumerate(frames):
                    path = frame_dir / f'frame-{i:03}.png'
                    frame.save(path)
                    evidence.append({'index': int(indices[i]), 'sha256': digest(path)})
                eval_prompt = prompt.format(text_prompt=case['prompt'])
                num_image_token = eval_prompt.count('<image>')
                if num_image_token < len(frames):
                    eval_prompt += '<image> ' * (len(frames)-num_image_token)
                inputs = processor(text=eval_prompt, images=frames, return_tensors='pt')
                tensors = {k: {'shape': list(v.shape), 'dtype': str(v.dtype),
                    'sha256': hashlib.sha256(v.contiguous().view(torch.uint8).numpy().tobytes()).hexdigest()}
                    for k, v in inputs.items()}
                inputs = {k: v.to(model.device) for k, v in inputs.items()}
                torch.cuda.reset_peak_memory_stats()
                with torch.no_grad():
                    outputs = model(**inputs, use_cache=False)
                logits = outputs.logits[0].float().cpu().tolist()
                assert len(logits) == 5 and all(math.isfinite(x) for x in logits)
                result = {'id': ident, 'status': 'completed', 'total_video_frames': total,
                    'sample_indices': indices.tolist(), 'sampled_frame_hashes': evidence,
                    'processed_input_tensors': tensors, 'logits': logits,
                    'rounded_aspect_scores': [round(x, 3) for x in logits],
                    'wall_s': time.perf_counter()-start,
                    'GPU_peak_allocated_bytes': torch.cuda.max_memory_allocated(),
                    'GPU_peak_reserved_bytes': torch.cuda.max_memory_reserved()}
                save(ident + '-result.json', result)
                rows.append(result)
                del inputs, outputs, frames
                print(ident, result['rounded_aspect_scores'], flush=True)
        except Exception as error:
            result = {'id': ident, 'status': 'failed', 'error_type': type(error).__name__,
                      'error': str(error), 'wall_s': time.perf_counter()-start}
            save(ident + '-result.json', result)
            rows.append(result)
            break
    save('inference-results.json', {'rows': rows,
        'unexecuted': [case['id'] for case in cases if case['id'] not in {row['id'] for row in rows}],
        'model_revision': '0731e98e15f8c06a3e3b4dc6c7a4b8d866f22a89',
        'aspects': ['visual_quality', 'temporal_consistency', 'dynamic_degree', 'text_to_video_alignment', 'factual_consistency'],
        'author_published_example_reference': [2.328, 2.484, 2.562, 1.969, 2.594],
        'original_protocol_changes': ['auto GPU/CPU weight placement', 'disable single-forward KV cache', 'fixed local files/version', 'PyAV13.1 after14.4 install failure'],
        'official_codex_calls': 0, 'weight_updates': 0,
        'limits': 'Controlled defect sensitivity; hand-authored mathematical truths, no human overall quality or paper correlation replication.'})


if __name__ == '__main__':
    main()
    if any(r['status'] != 'completed' for r in json.loads((OUT / 'inference-results.json').read_text())['rows']):
        sys.exit(1)
