#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

if ! command -v deno >/dev/null 2>&1; then
  printf 'error: deno is required to rebuild web/app.js\n' >&2
  printf 'Install Deno from https://deno.com/ or use the committed web/app.js.\n' >&2
  exit 1
fi

deno bundle --platform browser --no-check -o web/app.js src/app.ts
