#!/usr/bin/env bash
# tiktok-live-events (Python) - macOS / Linux one-click launcher.
set -euo pipefail

PY="python3"
if ! command -v "$PY" >/dev/null 2>&1; then
    if command -v python >/dev/null 2>&1; then PY="python"; else
        echo "[events] Python is not installed. Get it from https://www.python.org/downloads/"
        exit 1
    fi
fi

if ! command -v tiktok-live-events >/dev/null 2>&1; then
    echo "[events] Installing tiktok-live-events..."
    "$PY" -m pip install --user --upgrade tiktok-live-events || {
        echo "[events] pip install failed."
        exit 1
    }
fi

if [[ -t 0 ]]; then
    read -rp "Enter the TikTok username (without @): " TTUSER
else
    if [[ -r /dev/tty ]]; then
        printf 'Enter the TikTok username (without @): ' > /dev/tty
        read -r TTUSER < /dev/tty
    else
        echo "[events] No TTY available. Run: tiktok-live-events <username>"
        exit 1
    fi
fi

if [[ -z "${TTUSER:-}" ]]; then
    echo "[events] No username entered. Exiting."
    exit 1
fi

echo "[events] connecting to @${TTUSER}  (Ctrl+C to stop)"
if command -v tiktok-live-events >/dev/null 2>&1; then
    tiktok-live-events "$TTUSER"
else
    "$PY" -m tiktok_live_events.cli "$TTUSER"
fi
