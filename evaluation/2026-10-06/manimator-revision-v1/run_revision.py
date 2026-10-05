"""Historical, single-candidate revision; no retry or source repair."""
import ast
import difflib
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
BASE = OUT.parent / 'manimator-port-v1'
WORK = ROOT / 'work/full-reproduction-v1/manimator-revision-v1'
sys.path.insert(0, str(ROOT / 'tools'))
from reference_calls_v2 import invoke


def read(path):
    return json.loads(path.read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(name, data):
    with (OUT / name).open('x') as file:
        file.write(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def verify():
    for row in read(OUT / 'frozen.json'):
        assert sha(OUT / row['path']) == row['sha256']
    for row in read(BASE / 'results-frozen-v1.json'):
        assert sha(BASE / row['path']) == row['sha256']


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def protected_parts(source):
    tree = ast.parse(source)
    main = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'MainScene')
    parts = [n for n in main.body if isinstance(n, ast.Assign)
             or isinstance(n, ast.FunctionDef) and n.name in
             {'construct', 'point', 'signed_area', 'make_geometry'}]
    example = next(n for n in main.body if isinstance(n, ast.FunctionDef) and n.name == 'show_example')
    parts.extend(n for n in example.body if
        isinstance(n, ast.FunctionDef) and n.name == 'current_vertices'
        or isinstance(n, ast.Assign) and ast.unparse(n.targets[0]) == 'self.plane'
        or isinstance(n, ast.Expr) and isinstance(n.value, ast.Call)
        and ast.unparse(n.value.func) == 'self.plane.shift')
    parts.extend(n for n in tree.body if isinstance(n, (ast.Import, ast.ImportFrom)))
    return [ast.dump(n, include_attributes=False) for n in parts]


def patch():
    verify()
    p = read(OUT / 'patch-input.json')
    result = invoke(p['job_id'], p['prompt'], p['schema'], p['model'])
    save('patch-response.json', result)
    if result['status'] != 'completed':
        save('patch-gate.json', {'accepted_for_render': False, 'reason': 'transport failed'})
        return
    code = result['response']['code']
    old = (BASE / 'candidate-sources/candidate-01.py').read_text()
    (OUT / 'candidate-sources').mkdir(exist_ok=True)
    source = OUT / 'candidate-sources/candidate-02.py'
    source.write_text(code)
    edits = sum(line.startswith(('+', '-')) for line in
                difflib.ndiff(old.splitlines(), code.splitlines()))
    differences = ''.join(difflib.unified_diff(old.splitlines(True), code.splitlines(True),
                          fromfile='candidate-01.py', tofile='candidate-02.py'))
    (OUT / 'patch.diff').write_text(differences)
    try:
        load(BASE / 'run_port.py', 'base_port').preflight(code)
        same = protected_parts(old) == protected_parts(code)
        assert same, 'protected AST changed'
        assert edits <= 80, 'over80 changed lines'
        # Guard the unchanged morph schedule in addition to geometry helper AST.
        old_tree, new_tree = ast.parse(old), ast.parse(code)
        morph = lambda tree: [ast.dump(n, include_attributes=False) for n in ast.walk(tree)
            if isinstance(n, ast.Call) and any(isinstance(k.value, ast.Name)
            and k.value.id == 'smooth' for k in n.keywords)]
        assert morph(old_tree) == morph(new_tree), 'morph animation changed'
        old_calls = {ast.unparse(n.func) for n in ast.walk(old_tree) if isinstance(n, ast.Call)}
        new_calls = {ast.unparse(n.func) for n in ast.walk(new_tree) if isinstance(n, ast.Call)}
        added_calls = new_calls - old_calls
        assert all(call.endswith('.set_color') for call in added_calls), 'unexpected new calls'
        save('patch-gate.json', {'accepted_for_render': True, 'source_sha256': sha(source),
            'protected_AST_identical': same, 'changed_lines': edits,
            'morph_identical': True, 'new_calls': sorted(added_calls)})
    except Exception as error:
        save('patch-gate.json', {'accepted_for_render': False, 'reason': str(error),
            'source_sha256': sha(source), 'changed_lines': edits})
    print(read(OUT / 'patch-gate.json'), flush=True)


def render():
    verify()
    gate = read(OUT / 'patch-gate.json')
    if not gate['accepted_for_render']:
        return
    source = OUT / 'candidate-sources/candidate-02.py'
    assert sha(source) == gate['source_sha256']
    WORK.mkdir(parents=True, exist_ok=False)
    upstream = ROOT / 'work/full-reproduction-v1/upstreams/manimator'
    for row in read(BASE / 'source-pin.json')['files']:
        assert sha(upstream / row['path']) == row['sha256']
    sys.path.insert(0, str(upstream))
    import dotenv
    dotenv.load_dotenv = lambda *args, **kwargs: False
    os.environ['LITELLM_LOCAL_MODEL_COST_MAP'] = 'True'
    from manimator.utils.schema import ManimProcessor
    from code2video_pilot import environment
    environment()
    os.environ['PATH'] = str(ROOT / 'work/full-reproduction-v1/manimator-venv/bin') + ':' + os.environ['PATH']
    original_run = subprocess.run
    records = []
    def bounded_run(command, *args, **kwargs):
        adapted = ['-ql' if a == '-pql' else a for a in command]
        start = time.perf_counter()
        result = original_run(adapted, *args, **{**kwargs, 'check': False, 'timeout': 300})
        (WORK / 'render.stdout.log').write_text(result.stdout or '')
        (WORK / 'render.stderr.log').write_text(result.stderr or '')
        records.append({'native_command': command, 'adapted_command': adapted,
                        'exit_code': result.returncode, 'elapsed_seconds': time.perf_counter() - start})
        if result.returncode:
            raise subprocess.CalledProcessError(result.returncode, adapted)
        return result
    try:
        with tempfile.TemporaryDirectory(dir=WORK) as temp:
            processor = ManimProcessor()
            scene_file = processor.save_code(source.read_text(), temp)
            subprocess.run = bounded_run
            try:
                path = processor.render_scene(scene_file, 'MainScene', temp)
            finally:
                subprocess.run = original_run
            if path:
                shutil.copyfile(path, WORK / 'revised.mp4')
                # Native render_scene returns a separate temporary copy.
                Path(path).unlink()
    except Exception as error:
        save('render-result.json', {'rendered': False, 'records': records, 'reason': type(error).__name__})
        raise
    video = WORK / 'revised.mp4'
    save('render-result.json', {'rendered': video.exists(), 'records': records,
        'video': str(video.relative_to(ROOT)) if video.exists() else None,
        'video_sha256': sha(video) if video.exists() else None})
    probe = load(BASE / 'check_geometry.py', 'base_geometry')
    probe.SOURCE = source
    probe.EXPECTED_SHA = sha(source)
    probe.OUT = OUT
    probe.main()


if __name__ == '__main__':
    globals()[sys.argv[1]]()
