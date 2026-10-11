"""Check/install pinned VisualBook dependencies without generating example books."""
import argparse
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PINNED = ROOT / "experiments/visualbook"
RUNTIME = ROOT / "work/visualbook/runtime"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--install", action="store_true", help="npm ci from the committed lockfile; no upstream checkout, browser install or output generation")
    args = parser.parse_args()
    if not shutil.which("node"):
        raise SystemExit("Node 22+ is required before installing VisualBook dependencies")
    node_version = subprocess.check_output(["node", "--version"], text=True).strip()
    if int(node_version.lstrip("v").split(".")[0]) < 22:
        raise SystemExit("Node 22+ is required; found " + node_version)
    if args.install and not shutil.which("npm"):
        raise SystemExit("npm is required for --install")
    expected = json.loads((PINNED / "package.json").read_text())["dependencies"]
    issues = []
    if args.install:
        RUNTIME.mkdir(parents=True, exist_ok=True)
        for name in ["package.json", "package-lock.json"]:
            shutil.copy2(PINNED / name, RUNTIME / name)
        try:
            subprocess.run(["npm", "ci", "--no-audit", "--no-fund", "--prefix", str(RUNTIME)], check=True, timeout=300)
        except subprocess.TimeoutExpired:
            issues.append("npm ci exceeded the 300-second installation limit")
        except subprocess.CalledProcessError as error:
            issues.append("npm ci failed with exit code " + str(error.returncode))
    for name in ["package.json", "package-lock.json"]:
        if not (RUNTIME / name).is_file() or (RUNTIME / name).read_bytes() != (PINNED / name).read_bytes():
            issues.append("Missing or different pinned " + name)
    versions = {}
    for name, version in expected.items():
        file = RUNTIME / "node_modules" / name / "package.json"
        if not file.is_file():
            issues.append("Missing dependency " + name)
        else:
            actual = json.loads(file.read_text())["version"]
            versions[name] = actual
            if actual != version:
                issues.append("Version differs: " + name)
    if not issues:
        probe = subprocess.run(
            ["node", "--input-type=module", "-e", "for(const name of JSON.parse(process.argv[1])) await import(name);", json.dumps(list(expected))],
            cwd=RUNTIME, capture_output=True, text=True,
        )
        if probe.returncode:
            issues.append("Actual dependency import failed; inspect setup-import.stderr")
            (RUNTIME / "setup-import.stderr").write_text(probe.stderr)
    result = {
        "status": "failed" if issues else "completed",
        "action": "install-and-check" if args.install else "check",
        "nodeVersion": node_version,
        "lockSha256": hashlib.sha256((PINNED / "package-lock.json").read_bytes()).hexdigest(),
        "versions": versions,
        "issues": issues,
        "modelCalls": 0,
        "scope": "Pinned Node dependency versions and actual imports only; no browser availability, source checkout, model generation, rendering or art validation.",
    }
    if RUNTIME.exists():
        (RUNTIME / "setup-receipt.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(result, ensure_ascii=False))
    if issues:
        raise SystemExit("Run python3 tools/setup_visualbook.py --install; diagnostic retained when runtime exists")


if __name__ == "__main__":
    main()
