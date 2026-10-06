"""Supplement failed public files, preserve all v1 successes and failure logs."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time

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
    frozen = json.loads((OUT / 'supplement-frozen.json').read_text())
    for row in frozen:
        assert digest(OUT / row['path']) == row['sha256']
    assert not (OUT / 'acquisition-complete-v2.json').exists()
    prior = json.loads((OUT / 'acquisition.json').read_text())
    pin = json.loads((OUT / 'model-pin.json').read_text())
    old = {row['file']: row for row in prior['files']}
    directory = WORK / 'model-supplement'
    directory.mkdir(exist_ok=False)
    def one(item):
        name = item['rfilename']
        assert '/' not in name
        if old[name]['verified']:
            row = dict(old[name], origin='verified-v1', path='model/' + name)
            assert digest(WORK / row['path']) == row['sha256']
            return row
        path = directory / name
        log = WORK / (name + '.curl-v2.log')
        start = time.perf_counter()
        with log.open('w') as output:
            try:
                result = subprocess.run(['curl', '--fail', '--location', '--silent', '--show-error',
                    '--retry', '2', '--retry-all-errors', '--retry-max-time', '600',
                    '--max-time', '600', '--connect-timeout', '30', '--output', str(path),
                    f"https://huggingface.co/{pin['repository']}/resolve/{pin['revision']}/{name}"],
                    stdout=output, stderr=output, timeout=610)
                code, timed_out = result.returncode, False
            except subprocess.TimeoutExpired:
                code, timed_out = None, True
        row = {'file': name, 'exit_code': code, 'timed_out': timed_out,
               'origin': 'supplement-v2', 'path': 'model-supplement/' + name,
               'elapsed_s': time.perf_counter()-start, 'log_sha256': digest(log),
               'bytes': path.stat().st_size if path.exists() else 0, 'verified': False}
        if code == 0 and path.exists():
            row['sha256'] = digest(path)
            expected = item.get('lfs', {}).get('sha256')
            if expected:
                matches = row['sha256'] == expected
            elif item.get('blobId'):
                data = path.read_bytes()
                matches = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() == item['blobId']
            else:
                matches = True
            row['verified'] = row['bytes'] == item['size'] and matches
        print(name, 'verified' if row['verified'] else 'failed', row['bytes'], flush=True)
        return row
    with ThreadPoolExecutor(max_workers=3) as executor:
        rows = list(executor.map(one, pin['files']))
    verified = all(row['verified'] for row in rows)
    if verified:
        complete = WORK / 'model-complete'
        complete.mkdir()
        for row in rows:
            os.link(WORK / row['path'], complete / row['file'])
    result = {'files': rows, 'all_verified': verified, 'v1_records_and_successes_preserved': True,
        'model_revision': pin['revision'], 'authentication_provided': False, 'official_codex_calls': 0}
    (OUT / 'acquisition-complete-v2.json').write_text(json.dumps(result, indent=2)+'\n')
    assert verified, 'No inference on incomplete files'


if __name__ == '__main__':
    main()
