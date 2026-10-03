"""One evidence-bound technical patch, two deterministic renders, keep or rollback.

Human supplies the hypothesis/patch. No model dispatch, artistic acceptance,
object-level guard, or protection of unsampled time is provided.
"""
import argparse
import json
import math
import os
from pathlib import Path
import signal
import shutil
import subprocess
import time

from apply_edit import apply
from score_fact_responses import inside, read, sha

ROOT = Path(__file__).resolve().parents[1]


def write(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('x') as f:
        f.write(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def findings(manifest):
    checks = manifest.get('checks', {})
    return checks.get('findings', []) + checks.get('full_video_frame_checks', {}).get('findings', [])


def codes(manifest):
    return sorted({f['code'] for f in findings(manifest)})


def validate_ticket(ticket, scene, evidence_run):
    scene, evidence_run = Path(scene).resolve(), Path(evidence_run).resolve()
    if ticket.get('kind') != 'technical' or ticket.get('max_patch_attempts') != 1:
        raise ValueError('Only a single technical patch is supported')
    for field in ('id', 'hypothesis', 'expected_change', 'stop_condition'):
        if not isinstance(ticket.get(field), str) or not ticket[field].strip():
            raise ValueError('Ticket needs an explicit hypothesis, expectation and stop condition')
    manifest = read(evidence_run / 'manifest.json')
    if sha(evidence_run / 'manifest.json') != ticket['base_manifest_sha256']:
        raise ValueError('Baseline render manifest changed')
    if sha(evidence_run / 'checks.json') != ticket['base_checks_sha256']:
        raise ValueError('Baseline checks changed')
    if not manifest.get('video', {}).get('full_decode_passed'):
        raise ValueError('Ticket evidence requires a full decoded baseline video')
    source_hashes = ticket['source_hashes']
    if source_hashes != {s['path']: s['sha256'] for s in manifest['sources']}:
        raise ValueError('Ticket source identity disagrees with rendered sources')
    for name, digest in source_hashes.items():
        if sha(inside(scene, name)) != digest or sha(inside(evidence_run / 'source', name)) != digest:
            raise ValueError('Stale source or render snapshot')
    patch = ticket['patch']
    if not patch.get('files') or set(ticket['allowed_files']) != {f['path'] for f in patch['files']}:
        raise ValueError('Patch must use exactly the declared files')
    for change in patch['files']:
        if change.get('sha256') != source_hashes.get(change['path']):
            raise ValueError('Patch is not bound to ticket source')
    samples, protected = ticket['samples_s'], ticket['protected_times_s']
    duration = manifest['meta']['duration']
    if not samples or len(samples) != len(set(samples)) or any(
        type(t) not in (int, float) or not math.isfinite(t) or not 0 <= t <= duration for t in samples
    ):
        raise ValueError('Unique finite sample times required')
    if not protected or len(protected) != len(set(protected)) or any(t not in samples for t in protected):
        raise ValueError('Protected whole-frame times must be nonempty and sampled')
    observation = ticket['observation']
    t = observation['time_s']
    if t not in samples or not observation.get('object') or not observation.get('description'):
        raise ValueError('Evidence needs a sampled time, object and concrete defect')
    if observation['frame'] != f'frame-{t:.2f}.jpg' or sha(inside(evidence_run, observation['frame'])) != observation['sha256']:
        raise ValueError('Defect frame changed or does not match its stated time')
    target = ticket['target_code']
    if not any(f['code'] == target and f.get('time_s') == t for f in findings(manifest)):
        raise ValueError('Target defect is not independently checked at the cited frame time')
    timeout = ticket['render_timeout_s']
    if type(timeout) not in (int, float) or not math.isfinite(timeout) or not 0 < timeout <= 90:
        raise ValueError('Render timeout must be bounded by 90 seconds')
    return manifest


def render(scene, out, ticket, env):
    command = [env.get('C2M_NODE', 'node'), str(ROOT / 'tools/render_scene.mjs'),
               '--scene', str(scene / 'index.html'), '--brief', str(scene / 'brief.json'),
               '--out', str(out), '--render-invalid', '--samples', ','.join(map(str, ticket['samples_s'])),
               '--author', 'hand-authored technical feedback control']
    with subprocess.Popen(command, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                          text=True, start_new_session=True) as p:
        try:
            stdout, stderr = p.communicate(timeout=ticket['render_timeout_s'])
            process = {'exit_code': p.returncode, 'timed_out': False}
        except subprocess.TimeoutExpired:
            os.killpg(p.pid, signal.SIGKILL)
            stdout, stderr = p.communicate()
            process = {'exit_code': p.returncode, 'timed_out': True}
    out.parent.mkdir(parents=True, exist_ok=True)
    out.with_suffix('.stdout.log').write_text(stdout)
    out.with_suffix('.stderr.log').write_text(stderr)
    write(out.with_suffix('.process.json'), process)
    manifest = read(out / 'manifest.json') if (out / 'manifest.json').exists() else {}
    return manifest, process


def full_render(manifest, process):
    # Invalid geometry deliberately exports with exit 1; do not equate exit with quality.
    return (not process['timed_out'] and process['exit_code'] in (0, 1)
            and manifest.get('status') in ('render_passed', 'checks_failed')
            and manifest.get('video', {}).get('passed') is True
            and manifest['video'].get('full_decode_passed') is True
            and manifest.get('determinism', {}).get('passed') is True
            and isinstance(manifest.get('checks', {}).get('full_video_frame_checks', {}).get('findings'), list))


def decide(before, after, process, target, protected):
    reasons = []
    if not full_render(after, process):
        reasons.append('candidate_render_failed')
    if target not in codes(before):
        reasons.append('baseline_target_unconfirmed')
    if target in codes(after):
        reasons.append('target_persists')
    new = sorted(set(codes(after)) - set(codes(before)))
    if new:
        reasons.append('new_check_codes')
    if not all(p['unchanged'] for p in protected) or not protected:
        reasons.append('protected_frame_changed_or_missing')
    return {'decision': 'rollback' if reasons else 'keep', 'reasons': reasons,
            'before_codes': codes(before), 'after_codes': codes(after), 'new_codes': new,
            'target_removed': bool(full_render(after, process) and target in codes(before) and target not in codes(after)),
            'protected_frames': protected,
            'acceptance_scope': 'technical target + code-set regression + sampled whole-frame protection only',
            'artistic_acceptance': 'not_evaluated'}


def run(ticket, scene, evidence_run, out, env=None):
    scene, evidence_run, out = Path(scene).resolve(), Path(evidence_run).resolve(), Path(out).resolve()
    validate_ticket(ticket, scene, evidence_run)
    if out.exists() or out.is_relative_to(scene) or out.is_relative_to(evidence_run):
        raise ValueError('New attempt directory must be outside source/evidence')
    out.mkdir(parents=True)
    write(out / 'ticket.json', ticket)
    for name in ('feedback_cycle.py', 'apply_edit.py', 'score_fact_responses.py'):
        (out / 'tooling').mkdir(exist_ok=True)
        shutil.copyfile(ROOT / 'tools' / name, out / 'tooling' / name)
    started = time.monotonic()
    result = {'id': ticket['id'], 'decision': 'rollback', 'reasons': [], 'dispatched_model_calls': 0,
              'artistic_acceptance': 'not_evaluated', 'revision_history': ['frozen baseline', 'one hand-authored patch']}
    try:
        before, process = render(scene, out / 'before', ticket, env or dict(os.environ))
        if not full_render(before, process):
            raise ValueError('Baseline rerender failed; no patch applied')
        if {s['path']: s['sha256'] for s in before['sources']} != ticket['source_hashes']:
            raise ValueError('Rerender source differs from ticket; no patch applied')
        observation = ticket['observation']
        if sha(out / 'before' / observation['frame']) != observation['sha256']:
            raise ValueError('Rerender does not reproduce ticket evidence; no patch applied')
        if ticket['target_code'] not in codes(before):
            raise ValueError('Rerender no longer confirms baseline defect')
        patch_record = apply(scene, ticket['patch'], out / 'candidate')
        after, process = render(out / 'candidate', out / 'after', ticket, env or dict(os.environ))
        protected = []
        for t in ticket['protected_times_s']:
            name = f'frame-{t:.2f}.jpg'
            a, b = out / 'before' / name, out / 'after' / name
            a_hash, b_hash = sha(a) if a.exists() else None, sha(b) if b.exists() else None
            protected.append({'time_s': t, 'before_sha256': a_hash, 'after_sha256': b_hash,
                              'unchanged': a_hash is not None and a_hash == b_hash})
        result.update(decide(before, after, process, ticket['target_code'], protected))
        result['changed_hashes'] = patch_record['changed_hashes']
        result['renders'] = {'before': {'status': before.get('status'), 'process': read(out / 'before.process.json')},
                             'after': {'status': after.get('status'), 'process': process}}
    except (ValueError, OSError, KeyError) as e:
        result['reasons'].append('execution_or_evidence_failure')
        result['error'] = str(e)
    result['active_source'] = str(out / 'candidate') if result['decision'] == 'keep' else str(scene)
    result['failed_candidate_preserved'] = (out / 'candidate').exists() and result['decision'] == 'rollback'
    result['wall_s'] = time.monotonic() - started
    write(out / 'decision.json', result)
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('ticket', 'scene', 'evidence-run', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    result = run(read(args.ticket), args.scene, args.evidence_run, args.out)
    print(json.dumps(result, ensure_ascii=False))
