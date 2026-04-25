#!/bin/sh
# Xcode Cloud post-clone script.
# Runs immediately after Xcode Cloud clones the repo, before any build action.
#
# LOCATION: this file MUST live at ios/App/ci_scripts/ci_post_clone.sh —
# Apple's docs are explicit that the ci_scripts directory must be
# co-located with the .xcworkspace file. The repo's xcworkspace is at
# ios/App/App.xcworkspace, so the script lives at ios/App/ci_scripts/.
# A previous attempt placed this at the repo root and Xcode Cloud
# silently skipped it (build duration: 1m, queue: 17s, no log output).
#
# Why this exists:
#   - SOLVR's iOS app uses Capacitor + CocoaPods.
#   - ios/App/Pods/ is gitignored (standard, large).
#   - Xcode Cloud doesn't run `pod install` automatically.
#   - Without this script, the build fails with:
#       "Unable to open base configuration reference file
#        '.../Pods/Target Support Files/Pods-App/Pods-App.release.xcconfig'"
#
# This script also runs `pnpm install` + `pnpm build` + `npx cap sync ios`
# so the latest web bundle is baked into the IPA without us needing to
# manually run cap sync before each archive.
#
# Docs: https://developer.apple.com/documentation/xcode/writing-custom-build-scripts

set -e
echo "[ci_post_clone] Starting SOLVR post-clone setup..."

# Xcode Cloud clones the repo into /Volumes/workspace/repository.
# We're at /Volumes/workspace/repository/ios/App/ci_scripts/ at script
# invocation — climb three levels to get to the repo root where
# package.json + pnpm-lock.yaml + capacitor.config.ts live.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_ROOT"
echo "[ci_post_clone] Repo root: $REPO_ROOT"
ls -la

# ── 1. Install Node + pnpm ────────────────────────────────────────────────
# Xcode Cloud images ship with Homebrew but not Node by default.
# Pin to Node 22 (current LTS) for build reproducibility.
echo "[ci_post_clone] Installing Node 22 + pnpm..."
brew install node@22
brew link --overwrite --force node@22
npm install -g pnpm

# ── 2. Install web deps + build the bundle ────────────────────────────────
echo "[ci_post_clone] Installing JS dependencies..."
pnpm install --frozen-lockfile

echo "[ci_post_clone] Building web bundle..."
pnpm build

# ── 3. Sync web bundle into ios/App/App/public/ ───────────────────────────
# `cap sync ios` does both: copies dist/ + runs pod install.
# Set LANG to avoid the Ruby 4.0 / CocoaPods 1.16 ASCII-8BIT encoding bug.
echo "[ci_post_clone] Syncing Capacitor + installing Pods..."
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
npx cap sync ios

echo "[ci_post_clone] ✓ Done. Xcode can now build the project."
