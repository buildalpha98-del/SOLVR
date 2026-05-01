/**
 * Tests for packages/capacitor-voice/scripts/postinstall.ts
 *
 * Uses a real temp directory for filesystem operations so tests are integration-
 * style (no fs mocking needed) and we get high confidence the script behaves
 * correctly end-to-end.
 */

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

// Resolve the directory of this test file so we can construct paths relative
// to the actual plugin package (needed for the self-host detection test).
const __testFilename = fileURLToPath(import.meta.url);
const __testDirname = resolve(__testFilename, "..");
import { describe, it, expect, beforeEach, vi } from "vitest";
import * as plist from "plist";

// We import the named exports so we can unit-test the helpers in isolation.
import {
  findHostInfoPlist,
  isSelfHostedDevContext,
  ensureMicrophoneUsageDescription,
  ensureBackgroundModes,
  run,
} from "./postinstall.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTempHostApp(): { root: string; plistPath: string } {
  const root = mkdtempSync(join(tmpdir(), "cap-voice-test-"));
  const dir = join(root, "ios", "App", "App");
  mkdirSync(dir, { recursive: true });
  const plistPath = join(dir, "Info.plist");
  return { root, plistPath };
}

function writePlist(
  plistPath: string,
  data: Record<string, unknown>,
): void {
  writeFileSync(plistPath, plist.build(data as plist.PlistObject));
}

