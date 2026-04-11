#!/usr/bin/env bash
#
# sync-mobile.sh — Pull Manus's latest work from origin/main into the Capacitor
# iOS build, rebuild, reinstall on the iPhone 17 Pro simulator, and launch it.
#
# Usage:
#   ./scripts/sync-mobile.sh              # full sync: fetch + merge + build + install
#   ./scripts/sync-mobile.sh --no-fetch   # skip git fetch/merge, just rebuild current branch
#   ./scripts/sync-mobile.sh --device     # install on connected iPhone instead of simulator
#                                         # (requires iPhone plugged in + trusted)
#
# Typical workflow:
#   1. Manus ships a feature to main
#   2. You run: ./scripts/sync-mobile.sh
#   3. ~60-90 seconds later, the updated app is running on the simulator
#
# If the build or merge fails, the script stops at the first error and prints
# where to look.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ── Colors for readability ───────────────────────────────────────────────────
if [ -t 1 ]; then
  GREEN=$'\033[0;32m'
  BLUE=$'\033[0;34m'
  YELLOW=$'\033[0;33m'
  RED=$'\033[0;31m'
  RESET=$'\033[0m'
else
  GREEN=""; BLUE=""; YELLOW=""; RED=""; RESET=""
fi

step() { echo "${BLUE}==>${RESET} ${1}"; }
ok()   { echo "${GREEN}✓${RESET} ${1}"; }
warn() { echo "${YELLOW}!${RESET} ${1}"; }
fail() { echo "${RED}✗${RESET} ${1}" >&2; exit 1; }

# ── Parse flags ──────────────────────────────────────────────────────────────
SKIP_FETCH=false
USE_DEVICE=false
for arg in "$@"; do
  case "$arg" in
    --no-fetch) SKIP_FETCH=true ;;
    --device)   USE_DEVICE=true ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) fail "Unknown flag: $arg (use --help)" ;;
  esac
done

# ── Guard: must be in the SOLVR repo ─────────────────────────────────────────
REMOTE_URL="$(git remote get-url origin 2>/dev/null || true)"
if [[ "$REMOTE_URL" != *"buildalpha98-del/SOLVR"* ]]; then
  fail "Not in the SOLVR repo. Remote is: $REMOTE_URL"
fi

# ── Guard: clean working tree before merging ─────────────────────────────────
if [ "$SKIP_FETCH" = false ]; then
  if [[ -n "$(git status --porcelain)" ]]; then
    warn "Working tree has uncommitted changes:"
    git status --short
    echo
    warn "Either commit them first, or run with --no-fetch to skip the merge step."
    exit 1
  fi
fi

# ── Step 1: Fetch + merge origin/main ────────────────────────────────────────
if [ "$SKIP_FETCH" = true ]; then
  step "Skipping git fetch/merge (--no-fetch)"
else
  step "Fetching origin/main…"
  git fetch origin main

  CURRENT_BRANCH="$(git branch --show-current)"
  NEW_COMMITS="$(git log HEAD..origin/main --oneline 2>/dev/null | wc -l | tr -d ' ')"

  if [ "$NEW_COMMITS" -eq 0 ]; then
    ok "No new commits on main. Already up to date."
  else
    step "Merging $NEW_COMMITS new commit(s) from main into $CURRENT_BRANCH…"
    git log HEAD..origin/main --oneline | sed 's/^/    /'
    git merge origin/main --no-edit
    ok "Merge clean"
  fi
fi

# ── Step 2: Rebuild the Vite web bundle ──────────────────────────────────────
step "Building web bundle (vite build + esbuild server)…"
pnpm run build > /tmp/solvr-mobile-build.log 2>&1 || {
  tail -30 /tmp/solvr-mobile-build.log >&2
  fail "pnpm run build failed. Full log: /tmp/solvr-mobile-build.log"
}
ok "Web bundle built (dist/public/ + dist/index.js)"

# ── Step 3: Capacitor sync ───────────────────────────────────────────────────
step "Syncing web assets into iOS project (npx cap sync ios)…"
rm -rf ios/App/build
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx cap sync ios > /tmp/solvr-mobile-sync.log 2>&1 || {
  tail -30 /tmp/solvr-mobile-sync.log >&2
  fail "cap sync ios failed. Full log: /tmp/solvr-mobile-sync.log"
}
ok "Capacitor synced"

# ── Step 4: xcodebuild ───────────────────────────────────────────────────────
if [ "$USE_DEVICE" = true ]; then
  DESTINATION="platform=iOS,name=$(xcrun xctrace list devices 2>&1 | grep -v Simulator | grep -oE '[^(]+\(.+\) \([0-9A-F-]+\)' | head -1 | sed 's/ (.*//')"
  step "Building iOS app for physical device ($DESTINATION)…"
  SDK="iphoneos"
else
  DESTINATION="platform=iOS Simulator,name=iPhone 17 Pro"
  step "Building iOS app for iPhone 17 Pro simulator…"
  SDK="iphonesimulator"
fi

cd ios/App
xcodebuild \
  -workspace App.xcworkspace \
  -scheme App \
  -configuration Debug \
  -sdk "$SDK" \
  -destination "$DESTINATION" \
  -derivedDataPath ./build \
  build > /tmp/solvr-mobile-xcodebuild.log 2>&1 || {
    grep -E "error:|BUILD FAILED" /tmp/solvr-mobile-xcodebuild.log | tail -20 >&2
    fail "xcodebuild failed. Full log: /tmp/solvr-mobile-xcodebuild.log"
  }
ok "iOS app built"
cd "$REPO_ROOT"

# ── Step 5: Install + launch ─────────────────────────────────────────────────
APP_PATH="$REPO_ROOT/ios/App/build/Build/Products/Debug-iphonesimulator/App.app"

if [ "$USE_DEVICE" = true ]; then
  warn "Device install: open Xcode and press Cmd+R to deploy + launch on your iPhone."
  warn "Workspace: $REPO_ROOT/ios/App/App.xcworkspace"
  open "$REPO_ROOT/ios/App/App.xcworkspace"
  ok "Xcode opened"
else
  step "Installing on iPhone 17 Pro simulator…"
  xcrun simctl terminate "iPhone 17 Pro" com.solvr.mobile 2>/dev/null || true
  xcrun simctl install "iPhone 17 Pro" "$APP_PATH"
  xcrun simctl launch "iPhone 17 Pro" com.solvr.mobile > /dev/null
  ok "Solvr app relaunched on simulator"
fi

echo
ok "${GREEN}Sync complete.${RESET} Changes from Manus's latest main are live in the mobile app."
