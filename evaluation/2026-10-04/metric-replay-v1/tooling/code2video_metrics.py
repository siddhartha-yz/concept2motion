"""Offline, strict calculation of pinned TeachQuiz/AES response formats.

This is an explicit parser/failure-handling adaptation, not judge validation.
No transport, model call, source discovery or media processing is included.
"""
from collections import Counter
import json
import math
import re

DIMENSIONS = ('element_layout', 'attractiveness', 'logic_flow', 'accuracy_depth', 'visual_consistency')
DIMENSION_NAMES = ('Element Layout', 'Attractiveness', 'Logic Flow', 'Accuracy and Depth', 'Visual Consistency')
STAGES = ('baseline', 'post_unlearning', 'post_video')


def validate_questions(questions):
    ids = set()
    for q in questions:
        ident = q.get('id')
        if not isinstance(ident, str) or not ident.strip() or ident in ids:
            raise ValueError('Unique nonempty question IDs required')
        ids.add(ident)
        if not isinstance(q.get('question'), str) or not q['question'].strip():
            raise ValueError('Question text required')
        options = q.get('options')
        if not isinstance(options, dict) or set(options) != set('ABCD'):
            raise ValueError('Exactly A/B/C/D options required; do not shift missing option letters')
        if any(not isinstance(v, str) or not v.strip() for v in options.values()):
            raise ValueError('Nonempty option text required')
        if len(set(options.values())) != 4 or q.get('answer') not in options:
            raise ValueError('Distinct options and a valid answer key required')
    return questions


def grade_answer(response, correct_answer, mode):
    if mode not in ('baseline', 'selective') or correct_answer not in 'ABCD' or len(correct_answer) != 1:
        raise ValueError('Valid answer key and mode required')
    invalid = {'status': 'invalid', 'answer': None, 'correct': False}
    if not isinstance(response, str) or not response.strip():
        return invalid
    answer_fields = re.findall(r'^\s*ANSWER\s*=\s*(A|B|C|D|NULL)\s*$', response, re.MULTILINE)
    status_fields = re.findall(r'^\s*EVIDENCE_STATUS\s*=\s*(SUFFICIENT|INSUFFICIENT)\s*$', response, re.MULTILINE)
    if mode == 'selective':
        if len(answer_fields) != 1 or len(status_fields) != 1:
            return invalid
        status, answer = status_fields[0], answer_fields[0]
        if status == 'INSUFFICIENT' and answer == 'NULL':
            return {'status': 'unverifiable', 'answer': None, 'correct': False}
        if status != 'SUFFICIENT' or answer not in 'ABCD':
            return invalid
    else:
        first = response.strip().splitlines()[0]
        m = re.fullmatch(r'([A-D])(?:[).:]?(?:\s+.*)?)?', first)
        if not m or status_fields or (answer_fields and answer_fields != [m[1]]):
            return invalid
        answer = m[1]
    return {'status': 'correct' if answer == correct_answer else 'wrong',
            'answer': answer, 'correct': answer == correct_answer}


def grade_stage(questions, records, mode):
    validate_questions(questions)
    known = {q['id']: q for q in questions}
    ids = [r.get('id') for r in records]
    if len(ids) != len(set(ids)) or any(i not in known for i in ids):
        raise ValueError('Unknown/duplicate question responses rejected')
    by_id = {r['id']: r for r in records}
    rows = []
    for q in questions:
        r = by_id.get(q['id'])
        if r is None:
            answer = {'status': 'missing', 'answer': None, 'correct': False}
        elif r.get('status') == 'call_failed':
            answer = {'status': 'call_failed', 'answer': None, 'correct': False}
        elif r.get('status') != 'completed':
            answer = {'status': 'invalid', 'answer': None, 'correct': False}
        else:
            answer = grade_answer(r.get('response'), q['answer'], mode)
        rows.append({'id': q['id'], **answer})
    n, correct = len(questions), sum(r['correct'] for r in rows)
    statuses = Counter(r['status'] for r in rows)
    reportable = bool(n and not any(statuses[s] for s in ('missing', 'call_failed', 'invalid')))
    return {'questions': n, 'correct': correct,
            'full_denominator_fraction': {'numerator': correct, 'denominator': n,
                                          'value': correct / n if n else None},
            'reportable': reportable, 'statuses': dict(statuses), 'rows': rows,
            'scope': 'answer-key calculation; insufficient evidence is noncorrect, execution failures block a gain claim'}


def teachquiz(questions, stages):
    if set(stages) != set(STAGES):
        raise ValueError('All three fixed stages required')
    results = {stage: grade_stage(questions, stages[stage], 'baseline' if stage == 'baseline' else 'selective')
               for stage in STAGES}
    reportable = all(r['reportable'] for r in results.values())
    gain = (results['post_video']['full_denominator_fraction']['value']
            - results['post_unlearning']['full_denominator_fraction']['value']) if reportable else None
    return {'stages': results, 'learning_gain': gain,
            'learning_gain_percentage_points': 100 * gain if gain is not None else None,
            'reportable': reportable, 'measurement': 'model answer-key gain, not human learning',
            'unlearning_proven': False}


def parse_aes(response, status='completed'):
    if status == 'call_failed':
        return {'status': 'call_failed', 'overall_score': None}
    if status != 'completed' or not isinstance(response, str):
        return {'status': 'invalid', 'overall_score': None}
    text = response.strip()
    fence = re.fullmatch(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
    if fence:
        text = fence[1]
    scores = {}
    try:
        if text.startswith('{'):
            data = json.loads(text)
            for key in DIMENSIONS:
                scores[key] = data[key]['score']
        else:
            patterns = ('Element Layout', 'Attractiveness', 'Logic Flow', r'Accuracy (?:and|&) Depth', 'Visual Consistency')
            for key, name in zip(DIMENSIONS, patterns):
                matches = re.findall(rf'^\s*{name}\s*:\s*([-+]?\d+(?:\.\d+)?)\s*(?:/\s*20)?\s*$', text,
                                     re.MULTILINE | re.IGNORECASE)
                if len(matches) != 1:
                    raise ValueError('One explicit score per dimension required')
                scores[key] = float(matches[0])
        if any(type(v) not in (int, float) or not math.isfinite(v) or not 0 <= v <= 20 for v in scores.values()):
            raise ValueError('Scores must be finite numbers within 0–20')
        total = round(sum(scores.values()), 2)
        if text.startswith('{') and 'overall_score' in data:
            claimed = data['overall_score']
            if type(claimed) not in (int, float) or not math.isfinite(claimed) or abs(claimed - total) > .01:
                raise ValueError('Declared total disagrees with the five dimensions')
    except (ValueError, KeyError, TypeError):
        return {'status': 'invalid', 'overall_score': None}
    return {'status': 'valid', 'dimensions': scores, 'overall_score': total,
            'scope': 'five 0–20 scores summed; no semantic or artistic judgement performed'}
