from pathlib import Path
import copy
import json
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from feedback_cycle import decide, validate_ticket, sha


def manifest(codes, status='checks_failed'):
    return {'status': status, 'video': {'passed': True, 'full_decode_passed': True},
            'determinism': {'passed': True}, 'checks': {'findings': [{'code': c} for c in codes],
            'full_video_frame_checks': {'findings': []}}}


class FeedbackDecisionTests(unittest.TestCase):
    def setUp(self):
        self.before = manifest(['target', 'existing_warning'])
        self.after = manifest(['existing_warning'])
        self.process = {'exit_code': 1, 'timed_out': False}
        self.guards = [{'time_s': 1, 'unchanged': True}]

    def check(self, after=None, process=None, guards=None):
        return decide(self.before, after or self.after, process or self.process, 'target',
                      self.guards if guards is None else guards)

    def test_keep_means_limited_technical_acceptance_even_with_existing_warning(self):
        r = self.check()
        self.assertEqual(r['decision'], 'keep')
        self.assertEqual(r['after_codes'], ['existing_warning'])
        self.assertEqual(r['artistic_acceptance'], 'not_evaluated')

    def test_target_persists_or_new_pixel_failure_rolls_back(self):
        for after, reason in [(self.before, 'target_persists'),
                              (manifest(['pixel_mismatch']), 'new_check_codes')]:
            r = self.check(after=after)
            self.assertEqual(r['decision'], 'rollback'); self.assertIn(reason, r['reasons'])

    def test_fix_with_changed_or_missing_protection_rolls_back(self):
        for guards in ([], [{'time_s': 1, 'unchanged': False}]):
            r = self.check(guards=guards)
            self.assertEqual(r['decision'], 'rollback')
            self.assertIn('protected_frame_changed_or_missing', r['reasons'])

    def test_failed_render_not_a_successful_target_removal(self):
        for after, process in [(manifest([], 'execution_failed'), self.process),
                               (self.after, {'exit_code': -9, 'timed_out': True})]:
            r = self.check(after=after, process=process)
            self.assertEqual(r['decision'], 'rollback'); self.assertFalse(r['target_removed'])

    def test_full_video_findings_cannot_be_hidden_by_clean_sparse_samples(self):
        self.after['checks']['full_video_frame_checks']['findings'] = [{'code': 'target'}]
        self.assertIn('target_persists', self.check()['reasons'])

    def test_stale_source_evidence_and_unsupported_scope_rejected_before_patch(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d); scene = root / 'scene'; evidence = root / 'render'
            scene.mkdir(); (evidence / 'source').mkdir(parents=True)
            for p in (scene / 'scene.js', evidence / 'source/scene.js'): p.write_text('const x=1;')
            (evidence / 'frame-1.00.jpg').write_bytes(b'frame fixture')
            m = manifest(['target']); m['meta'] = {'duration': 2}
            m['checks']['findings'][0]['time_s'] = 1
            m['sources'] = [{'path': 'scene.js', 'sha256': sha(scene / 'scene.js')}]
            (evidence / 'manifest.json').write_text(json.dumps(m))
            (evidence / 'checks.json').write_text(json.dumps(m['checks']))
            ticket = {'id': 'fixture', 'kind': 'technical', 'hypothesis': 'fixture', 'expected_change': 'fixture',
                      'stop_condition': 'one attempt', 'max_patch_attempts': 1, 'render_timeout_s': 1,
                      'base_manifest_sha256': sha(evidence / 'manifest.json'),
                      'base_checks_sha256': sha(evidence / 'checks.json'),
                      'source_hashes': {'scene.js': sha(scene / 'scene.js')}, 'allowed_files': ['scene.js'],
                      'patch': {'files': [{'path': 'scene.js', 'sha256': sha(scene / 'scene.js'),
                                          'edits': [{'old': '1', 'new': '2'}]}]},
                      'samples_s': [1], 'protected_times_s': [1], 'target_code': 'target',
                      'observation': {'time_s': 1, 'object': 'x', 'description': 'fixture', 'frame': 'frame-1.00.jpg',
                                      'sha256': sha(evidence / 'frame-1.00.jpg')}}
            validate_ticket(ticket, scene, evidence)
            for field, value in [('protected_times_s', []), ('target_code', 'absent'), ('kind', 'artistic')]:
                changed = copy.deepcopy(ticket); changed[field] = value
                with self.assertRaises(ValueError): validate_ticket(changed, scene, evidence)
            (scene / 'scene.js').write_text('const x=3;')
            with self.assertRaises(ValueError): validate_ticket(ticket, scene, evidence)
            (scene / 'scene.js').write_text('const x=1;')
            (evidence / 'frame-1.00.jpg').write_bytes(b'changed')
            with self.assertRaises(ValueError): validate_ticket(ticket, scene, evidence)


if __name__ == '__main__': unittest.main()
