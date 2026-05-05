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

import { readFileSync, writeFileSync, existsSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as plist from "plist";

// Resolve __dirname in ESM context.
const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");

/**
 * Returns true when pnpm/npm install is being run from the plugin's own
 * monorepo (i.e. INIT_CWD is the repo root and
 * `<INIT_CWD>/packages/capacitor-voice/package.json` resolves to the same
 * canonical file as this plugin's own package.json).
 *
 * In this situation modifying a sibling app's Info.plist would be premature,
 * so we skip entirely.
 */
export function isSelfHostedDevContext(initCwd?: string): boolean {
  const cwd = initCwd ?? process.env.INIT_CWD;
  if (!cwd) return false;
  // This plugin's own package.json (one directory up from scripts/).
  const pluginPkgPath = resolve(__dirname, "..", "package.json");
  // What the plugin's package.json would be if it lives inside this host repo.
  const candidatePath = resolve(cwd, "packages", "capacitor-voice", "package.json");
  try {
    return realpathSync(pluginPkgPath) === realpathSync(candidatePath);
  } catch {
    // candidatePath doesn't exist → not a self-host context.
    return false;
  }
}

const REQUIRED_BG_MODES = ["audio", "voip"];

export function findHostInfoPlist(initCwd?: string): string | null {
  const cwd = initCwd ?? process.env.INIT_CWD ?? process.cwd();

  // Skip if we are being run from inside the plugin directory itself (dev install).
  if (
    cwd.endsWith("/packages/capacitor-voice") ||
    cwd.endsWith("\\packages\\capacitor-voice")
  ) {
    return null;
  }

  // Skip if pnpm install is being run from the plugin's own monorepo root
  // (i.e. the plugin lives at <INIT_CWD>/packages/capacitor-voice/).
  if (isSelfHostedDevContext(cwd)) {
    console.log(
      "[capacitor-voice] postinstall: detected self-hosted dev install " +
        "(plugin lives in the same repo as the host), skipping Info.plist modification.",
    );
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
