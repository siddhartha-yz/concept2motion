"""Fault controls for candidate export; no model or browser needed."""

import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "run_visualbook", ROOT / "tools/run_visualbook.py"
)
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class ExportGateTests(unittest.TestCase):
    def prepare(self, directory):
        job = Path(directory)
        (job / "book.html").write_text("<p>checked output</p>")
        (job / "book.json").write_text('{"figures":[]}')
        result = {
            "exit_code": 0,
            "timed_out": False,
            "source_unchanged": True,
            "tool_sources_unchanged": True,
            "returned_png_count": 2,
            "returned_candidate_png_count": 2,
            "plan_sha256": runner.digest(job / "book.json"),
        }
        (job / "result.json").write_text(json.dumps(result))
        preview = job / "preview-final"
        preview.mkdir()
        (preview / "report.json").write_text(
            json.dumps({"sha256": runner.digest(job / "book.html"), "findings": []})
        )
        (job / "review.json").write_text(
            json.dumps(
                {
                    "issues": [],
                    "ready_for_export": True,
                    "html_sha256": runner.digest(job / "book.html"),
                    "plan_sha256": result["plan_sha256"],
                }
            )
        )
        return job, result

    def test_matching_candidate_can_export_but_changed_html_cannot(self):
        with tempfile.TemporaryDirectory() as directory:
            job, _ = self.prepare(directory)
            self.assertTrue(runner.inspect(job)["ready_for_export"])
            (job / "book.html").write_text("<p>unseen modification</p>")
            self.assertIn("preview-is-stale", runner.inspect(job)["reasons"])

    def test_design_images_do_not_replace_candidate_preview(self):
        with tempfile.TemporaryDirectory() as directory:
            job, result = self.prepare(directory)
            result["returned_candidate_png_count"] = 0
            (job / "result.json").write_text(json.dumps(result))
            self.assertIn("no-image-feedback", runner.inspect(job)["reasons"])

    def test_plan_change_cannot_reuse_old_preview(self):
        with tempfile.TemporaryDirectory() as directory:
            job, _ = self.prepare(directory)
            (job / "book.json").write_text('{"figures":[{"id":"unseen"}]}')
            self.assertIn(
                "plan-was-modified-after-authoring", runner.inspect(job)["reasons"]
            )

    def test_known_visual_issue_blocks_export_even_with_zero_render_findings(self):
        with tempfile.TemporaryDirectory() as directory:
            job, _ = self.prepare(directory)
            review = json.loads((job / "review.json").read_text())
            review["issues"] = [
                {
                    "figureId": "sample",
                    "condition": "end",
                    "description": "marker obscures a value",
                }
            ]
            review["ready_for_export"] = False
            (job / "review.json").write_text(json.dumps(review))
            self.assertIn("known-unresolved-issues", runner.inspect(job)["reasons"])


if __name__ == "__main__":
    unittest.main()
