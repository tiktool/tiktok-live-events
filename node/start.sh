#!/usr/bin/env bash
# tiktok-live-events - macOS / Linux one-click launcher.
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
    echo "[events] Node.js is not installed. Get it from https://nodejs.org/"
    exit 1
fi

if ! command -v tiktok-live-events >/dev/null 2>&1; then
    echo "[events] Installing tiktok-live-events globally..."
    if ! npm i -g tiktok-live-events 2>/dev/null; then
        echo "[events] Global install needs sudo? Falling back to npx."
    fi
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
    npx -y tiktok-live-events "$TTUSER"
fi
