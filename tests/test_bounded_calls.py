import unittest
from tools.bounded_calls import dispatch


class CallGateTests(unittest.TestCase):
    def test_budget_rejected_before_execute(self):
        called = []
        with self.assertRaises(ValueError):
            dispatch(range(3), lambda job: called.append(job), budget=2)
        self.assertEqual(called, [])

    def test_outage_stops_submission_with_at_most_inflight_allowance(self):
        result = dispatch(range(48), lambda job: {'status': 'unknown'}, budget=48, workers=3)
        self.assertTrue(result['stopped'])
        self.assertLessEqual(result['attempts'], 5)
        self.assertGreaterEqual(result['attempts'], 3)
        self.assertEqual(result['attempts'] + len(result['unstarted_indices']), 48)

    def test_success_resets_failure_streak(self):
        sequence = ['unknown', 'unknown', 'completed', 'unknown', 'unknown', 'completed']
        result = dispatch(sequence, lambda status: {'status': status}, budget=6, workers=1)
        self.assertFalse(result['stopped'])
        self.assertEqual(result['attempts'], 6)

    def test_exception_counts_as_attempt_and_stops(self):
        def broken(job):
            raise OSError('simulated connection failure')
        result = dispatch(range(10), broken, budget=10, workers=1)
        self.assertEqual(result['attempts'], 3)
        self.assertEqual(len(result['unstarted_indices']), 7)
        self.assertEqual(result['results'][0]['result']['error_type'], 'OSError')


if __name__ == '__main__':
    unittest.main()
