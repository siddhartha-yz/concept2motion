"""Apply small, exact edits to a new scene version without regenerating source."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import tempfile

ASSETS = {'.html', '.js', '.mjs', '.css', '.json', '.png', '.jpg', '.jpeg', '.svg', '.woff', '.woff2', '.md'}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def apply(scene, patch, out):
    scene, out = scene.resolve(), out.resolve()
    if out.exists() or out.is_relative_to(scene):
        raise ValueError('Output must be a new directory outside the original scene')
    files = {}

    def collect(directory):
        for path in directory.iterdir():
            if path.name.startswith('.') or path.name == 'node_modules':
                continue
            if path.is_symlink():
                raise ValueError('Scene symlinks are not allowed')
            if path.is_dir():
                collect(path)
            elif path.suffix in ASSETS:
                files[path.relative_to(scene).as_posix()] = path.read_bytes()
    collect(scene)
    changes = patch.get('files', [])
    if not changes:
        raise ValueError('Patch needs file edits')
    updated, seen = {}, set()
    for change in changes:
        name = change['path']
        if name in seen or name not in files or Path(name).suffix not in {'.html', '.js', '.mjs', '.css', '.json', '.md'}:
            raise ValueError('Patch target must be a unique existing text asset')
        seen.add(name)
        data = files[name]
        if digest(data) != change['sha256']:
            raise ValueError('Stale source hash; inspect the current version before editing')
        text = data.decode('utf-8')
        if not change.get('edits'):
            raise ValueError('File needs edits')
        for edit in change['edits']:
            old, new = edit['old'], edit['new']
            if not isinstance(old, str) or not old or not isinstance(new, str) or old == new or text.count(old) != 1:
                raise ValueError('Each edit must match exactly once and change that match')
            text = text.replace(old, new, 1)
        updated[name] = text.encode('utf-8')
    out.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix='.c2m-edit-', dir=out.parent))
    try:
        for name, data in files.items():
            target = temporary / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(updated.get(name, data))
        record = {'patch': patch, 'source_hashes': {k: digest(v) for k, v in files.items()},
                  'changed_hashes': {k: digest(v) for k, v in updated.items()},
                  'verification': 'not rendered; no quality acceptance'}
        (temporary / 'revision.json').write_text(json.dumps(record, ensure_ascii=False, indent=2)+'\n')
        temporary.rename(out)
    except BaseException:
        shutil.rmtree(temporary)
        raise
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--scene', type=Path, required=True, help='Source directory, not HTML filename')
    parser.add_argument('--patch', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    record = apply(args.scene, json.loads(args.patch.read_text()), args.out)
    print(json.dumps({'changed_files': list(record['changed_hashes']), 'out': str(args.out)}))


if __name__ == '__main__':
    main()
