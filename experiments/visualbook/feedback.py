"""Turn an exported reader note into a version-bound revision input."""
import argparse, hashlib, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('note', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    note = json.loads(args.note.read_text())
    section, attempt = note['section'], note['attempt']
    if not all(s and all(c.isalnum() or c == '-' for c in s) for s in [section, attempt]):
        raise SystemExit('Invalid section/attempt')
    candidate = ROOT / 'experiments/visualbook/candidates' / section / attempt
    response_file = candidate / 'response.json'
    response = json.loads(response_file.read_text())
    brief = json.loads((candidate / 'brief.json').read_text())
    if note['sourceSha256'] != brief['sourceSha256']:
        raise SystemExit('Reader note refers to a different source; review explicitly')
    if note['candidateSha256'] != hashlib.sha256(response_file.read_bytes()).hexdigest():
        raise SystemExit('Reader note refers to a different figure version; review explicitly')
    figure = next((f for f in response['figures'] if f['id'] == note['figure']), None)
    if not figure or note['state'] not in [s['key'] for s in figure['states']]:
        raise SystemExit('Reader note has an unknown figure/state')
    if not isinstance(note.get('note'), str) or not note['note'].strip():
        raise SystemExit('Empty reader note')
    payload = {'kind': note.get('kind', 'unclassified note'), 'section': section,
               'fromAttempt': attempt, 'targetFigure': note['figure'], 'issues': [note['note']],
               'observedState': note['state'], 'observedParams': note['params'],
               'sourceSha256': note['sourceSha256'], 'readerNote': note,
               'instruction': 'Fix the reported issue in this figure. Preserve unrelated figure code exactly; independently check the complaint rather than assuming it is correct.',
               'previousResponse': response}
    if args.output.exists():
        raise SystemExit('Refuse to overwrite feedback capsule')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'section': section, 'attempt': attempt, 'figure': note['figure'],
                      'feedback': str(args.output), 'modelCalls': 0}))

if __name__ == '__main__':
    main()
