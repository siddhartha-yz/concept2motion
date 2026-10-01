"""Mock workflow checks; no real generation or comprehension claims."""
import copy
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("batch_explanation", ROOT / "tools/batch.py")
batch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(batch)
spec = importlib.util.spec_from_file_location("review_explanation", ROOT / "tools/review_run.py")
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)


def example_plan():
    stages = ["logits", "exponential", "shared-total", "normalizing", "normalized"]
    return {"question": "问题", "takeaway": "答案", "beats": [
        {"stage": stage, "start_s": i*6, "end_s": (i+1)*6,
         "caption": "因果句", "visual_action": "可见操作", "viewer_inference": "观众推论"}
        for i, stage in enumerate(stages)]}


class ExplanationTests(unittest.TestCase):
    def test_plan_rejects_missing_steps_gaps_short_beats_and_nonfinite_times(self):
        brief = {"id": "softmax", "duration_s": 30}
        batch.validate_plan(example_plan(), brief)
        for change in (lambda p: p["beats"].pop(),
                       lambda p: p["beats"][1].update(start_s=7),
                       lambda p: p["beats"][0].update(end_s=2),
                       lambda p: p["beats"][0].update(end_s=float("nan"))):
            plan = copy.deepcopy(example_plan())
            change(plan)
            with self.assertRaises(ValueError):
                batch.validate_plan(plan, brief)

    def test_samples_cover_opening_middle_and_ending_of_each_beat(self):
        samples = batch.plan_samples(example_plan())
        self.assertEqual(len(samples), 15)
        self.assertEqual(samples[:3], [.35, 3, 5.65])
        self.assertEqual(samples[-1], 29.65)

    def test_blind_reviewer_does_not_receive_the_target_or_math_verdict(self):
        brief = {"communication": {"audience": "中文新观众", "takeaway": "SECRET_TARGET"},
                 "mechanism": "SECRET_MECHANISM", "inputs": {"secret": 42}}
        prompt = batch.reviewer_prompt(brief, [Path("frame-29.65.jpg")])
        self.assertNotIn("SECRET", prompt)
        self.assertNotIn("checks passed", prompt)
        self.assertIn("frame-29.65.jpg", prompt)
        self.assertIn("causal_explanation", prompt)

    def test_planning_precedes_code_and_resume_keeps_all_three_calls(self):
        with tempfile.TemporaryDirectory() as temporary:
            out = Path(temporary)
            batch.save(out / "brief-softmax.json", {"id": "softmax", "duration_s": 30,
                       "communication": {"audience": "中文新观众"}})
            (out / "prompt-softmax.md").write_text("author instructions")
            (out / "protocol.md").write_text("stage contract")
            batch.save(out / "batch.json", {"cases": ["softmax"], "trials": 1,
                                            "budgets": {"technical": 2, "visual": 2}})
            roles = []

            def model(args, directory, prompt, schema, images=()):
                role = "planner" if schema is batch.PLAN_SCHEMA else "reviewer" if images else "author"
                roles.append(role)
                directory.mkdir(parents=True)
                if role == "planner":
                    response = example_plan()
                elif role == "author":
                    self.assertIn("Saved teaching plan", prompt)
                    response = {"html": "html", "javascript": "js", "storyboard": "story"}
                else:
                    self.assertEqual(schema, batch.BLIND_REVIEW_SCHEMA)
                    self.assertNotIn("Frozen brief", prompt)
                    response = {"decision": "pass", "revision_instruction": "",
                                "reconstructed_message": "mock answer", "causal_explanation": "mock chain",
                                "observations": [{"time_s": 29.65, "evidence": "frame-29.65.jpg",
                                                  "description": "mock visible evidence"}]}
                batch.save(directory / "response.json", response)
                batch.save(directory / "process.json", {"usage": [], "tool_types": []})
                return response

            def render(command, cwd, directory, timeout, prompt=None):
                self.assertIn("29.65", command[command.index("--samples")+1])
                rendered = Path(command[command.index("--out")+1])
                rendered.mkdir()
                batch.save(rendered / "manifest.json", {"status": "render_passed", "checks": {"passed": True},
                           "sources": [], "meta": {"duration": 30}})
                (rendered / "frame-29.65.jpg").write_bytes(b"mock frame")
                return {"exit_code": 0, "timed_out": False}

            with patch.object(batch, "model_call", side_effect=model) as calls, \
                    patch.object(batch, "run_process", side_effect=render) as renders:
                batch.trial(out, "softmax", 1, SimpleNamespace(node="node", render_timeout=20), policy)
                self.assertEqual(roles, ["planner", "author", "reviewer"])
                batch.trial(out, "softmax", 1, SimpleNamespace(), policy)
                self.assertEqual(calls.call_count, 3)
                self.assertEqual(renders.call_count, 1)
                self.assertEqual(batch.summarize(out)["model_calls"], 3)
                plan_file = out / batch.load(out / "softmax-01/state.json")["plan_response"]
                plan_file.write_text("modified")
                with self.assertRaisesRegex(ValueError, "Teaching plan changed"):
                    batch.trial(out, "softmax", 1, SimpleNamespace(), policy)
                self.assertEqual(calls.call_count, 3)


if __name__ == "__main__":
    unittest.main()
