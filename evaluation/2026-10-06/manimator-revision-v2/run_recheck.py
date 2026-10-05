"""Recheck the unchanged v1 candidate; normalized callable identity only."""
import ast
import difflib
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
V1 = OUT.parent / 'manimator-revision-v1'
BASE = OUT.parent / 'manimator-port-v1'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify():
    for directory, name in [(OUT, 'frozen.json'), (V1, 'results-frozen-v1.json'),
                            (BASE, 'results-frozen-v1.json')]:
        for row in json.loads((directory / name).read_text()):
            assert sha(directory / row['path']) == row['sha256']


def call_names(code):
    tree = ast.parse(code)
    names = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            func = node.func
            if isinstance(func, ast.Name):
                names.add(('name', func.id))
            elif isinstance(func, ast.Attribute):
                names.add(('attribute', func.attr))
            else:
                names.add(('other', ast.dump(func, include_attributes=False)))
    return names


def load_parent():
    spec = importlib.util.spec_from_file_location('v1_runner', V1 / 'run_revision.py')
    parent = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(parent)
    return parent


def gate():
    verify()
    parent = load_parent()
    old = (BASE / 'candidate-sources/candidate-01.py').read_text()
    source = OUT / 'candidate-sources/candidate-02.py'
    new = source.read_text()
    assert sha(source) == sha(V1 / 'candidate-sources/candidate-02.py')
    controls = {'changed_MathTex_arguments_allowed':
        call_names('MathTex("x",font_size=24).move_to(x)') ==
        call_names('MathTex("x",font_size=28).move_to(x)'),
        'new_open_call_detected':
        bool(call_names('MathTex("x");open("test")') - call_names('MathTex("x")'))}
    assert all(controls.values())
    parent.load(BASE / 'run_port.py', 'base_port').preflight(new)
    assert parent.protected_parts(old) == parent.protected_parts(new)
    changed = sum(line.startswith(('+', '-')) for line in
                  difflib.ndiff(old.splitlines(), new.splitlines()))
    assert changed <= 80
    morph = lambda code: [ast.dump(n, include_attributes=False) for n in ast.walk(ast.parse(code))
        if isinstance(n, ast.Call) and any(isinstance(k.value, ast.Name)
        and k.value.id == 'smooth' for k in n.keywords)]
    assert morph(old) == morph(new)
    assert not call_names(new) - call_names(old)
    with (OUT / 'patch-gate.json').open('x') as file:
        file.write(json.dumps({'accepted_for_render': True, 'source_sha256': sha(source),
            'candidate_unchanged_from_v1': True, 'protected_AST_identical': True,
            'morph_identical': True, 'changed_lines': changed,
            'normalized_new_call_names': [], 'mock_guard_controls': controls}, indent=2) + '\n')
    print('same candidate passed corrected gate', flush=True)


def render():
    verify()
    parent = load_parent()
    # Explicit output relocation; no mutation of the historical v1 source.
    parent.OUT = OUT
    parent.WORK = ROOT / 'work/full-reproduction-v1/manimator-revision-v2'
    parent.verify = verify
    parent.render()


if __name__ == '__main__':
    globals()[sys.argv[1]]()
