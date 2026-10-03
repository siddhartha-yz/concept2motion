import copy
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'tools'))
import model_infra_pilot as pilot
from report_model_infra_pilot import stable_comparison


class PilotIsolation(unittest.TestCase):
    def test_missing_video_is_not_a_quality_tie_or_loss(self):
        self.assertEqual(stable_comparison([{'winner':'tie'},{'winner':'tie'}],False),'not_comparable')
        self.assertEqual(stable_comparison([{'winner':'B'},{'winner':'B'}],False),'not_comparable')
        self.assertEqual(stable_comparison([{'winner':'C'},{'winner':'B'}],True),'unresolved')
        self.assertEqual(stable_comparison([{'winner':'C'},{'winner':'C'}],True),'C')

    def test_generic_retry_cannot_see_contract_verdict(self):
        manifest = {'status': 'checks_failed', 'errors': ['JS failure'], 'externalRequests': [],
                    'checks': {'passed': False, 'findings': [{'code': 'wrong_probability', 'detail': 'class 1', 'time_s': 4}]}}
        plain = pilot.feedback(manifest, False)
        enhanced = pilot.feedback(manifest, True)
        self.assertEqual(plain, {'execution_errors': ['JS failure'], 'external_requests': []})
        self.assertIn('wrong_probability', str(enhanced))
        self.assertFalse(enhanced['passed'])

    def test_judge_must_account_for_every_candidate_criterion_and_pair(self):
        ids = list('WXYZ')
        response = {'videos': [{'id': ident, 'checks': [{'criterion': i, 'status': 'missing', 'time_s': 1,
                     'evidence': 'no visible supporting geometry'} for i in range(4)]} for ident in ids],
                    'comparisons': [{'left': a, 'right': b, 'winner': 'tie', 'reason': 'both lack evidence'}
                                    for i,a in enumerate(ids) for b in ids[i+1:]]}
        pilot.validate_judge(response, ids)
        invalid = copy.deepcopy(response)
        invalid['videos'].pop()
        with self.assertRaises(ValueError):
            pilot.validate_judge(invalid, ids)
        invalid = copy.deepcopy(response)
        invalid['comparisons'][0] = invalid['comparisons'][1]
        with self.assertRaises(ValueError):
            pilot.validate_judge(invalid, ids)
        invalid = copy.deepcopy(response)
        invalid['videos'][0]['checks'][0]['time_s'] = float('nan')
        with self.assertRaises(ValueError):
            pilot.validate_judge(invalid, ids)


if __name__ == '__main__':
    unittest.main()
