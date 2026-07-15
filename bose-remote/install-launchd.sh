#!/usr/bin/env bash
# Install the remote as a macOS launchd agent so it starts on login and
# restarts if it crashes. Run once, on the Mac that will host the server:
#
#     ./install-launchd.sh
#
# Uninstall with:  launchctl bootout gui/$(id -u)/com.bose-remote
#                  rm ~/Library/LaunchAgents/com.bose-remote.plist
set -euo pipefail
cd "$(dirname "$0")"
DIR="$(pwd)"

mkdir -p data ~/Library/LaunchAgents
PLIST=~/Library/LaunchAgents/com.bose-remote.plist

sed "s|__DIR__|$DIR|g" com.bose-remote.plist > "$PLIST"

# reload if already installed
launchctl bootout "gui/$(id -u)/com.bose-remote" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo "installed and started."
echo "logs:   tail -f $DIR/data/server.log"
echo "url:    http://$(hostname -s | tr '[:upper:]' '[:lower:]').local:${PORT:-8787}"
echo ""
echo "note: the Mac must be awake to serve the app. In System Settings ->"
echo "Displays -> Advanced (or Energy), enable 'Prevent automatic sleeping"
echo "when the display is off' (desktop Macs) so the server stays reachable."
