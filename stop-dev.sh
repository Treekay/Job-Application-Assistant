#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
POWERSHELL_SCRIPT="$ROOT/stop-dev.ps1"

if command -v cygpath >/dev/null 2>&1; then
  POWERSHELL_SCRIPT="$(cygpath -w "$POWERSHELL_SCRIPT")"
fi

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$POWERSHELL_SCRIPT"
