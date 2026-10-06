"""Combine only verified immutable v1/v2/v3 files; no inference here."""
import hashlib
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
WORK = ROOT / 'work/full-reproduction-v1/videoscore-native-v1'


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as file:
        for block in iter(lambda: file.read(4*1024**2), b''):
            value.update(block)
    return value.hexdigest()


def main():
    assert not (OUT / 'acquisition-complete-v3.json').exists()
    prior = json.loads((OUT / 'acquisition-complete-v2.json').read_text())
    last = json.loads((OUT / 'shard4-acquisition-v3.json').read_text())
    rows = [last if row['file'] == last['file'] else row for row in prior['files']]
    pin = json.loads((OUT / 'model-pin.json').read_text())
    assert len(rows) == len(pin['files']) == 15
    for row in rows:
        assert row['verified'], 'Incomplete files; no assembly or inference'
        path = WORK / row['path']
        assert path.stat().st_size == row['bytes']
        assert digest(path) == row['sha256']
    complete = WORK / 'model-complete-v3'
    complete.mkdir(exist_ok=False)
    for row in rows:
        os.link(WORK / row['path'], complete / row['file'])
    result = {'model_revision': pin['revision'], 'files': rows, 'all_verified': True,
        'v1_v2_failure_records_preserved': True, 'auth_provided': False,
        'combined_directory': str(complete.relative_to(ROOT)), 'official_codex_calls': 0}
    (OUT / 'acquisition-complete-v3.json').write_text(json.dumps(result, indent=2)+'\n')
    print('all15 fixed files verified, ready for native inference', flush=True)


if __name__ == '__main__':
    main()
