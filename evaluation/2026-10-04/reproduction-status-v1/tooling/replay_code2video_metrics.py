"""Replay pinned score code in isolated AST-selected definitions; no provider imports.

Uses deterministic mock responses only. Does not call a model, evaluate real video,
modify upstream files, or reproduce paper outcomes.
"""
import argparse
import ast
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
import contextlib
from dataclasses import dataclass, asdict
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import tempfile
from threading import Lock
from types import ModuleType
from typing import Any, Callable, Dict, List, Optional, Tuple

from code2video_metrics import DIMENSIONS, DIMENSION_NAMES, grade_answer, grade_stage, parse_aes, teachquiz, validate_questions

ROOT = Path(__file__).resolve().parents[1]
PIN = '1142d8e14cdc2806df85aedb0fbb5dca474caa0f'
SELECTIONS = {
    'prompts/stage5_unlearning.py': ['get_unlearning_prompt', 'get_unlearning_and_video_learning_prompt'],
    'prompts/stage5_eva.py': ['get_prompt_aes'],
    'src/utils.py': ['extract_json_from_markdown', 'extract_answer_from_response'],
    'src/eval_TQ.py': ['Question', 'EvaluationResult', 'load_questions_from_json', 'SelectiveKnowledgeUnlearning'],
    'src/eval_AES.py': ['EvaluationResult', 'VideoEvaluator'],
}


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def load(path):
    return json.loads(Path(path).read_text())


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('x') as f:
        f.write(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def verify(upstream, manifest):
    if manifest['commit'] != PIN:
        raise ValueError('Pinned source commit required')
    for item in manifest['files']:
        p = (upstream / item['path']).resolve()
        if not p.is_relative_to(upstream.resolve()) or sha(p) != item['sha256']:
            raise ValueError('Upstream hash mismatch')
    return len(manifest['files'])


def native_definitions(upstream):
    common = dict(dataclass=dataclass, re=re, json=json, Path=Path, List=List, Dict=Dict, Tuple=Tuple,
                  Any=Any, Callable=Callable, Optional=Optional, ThreadPoolExecutor=ThreadPoolExecutor,
                  as_completed=as_completed, Lock=Lock)
    namespaces, selected = {}, []
    for index, (name, names) in enumerate(SELECTIONS.items()):
        source = upstream / name; tree = ast.parse(source.read_text(), filename=str(source))
        nodes = [n for n in tree.body if isinstance(n, (ast.ClassDef, ast.FunctionDef)) and n.name in names]
        if {n.name for n in nodes} != set(names):
            raise ValueError('Pinned definition missing')
        # Definitions are the original AST nodes. Top-level imports/main/API wrappers never execute.
        module = ModuleType(f'_c2m_native_metric_replay_{index}')
        sys.modules[module.__name__] = module
        module.__dict__.update(common)
        selected.extend({'file': name, 'definition': n.name, 'start_line': n.lineno,
                         'end_line': n.end_lineno, 'source_sha256': sha(source)} for n in nodes)
        exec(compile(ast.Module(body=nodes, type_ignores=[]), str(source), 'exec'), module.__dict__)
        namespaces[name] = module.__dict__
        if name.startswith('prompts/') or name == 'src/utils.py':
            common.update({n.name: module.__dict__[n.name] for n in nodes})
    return namespaces, selected


def prepare(upstream, out):
    if (out / 'frozen.json').exists(): raise ValueError('Do not replace frozen inputs')
    plan = load(out / 'plan.json')
    manifest = load(ROOT / plan['upstream_manifest'])
    count = verify(upstream, manifest)
    for name in ('replay_code2video_metrics.py', 'code2video_metrics.py'):
        target = out / 'tooling' / name; target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('xb') as f: f.write((ROOT / 'tools' / name).read_bytes())
    save(out / 'upstream-identity.json', {'commit': PIN, 'source_files_verified': count,
         'source_manifest_sha256': sha(ROOT / plan['upstream_manifest']),
         'provenance': 'existing pinned file export; no independent .git; provider modules not imported',
         'selected_file_hashes': {name: sha(upstream / name) for name in SELECTIONS},
         'question_file_sha256': sha(upstream / 'json_files/questions_by_topic_10.json')})
    save(out / 'frozen.json', [{'path': str(p.relative_to(out)), 'sha256': sha(p)}
                              for p in sorted(out.rglob('*')) if p.is_file()])


def replay(upstream, out):
    for item in load(out / 'frozen.json'):
        if sha(out / item['path']) != item['sha256']: raise ValueError('Frozen replay input changed')
    for name in ('replay_code2video_metrics.py', 'code2video_metrics.py'):
        if sha(ROOT / 'tools' / name) != sha(out / 'tooling' / name): raise ValueError('Runner changed')
    plan = load(out / 'plan.json'); manifest = load(ROOT / plan['upstream_manifest'])
    before_count = verify(upstream, manifest)
    native, selected = native_definitions(upstream)
    tq = native['src/eval_TQ.py']; aes = native['src/eval_AES.py']
    Question = tq['Question']
    q = Question(question='Which mock option is designated correct?', options=['first', 'second', 'third', 'fourth'], correct_answer='second')
    strict_q = {'id': 'q1', 'question': q.question, 'options': dict(zip('ABCD', q.options)), 'answer': 'B'}
    forbidden_calls = []
    def forbidden(*args, **kwargs):
        forbidden_calls.append('forbidden_external_request')
        raise RuntimeError('No provider transport exists in this replay')
    grader = tq['SelectiveKnowledgeUnlearning'](forbidden, per_question_workers=1)
    evaluator = aes['VideoEvaluator'](forbidden)
    rows, mock_request_count = [], 0
    captured = io.StringIO()
    with contextlib.redirect_stdout(captured):
        for case in plan['cases']:
            ident = case['id']; row = {'id': ident, 'kind': 'mock native score replay'}
            if ident in ('tq-correct', 'tq-wrong', 'tq-first-letter', 'tq-explanation-prefix', 'tq-insufficient-letter'):
                score, details = grader._grade_batch([q], [case['response']])
                guarded = grade_answer(case['response'], 'B', 'baseline' if ident in ('tq-correct', 'tq-wrong') else 'selective')
                row.update(native_accuracy=score, native_details=details, guarded=guarded,
                           expectation_met=score == case['expected_native_accuracy'] and guarded['status'] == case['expected_guarded_status'])
            elif ident == 'tq-truncated-list':
                score, details = grader._grade_batch([q] * 3, ['B'])
                qs = [{**strict_q, 'id': f'q{i}'} for i in range(3)]
                guarded = grade_stage(qs, [{'id': 'q0', 'status': 'completed', 'response': 'B'}], 'baseline')
                row.update(native_accuracy=score, native_details=details, guarded=guarded,
                           expectation_met=score == case['expected_native_accuracy'] and guarded['statuses']['missing'] == case['expected_guarded_missing'])
            elif ident == 'tq-stage-failure':
                n = case['questions']; counter = []
                def text_mock(prompt):
                    counter.append('text_mock')
                    if '[SELECTIVE-UNLEARNING TARGET]' in prompt: raise RuntimeError('fixed_mock_request_failure')
                    return 'B'
                def video_mock(prompt):
                    counter.append('video_mock_no_media_read')
                    return 'EVIDENCE_STATUS = SUFFICIENT\nANSWER = B'
                worker = tq['SelectiveKnowledgeUnlearning'](text_mock, per_question_workers=1)
                native_result = worker.evaluate_educational_video('mock concept', [q] * n, video_mock)
                qs = [{**strict_q, 'id': str(i)} for i in range(n)]
                stages = {'baseline': [{'id': str(i), 'status': 'completed', 'response': 'B'} for i in range(n)],
                          'post_unlearning': [{'id': str(i), 'status': 'call_failed'} for i in range(n)],
                          'post_video': [{'id': str(i), 'status': 'completed', 'response': 'EVIDENCE_STATUS = SUFFICIENT\nANSWER = B'} for i in range(n)]}
                guarded = teachquiz(qs, stages); mock_request_count += len(counter)
                row.update(native=asdict(native_result), guarded=guarded, mock_function_invocations=len(counter),
                           attached_video=None, expectation_met=native_result.learning_gain == case['expected_native_gain'] and guarded['learning_gain'] is None)
            elif ident == 'tq-incomplete-options':
                bad = {'question': 'Mock?', 'options': {'B': 'second', 'C': 'third', 'D': 'fourth'}, 'answer': 'B'}
                with tempfile.TemporaryDirectory() as directory:
                    path = Path(directory) / 'questions.json'; path.write_text(json.dumps({'mock': [bad]}))
                    result = tq['load_questions_from_json'](str(path))['mock'][0]
                rejected = False
                try: validate_questions([{'id': 'bad', **bad}])
                except ValueError: rejected = True
                row.update(native_correct_text=result.correct_answer, guarded_rejected=rejected,
                           expectation_met=result.correct_answer == case['expected_native_correct_text'] and rejected)
            else:
                if ident == 'aes-service-failure':
                    def mock_failure(**kwargs): raise RuntimeError('fixed_mock_service_failure')
                    failed_evaluator = aes['VideoEvaluator'](mock_failure)
                    result = failed_evaluator.evaluate_video('mock-nonexistent.mp4', 'mock concept')
                    guarded = parse_aes('', status='call_failed'); mock_request_count += 1
                else:
                    value = case.get('dimension_score', 16)
                    response = json.dumps({k: {'score': value} for k in DIMENSIONS})
                    if ident == 'aes-text': response = '\n'.join(name + ': 16' for name in DIMENSION_NAMES)
                    if ident == 'aes-malformed': response = case['response']
                    if ident == 'aes-missing-dimensions': response = json.dumps({'element_layout': {'score': 16}})
                    result = evaluator._parse_evaluation_response(response)
                    guarded = parse_aes(response); row['mock_response'] = response
                expectation = result.overall_score == case['expected_native_total']
                if 'expected_guarded_total' in case: expectation &= guarded['overall_score'] == case['expected_guarded_total']
                if 'expected_guarded_status' in case: expectation &= guarded['status'] == case['expected_guarded_status']
                row.update(native=asdict(result), guarded=guarded, expectation_met=bool(expectation))
            rows.append(row)
    # Audit the whole published question-file structure without calling it valid pedagogical truth.
    raw = load(upstream / 'json_files/questions_by_topic_10.json'); errors = []
    for concept, qs in raw.items():
        try: validate_questions([{'id': str(i), **q} for i, q in enumerate(qs)])
        except ValueError as e: errors.append({'concept': concept, 'error': str(e)})
    audit = {'concepts': len(raw), 'questions': sum(len(qs) for qs in raw.values()),
             'questions_per_concept': dict(Counter(len(qs) for qs in raw.values())),
             'answer_key_distribution': dict(Counter(q.get('answer') for qs in raw.values() for q in qs)),
             'structure_errors': errors, 'semantic_answer_truth_verified': False}
    verify(upstream, manifest)
    if forbidden_calls: raise ValueError('Unexpected external transport attempt')
    save(out / 'results.json', {'kind': 'mock native scoring replay; not real judge/model/video evaluation',
         'controls': len(rows), 'expectations_met': sum(r['expectation_met'] for r in rows),
         'rows': rows, 'selected_definitions': selected, 'upstream_files_verified_before_and_after': before_count,
         'mock_request_function_invocations': mock_request_count, 'external_requests': forbidden_calls,
         'model_calls': 0, 'actual_renders': 0, 'artistic_evaluations': 0})
    save(out / 'question-audit.json', audit)
    save(out / 'results-frozen.json', [{'path': str(p.relative_to(out)), 'sha256': sha(p)}
                                      for p in sorted(out.rglob('*')) if p.is_file()])
    print(json.dumps({'controls': len(rows), 'expectations_met': sum(r['expectation_met'] for r in rows),
                      'native_gain_with_mock_failure': next(r['native']['learning_gain'] for r in rows if r['id'] == 'tq-stage-failure'),
                      'model_calls': 0, 'question_structure_errors': len(errors)}))
    if not all(r['expectation_met'] for r in rows): raise SystemExit(1)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=('prepare', 'run'))
    parser.add_argument('--upstream', type=Path, default=ROOT / 'work/code2video-reproduction/upstream')
    parser.add_argument('--out', type=Path, default=ROOT / 'evaluation/2026-10-04/metric-replay-v1')
    args = parser.parse_args()
    prepare(args.upstream.resolve(), args.out.resolve()) if args.phase == 'prepare' else replay(args.upstream.resolve(), args.out.resolve())
