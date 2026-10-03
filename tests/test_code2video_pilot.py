"""Regression checks for the interruption and stale-output failures in this pilot."""
from pathlib import Path
import sys
import tempfile
import unittest

TOOLS = Path(__file__).resolve().parents[1] / "tools"
sys.path.insert(0, str(TOOLS))
import code2video_pilot as pilot


class ArtifactRecovery(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.source = self.root / "section_2.py"
        self.source.write_text("original scene")
        self.video = self.root / "video.mp4"
        self.video.write_bytes(b"rendered artifact bytes")
        self.success = {"attempt": 1, "source": self.source.name, "exit_code": 0,
                        "source_sha256": pilot.digest(self.source),
                        "video_sha256": pilot.digest(self.video)}

    def test_interrupted_retry_does_not_hide_identical_success(self):
        interrupted = {"source": self.source.name, "source_sha256": pilot.digest(self.source),
                       "interrupted": True}  # missing exit code triggered the pilot's KeyError
        result = pilot.matching_artifact(self.source, [self.success, interrupted], [self.video])
        self.assertEqual(result, (self.success, self.video))

    def test_changed_source_and_replaced_output_cannot_reuse_old_success(self):
        self.source.write_text("a different scene after repair")
        self.assertIsNone(pilot.matching_artifact(self.source, [self.success], [self.video]))
        self.source.write_text("original scene")
        self.video.write_bytes(b"another scene overwrote the same output path")
        self.assertIsNone(pilot.matching_artifact(self.source, [self.success], [self.video]))

    def test_unverifiable_output_is_not_a_success(self):
        partial = {**self.success, "exit_code": 1}
        incomplete = {k: v for k, v in self.success.items() if k != "video_sha256"}
        self.assertIsNone(pilot.matching_artifact(self.source, [partial, incomplete], [self.video]))


if __name__ == "__main__":
    unittest.main()
