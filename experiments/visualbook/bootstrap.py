"""Rebuild the frozen books without a model call; dependencies stay in work/."""
import argparse
import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent


def run(*args, cwd=ROOT):
    subprocess.run(args, cwd=cwd, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fetch", action="store_true", help="Clone pinned D2L and install the lockfile (network required)")
    args = parser.parse_args()
    manifest = json.loads((HERE / "sampling.json").read_text())
    commit = manifest["upstream_commit"]
    upstream = ROOT / "work/visualbook/upstreams/d2l-zh"
    runtime = ROOT / "work/visualbook/runtime"
    if args.fetch:
        upstream.parent.mkdir(parents=True, exist_ok=True)
        if not upstream.exists():
            run("git", "clone", "--no-checkout", "https://github.com/d2l-ai/d2l-zh.git", str(upstream))
            run("git", "checkout", "--detach", commit, cwd=upstream)
        actual = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=upstream, text=True).strip()
        if actual != commit:
            raise SystemExit("Existing upstream is at a different commit; choose a separate checkout rather than resetting it")
        runtime.mkdir(parents=True, exist_ok=True)
        for name in ["package.json", "package-lock.json"]:
            shutil.copy2(HERE / name, runtime / name)
        run("npm", "ci", "--prefix", str(runtime))
    if not upstream.exists() or not (runtime / "node_modules").exists():
        raise SystemExit("Missing pinned source/dependencies. Run bootstrap.py --fetch first")
    # First candidates remain directly inspectable; the main pages use active.json.
    import os
    env = dict(os.environ, VISUALBOOK_ATTEMPT="first")
    subprocess.run(["node", str(HERE / "build.mjs")], cwd=ROOT, env=env, check=True)
    run("node", str(HERE / "build.mjs"))
    print(json.dumps({"output": str(ROOT / "outputs/visualbook/index.html"), "modelCalls": 0, "sourceCommit": commit}))


if __name__ == "__main__":
    main()
