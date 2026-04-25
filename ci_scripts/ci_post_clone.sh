#!/bin/sh
# Xcode Cloud post-clone script.
# Runs immediately after Xcode Cloud clones the repo, before any build action.
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

# Xcode Cloud clones into /Volumes/workspace/repository — the script's
# working directory at invocation is ci_scripts/, so jump up one level.
cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"
echo "[ci_post_clone] Repo root: $REPO_ROOT"

# ── 1. Install Node + pnpm ────────────────────────────────────────────────
# Xcode Cloud images ship with Homebrew but not Node by default.
echo "[ci_post_clone] Installing Node + pnpm..."
brew install node
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
