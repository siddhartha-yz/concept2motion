"""State-machine tests use mocks; these are not model generation benchmarks."""
import importlib.util
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("batch", ROOT / "tools/batch.py")
batch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(batch)
spec = importlib.util.spec_from_file_location("review", ROOT / "tools/review_run.py")
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)


class BatchTests(unittest.TestCase):
    def test_full_frame_failure_is_preserved_for_repair_when_samples_pass(self):
        manifest = {"checks": {"findings": [], "full_video_frame_checks": {"findings": [
            {"code": "text_shape_overlap", "time_s": 7.0167, "detail": "label / moving bar"}]}}}
        findings = batch.deterministic_findings(manifest)
        self.assertEqual(findings[0]["time_s"], 7.0167)
        self.assertIn("label / moving bar", json.dumps(findings))

    def test_budget_counts_kinds_separately_and_stops_after_two_repairs(self):
        attempts = [{"review": {"kind": "technical", "decision": "revise"}}] * 2
        attempts += [{"review": {"kind": "visual", "decision": "revise"}}] * 2
        budgets = {"technical": 2, "visual": 2}
        self.assertTrue(batch.can_revise(attempts, budgets))
        attempts.append({"review": {"kind": "technical", "decision": "revise"}})
        self.assertFalse(batch.can_revise(attempts, budgets))

    def test_frozen_prompt_cannot_change_between_trials(self):
        with tempfile.TemporaryDirectory() as temporary:
            out = Path(temporary)
            prompt = out / "prompt.md"
            prompt.write_text("original")
            config = {"frozen": [{"path": prompt.name, "sha256": batch.digest(prompt)}]}
            batch.verify_frozen(out, config)
            prompt.write_text("modified")
            with self.assertRaisesRegex(ValueError, "Frozen benchmark material"):
                batch.verify_frozen(out, config)

    def test_checkpoint_reuses_generation_and_rejects_manual_source_edits(self):
        with tempfile.TemporaryDirectory() as temporary:
            out = Path(temporary)
            batch.save(out / "brief-softmax.json", {"id": "softmax", "duration_s": 12})
            (out / "prompt-softmax.md").write_text("frozen prompt")
            batch.save(out / "batch.json", {"budgets": {"technical": 2, "visual": 2}})
            response = out / "completed.json"
            batch.save(response, {"html": "original html", "javascript": "original js", "storyboard": "story"})
            directory = out / "softmax-01"
            batch.save(directory / "state.json", {"case": "softmax", "trial": 1, "status": "blocked", "attempts": [
                {"index": 1, "generation": response.name, "generation_sha256": batch.digest(response)}]})
            source = directory / "attempt-01/candidate"
            source.mkdir(parents=True)
            (source / "index.html").write_text("manual edit")
            with patch.object(batch, "model_call") as model:
                with self.assertRaisesRegex(ValueError, "Candidate source changed"):
                    batch.trial(out, "softmax", 1, SimpleNamespace(), policy)
                model.assert_not_called()
            self.assertEqual(batch.load(directory / "state.json")["status"], "blocked")

    def test_resume_of_completed_trial_does_not_call_model(self):
        with tempfile.TemporaryDirectory() as temporary:
            out = Path(temporary)
            batch.save(out / "softmax-01/state.json", {"status": "passed"})
            with patch.object(batch, "model_call") as model:
                batch.trial(out, "softmax", 1, SimpleNamespace(), policy)
                model.assert_not_called()

    def test_interrupted_model_calls_preserve_previous_artifacts(self):
        with tempfile.TemporaryDirectory() as temporary:
            attempt = Path(temporary)
            first = batch.next_call(attempt, "author")
            first.mkdir(); (first / "stdout.log").write_text("partial response")
            second = batch.next_call(attempt, "author")
            self.assertNotEqual(first, second)
            self.assertEqual((first / "stdout.log").read_text(), "partial response")

    def test_usage_and_tool_contamination_are_extracted_without_raw_logs(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "events.log"
            path.write_text('\n'.join(json.dumps(e) for e in [
                {"type": "thread.started", "thread_id": "fresh-context"},
                {"type": "item.completed", "item": {"type": "command_execution", "command": "private"}},
                {"type": "turn.completed", "usage": {"input_tokens": 20, "output_tokens": 30}}]))
            summary = batch.event_summary(path)
            self.assertEqual(summary["tool_types"], ["command_execution"])
            self.assertEqual(summary["usage"][0]["output_tokens"], 30)
            self.assertNotIn("private", json.dumps(summary))

    def test_resume_after_reviewer_failure_keeps_generation_and_render(self):
        with tempfile.TemporaryDirectory() as temporary:
            out = Path(temporary)
            batch.save(out / "brief-softmax.json", {"id": "softmax", "duration_s": 12})
            batch.save(out / "batch.json", {"budgets": {"technical": 2, "visual": 2}})
            (out / "prompt-softmax.md").write_text("frozen prompt")
            args = SimpleNamespace(node="node", render_timeout=20)
            calls = []

            def model(args, directory, prompt, schema, images=()):
                calls.append("reviewer" if images else "author")
                directory.mkdir(parents=True)
                if images:
                    raise RuntimeError("mock transport failure")
                response = {"html": "html", "javascript": "js", "storyboard": "story"}
                batch.save(directory / "response.json", response)
                return response

            def render(command, cwd, directory, timeout, prompt=None):
                rendered = Path(command[command.index("--out")+1])
                rendered.mkdir()
                batch.save(rendered / "manifest.json", {"status": "render_passed", "checks": {"passed": True},
                           "sources": [], "meta": {"duration": 12}})
                (rendered / "frame-5.00.jpg").write_bytes(b"mock frame")
                return {"exit_code": 0, "timed_out": False}

            with patch.object(batch, "model_call", side_effect=model), patch.object(batch, "run_process", side_effect=render) as renderer:
                with self.assertRaisesRegex(RuntimeError, "mock transport failure"):
                    batch.trial(out, "softmax", 1, args, policy)
                self.assertEqual(calls, ["author", "reviewer"])
                self.assertEqual(renderer.call_count, 1)
                review = {"decision": "pass", "revision_instruction": "", "observations": [
                    {"time_s": 5, "evidence": "frame-5.00.jpg", "description": "mock visual observation"}]}
                with patch.object(batch, "model_call", return_value=review) as reviewer:
                    batch.trial(out, "softmax", 1, args, policy)
                    reviewer.assert_called_once()
                    self.assertTrue(reviewer.call_args.args[4])
                self.assertEqual(renderer.call_count, 1)
                self.assertEqual(batch.load(out / "softmax-01/state.json")["status"], "passed")

    def test_gallery_does_not_link_missing_review_and_escapes_findings(self):
        with tempfile.TemporaryDirectory() as temporary:
            out = Path(temporary)
            batch.save(out / "batch.json", {"cases": ["softmax"], "trials": 1})
            rendered = out / "softmax-01/attempt-01/render-01"
            batch.save(rendered / "manifest.json", {"status": "execution_failed", "checks": {
                "findings": [{"code": "<script>unsafe</script>"}]}})
            batch.save(out / "softmax-01/state.json", {"case": "softmax", "trial": 1, "status": "blocked",
                "attempts": [{"index": 1, "render": str(rendered.relative_to(out))}]})
            batch.summarize(out)
            gallery = (out / "index.html").read_text()
            self.assertIn("&lt;script&gt;unsafe&lt;/script&gt;", gallery)
            self.assertNotIn('href="softmax-01/attempt-01/render-01/review.json"', gallery)
            self.assertIn('href="softmax-01/attempt-01/render-01/manifest.json"', gallery)


if __name__ == "__main__":
    unittest.main()
