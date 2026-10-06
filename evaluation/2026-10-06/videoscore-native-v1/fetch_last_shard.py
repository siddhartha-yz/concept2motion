"""One unchanged public shard, separate transport experiment."""
import hashlib
import json
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
    for row in json.loads((OUT / 'last-shard-frozen.json').read_text()):
        assert digest(OUT / row['path']) == row['sha256']
    assert not (OUT / 'shard4-acquisition-v3.json').exists()
    pin = json.loads((OUT / 'model-pin.json').read_text())
    name = 'model-00004-of-00004.safetensors'
    item = next(x for x in pin['files'] if x['rfilename'] == name)
    directory = WORK / 'model-supplement-v3'
    directory.mkdir(exist_ok=False)
    path = directory / name
    log = WORK / 'shard4-curl-v3.log'
    start = time.perf_counter()
    with log.open('w') as output:
        try:
            result = subprocess.run(['curl', '--fail', '--location', '--silent', '--show-error',
                '--ipv4', '--http1.1', '--retry', '2', '--retry-all-errors',
                '--retry-max-time', '600', '--max-time', '600', '--connect-timeout', '30',
                '--output', str(path),
                f"https://huggingface.co/{pin['repository']}/resolve/{pin['revision']}/{name}?download=true"],
                stdout=output, stderr=output, timeout=610)
            code, timed_out = result.returncode, False
        except subprocess.TimeoutExpired:
            code, timed_out = None, True
    row = {'file': name, 'exit_code': code, 'timed_out': timed_out,
        'path': 'model-supplement-v3/' + name, 'origin': 'supplement-v3',
        'elapsed_s': time.perf_counter()-start, 'log_sha256': digest(log),
        'bytes': path.stat().st_size if path.exists() else 0, 'verified': False}
    if code == 0 and path.exists():
        row['sha256'] = digest(path)
        row['verified'] = row['sha256'] == item['lfs']['sha256'] and row['bytes'] == item['size']
    (OUT / 'shard4-acquisition-v3.json').write_text(json.dumps(row, indent=2)+'\n')
    print('shard4', row['bytes'], row['verified'], flush=True)


if __name__ == '__main__':
    main()
