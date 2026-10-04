"""Recover the two pinned text exports via GitHub; never fetch weights or media."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'evaluation/2026-10-04/reproduction-status-v1'
REPOS = {'tea': 'TIGER-AI-Lab/TheoremExplainAgent', 'phy': 'meghamariamkm/PhyEduVideo'}


def validate(raw, item):
    blob = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
    if blob != item['git_blob_sha'] or hashlib.sha256(raw).hexdigest() != item['sha256']:
        raise ValueError('Upstream text bytes do not match the frozen manifest')


def recover(destination, verify_only=False):
    counts = {}
    for project, repo in REPOS.items():
        manifest = json.loads((OUT / f'{project}-source-manifest.json').read_text())
        target_root = (destination / project).resolve()
        fetched = 0
        for item in manifest['files']:
            path = (target_root / item['path']).resolve()
            if not path.is_relative_to(target_root):
                raise ValueError('Manifest path escapes export root')
            if path.exists():
                validate(path.read_bytes(), item)
            elif verify_only:
                raise ValueError('Missing pinned source file')
            else:
                if item['bytes'] == 0:
                    raw = b''
                else:
                    # gh owns its authentication; no credential files or tokens are read.
                    result = subprocess.run(['gh', 'api', f"repos/{repo}/git/blobs/{item['git_blob_sha']}"],
                                            capture_output=True, timeout=60)
                    if result.returncode:
                        raise RuntimeError('GitHub source retrieval failed; no source result assumed')
                    raw = base64.b64decode(json.loads(result.stdout)['content'])
                validate(raw, item)
                path.parent.mkdir(parents=True, exist_ok=True)
                with path.open('xb') as file:
                    file.write(raw)
                fetched += 1
        # Export identity is copied verbatim, never synthesized from an unpinned HEAD.
        identity = target_root / 'SOURCE_MANIFEST.json'
        if identity.exists() and identity.read_bytes() != (OUT / f'{project}-source-manifest.json').read_bytes():
            raise ValueError('Existing export identity differs')
        if not verify_only and not identity.exists():
            identity.write_bytes((OUT / f'{project}-source-manifest.json').read_bytes())
        counts[project] = {'verified': len(manifest['files']), 'fetched': fetched, 'commit': manifest['commit']}
    return counts


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--destination', type=Path, default=ROOT / 'work/reproduction-source-v1')
    parser.add_argument('--verify-only', action='store_true')
    args = parser.parse_args()
    if not args.destination.resolve().is_relative_to((ROOT / 'work').resolve()):
        raise ValueError('Third-party exports belong in ignored work/')
    print(json.dumps(recover(args.destination, args.verify_only), indent=2))
