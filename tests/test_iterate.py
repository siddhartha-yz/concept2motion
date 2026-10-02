"""Contract regressions for the small-loop mechanism evidence, without model calls."""
import math
from pathlib import Path
import sys
import unittest
from types import SimpleNamespace
from unittest import mock

TOOLS = Path(__file__).resolve().parents[1] / 'tools'
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))
import iterate


def tips(phase=-math.pi / 2):
    return [{'x': math.cos(phase + j * math.pi / 3),
             'y': math.sin(phase + j * math.pi / 3)} for j in range(6)]


def state(t, angle=0, reference=0, vertices=None):
    return {'time_s': t, 'state': {'mechanism': {
        'angle': angle, 'referenceAngle': reference,
        'vertices': tips() if vertices is None else vertices}}}


class MechanismChecks(unittest.TestCase):
    def test_studio_time_s_state_format_accepts_actual_six_tip_endpoints(self):
        states = [state(0), state(.8), state(2.8, math.pi / 3),
                  state(4.8, math.pi / 3), state(7.2, 2 * math.pi / 3),
                  state(9.8, 2 * math.pi / 3)]
        self.assertTrue(iterate.mechanism_checks(states)['passed'])

    def test_revision_requires_120_degrees_at_earlier_endpoint(self):
        before = [state(6.85, math.pi / 3)]
        self.assertFalse(iterate.mechanism_checks(before, revised=True)['passed'])
        self.assertTrue(iterate.mechanism_checks([state(6.85, 2 * math.pi / 3)], revised=True)['passed'])

    def test_reported_six_tips_must_be_unique_and_have_unit_radius(self):
        repeated = tips(); repeated[-1] = repeated[0]
        self.assertFalse(iterate.mechanism_checks([state(0, vertices=repeated)])['passed'])
        stretched = tips(); stretched[0]['y'] *= .5
        self.assertFalse(iterate.mechanism_checks([state(0, vertices=stretched)])['passed'])

    def test_six_unit_points_without_sixfold_symmetry_fail(self):
        wrong = tips(); wrong[0] = {'x': math.cos(.1), 'y': math.sin(.1)}
        self.assertFalse(iterate.mechanism_checks([state(0, vertices=wrong)])['passed'])

    def test_five_tips_and_nonfinite_tip_fail(self):
        self.assertFalse(iterate.mechanism_checks([state(0, vertices=tips()[:5])])['passed'])
        invalid = tips(); invalid[2]['x'] = float('nan')
        self.assertFalse(iterate.mechanism_checks([state(0, vertices=invalid)])['passed'])

    def test_wrong_endpoints_and_moving_reference_fail(self):
        self.assertFalse(iterate.mechanism_checks([state(2.8, 0)])['passed'])
        self.assertFalse(iterate.mechanism_checks([state(7.2, math.pi / 3)])['passed'])
        self.assertFalse(iterate.mechanism_checks([state(0, reference=.1)])['passed'])

    def test_no_states_does_not_pass(self):
        self.assertFalse(iterate.mechanism_checks([])['passed'])

    def test_invalid_times_are_saved_as_findings_instead_of_raising(self):
        for t in (None, '0', float('nan'), float('inf'), -1, 11, True):
            with self.subTest(t=t):
                result = iterate.mechanism_checks([state(t)])
                self.assertFalse(result['passed'])
                self.assertTrue(result['findings'])

    def test_booleans_cannot_substitute_for_numeric_angle_or_reference(self):
        self.assertFalse(iterate.mechanism_checks([state(0, angle=False)])['passed'])
        self.assertFalse(iterate.mechanism_checks([state(0, reference=False)])['passed'])

    def test_transient_extra_full_turn_cannot_pass_at_nonendpoint(self):
        self.assertFalse(iterate.mechanism_checks([state(1.8, 2 * math.pi)])['passed'])
        self.assertFalse(iterate.mechanism_checks([state(6.2, -1)])['passed'])


