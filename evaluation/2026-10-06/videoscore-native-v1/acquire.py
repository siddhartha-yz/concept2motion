"""Pinned public files only; no authentication or provider API."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
WORK = ROOT / 'work/full-reproduction-v1/videoscore-native-v1'
MODEL = WORK / 'model'


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as file:
        for block in iter(lambda: file.read(4 * 1024**2), b''):
            value.update(block)
    return value.hexdigest()


def main():
    for row in json.loads((OUT / 'design-frozen.json').read_text()):
        assert digest(OUT / row['path']) == row['sha256']
    assert not (OUT / 'acquisition.json').exists(), 'New acquisition version required'
    MODEL.mkdir(exist_ok=True)
    pin = json.loads((OUT / 'model-pin.json').read_text())
    def one(item):
        name = item['rfilename']
        assert '/' not in name
        path = MODEL / name
        log = WORK / (name + '.curl.log')
        start = time.perf_counter()
        with log.open('w') as output:
            try:
                result = subprocess.run(['curl', '--fail', '--location', '--silent', '--show-error',
                    '--retry', '2', '--retry-max-time', '600', '--max-time', '600',
                    '--connect-timeout', '30', '--output', str(path),
                    f"https://huggingface.co/{pin['repository']}/resolve/{pin['revision']}/{name}"],
                    stdout=output, stderr=output, timeout=610)
                code, timed_out = result.returncode, False
            except subprocess.TimeoutExpired:
                code, timed_out = None, True
        row = {'file': name, 'exit_code': code, 'timed_out': timed_out,
               'elapsed_s': time.perf_counter() - start, 'log_sha256': digest(log),
               'bytes': path.stat().st_size if path.exists() else 0}
        expected_sha = item.get('lfs', {}).get('sha256')
        if code == 0 and path.exists():
            row['sha256'] = digest(path)
            row['size_matches'] = path.stat().st_size == item['size']
            row['lfs_sha256_matches'] = row['sha256'] == expected_sha if expected_sha else None
            if not expected_sha and item.get('blobId'):
                data = path.read_bytes()
                row['git_blob_matches'] = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() == item['blobId']
            row['verified'] = row['size_matches'] and (
                row['lfs_sha256_matches'] if expected_sha else row.get('git_blob_matches', True))
        else:
            row['verified'] = False
        print(name, row['bytes'], 'verified' if row['verified'] else 'failed', flush=True)
        return row
    with ThreadPoolExecutor(max_workers=3) as executor:
        rows = list(executor.map(one, pin['files']))
    result = {'model_revision': pin['revision'], 'files': rows,
              'all_verified': all(row['verified'] for row in rows),
              'authentication_provided': False, 'official_codex_calls': 0}
    (OUT / 'acquisition.json').write_text(json.dumps(result, indent=2) + '\n')
    assert result['all_verified'], 'Incomplete public files; no inference'


if __name__ == '__main__':
    main()
