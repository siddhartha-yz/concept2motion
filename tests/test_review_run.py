import importlib.util
import unittest
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


if __name__ == "__main__":
    unittest.main()
