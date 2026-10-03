"""Frozen paired pilot: weak author, deterministic feedback, strong final judge.

No agent framework, no judge feedback to the author, no hidden candidate selection.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import math
import os
from pathlib import Path
import random
import shutil
import subprocess
import time
from types import SimpleNamespace

from batch import AUTHOR_SCHEMA, digest, model_call, save
import calibrate_review as controls
from code2video_pilot import CONFIG

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / 'evaluation/2026-10-02/model-infra-pilot-v1'
WORK = ROOT / 'work/model-infra-pilot-v1'
NODE = '/home/yang-zhi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'
WEAK, STRONG = 'gpt-6-luna', 'gpt-6-astra'
TIMES = [1, 4, 8, 11, 14, 17]
CASES = [
    {'id': 'softmax', 'duration_s': 18, 'inputs': {'logits': [-.8, .4, 1.2]},
     'question': 'Why must all three softmax outputs share one denominator?',
     'mechanism': 'Signed inputs become positive exp masses; sum all three once; divide each by that same sum; partition one total-one capacity.',
     'visual_checks': ['Input signs and class identities are visible', 'Each input visibly becomes its positive exponential mass',
                       'All three masses visibly contribute to one shared total', 'Three final probabilities visibly partition one total-one capacity']},
    {'id': 'residual', 'duration_s': 18, 'inputs': {'x': [.8, -.6, .3], 'residual': [-.2, .4, -.1]},
     'question': 'What exactly survives along the identity path, and where does addition happen?',
     'mechanism': 'Identity transports x unchanged; a separate illustrative correction F(x) merges componentwise into y=x+F(x); not trained weights.',
     'visual_checks': ['Original signed components and their identity path remain identifiable', 'A separate correction path is visibly distinguishable',
                       'Corresponding components visibly join head-to-tail at the merge', 'The displayed result visibly agrees with signed componentwise addition']},
]
ARMS = {'A': 'weak one-shot', 'B': 'weak generic revision', 'C': 'weak deterministic-feedback revision', 'D': 'strong one-shot reference'}
SUPPORT_FILES = {}  # Optional frozen local modules, identical for every arm.
CHECK_SCHEMA = {'type': 'object', 'additionalProperties': False, 'properties': {
    'criterion': {'type': 'integer', 'enum': [0, 1, 2, 3]},
    'status': {'type': 'string', 'enum': ['demonstrated', 'missing', 'contradicted', 'uncertain']},
    'time_s': {'type': 'number'}, 'evidence': {'type': 'string'}},
    'required': ['criterion', 'status', 'time_s', 'evidence']}
JUDGE_SCHEMA = {'type': 'object', 'additionalProperties': False, 'properties': {
    'videos': {'type': 'array', 'items': {'type': 'object', 'additionalProperties': False,
        'properties': {'id': {'type': 'string'}, 'checks': {'type': 'array', 'items': CHECK_SCHEMA},
                       'reconstructed_message': {'type': 'string'}, 'limits': {'type': 'string'}},
        'required': ['id', 'checks', 'reconstructed_message', 'limits']}},
    'comparisons': {'type': 'array', 'items': {'type': 'object', 'additionalProperties': False,
        'properties': {'left': {'type': 'string'}, 'right': {'type': 'string'}, 'winner': {'type': 'string'},
                       'reason': {'type': 'string'}}, 'required': ['left', 'right', 'winner', 'reason']}},
    'uncertainty': {'type': 'string'}}, 'required': ['videos', 'comparisons', 'uncertainty']}


def read(path):
    return json.loads(path.read_text())


def args_for(model):
    return SimpleNamespace(codex='/usr/lib/chatgpt/resources/codex', model_timeout=240,
                           codex_config=[f'model="{model}"', *CONFIG])


def invoke(directory, prompt, schema, model, images=()):
    # A completed call may be resumed, never silently regenerated or discarded.
    if directory.exists():
        if (directory/'safe.json').exists():
            old = read(directory/'safe.json')
            if old['prompt_sha256'] != __import__('hashlib').sha256(prompt.encode()).hexdigest():
                raise ValueError('Resume prompt changed')
            if old['model'] != model or old['image_sha256'] != [digest(p) for p in images]:
                raise ValueError('Resume model or attached evidence changed')
            return old
        raise ValueError(f'Interrupted call needs explicit accounting: {directory}')
    record = {'model': model, 'prompt_sha256': __import__('hashlib').sha256(prompt.encode()).hexdigest(),
              'image_sha256': [digest(p) for p in images], 'status': 'started'}
    try:
        record.update(status='completed', response=model_call(args_for(model), directory, prompt, schema, images))
    except Exception as error:
        record.update(status='unknown', error=str(error))
    if (directory/'process.json').exists():
        process = read(directory/'process.json')
        record['process'] = {k: process[k] for k in ('exit_code', 'timed_out', 'wall_s', 'usage', 'tool_types') if k in process}
    save(directory/'safe.json', record)
    return record


def prepare():
    WORK.mkdir(parents=True, exist_ok=False)
    REPORT.mkdir(parents=True, exist_ok=False)
    (REPORT/'tooling').mkdir()
    for name in ['model_infra_pilot.py', 'render_scene.mjs', 'contracts.mjs', 'batch.py']:
        shutil.copyfile(ROOT/'tools'/name, REPORT/'tooling'/name)
    protocol = (ROOT/'docs/scene-protocol.md').read_text().split('## Run a candidate')[0]
    (REPORT/'protocol.md').write_text(protocol)
    save(REPORT/'cases.json', CASES)
    save(REPORT/'judge-schema.json', JUDGE_SCHEMA)
    config = {'weak': WEAK, 'strong': STRONG, 'reasoning': 'low for both; no agents', 'repeats': 2, 'arms': ARMS,
              'primary_comparison': 'C vs B', 'generation_calls': {'A': 1, 'B': 3, 'C': 3, 'D': 1},
              'pairing': 'A initial candidate shared exactly with B/C; two independently generated weak starts per task',
              'final_selection': 'fixed last revision, no best-of or fallback selection; every attempt retained',
              'feedback': 'B/C receive identical prior source, same sampled frames and execution errors. Only C receives deterministic findings.',
              'budget_limits': 'B/C same number of author calls, model, effort, requested source-size limit and render timeout; actual tokens differ and must be reported. Not a strict equal-token experiment.',
              'judge': 'final only after all candidates generated; two opposite panel orders; no feedback to author',
              'samples_s': TIMES, 'model_timeout_s': 240, 'render_timeout_s': 120, 'max_workers': 4,
              'inference': 'exploratory paired pilot; two tasks are existing contract families, not representative held-out benchmark; no significance claim'}
    save(REPORT/'experiment.json', config)
    frozen = [p for p in REPORT.rglob('*') if p.is_file()]
    save(REPORT/'frozen.json', [{'path': str(p.relative_to(REPORT)), 'sha256': digest(p)} for p in frozen])
    for case in CASES:
        save(WORK/f"brief-{case['id']}.json", case)
    print('Prepared 2 tasks x 2 repetitions x 4 arms; protocol/budgets frozen', flush=True)


def verify():
    for item in read(REPORT/'frozen.json'):
        if digest(REPORT/item['path']) != item['sha256']:
            raise ValueError(f"Frozen experiment changed: {item['path']}")
    for name in ['model_infra_pilot.py', 'render_scene.mjs', 'contracts.mjs', 'batch.py']:
        if digest(ROOT/'tools'/name) != digest(REPORT/'tooling'/name):
            raise ValueError('Tool changed after freezing')


def common_prompt(case):
    return f'''Authorized original mathematical animation benchmark. Return ONLY structured html/javascript/storyboard.
Do not use tools, read files, browse, delegate or invoke models. No external assets or libraries.
Produce a Chinese silent explanation for a newcomer, using Canvas2D at exactly 854x480, 15fps, 18 seconds.
Use a dark background, legible concise captions, stable component identities/colors, meaningful visual changes.
Show the question and what the objects mean. Visible geometric actions must support the mechanism, not just display formulas.
Source-size budget: keep JavaScript under 9000 characters and HTML under 1000 characters; storyboard under 1500 characters.
Expose deterministic window.C2M version 1 and canvas#scene. index.html must reference scene.js.
Redraw the whole frame at explicit render(t). No playback in ?export=1. Meta caseId must be {case['id']}.
Report truthful numerical mechanism, geometry and measured bounds for every drawn text/shape as required below.
Do not claim learned weights or copy a finished scene. Preserve the required stages in order.
Brief:
{json.dumps(case, ensure_ascii=False)}
Common protocol (all methods receive the same contract):
{(REPORT/'protocol.md').read_text()}
'''


def feedback(manifest, enriched):
    result = {'execution_errors': manifest.get('errors', []), 'external_requests': manifest.get('externalRequests', [])}
    if enriched:
        findings = manifest.get('checks', {}).get('findings', [])
        groups = {}
        for item in findings:
            key = (item.get('code'), item.get('detail'))
            group = groups.setdefault(key, {'code': key[0], 'detail': key[1], 'first_time_s': item.get('time_s'), 'occurrences': 0})
            group['occurrences'] += 1
        result['deterministic_findings'] = list(groups.values())[:30]
        result['check_scope'] = 'numerical mechanism, declared geometry, sampled pixels, layout, stage order, seek determinism; not artistic approval'
        result['passed'] = manifest.get('checks', {}).get('passed', False)
    return result


def render_environment():
    env = dict(os.environ)
    env.update(C2M_NODE_MODULES='/home/yang-zhi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules',
               C2M_CHROMIUM='/home/yang-zhi/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
               C2M_FFMPEG='/home/yang-zhi/.local/bin/ffmpeg',
               C2M_FFPROBE='/home/yang-zhi/Documents/Codex/2026-09-21/la/work/ffmpeg-runtime/usr/bin/ffprobe')
    env['LD_LIBRARY_PATH'] = '/home/yang-zhi/Documents/Codex/2026-09-21/la/work/ffmpeg-runtime/usr/lib/x86_64-linux-gnu:'+env.get('LD_LIBRARY_PATH', '')
    return env


def create_attempt(case, repeat, arm, version, prompt, images=()):
    directory = WORK/'candidates'/f"{case['id']}-{repeat}-{arm}"/f'v{version}'
    if (directory/'record.json').exists():
        return read(directory/'record.json')
    model = STRONG if arm == 'D' else WEAK
    call = invoke(directory/'call', prompt, AUTHOR_SCHEMA, model, images)
    record = {'case': case['id'], 'repeat': repeat, 'arm': arm, 'version': version,
              'input_brief': str((WORK/f"brief-{case['id']}.json").relative_to(ROOT)),
              'call': str((directory/'call/safe.json').relative_to(ROOT)), 'model': model,
              'render': None, 'revision_history': f'fixed version {version}; no strong judge feedback',
              'status': 'generation_unknown'}
    if call['status'] == 'completed':
        source = directory/'source'
        source.mkdir(exist_ok=True)
        for field, name in [('html', 'index.html'), ('javascript', 'scene.js'), ('storyboard', 'storyboard.md')]:
            (source/name).write_text(call['response'][field])
        for name, path in SUPPORT_FILES.items():
            if Path(name).name != name:
                raise ValueError('Support module must be a local filename')
            shutil.copyfile(path, source/name)
        record['source'] = str(source.relative_to(ROOT))
        record['source_sha256'] = {p.name: digest(p) for p in source.iterdir()}
        record['requested_source_limits_met'] = len(call['response']['javascript']) <= 9000 and len(call['response']['html']) <= 1000
        out = directory/'render'
        command = [NODE, str(ROOT/'tools/render_scene.mjs'), '--scene', str(source/'index.html'), '--out', str(out),
                   '--brief', str(WORK/f"brief-{case['id']}.json"), '--render-invalid', '--author', model,
                   '--samples', ','.join(map(str, TIMES))]
        started = time.monotonic()
        try:
            result = subprocess.run(command, env=render_environment(), capture_output=True, text=True, timeout=120)
            (directory/'render.stdout.log').write_text(result.stdout)
            (directory/'render.stderr.log').write_text(result.stderr)
            record['render_exit_code'] = result.returncode
        except subprocess.TimeoutExpired:
            record['render_timeout'] = True
        record['render_wall_s'] = time.monotonic()-started
        record['render'] = str(out.relative_to(ROOT))
        record['status'] = 'rendered' if (out/'video.mp4').exists() else 'render_failed'
        if (out/'manifest.json').exists():
            manifest = read(out/'manifest.json')
            record['technical_pass'] = manifest.get('status') == 'render_passed'
            record['math_scope'] = 'candidate-reported values and geometry, independently recomputed with sampled pixel checks; not all-pixel proof'
    save(directory/'record.json', record)
    print(f"{case['id']} r{repeat} {arm} v{version}: {record['status']}", flush=True)
    return record


def prior_material(record):
    if not record.get('source'):
        return {}, [], {'errors': ['Previous model call produced no usable source']}
    source = ROOT/record['source']
    payload = {p.name: p.read_text() for p in source.iterdir()}
    out = ROOT/record['render']
    images = [out/f'frame-{t:.2f}.jpg' for t in TIMES if (out/f'frame-{t:.2f}.jpg').exists()]
    manifest = read(out/'manifest.json') if (out/'manifest.json').exists() else {'errors': ['No render manifest; rendering failed or timed out']}
    return payload, images, manifest


def revise_chain(case, repeat, arm, initial):
    previous = initial
    records = [initial]
    for version in (2, 3):
        source, images, manifest = prior_material(previous)
        instruction = ('Use the deterministic findings to target specific defects, while keeping the explanation clear.' if arm == 'C' else
                       'Inspect the supplied source and sampled frames yourself; correct defects and improve the explanation.')
        prompt = common_prompt(case)+f'\nRevision {version}/3. {instruction}\nPrior source:\n'+json.dumps(source, ensure_ascii=False)+\
                 '\nPrior execution evidence:\n'+json.dumps(feedback(manifest, arm == 'C'), ensure_ascii=False)+\
                 '\nAttached samples, if present, are at seconds '+json.dumps(TIMES)+'. Return a complete replacement, not a patch.'
        previous = create_attempt(case, repeat, arm, version, prompt, images)
        records.append(previous)
    return {'case': case['id'], 'repeat': repeat, 'arm': arm, 'attempts': records, 'final': previous}


def generate():
    verify()
    started = time.monotonic()
    finals = []
    # Initial weak samples and strong references are independent across task/repeat.
    initials = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        jobs = {pool.submit(create_attempt, case, repeat, arm, 1, common_prompt(case)): (case, repeat, arm)
                for case in CASES for repeat in (1, 2) for arm in ('A', 'D')}
        for job in as_completed(jobs):
            case, repeat, arm = jobs[job]
            record = job.result()
            initials[(case['id'], repeat, arm)] = record
            finals.append({'case': case['id'], 'repeat': repeat, 'arm': arm, 'attempts': [record], 'final': record})
            save(REPORT/'generation.json', finals)
    with ThreadPoolExecutor(max_workers=4) as pool:
        jobs = [pool.submit(revise_chain, case, repeat, arm, initials[(case['id'], repeat, 'A')])
                for case in CASES for repeat in (1, 2) for arm in ('B', 'C')]
        for job in as_completed(jobs):
            finals.append(job.result())
            save(REPORT/'generation.json', finals)
    save(REPORT/'generation-timing.json', {'batch_wall_s': time.monotonic()-started, 'resumed': 'Prior completed calls, if any, are reused and recorded; per-call durations remain authoritative.'})
    print('All 16 final candidates accounted for; no best-of selection', flush=True)


def calibrate():
    verify()
    samples = controls.check_frozen()
    def task(sample):
        call = invoke(WORK/'calibration'/sample['id'], controls.prompt(), controls.SCHEMA, STRONG, [ROOT/sample['contact']])
        verdict = {'id': sample['id'], 'call': call, 'status': 'unknown'}
        if call['status'] == 'completed':
            try:
                controls.validate(call['response'])
                verdict['matches'] = {axis: call['response'][axis] == controls.CASES[sample['id']][axis] for axis in controls.FIELDS}
                verdict['status'] = 'matched' if all(verdict['matches'].values()) else 'mismatched'
            except ValueError as error:
                verdict['error'] = str(error)
        save(REPORT/'calibration'/f"{sample['id']}.json", verdict)
        return verdict
    with ThreadPoolExecutor(max_workers=4) as pool:
        records = list(pool.map(task, samples))
    save(REPORT/'calibration.json', {'records': records, 'screening_pass': all(r['status'] == 'matched' for r in records),
         'limits': 'Same four previously seen controlled fixtures, one repetition per fixture; new model screening, not independent benchmark validation.'})


def sheets():
    from PIL import Image, ImageDraw, ImageFont
    verify()
    finals = read(REPORT/'generation.json')
    if len(finals) != 16:
        raise ValueError('Incomplete candidate set')
    panels = []
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
    for case in CASES:
        for repeat in (1, 2):
            group = [r for r in finals if r['case'] == case['id'] and r['repeat'] == repeat]
            random.Random(f"v1-{case['id']}-{repeat}").shuffle(group)
            items = []
            for index, record in enumerate(group):
                ident = 'WXYZ'[index]
                directory = WORK/'panels'/f"{case['id']}-{repeat}"
                directory.mkdir(parents=True, exist_ok=True)
                contact = directory/f'{ident}.png'
                sheet = Image.new('RGB', (1708, 1524), '#202020')
                attempt = record['final']
                for j, seconds in enumerate(TIMES):
                    x, y = j%2*854, j//2*508
                    frame = ROOT/attempt['render']/f'frame-{seconds:.2f}.jpg' if attempt['render'] else None
                    if frame and frame.exists():
                        picture = Image.open(frame).convert('RGB')
                        if picture.size != (854, 480):
                            raise ValueError('Unexpected frame dimensions; do not silently resize a candidate')
                        sheet.paste(picture, (x, y+28))
                    else:
                        ImageDraw.Draw(sheet).text((x+30, y+200), 'NO FRAME AVAILABLE', font=font, fill='white')
                    ImageDraw.Draw(sheet).text((x+8, y+4), f'{ident}: {seconds:.2f}s', font=font, fill='white')
                sheet.save(contact)
                items.append({'id': ident, 'arm': record['arm'], 'contact': str(contact.relative_to(ROOT)),
                              'sha256': digest(contact), 'final_source': attempt.get('source'),
                              'rendered_video': attempt['status'] == 'rendered'})
            panels.append({'case': case['id'], 'repeat': repeat, 'items': items})
    save(REPORT/'panels.json', panels)
    print('Prepared 16 anonymized contact sheets; no judgement yet', flush=True)


def validate_judge(response, ids):
    videos = response.get('videos', [])
    if len(videos) != 4 or {v['id'] for v in videos} != set(ids):
        raise ValueError('Judge must account for all four inputs exactly once')
    for video in videos:
        if len(video['checks']) != 4 or {c['criterion'] for c in video['checks']} != {0, 1, 2, 3}:
            raise ValueError('Every candidate needs all four criterion decisions')
        for check in video['checks']:
            t = check['time_s']
            if type(t) not in (int, float) or not math.isfinite(t) or t not in TIMES or not check['evidence'].strip():
                raise ValueError('Invalid timestamped evidence')
    pairs = response.get('comparisons', [])
    if len(pairs) != 6 or {frozenset((p['left'],p['right'])) for p in pairs} != {frozenset((a,b)) for a in ids for b in ids if a != b}:
        raise ValueError('Judge must account for six unique pairs')
    if any(p['winner'] not in (p['left'], p['right'], 'tie', 'uncertain') or not p['reason'].strip() for p in pairs):
        raise ValueError('Invalid pairwise judgement')


def judge():
    verify()
    if not read(REPORT/'calibration.json')['screening_pass']:
        raise ValueError('Strong judge failed screening; keep generation but do not declare comparative quality')
    # Generation must be fully frozen before any final judge output exists.
    panels = read(REPORT/'panels.json')
    if len(panels) != 4:
        raise ValueError('Incomplete panels')
    def task(panel, order):
        items = panel['items'] if order == 1 else list(reversed(panel['items']))
        images = [ROOT/item['contact'] for item in items]
        for item, image in zip(items, images):
            if digest(image) != item['sha256']:
                raise ValueError('Frozen judge image changed')
        case = next(c for c in CASES if c['id'] == panel['case'])
        prompt = f'''Authorized final blind visual assessment. Do not use tools, browse, read source or delegate.
Four contact sheets are four independent explanations of the same task, identified ONLY by W/X/Y/Z. You do not know their model, method or revision count.
Task question: {case['question']}
Audience: Chinese-speaking newcomer. Judge only the attached sampled frames; do not infer unseen motion or actual human learning.
For each ID, reconstruct what the pictures explain. For each criterion below (0..3), report demonstrated/missing/contradicted/uncertain with an exact supplied time and concrete visible evidence.
'Demonstrated' requires a visible geometric relation supporting the words. A correct formula or prior mathematical knowledge alone is insufficient. No frame means missing evidence, not invented content.
Criteria: {json.dumps(dict(enumerate(case['visual_checks'])), ensure_ascii=False)}
Then compare ALL SIX unordered pairs. Prefer the candidate that makes the task's causal mechanism more identifiable and visually supported, considering contradictions, missing steps, component identity and readability. Return winner ID, 'tie' or 'uncertain', with concrete reasons. Do not prefer decoration, extra text or more claims without supporting geometry. No numerical beauty score.
Supplied times: {TIMES}. Attachment order: {[i['id'] for i in items]}. State sample limitations.
'''
        call = invoke(WORK/'judges'/f"{panel['case']}-{panel['repeat']}-o{order}", prompt, JUDGE_SCHEMA, STRONG, images)
        record = {'case': panel['case'], 'repeat': panel['repeat'], 'order': order, 'call': call, 'status': 'unknown'}
        if call['status'] == 'completed':
            try:
                validate_judge(call['response'], [i['id'] for i in items])
                record['status'] = 'reviewed'
            except ValueError as error:
                record['error'] = str(error)
        save(REPORT/'judges'/f"{panel['case']}-{panel['repeat']}-o{order}.json", record)
        return record
    with ThreadPoolExecutor(max_workers=4) as pool:
        records = list(pool.map(lambda p: task(*p), [(panel, order) for panel in panels for order in (1,2)]))
    save(REPORT/'judgements.json', records)
    print('8 final panels accounted for, both attachment orders retained', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=['prepare', 'calibrate', 'generate', 'sheets', 'judge'])
    phase = parser.parse_args().phase
    globals()[phase]()
