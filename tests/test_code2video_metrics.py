from pathlib import Path
import sys
import json
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from code2video_metrics import DIMENSIONS, DIMENSION_NAMES, grade_answer, grade_stage, parse_aes, teachquiz, validate_questions


def questions(n=2):
    return [{'id': str(i), 'question': 'Fixture?', 'options': {k: k + ' text' for k in 'ABCD'}, 'answer': 'B'} for i in range(n)]


def answer(ident, sufficient=True):
    return {'id': ident, 'status': 'completed', 'response':
            'EVIDENCE_STATUS = ' + ('SUFFICIENT\nANSWER = B' if sufficient else 'INSUFFICIENT\nANSWER = NULL')}


class MetricTests(unittest.TestCase):
    def test_explicit_answer_wins_over_explanation_letter_and_abstention_not_guess(self):
        r = 'A is a distractor.\nEVIDENCE_STATUS = SUFFICIENT\nANSWER = B'
        self.assertEqual(grade_answer(r, 'B', 'selective')['status'], 'correct')
        r = 'EVIDENCE_STATUS = INSUFFICIENT\nANSWER = NULL\nOption B cannot be determined.'
        self.assertEqual(grade_answer(r, 'B', 'selective')['status'], 'unverifiable')

    def test_contradictory_abstention_duplicate_and_missing_answer_invalid(self):
        for r in ['EVIDENCE_STATUS = INSUFFICIENT\nANSWER = B',
                  'EVIDENCE_STATUS = SUFFICIENT\nANSWER = B\nANSWER = A', 'B']:
            self.assertEqual(grade_answer(r, 'B', 'selective')['status'], 'invalid')

    def test_missing_answers_remain_in_denominator_and_block_gain(self):
        qs = questions(3); stage = grade_stage(qs, [answer('0')], 'selective')
        self.assertEqual(stage['full_denominator_fraction']['denominator'], 3)
        self.assertEqual(stage['statuses']['missing'], 2)
        self.assertFalse(stage['reportable'])

    def test_failed_unlearning_cannot_produce_reportable_positive_gain(self):
        qs = questions()
        stages = {'baseline': [{'id': str(i), 'status': 'completed', 'response': 'B'} for i in range(2)],
                  'post_unlearning': [{'id': str(i), 'status': 'call_failed'} for i in range(2)],
                  'post_video': [answer(str(i)) for i in range(2)]}
        r = teachquiz(qs, stages)
        self.assertIsNone(r['learning_gain']); self.assertFalse(r['reportable'])
        stages['post_unlearning'] = [answer(str(i), False) for i in range(2)]
        r = teachquiz(qs, stages)
        self.assertEqual(r['learning_gain'], 1)
        self.assertEqual(r['learning_gain_percentage_points'], 100)
        self.assertFalse(r['unlearning_proven'])

    def test_empty_questions_no_zero_score_or_learning_claim(self):
        r = teachquiz([], {s: [] for s in ['baseline', 'post_unlearning', 'post_video']})
        self.assertIsNone(r['learning_gain'])
        self.assertIsNone(r['stages']['baseline']['full_denominator_fraction']['value'])

    def test_partial_options_and_duplicate_ids_not_silently_remapped(self):
        qs = questions(); del qs[0]['options']['A']
        with self.assertRaises(ValueError): validate_questions(qs)
        with self.assertRaises(ValueError): grade_stage(questions(), [answer('0'), answer('0')], 'selective')

    def test_json_and_text_same_dimension_values_same_total(self):
        a = parse_aes(json.dumps({k: {'score': 16} for k in DIMENSIONS}))
        b = parse_aes('\n'.join(name + ': 16' for name in DIMENSION_NAMES))
        self.assertEqual(a['overall_score'], 80); self.assertEqual(b['overall_score'], 80)
        self.assertEqual(a['dimensions'], b['dimensions'])

    def test_missing_invalid_nonfinite_and_out_of_range_are_not_zero_scores(self):
        for response in ['{', json.dumps({'element_layout': {'score': 16}}),
                         *[json.dumps({k: {'score': v} for k in DIMENSIONS}) for v in [True, '16', -1, 21, float('nan'), float('inf')]]]:
            r = parse_aes(response)
            self.assertEqual(r['status'], 'invalid'); self.assertIsNone(r['overall_score'])

    def test_service_failure_not_low_quality_and_declared_total_must_match(self):
        self.assertEqual(parse_aes('', status='call_failed')['status'], 'call_failed')
        data = {k: {'score': 16} for k in DIMENSIONS}; data['overall_score'] = 100
        self.assertEqual(parse_aes(json.dumps(data))['status'], 'invalid')


if __name__ == '__main__': unittest.main()
