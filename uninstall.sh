#!/usr/bin/env bash
set -euo pipefail

DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
APP_DIR="$DATA_HOME/nami-notch"
BIN="$HOME/.local/bin/nami-notch"
CONFIG_DIR="$CONFIG_HOME/nami-notch"
HYPR_DIR="$CONFIG_HOME/hypr"
PURGE=0

usage() {
  cat <<'EOF'
Remove Nami Notch.

Usage:
  ./uninstall.sh [--purge]

Options:
  --purge   Also remove the saved pet model/outfit settings.
  -h, --help
EOF
}

while (($#)); do
  case "$1" in
    --purge) PURGE=1 ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'error: unknown option: %s\n' "$1" >&2; exit 1 ;;
  esac
  shift
done

if command -v pgrep >/dev/null 2>&1 && pgrep -f "python3 $BIN" >/dev/null 2>&1; then
  pkill -f "python3 $BIN" >/dev/null 2>&1 || true
  sleep 1
fi

rm -f "$BIN"
rm -rf "$APP_DIR"

for FILE in \
  "$HYPR_DIR/UserConfigs/Startup_Apps.conf" \
  "$HYPR_DIR/hyprland.conf" \
  "$HYPR_DIR/nami-notch.conf"
do
  if [[ -f "$FILE" ]] && grep -Fq '# >>> nami-notch >>>' "$FILE"; then
    sed -i '/^# >>> nami-notch >>>$/,/^# <<< nami-notch <<<$/d' "$FILE"
    printf 'Removed autostart from %s\n' "$FILE"
  fi
done

if [[ "$PURGE" -eq 1 ]]; then
  rm -rf "$CONFIG_DIR"
  printf 'Removed settings.\n'
else
  printf 'Kept settings in %s\n' "$CONFIG_DIR"
fi

printf 'Nami Notch removed.\n'
