"""Attach timestamped review evidence and track bounded revision requests."""
import argparse
import hashlib
import json
from pathlib import Path


def validate_review(review, manifest, run):
    if review.get("decision") not in {"pass", "revise"}:
        raise ValueError("decision must be pass or revise")
    if review.get("kind") not in {"technical", "visual"}:
        raise ValueError("kind must be technical or visual")
    if not review.get("reviewer") or not review.get("observations"):
        raise ValueError("reviewer and timestamped observations are required")
    if review.get("artistic_acceptance", "pending_user_review") != "pending_user_review":
        raise ValueError("AI review cannot grant the user's artistic acceptance")
    if review["decision"] == "pass" and (
        manifest.get("status") != "render_passed" or not manifest.get("checks", {}).get("passed")
    ):
        raise ValueError("A passing review requires a verified full render")
    if review["decision"] == "revise" and not review.get("revision_instruction"):
        raise ValueError("A revision needs a concrete instruction")
    for observation in review["observations"]:
        t = observation.get("time_s")
        if not isinstance(t, (float, int)) or not 0 <= t <= manifest["meta"]["duration"]:
            raise ValueError("Observation timestamp is outside this scene")
        if not observation.get("description") or not observation.get("evidence"):
            raise ValueError("Every observation needs a description and artifact")
        path = (run / observation["evidence"]).resolve()
        if not path.is_relative_to(run.resolve()) or not path.is_file():
            raise ValueError("Evidence must be an existing file inside the attempt")
    for source in manifest["sources"]:
        path = (run / "source" / source["path"]).resolve()
        if not path.is_relative_to((run / "source").resolve()):
            raise ValueError("Invalid source path")
        if hashlib.sha256(path.read_bytes()).hexdigest() != source["sha256"]:
            raise ValueError("Frozen source changed after rendering")


def revision_state(records, budgets):
    requested = {kind: sum(r["decision"] == "revise" and r["kind"] == kind for r in records)
                 for kind in budgets}
    latest = records[-1]
    allowed = (latest["decision"] == "revise" and
               requested[latest["kind"]] <= budgets[latest["kind"]])
    return {"requested_revisions": requested, "continue_allowed": allowed,
            "stop_reason": "review_passed" if latest["decision"] == "pass" else
            "revision_budget_available" if allowed else "revision_budget_exhausted"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", type=Path, required=True)
    parser.add_argument("--review", type=Path, required=True)
    parser.add_argument("--ledger", type=Path, required=True)
    args = parser.parse_args()
    run, ledger_path = args.run.resolve(), args.ledger.resolve()
    manifest = json.loads((run / "manifest.json").read_text())
    review = json.loads(args.review.read_text())
    validate_review(review, manifest, run)
    if (run / "review.json").exists():
        raise ValueError("Review already exists; preserve the previous record")
    ledger = json.loads(ledger_path.read_text()) if ledger_path.exists() else {
        "budgets": {"technical": 2, "visual": 2}, "records": []
    }
    if any(r["run"] == str(run) for r in ledger["records"]):
        raise ValueError("Attempt already recorded in ledger")
    if ledger["records"] and not ledger["state"]["continue_allowed"]:
        raise ValueError("Ledger is stopped; start a new explicitly authorized evaluation")
    review["artistic_acceptance"] = "pending_user_review"
    record = {"run": str(run), "kind": review["kind"], "decision": review["decision"],
              "render_status": manifest["status"], "sources": manifest["sources"]}
    ledger["records"].append(record)
    ledger["state"] = revision_state(ledger["records"], ledger["budgets"])
    ledger_path.parent.mkdir(parents=True, exist_ok=True)
    (run / "review.json").write_text(json.dumps(review, indent=2, ensure_ascii=False) + "\n")
    temporary = ledger_path.with_suffix(".tmp")
    temporary.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + "\n")
    temporary.replace(ledger_path)
    print(json.dumps(ledger["state"], indent=2))


if __name__ == "__main__":
    main()
