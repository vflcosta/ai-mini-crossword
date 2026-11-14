#!/usr/bin/env bash
# Runs every check for the app: backend tests, frontend tests, frontend build.
# Used by the pre-push hook and safe to run by hand:  ./scripts/test-all.sh
set -uo pipefail
cd "$(dirname "$0")/.."

failed=0
step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }

# ---------- backend ----------
step "Backend tests (pytest)"
PY=""
for candidate in backend/venv/bin/python backend/.venv/bin/python python3 python; do
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -m pytest --version >/dev/null 2>&1; then
    PY="$candidate"; break
  fi
done
if [ -z "$PY" ]; then
  echo "✗ pytest is not installed. Run once:"
  echo "    cd backend && source venv/bin/activate && pip install -r requirements-dev.txt"
  failed=1
else
  case "$PY" in */*) PY="$PWD/$PY" ;; esac
  (cd backend && "$PY" -m pytest) || failed=1
fi

# ---------- frontend ----------
step "Frontend tests (vitest)"
if [ ! -x frontend/node_modules/.bin/vitest ]; then
  echo "✗ Frontend test tools are not installed. Run once:"
  echo "    cd frontend && npm install"
  failed=1
else
  (cd frontend && npm test --silent) || failed=1
  step "Frontend build"
  (cd frontend && npm run build --silent) || failed=1
fi

echo
if [ "$failed" -ne 0 ]; then
  printf '\033[31m✗ Checks failed.\033[0m\n'
  exit 1
fi
printf '\033[32m✓ All checks passed.\033[0m\n'
