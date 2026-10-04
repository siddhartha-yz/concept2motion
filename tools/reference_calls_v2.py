"""New 96-attempt ledger, bounded official Codex transport; no paid providers."""
import argparse
import fcntl
import json
from pathlib import Path

from batch import save, digest
from bounded_calls import dispatch
import reference_screening as v1
import model_infra_pilot as transport

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'evaluation/2026-10-04/full-reproduction-v1'
WORK = ROOT / 'work/full-reproduction-v1/calls'


def read(path):
    return json.loads(path.read_text())


def authorize(job_id, prompt, images, model):
    WORK.mkdir(parents=True, exist_ok=True)
    with (WORK / 'ledger.lock').open('a+') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        plan = read(OUT / 'plan.json')
        for item in read(OUT / 'plan-frozen.json'):
            if digest(OUT / item['path']) != item['sha256']:
                raise ValueError('Authorization design changed')
        path = OUT / 'new-call-ledger.json'
        ledger = read(path) if path.exists() else {'budget': plan['new_cli_attempt_limit'], 'attempts': []}
        bound = {'id': job_id, 'prompt_sha256': __import__('hashlib').sha256(prompt.encode()).hexdigest(),
                 'image_sha256': [digest(p) for p in images], 'model': model}
        old = next((a for a in ledger['attempts'] if a['id'] == job_id), None)
        if old is not None:
            if any(old[k] != value for k, value in bound.items()):
                raise ValueError('Resume identity differs')
            return
        if ledger['budget'] != 96 or len(ledger['attempts']) >= ledger['budget']:
            raise ValueError('New authorization exhausted')
        ledger['attempts'].append(dict(bound, status='reserved_before_dispatch'))
        save(path, ledger)


def invoke(job_id, prompt, schema, model, images=()):
    images = [Path(p).resolve() for p in images]
    authorize(job_id, prompt, images, model)
    result = transport.invoke(WORK / job_id, prompt, schema, model, images)
    save(OUT / 'new-responses' / f'{job_id}.json', result)
    with (WORK / 'ledger.lock').open('a+') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        ledger = read(OUT / 'new-call-ledger.json')
        next(a for a in ledger['attempts'] if a['id'] == job_id)['status'] = result['status']
        save(OUT / 'new-call-ledger.json', ledger)
    return result


def prepare_screening():
    v1.verify()
    previous = read(v1.OUT / 'screening-results.json')
    failed = {r['job'] for r in previous['rows'] if r['status'] != 'completed'}
    jobs = [j for j in read(v1.OUT / 'screening-jobs.json') if j['id'] in failed]
    for job in jobs:
        job['new_id'] = 'screen-' + job['id']
        job['model'] = 'gpt-6-astra'
    target = OUT / 'screening-completion-jobs.json'
    if target.exists():
        raise ValueError('Do not overwrite a fixed new batch')
    save(target, jobs)
    save(OUT / 'screening-completion-frozen.json', {'jobs_sha256': digest(target),
         'runner_sha256': digest(Path(__file__)), 'gate_sha256': digest(ROOT / 'tools/bounded_calls.py'),
         'old_batch_preserved': True, 'planned_new_attempts': len(jobs), 'inflight': 3,
         'failure_stop': 3, 'retry': 'none; this is a separately authorized new batch, not a rewritten v1'})


def run_screening():
    v1.verify()
    frozen = read(OUT / 'screening-completion-frozen.json')
    if digest(OUT / 'screening-completion-jobs.json') != frozen['jobs_sha256'] or digest(Path(__file__)) != frozen['runner_sha256'] or digest(ROOT / 'tools/bounded_calls.py') != frozen['gate_sha256']:
        raise ValueError('New batch changed')
    jobs = read(OUT / 'screening-completion-jobs.json')
    # Only known completed or failed safe records are resumable. Interrupted reservations
    # stay accounted and transport refuses to silently repeat them.
    pending = [j for j in jobs if not (OUT / 'new-responses' / f"{j['new_id']}.json").exists()]

    def execute(job):
        images = [ROOT / p for p in job['images']]
        if [digest(p) for p in images] != job['image_sha256']:
            raise ValueError('Supplied evidence changed')
        result = invoke(job['new_id'], job['prompt'], job['schema'], job['model'], images)
        print(job['new_id'], result['status'], flush=True)
        return {'status': result['status'], 'id': job['new_id']}

    gate = dispatch(pending, execute, budget=len(pending), workers=3, failure_limit=3)
    save(OUT / 'screening-completion-dispatch.json', gate)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=['prepare_screening', 'run_screening'])
    globals()[parser.parse_args().phase]()
