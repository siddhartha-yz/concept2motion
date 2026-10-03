import copy
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from score_fact_responses import summarize, valid_response


class FactResponseTests(unittest.TestCase):
    def setUp(self):
        self.stimuli = [{'id': str(i), 'contact_sha256': 'contact',
                         'frames': [{'time_s': 1, 'sha256': 'frame'}]} for i in range(6)]
        self.facts = [{'id': str(i), 'fact': 'join', 'expected_fact': label}
                      for i, label in enumerate(['supported', 'supported', 'contradicted',
                                                 'contradicted', 'unverifiable', 'unverifiable'])]

    def response(self, ident, label):
        return {'id': ident, 'status': 'completed', 'label': label, 'contact_sha256': 'contact',
                'limitations': 'Mock only; no semantic observation performed',
                'observations': [{'time_s': 1, 'frame_sha256': 'frame', 'object': 'arrows',
                                  'description': 'Synthetic schema fixture, not a visual judgement'}]}

    def envelope(self, records):
        return {'kind': 'mock', 'reviewer': 'test fixture', 'responses': records}

    def test_full_denominator_keeps_wrong_unknown_missing_failed_invalid(self):
        invalid = self.response('3', 'contradicted'); invalid['observations'][0]['time_s'] = 2
        r = summarize(self.stimuli, self.facts, self.envelope([
            self.response('0', 'supported'), self.response('1', 'contradicted'),
            self.response('2', 'unverifiable'), invalid, {'id': '4', 'status': 'call_failed'}]))
        g = r['overall']
        self.assertEqual(g['label_matches_all_controls'], {'numerator': 1, 'denominator': 6, 'value': 1/6})
        self.assertEqual(g['label_matches_valid_responses']['denominator'], 3)
        self.assertEqual(g['outcomes']['invalid'], 1)
        self.assertEqual(g['outcomes']['missing'], 1)
        self.assertEqual(g['outcomes']['call_failed'], 1)
        self.assertEqual(g['confusion']['contradicted']['unverifiable'], 1)
        self.assertFalse(r['semantic_evidence_verified'])

    def test_empty_batch_does_not_claim_valid_label_accuracy(self):
        g = summarize(self.stimuli, self.facts, self.envelope([]))['overall']
        self.assertEqual(g['outcomes']['missing'], 6)
        self.assertIsNone(g['label_matches_valid_responses']['value'])

    def test_wrong_frame_contact_time_and_absent_object_rejected(self):
        for where, value in [('contact', 'wrong'), ('frame', 'wrong'), ('time', True), ('object', '')]:
            r = self.response('0', 'supported')
            if where == 'contact': r['contact_sha256'] = value
            else: r['observations'][0][{'frame': 'frame_sha256', 'time': 'time_s', 'object': 'object'}[where]] = value
            with self.assertRaises(ValueError): valid_response(r, self.stimuli[0])

    def test_duplicates_unknown_ids_and_undeclared_provenance_rejected(self):
        a = self.response('0', 'supported')
        for records in ([a, copy.deepcopy(a)], [self.response('unknown', 'supported')]):
            with self.assertRaises(ValueError): summarize(self.stimuli, self.facts, self.envelope(records))
        e = self.envelope([]); e['kind'] = 'quality_result'
        with self.assertRaises(ValueError): summarize(self.stimuli, self.facts, e)


if __name__ == '__main__': unittest.main()
