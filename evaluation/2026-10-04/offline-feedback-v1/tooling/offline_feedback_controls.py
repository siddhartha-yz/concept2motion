"""Freeze/run seven hand-authored feedback controls. No model calls."""
import argparse
from collections import Counter
import json
from pathlib import Path
import shutil

from feedback_cycle import ROOT, read, run, sha, write
from model_infra_pilot import NODE, render_environment
from score_fact_responses import verify_pack

REPORT = ROOT / 'evaluation/2026-10-04/offline-feedback-v1'
WORK = ROOT / 'work/offline-feedback-v1'


def prepare():
    plan = read(REPORT / 'plan.json')
    if (REPORT / 'tickets').exists() or WORK.exists():
        raise ValueError('Never overwrite a frozen control version')
    pack = ROOT / plan['source_pack']
    _, _, integrity = verify_pack(pack, ROOT)
    for case in plan['cases']:
        ident, fixture = case['id'], case['fixture']
        scene = pack / 'sources' / fixture
        evidence = ROOT / 'work/judge-fact-probes-v3' / fixture / 'render'
        m = read(evidence / 'manifest.json')
        old, new = {'H9': ('"joinOffset": 55', '"joinOffset": 0'),
                    'K6': ('"massOffset": 80', '"massOffset": 0'),
                    'S3': ('"outputOffset": 0.35', '"outputOffset": 0'),
                    'V6': ('"outputReveal": 0.4', '"outputReveal": 1')}[fixture]
        if ident == 'join-partial': new = '"joinOffset": 35'
        edits = [{'old': old, 'new': new}]
        if ident == 'join-regression': edits.append({'old': 'scale=cfg.scale??160', 'new': 'scale=cfg.scale??210'})
        if ident == 'join-render-error': edits.append({'old': 'const cfg=', 'new': 'const cfg=; '})
        t = 6.5 if fixture == 'K6' else 17.5
        observation = {
            'H9': ('correction[0..2]', '橙色尾端相对蓝色头端偏移 55 像素；正确文字不能代替相接几何。', '去掉独立加到修正起点上的偏移，可以恢复首尾连接。'),
            'K6': ('massBar[0..2]', '指数条额外增加同样 80 像素，三个条形份额不再匹配指数质量。', '去掉共同像素加项，可以恢复共同尺度下的指数比例。'),
            'S3': ('output[0..2]', '紫色箭头目标额外加 0.35，与标出的逐项分量和矛盾。', '去掉输出偏移，可以恢复完整的带符号分量和。'),
            'V6': ('output[0..2]', '稳定输出阶段只显示目标长度的 40%。', '把控制用固定 reveal 改为 1，可在稳定阶段显示完整目标。')
        }[fixture]
        hypothesis = observation[2]
        if ident == 'join-partial': hypothesis = '只减少到 35 像素偏移，验证未彻底消除缺陷时不能保留。'
        if ident == 'join-regression': hypothesis += ' 同时注入尺度变化，验证目标修好也必须检查保护帧。'
        if ident == 'join-render-error': hypothesis += ' 同时注入语法错误，验证失败候选会保留并回退。'
        frame = f'frame-{t:.2f}.jpg'
        ticket = {'id': ident, 'kind': 'technical', 'fixture': fixture,
                  'source_pack': plan['source_pack'], 'source': str(scene.relative_to(ROOT)),
                  'evidence_run': str(evidence.relative_to(ROOT)),
                  'source_hashes': {s['path']: s['sha256'] for s in m['sources']},
                  'base_manifest_sha256': sha(evidence / 'manifest.json'),
                  'base_checks_sha256': sha(evidence / 'checks.json'),
                  'observation': {'time_s': t, 'object': observation[0], 'description': observation[1],
                                  'frame': frame, 'sha256': sha(evidence / frame)},
                  'hypothesis': hypothesis, 'expected_change': case['target_code'] + ' 消失',
                  'target_code': case['target_code'], 'allowed_files': ['scene.js'],
                  'scope_limits': 'Only exact edits and sampled whole frames enforced; object/time semantics not enforced',
                  'samples_s': plan['samples_s'], 'protected_times_s': case['protected_times_s'],
                  'max_patch_attempts': 1, 'render_timeout_s': plan['render_timeout_s'],
                  'stop_condition': 'one patch, no retry; failure or regression selects baseline',
                  'patch': {'files': [{'path': 'scene.js', 'sha256': sha(scene / 'scene.js'), 'edits': edits}]}}
        write(REPORT / 'tickets' / f'{ident}.json', ticket)
    WORK.mkdir(parents=True)
    for name in ('offline_feedback_controls.py', 'feedback_cycle.py', 'apply_edit.py', 'score_fact_responses.py',
                 'render_scene.mjs', 'contracts.mjs', 'capture_frame.mjs'):
        (REPORT / 'tooling').mkdir(exist_ok=True)
        shutil.copyfile(ROOT / 'tools' / name, REPORT / 'tooling' / name)
    write(REPORT / 'preflight.json', {'integrity': integrity, 'model_calls': 0,
                                     'installed_new_dependencies': False})
    write(REPORT / 'frozen.json', [{'path': str(p.relative_to(REPORT)), 'sha256': sha(p)}
                                  for p in sorted(REPORT.rglob('*')) if p.is_file()])
    print('Seven tickets, sources and tools frozen before execution; no calls')


