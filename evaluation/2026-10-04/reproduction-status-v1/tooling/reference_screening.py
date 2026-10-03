"""Fixed 48-attempt official Codex screening; paper ports, not paper results."""
import argparse
import ast
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict
import json
from math import prod
from pathlib import Path
import re
import shutil
from typing import List

from batch import digest, save
import model_infra_pilot as transport
from replay_code2video_metrics import native_definitions
from code2video_metrics import parse_aes
from score_fact_responses import verify_pack, summarize

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'evaluation/2026-10-04/reproduction-status-v1'
WORK = ROOT / 'work/reference-screening-v1'
SOURCE = ROOT / 'work/reproduction-source-v1'
PACK = ROOT / 'evaluation/2026-10-03/judge-fact-probes-v3'
CONTENT_SCHEMA = {'type': 'object', 'additionalProperties': False,
                  'properties': {'content': {'type': 'string'}}, 'required': ['content']}
FACT_SCHEMA = {'type': 'object', 'additionalProperties': False, 'properties': {
    'label': {'type': 'string', 'enum': ['supported', 'contradicted', 'unverifiable']},
    'limitations': {'type': 'string'},
    'observations': {'type': 'array', 'items': {'type': 'object', 'additionalProperties': False,
        'properties': {'time_s': {'type': 'number', 'enum': [1, 4, 6.5, 8, 11, 17.5]},
                       'object': {'type': 'string'}, 'description': {'type': 'string'}},
        'required': ['time_s', 'object', 'description']}}},
    'required': ['label', 'limitations', 'observations']}


def read(path):
    return json.loads(path.read_text())


def verify_sources():
    counts = {}
    for project in ('tea', 'phy'):
        manifest = read(SOURCE / project / 'SOURCE_MANIFEST.json')
        expected = read(OUT / 'plan.json')['pins'][{'tea': 'TheoremExplainAgent', 'phy': 'PhyEduVideo'}[project]]
        if manifest['commit'] != expected:
            raise ValueError('Source pin mismatch')
        for item in manifest['files']:
            if digest(SOURCE / project / item['path']) != item['sha256']:
                raise ValueError('Source bytes changed')
        counts[project] = len(manifest['files'])
    manifest = read(ROOT / 'work/code2video-reproduction/upstream/SOURCE_MANIFEST.json')
    if manifest['commit'] != '1142d8e14cdc2806df85aedb0fbb5dca474caa0f':
        raise ValueError('Code2Video pin mismatch')
    for item in manifest['files']:
        if digest(ROOT / 'work/code2video-reproduction/upstream' / item['path']) != item['sha256']:
            raise ValueError('Code2Video source bytes changed')
    counts['code2video'] = len(manifest['files'])
    return counts


def tea_utils():
    path = SOURCE / 'tea/eval_suite/utils.py'
    nodes = [n for n in ast.parse(path.read_text()).body if isinstance(n, ast.FunctionDef)]
    namespace = dict(json=json, re=re, prod=prod, List=List)
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(path), 'exec'), namespace)
    return namespace


def prepare():
    if (OUT / 'screening-frozen.json').exists():
        raise ValueError('Do not overwrite a freeze')
    counts = verify_sources()
    stimuli, _, integrity = verify_pack(PACK, ROOT)
    native, _ = native_definitions(ROOT / 'work/code2video-reproduction/upstream')
    native_prompt = native['prompts/stage5_eva.py']['get_prompt_aes']
    tea_prompt = (SOURCE / 'tea/eval_suite/prompts_raw/image_eval.txt').read_text()
    WORK.mkdir(exist_ok=False)
    jobs = []
    for stimulus in stimuli:
        ident = stimulus['id']
        brief = read(PACK / 'sources' / ident / 'brief.json')
        concept = 'Softmax: signed inputs become positive exponential masses and normalized probabilities sharing one total.' if brief['id'] == 'softmax' else 'Residual connection: the unchanged input and an illustrative signed correction add componentwise; no trained weights.'
        for repeat in (1, 2):
            jobs.append({'id': f'fact-{ident}-r{repeat}', 'control': ident, 'method': 'fact', 'repeat': repeat,
                         'prompt': (ROOT / stimulus['prompt']).read_text() + '\nReturn the supplied JSON schema. Do not use tools, read files, browse, delegate or invoke another model.',
                         'schema': FACT_SCHEMA, 'images': [stimulus['contact']]})
        frame = next(f for f in stimulus['frames'] if f['time_s'] == 11)
        for method, prompt, schema, images in (
            ('tea', tea_prompt.format(description=concept), CONTENT_SCHEMA, [frame['frame']]),
            ('aes', native_prompt(concept), CONTENT_SCHEMA, [stimulus['contact']]),
        ):
            caveat = '\nThis authorized isolated evaluator call supplies only ' + ('one frame at 11 seconds' if method == 'tea' else 'six timestamped still frames, not full video or audio') + '. State evidence limitations in your analysis. Do not use tools, read files, browse, delegate or invoke another model. Return the original requested JSON as a string in content.'
            jobs.append({'id': f'{method}-{ident}', 'control': ident, 'method': method,
                         'prompt': prompt + caveat, 'schema': schema, 'images': images})
    if len(jobs) != 48 or read(OUT / 'plan.json')['model_call_budget'] != 48:
        raise ValueError('Budget/design mismatch')
    for job in jobs:
        job['image_sha256'] = [digest(ROOT / image) for image in job['images']]
    save(OUT / 'screening-jobs.json', jobs)
    save(OUT / 'source-integrity.json', {'files': counts, 'stimuli': integrity})
    for project in ('tea', 'phy'):
        shutil.copyfile(SOURCE / project / 'SOURCE_MANIFEST.json', OUT / f'{project}-source-manifest.json')
    names = ('reference_screening.py', 'batch.py', 'model_infra_pilot.py', 'code2video_pilot.py',
             'replay_code2video_metrics.py', 'code2video_metrics.py', 'score_fact_responses.py')
    (OUT / 'tooling').mkdir(exist_ok=True)
    for name in names:
        shutil.copyfile(ROOT / 'tools' / name, OUT / 'tooling' / name)
    paths = ['plan.json', 'DESIGN.md', 'screening-jobs.json', 'source-integrity.json', 'tea-source-manifest.json', 'phy-source-manifest.json']
    paths += [f'tooling/{name}' for name in names]
    save(OUT / 'screening-frozen.json', [{'path': name, 'sha256': digest(OUT / name)} for name in paths])


