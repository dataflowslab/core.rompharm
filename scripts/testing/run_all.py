import os
import sys
import subprocess

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

SCRIPTS = [
    "scripts/testing/00_auth_health.py",
    "scripts/testing/10_inventory_smoke.py",
    "scripts/testing/20_procurement_smoke.py",
    "scripts/testing/30_requests_smoke.py",
    "scripts/testing/40_sales_smoke.py",
]


def main() -> int:
    python = sys.executable
    failures = 0

    for script in SCRIPTS:
        script_path = os.path.join(ROOT, script)
        print(f"\n==> Running {script}")
        result = subprocess.run([python, script_path], cwd=ROOT)
        if result.returncode != 0:
            failures += 1
            print(f"[FAIL] {script} exited with code {result.returncode}")
        else:
            print(f"[OK] {script}")

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