def render_record(directory):
    result = {'process': read(directory.with_suffix('.process.json'))}
    if (directory / 'manifest.json').exists():
        m = read(directory / 'manifest.json')
        checks = m.get('checks', {})
        all_findings = checks.get('findings', []) + checks.get('full_video_frame_checks', {}).get('findings', [])
        result.update(status=m['status'], video=m.get('video'), sources=m.get('sources'), tooling=m.get('tooling'),
                      environment={k: m.get(k) for k in ('playwrightVersion', 'chromiumVersion', 'ffmpegVersion')},
                      determinism=m.get('determinism'), wall_s=m.get('wall_seconds'),
                      finding_counts=dict(Counter(f['code'] for f in all_findings)),
                      checks_summary={k: checks.get(k) for k in ('sampled_frames', 'coverage', 'mass_geometry', 'pixel_coverage', 'passed')},
                      full_video_frame_count=checks.get('full_video_frame_checks', {}).get('frames'),
                      error_count=len(m.get('errors', [])),
                      manifest_sha256=sha(directory / 'manifest.json'))
        result['frames'] = [{'path': str(p.relative_to(ROOT)), 'sha256': sha(p)}
                            for p in sorted(directory.glob('frame-*.jpg'))]
        if (directory / 'checks.json').exists(): result['checks_sha256'] = sha(directory / 'checks.json')
    return result


def execute():
    for item in read(REPORT / 'frozen.json'):
        if sha(REPORT / item['path']) != item['sha256']: raise ValueError('Frozen control changed')
    for p in (REPORT / 'tooling').iterdir():
        if sha(ROOT / 'tools' / p.name) != sha(p): raise ValueError('Tool changed after freeze')
    env = render_environment(); env['C2M_NODE'] = NODE
    results = []
    for case in read(REPORT / 'plan.json')['cases']:
        ident = case['id']; ticket = read(REPORT / 'tickets' / f'{ident}.json')
        attempt = WORK / ident
        result = run(ticket, ROOT / ticket['source'], ROOT / ticket['evidence_run'], attempt, env)
        result['expected'] = case['expected']
        result['expectation_met'] = result['decision'] == case['expected'] and 'execution_or_evidence_failure' not in result['reasons']
        result['render_evidence'] = {v: render_record(attempt / v) for v in ('before', 'after')
                                     if (attempt / v).with_suffix('.process.json').exists()}
        if (attempt / 'candidate').exists():
            for name in ('scene.js', 'brief.json', 'revision.json'):
                target = REPORT / 'candidate-sources' / ident / name; target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(attempt / 'candidate' / name, target)
        write(REPORT / 'results' / f'{ident}.json', result)
        results.append(result)
        print(ident, result['decision'], result['reasons'], 'expected:', result['expectation_met'], flush=True)
    write(REPORT / 'summary.json', {'kind': 'actual deterministic technical controls', 'controls': len(results),
          'expectations_met': sum(r['expectation_met'] for r in results),
          'kept': sum(r['decision'] == 'keep' for r in results),
          'rolled_back': sum(r['decision'] == 'rollback' for r in results),
          'render_attempts': sum(len(r['render_evidence']) for r in results),
          'full_decoded_exports': sum(v.get('video', {}).get('full_decode_passed', False)
                                     for r in results for v in r['render_evidence'].values()),
          'dispatched_model_calls': 0, 'artistic_evaluations': 0})
    write(REPORT / 'results-frozen.json', [{'path': str(p.relative_to(REPORT)), 'sha256': sha(p)}
                                          for p in sorted(REPORT.rglob('*')) if p.is_file()])
    if not all(r['expectation_met'] for r in results): raise SystemExit(1)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=('prepare', 'run'))
    args = parser.parse_args()
    prepare() if args.phase == 'prepare' else execute()