def verify():
    for item in read(OUT / 'screening-frozen.json'):
        if digest(OUT / item['path']) != item['sha256']:
            raise ValueError('Frozen input changed')
        if item['path'].startswith('tooling/') and digest(ROOT / 'tools' / Path(item['path']).name) != item['sha256']:
            raise ValueError('Runtime tooling changed')
    verify_sources()
    verify_pack(PACK, ROOT)


def run():
    verify()
    jobs = read(OUT / 'screening-jobs.json')
    if len(jobs) > read(OUT / 'plan.json')['model_call_budget'] or len({j['id'] for j in jobs}) != len(jobs):
        raise ValueError('Budget/unique job mismatch')

    def execute(job):
        images = [ROOT / p for p in job['images']]
        if [digest(p) for p in images] != job['image_sha256']:
            raise ValueError('Evidence changed')
        directory = WORK / job['id']
        # transport.invoke resumes completed/failed safe records; interrupted directories
        # stop rather than silently creating another call. Each fixed ID has one attempt.
        result = transport.invoke(directory, job['prompt'], job['schema'], read(OUT / 'plan.json')['model'], images)
        save(OUT / 'responses' / f"{job['id']}.json", result)
        return job['id'], result['status']

    pending = [j for j in jobs if not (OUT / 'responses' / f"{j['id']}.json").exists()]
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = [pool.submit(execute, j) for j in pending]
        for future in as_completed(futures):
            ident, status = future.result()
            print(ident, status, flush=True)
    verify()


def report():
    verify()
    stimuli, facts, integrity = verify_pack(PACK, ROOT)
    by_id = {s['id']: s for s in stimuli}
    native, _ = native_definitions(ROOT / 'work/code2video-reproduction/upstream')
    evaluator = native['src/eval_AES.py']['VideoEvaluator'](lambda **kw: (_ for _ in ()).throw(ValueError('No network')))
    utils = tea_utils()
    rows = []
    envelopes = {r: {'kind': 'external', 'reviewer': read(OUT / 'plan.json')['model'], 'responses': []} for r in (1, 2)}
    for job in read(OUT / 'screening-jobs.json'):
        path = OUT / 'responses' / f"{job['id']}.json"
        result = read(path) if path.exists() else {'status': 'missing'}
        row = {'job': job['id'], 'method': job['method'], 'control': job['control'], 'status': result['status'], 'process': result.get('process')}
        response = result.get('response', {})
        if job['method'] == 'fact':
            s = by_id[job['control']]
            wrapped = dict(response, id=job['control'], status='completed' if result['status'] == 'completed' else 'call_failed', contact_sha256=s['contact_sha256'])
            frame_hashes = {f['time_s']: f['sha256'] for f in s['frames']}
            for observation in wrapped.get('observations', []):
                observation['frame_sha256'] = frame_hashes.get(observation.get('time_s'))
            if result['status'] != 'missing':
                envelopes[job['repeat']]['responses'].append(wrapped)
        elif result['status'] == 'completed':
            try:
                text = response['content']
                if job['method'] == 'aes':
                    row['native'] = asdict(evaluator._parse_evaluation_response(text))
                    row['strict'] = parse_aes(text)
                else:
                    parsed = utils['convert_score_fields'](utils['extract_json'](text))
                    scores = [parsed['evaluation'][k]['score'] for k in ('visual_relevance', 'element_layout')]
                    row['native'] = parsed
                    row['single_frame_geometric_mean'] = utils['calculate_geometric_mean'](scores)
                    row['range_valid'] = all(type(s) is int and 1 <= s <= 5 for s in scores)
            except (KeyError, TypeError, ValueError) as error:
                row['parse_error'] = str(error)
        rows.append(row)
    for repeat, envelope in envelopes.items():
        envelope['stimuli_sha256'] = integrity['stimuli_sha256']
        save(OUT / f'fact-responses-r{repeat}.json', envelope)
        save(OUT / f'fact-results-r{repeat}.json', summarize(stimuli, facts, envelope))
    save(OUT / 'screening-results.json', {'rows': rows, 'budget': 48, 'attempt_directories': len(list(WORK.glob('*/prompt.md'))),
         'complete': sum(r['status'] == 'completed' for r in rows), 'missing': sum(r['status'] == 'missing' for r in rows),
         'limitations': 'Changed models, sparse still evidence; original paper performance and human learning not reproduced.'})


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=['prepare', 'run', 'report'])
    globals()[parser.parse_args().phase]()
