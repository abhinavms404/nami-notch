#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
APP_DIR="$DATA_HOME/nami-notch"
BIN_DIR="$HOME/.local/bin"
BIN="$BIN_DIR/nami-notch"
CONFIG_DIR="$CONFIG_HOME/nami-notch"
HYPR_DIR="$CONFIG_HOME/hypr"
AUTOSTART=1
START=1
CHECK_DEPS=1

usage() {
  cat <<'EOF'
Install Nami Notch.

Usage:
  ./install.sh [options]

Options:
  --no-autostart   Do not add Nami Notch to the Hyprland startup config.
  --no-start       Install only; do not launch or restart Nami Notch.
  --skip-deps      Skip the Python/GTK runtime check.
  -h, --help       Show this help.
EOF
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

say() {
  printf '%s\n' "$*"
}

while (($#)); do
  case "$1" in
    --no-autostart) AUTOSTART=0 ;;
    --no-start) START=0 ;;
    --skip-deps) CHECK_DEPS=0 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
  shift
done

[[ -f "$REPO_DIR/bin/nami-notch" ]] || die "bin/nami-notch is missing"
[[ -f "$REPO_DIR/web/index.html" ]] || die "web/index.html is missing"
[[ -f "$REPO_DIR/web/app.js" ]] || die "web/app.js is missing"
[[ -d "$REPO_DIR/src" ]] || die "src/ is missing"

if [[ "$CHECK_DEPS" -eq 1 ]]; then
  if ! python3 - <<'PY'
import sys

ok = True
try:
    import cairo  # noqa: F401
except Exception as exc:
    print(f"pycairo: {exc}", file=sys.stderr)
    ok = False

try:
    import gi
    gi.require_version("Gtk", "3.0")
    gi.require_version("Gdk", "3.0")
    gi.require_version("GtkLayerShell", "0.1")
    gi.require_version("WebKit2", "4.1")
    from gi.repository import Gdk, Gtk, GtkLayerShell, WebKit2  # noqa: F401
except Exception as exc:
    print(f"PyGObject/GTK/WebKit2/gtk-layer-shell: {exc}", file=sys.stderr)
    ok = False

raise SystemExit(0 if ok else 1)
PY
  then
    printf '\nMissing runtime dependencies.\n\n' >&2
    if [[ -r /etc/os-release ]]; then
      # shellcheck disable=SC1091
      . /etc/os-release
      case "${ID:-}" in
        arch|manjaro)
          printf 'Arch Linux:\n  sudo pacman -S --needed python-gobject python-cairo gtk3 webkit2gtk-4.1 gtk-layer-shell\n\n' >&2
          ;;
        debian|ubuntu|linuxmint|pop)
          printf 'Debian/Ubuntu (package names vary by release):\n  sudo apt install python3-gi python3-gi-cairo python3-cairo gir1.2-gtk-3.0 gir1.2-webkit2-4.1 gir1.2-gtklayershell-0.1\n\n' >&2
          ;;
      esac
    fi
    printf 'Install the GTK 3, WebKit2GTK 4.1, gtk-layer-shell and PyGObject/Pycairo packages, then rerun.\n' >&2
    exit 1
  fi
fi

say "Installing Nami Notch to $APP_DIR"
install -d "$APP_DIR/web" "$APP_DIR/src" "$BIN_DIR" "$CONFIG_DIR"
install -m 0644 "$REPO_DIR/web/index.html" "$APP_DIR/web/index.html"
install -m 0644 "$REPO_DIR/web/style.css" "$APP_DIR/web/style.css"
install -m 0644 "$REPO_DIR/web/app.js" "$APP_DIR/web/app.js"
cp -a "$REPO_DIR/src/." "$APP_DIR/src/"
install -m 0755 "$REPO_DIR/bin/nami-notch" "$BIN"

if [[ ! -f "$CONFIG_DIR/settings.json" ]]; then
  printf '{\n  "model": "nami",\n  "outfit": "auto",\n  "compact": "stats",\n  "pinned": false\n}\n' > "$CONFIG_DIR/settings.json"
fi

if [[ "$AUTOSTART" -eq 1 ]]; then
  TARGET=""
  if [[ -f "$HYPR_DIR/UserConfigs/Startup_Apps.conf" ]]; then
    TARGET="$HYPR_DIR/UserConfigs/Startup_Apps.conf"
  elif [[ -f "$HYPR_DIR/hyprland.conf" ]]; then
    TARGET="$HYPR_DIR/hyprland.conf"
  fi

  if [[ -n "$TARGET" ]]; then
    if grep -Fq 'nami-notch' "$TARGET"; then
      say "Autostart already configured in $TARGET"
    else
      [[ -f "$TARGET.nami-notch.bak" ]] || cp -a "$TARGET" "$TARGET.nami-notch.bak"
      {
        printf '\n# >>> nami-notch >>>\n'
        printf 'exec-once = env GDK_BACKEND=wayland %s\n' "$BIN"
        printf '# <<< nami-notch <<<\n'
      } >> "$TARGET"
      say "Added autostart to $TARGET"
    fi
  elif [[ -d "$HYPR_DIR" ]]; then
    SNIPPET="$HYPR_DIR/nami-notch.conf"
    if [[ ! -f "$SNIPPET" ]]; then
      {
        printf '# >>> nami-notch >>>\n'
        printf 'exec-once = env GDK_BACKEND=wayland %s\n' "$BIN"
        printf '# <<< nami-notch <<<\n'
      } > "$SNIPPET"
      say "Created $SNIPPET"
    fi
    say "Add this line to your Hyprland config if it is not already sourced:"
    say "  source = $SNIPPET"
  else
    say "Hyprland config not found; skipping autostart."
  fi
fi

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) say "Note: $BIN_DIR is not in PATH. Use $BIN or add it to PATH." ;;
esac

if [[ "$START" -eq 1 ]]; then
  if [[ -z "${WAYLAND_DISPLAY:-}" ]]; then
    say "No Wayland session detected. Start later with: GDK_BACKEND=wayland $BIN"
  else
    if command -v pgrep >/dev/null 2>&1 && pgrep -f "python3 $BIN" >/dev/null 2>&1; then
      say "Restarting running Nami Notch..."
      pkill -f "python3 $BIN" >/dev/null 2>&1 || true
      sleep 1
    fi
    if command -v setsid >/dev/null 2>&1; then
      setsid env GDK_BACKEND=wayland "$BIN" >/dev/null 2>&1 </dev/null &
    else
      nohup env GDK_BACKEND=wayland "$BIN" >/dev/null 2>&1 </dev/null &
    fi
    sleep 1
    say "Nami Notch started."
  fi
else
  say "Start with: GDK_BACKEND=wayland $BIN"
fi

say "Config: $CONFIG_DIR/settings.json"
say "Log:    $APP_DIR/nami.log"