function readPlist(plistPath: string): Record<string, unknown> {
  return plist.parse(readFileSync(plistPath, "utf-8")) as Record<
    string,
    unknown
  >;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("postinstall", () => {
  // Spy on console so we can assert log output without polluting test output.
  const consoleSpy = {
    log: vi.spyOn(console, "log").mockImplementation(() => {}),
    warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
  };

  beforeEach(() => {
    consoleSpy.log.mockClear();
    consoleSpy.warn.mockClear();
  });

  // ── isSelfHostedDevContext ──────────────────────────────────────────────────

  describe("isSelfHostedDevContext", () => {
    it("returns false when initCwd is an empty string (no cwd provided)", () => {
      // Empty string is falsy — treated the same as no cwd.
      expect(isSelfHostedDevContext("")).toBe(false);
    });

    it("returns false when the candidate path does not exist in initCwd", () => {
      const root = mkdtempSync(join(tmpdir(), "cap-voice-selfhost-false-"));
      expect(isSelfHostedDevContext(root)).toBe(false);
    });

    it("returns true when initCwd contains a symlink that resolves to the plugin's own package.json", () => {
      // Build a fake monorepo root that has packages/capacitor-voice/ pointing
      // at the real plugin directory via a symlink.
      const fakeRoot = mkdtempSync(join(tmpdir(), "cap-voice-selfhost-true-"));
      const fakePackagesDir = join(fakeRoot, "packages");
      mkdirSync(fakePackagesDir, { recursive: true });
      // The real plugin root is two directories above scripts/ (scripts → package root).
      const realPluginRoot = resolve(__testDirname, "..");
      symlinkSync(realPluginRoot, join(fakePackagesDir, "capacitor-voice"));
      expect(isSelfHostedDevContext(fakeRoot)).toBe(true);
    });
  });

  // ── findHostInfoPlist ───────────────────────────────────────────────────────

  describe("findHostInfoPlist", () => {
    it("returns null when INIT_CWD points to the plugin itself", () => {
      const result = findHostInfoPlist("/some/repo/packages/capacitor-voice");
      expect(result).toBeNull();
    });

    it("returns null and logs self-hosted message when initCwd is the plugin's own monorepo root", () => {
      // Build a fake monorepo root with packages/capacitor-voice symlinked to
      // the real plugin directory — replicates running `pnpm install` from the
      // SOLVR repo root during plugin development.
      const fakeRoot = mkdtempSync(join(tmpdir(), "cap-voice-selfhost-skip-"));
      const fakePackagesDir = join(fakeRoot, "packages");
      mkdirSync(fakePackagesDir, { recursive: true });
      const realPluginRoot = resolve(__testDirname, "..");
      symlinkSync(realPluginRoot, join(fakePackagesDir, "capacitor-voice"));

      const result = findHostInfoPlist(fakeRoot);
      expect(result).toBeNull();
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("self-hosted dev install"),
      );
    });

    it("returns the path when the default Info.plist exists", () => {
      const { root, plistPath } = makeTempHostApp();
      writePlist(plistPath, { CFBundleName: "TestApp" });
      const result = findHostInfoPlist(root);
      expect(result).toBe(plistPath);
    });

    it("returns null (and warns) when Info.plist is not found", () => {
      const root = mkdtempSync(join(tmpdir(), "cap-voice-test-no-plist-"));
      const result = findHostInfoPlist(root);
      expect(result).toBeNull();
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining("could not find Info.plist"),
      );
    });
  });

  // ── ensureMicrophoneUsageDescription ──────────────────────────────────────

  describe("ensureMicrophoneUsageDescription", () => {
    it("adds NSMicrophoneUsageDescription when absent", () => {
      const parsed: Record<string, unknown> = { CFBundleDisplayName: "MyApp" };
      const changed = ensureMicrophoneUsageDescription(parsed, "MyApp");
      expect(changed).toBe(true);
      expect(parsed["NSMicrophoneUsageDescription"]).toBe(
        "MyApp uses your microphone for in-app calls.",
      );
    });

    it("does NOT overwrite an existing NSMicrophoneUsageDescription", () => {
      const parsed: Record<string, unknown> = {
        NSMicrophoneUsageDescription: "Existing description",
      };
      const changed = ensureMicrophoneUsageDescription(parsed, "MyApp");
      expect(changed).toBe(false);
      expect(parsed["NSMicrophoneUsageDescription"]).toBe(
        "Existing description",
      );
    });
  });

  // ── ensureBackgroundModes ─────────────────────────────────────────────────

  describe("ensureBackgroundModes", () => {
    it("adds both audio and voip when UIBackgroundModes is absent", () => {
      const parsed: Record<string, unknown> = {};
      const added = ensureBackgroundModes(parsed);
      expect(added).toEqual(["audio", "voip"]);
      expect(parsed["UIBackgroundModes"]).toEqual(["audio", "voip"]);
    });

    it("adds only voip when audio is already present", () => {
      const parsed: Record<string, unknown> = {
        UIBackgroundModes: ["audio"],
      };
      const added = ensureBackgroundModes(parsed);
      expect(added).toEqual(["voip"]);
      expect(parsed["UIBackgroundModes"]).toEqual(["audio", "voip"]);
    });

    it("adds only audio when voip is already present", () => {
      const parsed: Record<string, unknown> = {
        UIBackgroundModes: ["voip"],
      };
      const added = ensureBackgroundModes(parsed);
      expect(added).toEqual(["audio"]);
      expect(parsed["UIBackgroundModes"]).toEqual(["voip", "audio"]);
    });

    it("returns empty array and changes nothing when both modes are present", () => {
      const parsed: Record<string, unknown> = {
        UIBackgroundModes: ["audio", "voip"],
      };
      const added = ensureBackgroundModes(parsed);
      expect(added).toEqual([]);
      expect(parsed["UIBackgroundModes"]).toEqual(["audio", "voip"]);
    });

    it("preserves extra existing modes", () => {
      const parsed: Record<string, unknown> = {
        UIBackgroundModes: ["fetch"],
      };
      const added = ensureBackgroundModes(parsed);
      expect(added).toEqual(["audio", "voip"]);
      expect(parsed["UIBackgroundModes"]).toEqual(["fetch", "audio", "voip"]);
    });
  });

  // ── run() integration tests ───────────────────────────────────────────────

  describe("run", () => {
    it("1. already-configured plist: idempotent — no changes, no write", () => {
      const { root, plistPath } = makeTempHostApp();
      writePlist(plistPath, {
        CFBundleDisplayName: "Solvr",
        NSMicrophoneUsageDescription:
          "Solvr uses your microphone for in-app calls.",
        UIBackgroundModes: ["audio", "voip"],
      });

      const before = readFileSync(plistPath, "utf-8");
      run(root);
      const after = readFileSync(plistPath, "utf-8");

      expect(after).toBe(before);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("already has all required entries"),
      );
    });

    it("2. missing NSMicrophoneUsageDescription: added with host app name", () => {
      const { root, plistPath } = makeTempHostApp();
      writePlist(plistPath, {
        CFBundleDisplayName: "WorkApp",
        UIBackgroundModes: ["audio", "voip"],
      });

      run(root);

      const result = readPlist(plistPath);
      expect(result["NSMicrophoneUsageDescription"]).toBe(
        "WorkApp uses your microphone for in-app calls.",
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("added NSMicrophoneUsageDescription"),
      );
    });

    it("2b. missing both keys: uses CFBundleName as fallback display name", () => {
      const { root, plistPath } = makeTempHostApp();
      writePlist(plistPath, {
        CFBundleName: "FallbackApp",
      });

      run(root);

      const result = readPlist(plistPath);
      expect(result["NSMicrophoneUsageDescription"]).toBe(
        "FallbackApp uses your microphone for in-app calls.",
      );
    });

    it("2c. missing both keys and no bundle name: uses fallback string", () => {
      const { root, plistPath } = makeTempHostApp();
      writePlist(plistPath, {});

      run(root);

      const result = readPlist(plistPath);
      expect(result["NSMicrophoneUsageDescription"]).toBe(
        "This app uses your microphone for in-app calls.",
      );
    });

    it("3. missing UIBackgroundModes entirely: both audio and voip added", () => {
      const { root, plistPath } = makeTempHostApp();
      writePlist(plistPath, {
        CFBundleDisplayName: "MyApp",
        NSMicrophoneUsageDescription: "Already here",
      });

      run(root);

      const result = readPlist(plistPath);
      expect(result["UIBackgroundModes"]).toContain("audio");
      expect(result["UIBackgroundModes"]).toContain("voip");
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("audio"),
      );
    });

    it("4. existing UIBackgroundModes with only audio: voip appended, audio preserved", () => {
      const { root, plistPath } = makeTempHostApp();
      writePlist(plistPath, {
        CFBundleDisplayName: "MyApp",
        NSMicrophoneUsageDescription: "Exists",
        UIBackgroundModes: ["audio"],
      });

      run(root);

      const result = readPlist(plistPath);
      const modes = result["UIBackgroundModes"] as string[];
      expect(modes).toContain("audio");
      expect(modes).toContain("voip");
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("voip"),
      );
    });

    it("5. malformed plist: logs warning, does not throw", () => {
      const { root, plistPath } = makeTempHostApp();
      writeFileSync(plistPath, "<<< THIS IS NOT A VALID PLIST >>>");

      expect(() => run(root)).not.toThrow();
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining("could not parse"),
      );
    });

    it("6. no host app Info.plist found: logs skip message, does not throw", () => {
      const root = mkdtempSync(join(tmpdir(), "cap-voice-test-noplist-"));

      expect(() => run(root)).not.toThrow();
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("skipping"),
      );
    });
  });
});
