"""Offline summary of separately authorized completion calls; never rewrites v1."""
from collections import Counter
from dataclasses import asdict
from pathlib import Path

import reference_screening as original
from batch import digest, save
from code2video_metrics import parse_aes
from replay_code2video_metrics import native_definitions
from score_fact_responses import summarize, verify_pack


def main():
    original.verify()
    out = original.ROOT / 'evaluation/2026-10-04/full-reproduction-v1'
    target = out / 'screening-composite-results.json'
    if target.exists():
        raise ValueError('Do not overwrite results')
    stimuli, facts, integrity = verify_pack(original.PACK, original.ROOT)
    by_id = {s['id']: s for s in stimuli}
    new = {j['id']: j for j in original.read(out / 'screening-completion-jobs.json')}
    native, _ = native_definitions(original.ROOT / 'work/code2video-reproduction/upstream')
    evaluator = native['src/eval_AES.py']['VideoEvaluator'](None)
    utils = original.tea_utils()
    rows, envelopes = [], {r: {'kind': 'external', 'reviewer': 'gpt-6-astra; composite of two separately authorized batches', 'responses': []} for r in (1, 2)}
    for job in original.read(original.OUT / 'screening-jobs.json'):
        is_new = job['id'] in new
        path = out / 'new-responses' / f"{new[job['id']]['new_id']}.json" if is_new else original.OUT / 'responses' / f"{job['id']}.json"
        result = original.read(path)
        row = {'job': job['id'], 'method': job['method'], 'control': job['control'],
               'batch': 'new96' if is_new else 'old48', 'response_file': str(path.relative_to(original.ROOT)),
               'response_sha256': digest(path), 'status': result['status']}
        response = result.get('response', {})
        if job['method'] == 'fact':
            s = by_id[job['control']]
            wrapped = dict(response, id=s['id'], status='completed' if result['status'] == 'completed' else 'call_failed', contact_sha256=s['contact_sha256'])
            hashes = {f['time_s']: f['sha256'] for f in s['frames']}
            for observation in wrapped.get('observations', []):
                observation['frame_sha256'] = hashes.get(observation.get('time_s'))
            envelopes[job['repeat']]['responses'].append(wrapped)
        elif result['status'] == 'completed':
            try:
                content = response['content']
                if job['method'] == 'aes':
                    row['native'] = asdict(evaluator._parse_evaluation_response(content))
                    row['strict'] = parse_aes(content)
                else:
                    parsed = utils['convert_score_fields'](utils['extract_json'](content))
                    scores = [parsed['evaluation'][k]['score'] for k in ('visual_relevance', 'element_layout')]
                    row.update(native=parsed, single_frame_geometric_mean=utils['calculate_geometric_mean'](scores), range_valid=all(type(s) is int and 1 <= s <= 5 for s in scores))
            except (KeyError, TypeError, ValueError) as error:
                row['parse_error'] = str(error)
        rows.append(row)
    scores = {}
    for repeat, envelope in envelopes.items():
        envelope['stimuli_sha256'] = integrity['stimuli_sha256']
        save(out / f'composite-fact-responses-r{repeat}.json', envelope)
        scores[repeat] = summarize(stimuli, facts, envelope)
        save(out / f'composite-fact-results-r{repeat}.json', scores[repeat])
    pairs = list(zip(scores[1]['rows'], scores[2]['rows']))
    agreement = sum(a['outcome'] == b['outcome'] for a, b in pairs)
    save(target, {'rows': rows, 'selected_response_counts': dict(Counter(r['status'] for r in rows)),
                 'repeated_label_agreement': {'numerator': agreement, 'denominator': len(pairs)},
                 'independent_controls': len(stimuli), 'new_attempts': len(new),
                 'old_attempts_preserved': 48, 'composite_is_one_batch': False,
                 'semantic_evidence_verified': False,
                 'limitations': 'Same frozen controls across two dates/budgets; changed paper models and sparse still inputs. No general quality, learning, or full reproduction claim.'})
    print({r: s['overall'] for r, s in scores.items()})


if __name__ == '__main__':
    main()
