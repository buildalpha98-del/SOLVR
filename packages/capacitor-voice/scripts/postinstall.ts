/**
 * postinstall.ts — @buildalpha/capacitor-voice
 *
 * Runs after `pnpm install` in any host app that has installed this plugin.
 * Appends required Info.plist entries to the host app's ios/App/App/Info.plist:
 *   - NSMicrophoneUsageDescription (required by Apple for microphone access)
 *   - UIBackgroundModes: audio + voip (required for background calls + PushKit)
 *
 * Idempotent: re-runs are no-ops if the keys are already present.
 * Fails open: logs a warning and exits 0 on any error — never crashes `pnpm install`.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as plist from "plist";

const REQUIRED_BG_MODES = ["audio", "voip"];

export function findHostInfoPlist(initCwd?: string): string | null {
  const cwd = initCwd ?? process.env.INIT_CWD ?? process.cwd();

  // Skip if we are being run from inside the plugin itself (dev install).
  if (
    cwd.endsWith("/packages/capacitor-voice") ||
    cwd.endsWith("\\packages\\capacitor-voice")
  ) {
    return null;
  }

  // Default Capacitor iOS path.
  const defaultPath = join(cwd, "ios", "App", "App", "Info.plist");
  if (existsSync(defaultPath)) return defaultPath;

  // Not found — log a warning so host devs know to check manually.
  console.warn(
    `[capacitor-voice] postinstall: could not find Info.plist at ${defaultPath}. ` +
      `If your iOS project lives at a different path, add the required keys manually ` +
      `(NSMicrophoneUsageDescription, UIBackgroundModes: audio + voip).`,
  );
  return null;
}

export function ensureMicrophoneUsageDescription(
  parsed: Record<string, unknown>,
  hostAppName: string,
): boolean {
  if (parsed["NSMicrophoneUsageDescription"]) return false;
  parsed["NSMicrophoneUsageDescription"] =
    `${hostAppName} uses your microphone for in-app calls.`;
  return true;
}

export function ensureBackgroundModes(
  parsed: Record<string, unknown>,
): string[] {
  const existing: string[] = Array.isArray(parsed["UIBackgroundModes"])
    ? (parsed["UIBackgroundModes"] as string[])
    : [];
  const added: string[] = [];
  for (const mode of REQUIRED_BG_MODES) {
    if (!existing.includes(mode)) {
      existing.push(mode);
      added.push(mode);
    }
  }
  parsed["UIBackgroundModes"] = existing;
  return added;
}

export function run(initCwd?: string): void {
  const plistPath = findHostInfoPlist(initCwd);
  if (!plistPath) {
    console.log(
      "[capacitor-voice] postinstall: not running inside a host Capacitor app, skipping.",
    );
    return;
  }

  let raw: string;
  try {
    raw = readFileSync(plistPath, "utf-8");
  } catch {
    console.warn(
      `[capacitor-voice] postinstall: could not read ${plistPath}, skipping.`,
    );
    return;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = plist.parse(raw) as Record<string, unknown>;
  } catch {
    console.warn(
      `[capacitor-voice] postinstall: could not parse ${plistPath}, skipping.`,
    );
    return;
  }

  const hostAppName =
    (parsed["CFBundleDisplayName"] as string | undefined) ??
    (parsed["CFBundleName"] as string | undefined) ??
    "This app";

  let modified = false;

  if (ensureMicrophoneUsageDescription(parsed, hostAppName)) {
    modified = true;
    console.log(
      "[capacitor-voice] postinstall: added NSMicrophoneUsageDescription.",
    );
  }

  const addedModes = ensureBackgroundModes(parsed);
  if (addedModes.length > 0) {
    modified = true;
    console.log(
      `[capacitor-voice] postinstall: added UIBackgroundModes: ${addedModes.join(", ")}.`,
    );
  }

  if (!modified) {
    console.log(
      "[capacitor-voice] postinstall: Info.plist already has all required entries.",
    );
    return;
  }

  writeFileSync(plistPath, plist.build(parsed));
  console.log(`[capacitor-voice] postinstall: updated ${plistPath}.`);
}

// Only run main() when executed directly (not when imported by tests).
if (
  process.argv[1] &&
  (process.argv[1].endsWith("postinstall.ts") ||
    process.argv[1].endsWith("postinstall.js"))
) {
  try {
    run();
  } catch (e) {
    console.warn(
      "[capacitor-voice] postinstall: unexpected error, skipping.",
      e,
    );
  }
}
