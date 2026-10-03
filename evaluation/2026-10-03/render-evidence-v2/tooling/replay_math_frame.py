"""Render frozen, hand-authored adapter controls with no model calls."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import shutil
import subprocess
import time

from batch import digest, save
from model_infra_pilot import NODE, ROOT, render_environment


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fixtures', type=Path, default=ROOT/'evaluation/2026-10-03/render-evidence-v2')
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    fixtures, out = args.fixtures.resolve(), args.out.resolve()
    plan = json.loads((fixtures/'helper-plan.json').read_text())
    out.mkdir(parents=True, exist_ok=False)
    shutil.copyfile(fixtures/'helper-plan.json', out/'plan.json')
    shutil.copyfile(Path(__file__), out/'replay_math_frame.py')
    expected = plan['expected']

    def render(ident):
        source = fixtures/'fixture-sources'/ident
        if digest(source/'math-frame.mjs') != digest(ROOT/'runtime/math-frame.mjs'):
            raise ValueError('Frozen adapter differs from current adapter; record a new fixture version first')
        directory = out/ident
        directory.mkdir()
        began = time.monotonic()
        process = subprocess.run([
            NODE, str(ROOT/'tools/render_scene.mjs'), '--scene', str(source/'index.html'),
            '--brief', str(source/'brief.json'), '--out', str(directory/'render'),
            '--render-invalid', '--samples', '1,4,8,11,14,17',
            '--author', 'hand-authored adapter regression fixture'
        ], env=render_environment(), capture_output=True, text=True, timeout=60)
        (directory/'stdout.log').write_text(process.stdout)
        (directory/'stderr.log').write_text(process.stderr)
        manifest = json.loads((directory/'render/manifest.json').read_text())
        codes = sorted({f['code'] for f in manifest.get('checks', {}).get('findings', [])})
        exported = (directory/'render/video.mp4').exists()
        decoded = manifest.get('video', {}).get('full_decode_passed', False)
        correct = (process.returncode == 0 and manifest['status'] == 'render_passed' and not codes
                   if expected[ident] == 'pass' else
                   process.returncode == 1 and manifest['status'] == 'checks_failed' and expected[ident] in codes)
        result = {'id': ident, 'expected': expected[ident], 'expectation_met': bool(correct and exported and decoded),
                  'status': manifest['status'], 'exit_code': process.returncode, 'finding_codes': codes,
                  'full_decode': decoded, 'video_exported': exported, 'wall_s': time.monotonic()-began,
                  'render_directory': str(directory/'render'), 'sources': manifest['sources'],
                  'mass_geometry_coverage': manifest.get('checks', {}).get('mass_geometry'),
                  'review': 'technical controlled fixture; not artistic approval',
                  'revision': 'unchanged frozen hand-authored fixture; reproducibility repeat'}
        save(directory/'result.json', result)
        return result

    began = time.monotonic()
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(render, plan['fixtures']))
    summary = {'model_calls': 0, 'fixtures': len(results),
               'expectations_met': sum(r['expectation_met'] for r in results),
               'batch_wall_s': time.monotonic()-began, 'results': results}
    save(out/'summary.json', summary)
    print(json.dumps({k: v for k, v in summary.items() if k != 'results'}, ensure_ascii=False))
    if not all(r['expectation_met'] for r in results):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
