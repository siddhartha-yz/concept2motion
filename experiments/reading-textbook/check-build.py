"""Negative input controls using copied, explicitly synthetic edits."""
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
spec = importlib.util.spec_from_file_location('reading_builder', HERE/'build.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
courses = ROOT/'work/reading-textbook/upstreams/video2book-courses'
records = []

def run(name, action, expected=None):
    try:
        action()
        records.append({'name': name, 'pass': expected is None})
    except ValueError as error:
        records.append({'name': name, 'pass': expected is not None and expected in str(error), 'error': str(error)})

run('fixed real inputs accepted', lambda: builder.frozen_inputs(courses))
with tempfile.TemporaryDirectory(prefix='reading-source-control-', dir=ROOT/'work/reading-textbook') as directory:
    fixture = Path(directory)
    shutil.copy2(HERE/'content.json', fixture/'content.json')
    shutil.copy2(HERE/'bindings.lock.json', fixture/'bindings.lock.json')
    builder.HERE = fixture
    content = json.loads((fixture/'content.json').read_text())
    content['units'][0]['paragraphs'][0]['text'] += ' synthetic edit'
    (fixture/'content.json').write_text(json.dumps(content, ensure_ascii=False))
    run('changed authored paragraph rejected', lambda: builder.frozen_inputs(courses), 'authored content changed')
    shutil.copy2(HERE/'content.json', fixture/'content.json')
    lock = json.loads((HERE/'bindings.lock.json').read_text())
    for source in lock['sources']:
        destination = fixture/source['path']
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(courses/source['path'], destination)
    changed = fixture/lock['sources'][-1]['path']
    changed.write_text(changed.read_text()+'\nSynthetic source edit\n')
    run('changed later source rejected before rendering', lambda: builder.frozen_inputs(fixture), 'source changed')
    changed.unlink()
    run('missing source rejected', lambda: builder.frozen_inputs(fixture), 'source ambiguous or missing')
builder.HERE = HERE
result = {'scope': 'Real frozen inputs plus synthetic tampered-input controls; no model or learning test', 'checks': records, 'passed': sum(r['pass'] for r in records), 'total': len(records)}
out = ROOT/'evaluation/2026-10-10/reading-textbook-v1/raw/build-controls'
out.mkdir(parents=True, exist_ok=True)
(out/'checks.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(result))
raise SystemExit(0 if result['passed'] == result['total'] else 1)
