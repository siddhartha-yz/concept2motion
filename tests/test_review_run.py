import importlib.util
import unittest
import tempfile
import hashlib
from pathlib import Path

spec = importlib.util.spec_from_file_location("review_run", Path(__file__).resolve().parents[1] / "tools/review_run.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ReviewPolicyTests(unittest.TestCase):
    def test_third_visual_revision_stops_the_loop(self):
        records = [{"decision": "revise", "kind": "visual"}] * 3
        state = module.revision_state(records, {"technical": 2, "visual": 2})
        self.assertFalse(state["continue_allowed"])
        self.assertEqual(state["stop_reason"], "revision_budget_exhausted")

    def test_ai_cannot_accept_art_for_the_user(self):
        review = {"decision": "pass", "kind": "visual", "reviewer": "AI",
                  "observations": [{}], "artistic_acceptance": "accepted"}
        with self.assertRaisesRegex(ValueError, "artistic acceptance"):
            module.validate_review(review, {}, Path("."))

    def test_passing_review_requires_a_real_verified_render(self):
        review = {"decision": "pass", "kind": "visual", "reviewer": "AI", "observations": [{}]}
        with self.assertRaisesRegex(ValueError, "verified full render"):
            module.validate_review(review, {"status": "checks_passed"}, Path("."))

    def test_draft_video_cannot_be_accepted_as_a_full_render(self):
        review = {"decision": "pass", "kind": "visual", "reviewer": "AI", "observations": [{}]}
        with self.assertRaisesRegex(ValueError, "verified full render"):
            module.validate_review(review, {"status": "preview_ready", "checks": {"passed": True}}, Path("."))

    def test_modified_validator_evidence_blocks_a_passing_review(self):
        with tempfile.TemporaryDirectory() as temporary:
            run = Path(temporary)
            (run / "tooling").mkdir()
            tool = run / "tooling" / "contracts.mjs"
            tool.write_text("original validator")
            original_hash = hashlib.sha256(tool.read_bytes()).hexdigest()
            (run / "frame.jpg").write_bytes(b"evidence")
            manifest = {"status": "render_passed", "checks": {"passed": True}, "meta": {"duration": 12},
                        "sources": [], "tooling": [{"path": tool.name, "sha256": original_hash}]}
            review = {"decision": "pass", "kind": "visual", "reviewer": "AI",
                      "observations": [{"time_s": 11, "evidence": "frame.jpg", "description": "Reviewed frame"}]}
            module.validate_review(review, manifest, run)
            tool.write_text("altered validator")
            with self.assertRaisesRegex(ValueError, "Frozen tooling changed"):
                module.validate_review(review, manifest, run)


if __name__ == "__main__":
    unittest.main()
