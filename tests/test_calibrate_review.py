"""Evaluator failures must not silently become accepted evidence."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import calibrate_review as review


class ReviewAccounting(unittest.TestCase):
    def test_invalid_frame_evidence_is_rejected(self):
        response = {"support": "demonstrated", "consistency": "consistent", "order": "coherent",
                    "observations": [{"time_s": .75, "evidence": "visible input arrow"}]}
        review.validate(response)
        for value in (float("nan"), float("inf"), True, None, "0.75", 1.75):
            with self.subTest(value=value), self.assertRaises(ValueError):
                invalid = copy.deepcopy(response)
                invalid["observations"][0]["time_s"] = value
                review.validate(invalid)
        invalid = copy.deepcopy(response)
        invalid["observations"][0]["evidence"] = "  "
        with self.assertRaises(ValueError):
            review.validate(invalid)

    def test_failed_reviews_are_unknown_even_with_accepting_payload(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(review, "REPORT", Path(directory)):
            records = [{"id": case, "repeat": repeat, "status": "unknown",
                        "response": {axis: review.CASES["K7"][axis] for axis in review.FIELDS}}
                       for case in review.CASES for repeat in (1, 2)]
            (Path(directory) / "outcomes.json").write_text(json.dumps(records))
            review.summarize()
            summary = json.loads((Path(directory) / "summary.json").read_text())
            self.assertEqual(summary["false_all_axis_acceptances"], 0)
            self.assertTrue(all(c["unknown"] == 8 and c["matched"] == 0 for c in summary["per_axis"].values()))
            self.assertTrue(all(all(v is None for v in c["repeat_agreement"].values()) for c in summary["cases"]))
            # Dropping an unsuccessful case cannot create a complete experiment.
            (Path(directory) / "outcomes.json").write_text(json.dumps(records[:-1]))
            with self.assertRaises(ValueError):
                review.summarize()


if __name__ == "__main__":
    unittest.main()
