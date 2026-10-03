"""Import factual probe responses offline. Never dispatches a model or scores art."""
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path

LABELS = ('supported', 'contradicted', 'unverifiable')
OUTCOMES = (*LABELS, 'missing', 'call_failed', 'invalid')


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read(path):
    return json.loads(Path(path).read_text())


def inside(root, name):
    path = (root / name).resolve()
    if not path.is_relative_to(root.resolve()) or not path.is_file():
        raise ValueError('Artifact must be a file inside its declared root')
    return path


def verify_pack(pack, repo):
    """Verify archived sources and exact local stimuli, without altering the pack."""
    pack, repo = Path(pack).resolve(), Path(repo).resolve()
    count = 0
    for item in read(pack / 'frozen.json'):
        if sha(inside(pack, item['path'])) != item['sha256']:
            raise ValueError('Frozen probe file changed')
        count += 1
    frozen = read(pack / 'stimuli-frozen.json')
    if sha(pack / 'stimuli.json') != frozen['stimuli_sha256']:
        raise ValueError('Stimulus manifest changed')
    stimuli = read(pack / 'stimuli.json')
    if stimuli != frozen['samples']:
        raise ValueError('Stimulus manifest disagrees with frozen samples')
    facts = read(pack / 'oracle.json')['facts']
    ids = [s['id'] for s in stimuli]
    if len(ids) != len(set(ids)) or set(ids) != {f['id'] for f in facts}:
        raise ValueError('Unique stimulus IDs must match oracle IDs')
    artifact_count = 0
    for s in stimuli:
        artifacts = [(s[k], s[k + '_sha256']) for k in ('contact', 'video', 'prompt')]
        artifacts += [(f['frame'], f['sha256']) for f in s['frames']]
        for name, expected in artifacts:
            if sha(inside(repo, name)) != expected:
                raise ValueError('Actual stimulus changed or unavailable')
            artifact_count += 1
    return stimuli, facts, {'frozen_files': count, 'stimulus_artifacts': artifact_count,
                            'stimuli_sha256': frozen['stimuli_sha256']}


def valid_response(response, stimulus):
    if response.get('contact_sha256') != stimulus['contact_sha256']:
        raise ValueError('Response must bind the exact supplied contact sheet')
    if response.get('label') not in LABELS:
        raise ValueError('Unknown factual label')
    if not isinstance(response.get('limitations'), str) or not response['limitations'].strip():
        raise ValueError('Explicit limitations required')
    observations = response.get('observations')
    if not isinstance(observations, list) or not observations:
        raise ValueError('Frame observations required, including for unverifiable')
    frames = {f['time_s']: f['sha256'] for f in stimulus['frames']}
    for o in observations:
        if not isinstance(o, dict):
            raise ValueError('Observation must be an object')
        t = o.get('time_s')
        if type(t) not in (int, float) or not math.isfinite(t) or t not in frames:
            raise ValueError('Observation must use a supplied frame time')
        if o.get('frame_sha256') != frames[t]:
            raise ValueError('Observation frame hash does not match supplied frame')
        for key in ('object', 'description'):
            if not isinstance(o.get(key), str) or not o[key].strip():
                raise ValueError('Object and concrete observation required')
    return response['label']


def ratio(n, d):
    return {'numerator': n, 'denominator': d, 'value': n / d if d else None}


def summarize(stimuli, facts, envelope):
    """Keep one independent control per denominator; missing/invalid are not dropped."""
    if envelope.get('kind') not in ('mock', 'external'):
        raise ValueError('Declare mock or external provenance')
    if not isinstance(envelope.get('reviewer'), str) or not envelope['reviewer'].strip():
        raise ValueError('Reviewer/provenance required')
    responses = envelope.get('responses')
    if not isinstance(responses, list) or any(not isinstance(r, dict) for r in responses):
        raise ValueError('Responses must be a list of objects')
    known = {s['id']: s for s in stimuli}
    oracle = {f['id']: f for f in facts}
    if any(r.get('id') not in known for r in responses):
        raise ValueError('Unknown response ID')
    counts = Counter(r['id'] for r in responses)
    if any(n > 1 for n in counts.values()):
        raise ValueError('Duplicate IDs/repeats cannot count as new controls')
    by_id = {r['id']: r for r in responses}
    rows = []
    for ident, s in known.items():
        r = by_id.get(ident)
        error = None
        if r is None:
            outcome = 'missing'
        elif r.get('status') == 'call_failed':
            outcome = 'call_failed'
        else:
            try:
                if r.get('status') != 'completed':
                    raise ValueError('Status must be completed or call_failed')
                outcome = valid_response(r, s)
            except (ValueError, TypeError, KeyError) as e:
                outcome, error = 'invalid', str(e)
        f = oracle[ident]
        rows.append({'id': ident, 'fact': f['fact'], 'expected': f['expected_fact'],
                     'outcome': outcome, 'error': error, 'correct': outcome == f['expected_fact']})

    def group(selected):
        matrix = {label: {out: 0 for out in OUTCOMES} for label in LABELS}
        for r in selected:
            matrix[r['expected']][r['outcome']] += 1
        n = len(selected)
        valid = sum(r['outcome'] in LABELS for r in selected)
        correct = sum(r['correct'] for r in selected)
        # Both correct-only-among-valid and full denominator are explicit.
        return {'controls': n, 'confusion': matrix, 'response_coverage': ratio(valid, n),
                'label_matches_all_controls': ratio(correct, n),
                'label_matches_valid_responses': ratio(correct, valid),
                'by_truth': {label: ratio(matrix[label][label], sum(matrix[label].values()))
                             for label in LABELS},
                'outcomes': {out: sum(r['outcome'] == out for r in selected) for out in OUTCOMES}}

    return {'kind': envelope['kind'], 'reviewer': envelope['reviewer'],
            'measurement': 'factual control label agreement; not quality or learning',
            'semantic_evidence_verified': False,
            'reliability_claim': 'not established by this importer',
            'overall': group(rows),
            'by_fact': {fact: group([r for r in rows if r['fact'] == fact])
                        for fact in sorted({r['fact'] for r in rows})}, 'rows': rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pack', type=Path, required=True)
    parser.add_argument('--repo', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--responses', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    if args.out.exists():
        raise ValueError('Never overwrite a screening result')
    stimuli, facts, integrity = verify_pack(args.pack, args.repo)
    envelope = read(args.responses)
    if envelope.get('stimuli_sha256') != integrity['stimuli_sha256']:
        raise ValueError('Response batch must bind the frozen stimulus manifest')
    result = summarize(stimuli, facts, envelope)
    result.update(integrity=integrity, responses_sha256=sha(args.responses),
                  importer_sha256=sha(__file__), dispatched_model_calls=0)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open('x') as f:
        f.write(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(result['overall'], ensure_ascii=False))


if __name__ == '__main__':
    main()
