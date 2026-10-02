"""Source-preserving action retiming contracts; no browser or model calls."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


spec = importlib.util.spec_from_file_location(
    'retime', Path(__file__).resolve().parents[1] / 'tools/retime.py')
retime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(retime)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def snapshot(directory):
    return {str(p.relative_to(directory)): p.read_bytes()
            for p in directory.rglob('*') if p.is_file()}


class RetimeTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.scene = self.root / 'original'
        self.scene.mkdir()
        (self.scene / 'assets').mkdir()
        (self.scene / 'scene.mjs').write_bytes(
            b'// preserved drawing source\r\nexport const createScene = runtime => {};\r\n')
        (self.scene / 'index.html').write_bytes(b'<!doctype html><canvas></canvas>\n')
        (self.scene / 'assets/icon.svg').write_bytes(b'<svg><!-- retained --></svg>\n')
        self.result = self.measure(self.scene)

    def measure(self, scene, timings=None):
        return {
            'status': 'preview_ready',
            'meta': {
                'duration': 10,
                'timings': timings or {
                    'turn-one': {'start': .8, 'end': 2.8},
                    'turn-two': {'start': 5.2, 'end': 7.2},
                },
            },
            'sources': [
                {'path': name, 'sha256': digest(data)}
                for name, data in snapshot(scene).items()
                if name != 'revision.json'
            ] + [{'path': 'runtime/concept-runtime.mjs', 'sha256': 'host-runtime'}],
        }

    def assert_rejected_without_changes(self, *, action='turn-two', shift=-.35,
                                        result=None, out=None):
        out = out or self.root / 'rejected'
        before = snapshot(self.root)
        with self.assertRaises(ValueError):
            retime.retime(self.scene, result or self.result, action, shift, out)
        self.assertEqual(snapshot(self.root), before)
        self.assertEqual(list(self.root.glob('.c2m-retime-*')), [])

    def test_registered_shift_changes_timing_only_and_preserves_original(self):
        before = snapshot(self.scene)
        measured = copy.deepcopy(self.result)
        out = self.root / 'retimed'
        record = retime.retime(self.scene, self.result, 'turn-two', -.35, out)

        self.assertEqual(json.loads((out / 'timing.json').read_text()), {
            'turn-two': {'start': 4.85, 'end': 6.85}})
        self.assertEqual(snapshot(self.scene), before)
        self.assertEqual(self.result, measured)
        for name, data in before.items():
            self.assertEqual((out / name).read_bytes(), data)
        self.assertEqual(set(snapshot(out)) - set(before), {'timing.json', 'revision.json'})
        self.assertFalse((out / 'runtime').exists())
        self.assertEqual(record['before'], {'start': 5.2, 'end': 7.2})
        self.assertEqual(record['after'], {'start': 4.85, 'end': 6.85})
        self.assertTrue(record['scene_source_unchanged'])
        self.assertEqual(record['model_calls'], 0)
        self.assertEqual(record['timing_sha256'], digest((out / 'timing.json').read_bytes()))
        self.assertEqual(json.loads((out / 'revision.json').read_text()), record)
        self.assertIn('not rendered', record['verification'])

    def test_retiming_uses_current_measured_interval_for_subsequent_revision(self):
        first = self.root / 'first'
        retime.retime(self.scene, self.result, 'turn-two', -.35, first)
        latest = self.measure(first, {
            'turn-one': {'start': .8, 'end': 2.8},
            'turn-two': {'start': 4.85, 'end': 6.85},
        })
        before_first = snapshot(first)
        second = self.root / 'second'
        record = retime.retime(first, latest, 'turn-two', -.35, second)
        self.assertEqual(record['before'], {'start': 4.85, 'end': 6.85})
        self.assertEqual(record['after'], {'start': 4.5, 'end': 6.5})
        self.assertEqual(snapshot(first), before_first)
        self.assertEqual((second / 'scene.mjs').read_bytes(),
                         (self.scene / 'scene.mjs').read_bytes())

    def test_partial_overrides_for_other_actions_are_retained(self):
        overrides = {'turn-one': {'start': .5}, 'turn-two': {'end': 7.1}}
        (self.scene / 'timing.json').write_text(json.dumps(overrides))
        measured = self.measure(self.scene, {
            'turn-one': {'start': .5, 'end': 2.8},
            'turn-two': {'start': 5.2, 'end': 7.1},
        })
        before = snapshot(self.scene)
        out = self.root / 'partial'
        retime.retime(self.scene, measured, 'turn-two', -.35, out)
        self.assertEqual(json.loads((out / 'timing.json').read_text()), {
            'turn-one': {'start': .5},
            'turn-two': {'start': 4.85, 'end': 6.75},
        })
        self.assertEqual(snapshot(self.scene), before)

    def test_stale_drawing_source_is_rejected_before_creating_output(self):
        (self.scene / 'scene.mjs').write_bytes(b'// changed since preview\n')
        self.assert_rejected_without_changes()

    def test_stale_timing_source_is_rejected_before_creating_output(self):
        (self.scene / 'timing.json').write_text('{}')
        measured = self.measure(self.scene)
        (self.scene / 'timing.json').write_text('{"turn-one":{"start":0.5}}')
        self.assert_rejected_without_changes(result=measured)

    def test_unknown_action_is_rejected(self):
        self.assert_rejected_without_changes(action='misspelled-turn')

    def test_nonfinite_boolean_zero_and_nonnumeric_shifts_are_rejected(self):
        for shift in (float('nan'), float('inf'), -float('inf'),
                      True, False, 0, 0.0, -0.0, '-.35', None):
            with self.subTest(shift=shift):
                self.assert_rejected_without_changes(shift=shift)

    def test_shift_beyond_either_scene_boundary_is_rejected(self):
        for shift in (-5.21, 2.81):
            with self.subTest(shift=shift):
                self.assert_rejected_without_changes(shift=shift)

    def test_boundary_aligned_intervals_are_allowed(self):
        for name, shift, expected in (
                ('starts-at-zero', -5.2, {'start': 0.0, 'end': 2.0}),
                ('ends-at-duration', 2.8, {'start': 8.0, 'end': 10.0})):
            with self.subTest(shift=shift):
                record = retime.retime(self.scene, self.result, 'turn-two', shift,
                                       self.root / name)
                self.assertEqual(record['after'], expected)

    def test_existing_output_is_rejected_and_preserved(self):
        for kind in ('file', 'directory'):
            with self.subTest(kind=kind):
                out = self.root / f'existing-{kind}'
                if kind == 'file':
                    out.write_bytes(b'existing result')
                else:
                    out.mkdir()
                    (out / 'keep.txt').write_bytes(b'existing result')
                self.assert_rejected_without_changes(out=out)

    def test_output_nested_inside_source_is_rejected(self):
        self.assert_rejected_without_changes(out=self.scene / 'nested/new')

    def test_manifest_path_cannot_overwrite_a_file_outside_new_candidate(self):
        (self.root / 'outside.svg').write_bytes(b'source outside candidate')
        destination = self.root / 'destination'
        destination.mkdir()
        (destination / 'outside.svg').write_bytes(b'keep existing destination')
        measured = copy.deepcopy(self.result)
        measured['sources'].append({
            'path': '../outside.svg',
            'sha256': digest((self.root / 'outside.svg').read_bytes()),
        })
        self.assert_rejected_without_changes(result=measured,
                                             out=destination / 'new')

    def test_unmeasured_candidate_is_rejected(self):
        for status in ('generated', 'blocked', 'failed'):
            measured = copy.deepcopy(self.result)
            measured['status'] = status
            with self.subTest(status=status):
                self.assert_rejected_without_changes(result=measured)

    def test_sampled_candidate_can_be_retimed_without_full_video(self):
        self.result['status'] = 'samples_ready'
        record = retime.retime(self.scene, self.result, 'turn-two', -.35,
                               self.root / 'sampled')
        self.assertEqual(record['after'], {'start': 4.85, 'end': 6.85})


if __name__ == '__main__':
    unittest.main()
