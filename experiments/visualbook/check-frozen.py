"""Check the active frozen candidates without generating or spending model quota."""
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent


def main():
    evidence = ROOT / "work/visualbook/frozen-checks"
    # Keep engineering reruns apart from the recorded research evidence.
    import time
    run_id = time.strftime("%Y%m%dT%H%M%S", time.gmtime())
    env = dict(os.environ, VISUALBOOK_EVIDENCE_DIR=str(evidence / run_id))
    subprocess.run(["python3", str(HERE / "bootstrap.py")], cwd=ROOT, env=env, check=True)
    active = json.loads((HERE / "active.json").read_text())
    for section, attempt in active.items():
        subprocess.run(["node", str(HERE / "math-check.mjs"), section, attempt], cwd=ROOT, env=env, check=True)
    subprocess.run(["node", str(HERE / "relation-check.mjs"), "relations.json"], cwd=ROOT, env=env, check=True)
    subprocess.run(["node", str(HERE / "reading-check.mjs"), "reading"], cwd=ROOT, env=env, check=True)
    print(json.dumps({"evidence": str(evidence / run_id), "modelCalls": 0}))


if __name__ == "__main__":
    main()