def angle_at(t, second_start=5.2):
    def smooth(start):
        p = max(0, min(1, (t - start) / 2))
        return p * p * (3 - 2 * p)
    return math.pi / 3 * (smooth(.8) + smooth(second_start))


def preview_states(revised=False):
    start, count = (4, 96) if revised else (0, 240)
    second_start = 4.85 if revised else 5.2
    frames = [state(start + i / 24, angle_at(start + i / 24, second_start))
              for i in range(count)]
    samples = []
    for t in iterate.SAMPLES:
        sample = state(t, angle_at(t, second_start))
        # Distinct stable sample hashes; changed motion pixels are allowed inside [4,8].
        prefix = 'revised' if revised and 4 < t < 8 else 'baseline'
        sample['sha256'] = f'{prefix}:{t}'
        samples.append(sample)
    return {'frames': frames, 'samples': samples}


class RevisionChecks(unittest.TestCase):
    def test_full_baseline_and_local_correctly_shifted_preview_pass(self):
        before, after = preview_states(), preview_states(revised=True)
        self.assertEqual(len(before['frames']), 240)
        self.assertEqual(len(after['frames']), 96)
        self.assertTrue(iterate.mechanism_checks(before['frames'] + before['samples'])['passed'])
        self.assertTrue(iterate.mechanism_checks(after['frames'] + after['samples'], revised=True)['passed'])
        result = iterate.revision_checks(before, after)
        self.assertTrue(result['passed'], result['findings'])

    def test_unchanged_second_action_cannot_pass_revision_contract(self):
        before, after = preview_states(), preview_states(revised=True)
        for frame in after['frames']:
            frame['state']['mechanism']['angle'] = angle_at(frame['time_s'], 5.2)
        result = iterate.revision_checks(before, after)
        self.assertFalse(result['passed'])
        self.assertTrue(any(f['code'] == 'wrong_revision_trajectory'
                            for f in result['findings']))

    def test_unrelated_sample_pixel_drift_fails_even_with_correct_motion_shift(self):
        before, after = preview_states(), preview_states(revised=True)
        after['samples'][0]['sha256'] = 'unrelated-first-frame-change'
        result = iterate.revision_checks(before, after)
        self.assertFalse(result['passed'])
        self.assertTrue(any(f['code'] == 'unrelated_pixel_drift' and f['time'] == 0
                            for f in result['findings']))

    def test_correctly_shifted_midpoint_is_checked_against_original_later_time(self):
        before, after = preview_states(), preview_states(revised=True)
        # t=5.5 must match original t=5.85, not its unshifted t=5.5.
        frame = next(f for f in after['frames'] if f['time_s'] == 5.5)
        self.assertAlmostEqual(frame['state']['mechanism']['angle'], angle_at(5.85), places=12)
        frame['state']['mechanism']['angle'] = angle_at(5.5)
        result = iterate.revision_checks(before, after)
        self.assertTrue(any(f['code'] == 'wrong_revision_trajectory' and f['time'] == 5.5
                            for f in result['findings']))


class CallBudget(unittest.TestCase):
    def test_budget_exhaustion_prevents_call_and_timeout_is_capped_by_remaining(self):
        args = SimpleNamespace(budget=10, timeout=120, codex='unused')
        with mock.patch.object(iterate.time, 'monotonic', return_value=8), \
             mock.patch.object(iterate, 'model_call') as client:
            with self.assertRaises(RuntimeError):
                iterate.call(args, Path('/tmp/unused'), '', {}, started=0)
            client.assert_not_called()
        with mock.patch.object(iterate.time, 'monotonic', return_value=4), \
             mock.patch.object(iterate, 'model_call', return_value={'source': 'ok'}) as client:
            self.assertEqual(iterate.call(args, Path('/tmp/unused'), '', {}, started=0), {'source': 'ok'})
            self.assertEqual(client.call_args.args[0].model_timeout, 6)


if __name__ == '__main__':
    unittest.main()
