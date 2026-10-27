import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, SETTINGS_STORAGE_KEY, type UiSettings } from "./settings";

describe("UI settings", () => {
  beforeEach(() => localStorage.clear());

  it("returns defaults for malformed or missing data", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    localStorage.setItem(SETTINGS_STORAGE_KEY, "not-json");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("drops unknown keys and repairs invalid values", () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ theme: "neon", autoLockMinutes: 2, clipboardSeconds: 1, password: "secret" }));
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings()).not.toHaveProperty("password");
  });

  it("persists only the preference whitelist", () => {
    const input = { ...DEFAULT_SETTINGS, theme: "dark", autoLockMinutes: 15, password: "do-not-store" } as unknown as UiSettings;
    saveSettings(input);
    const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!);
    expect(stored).toEqual({ theme: "dark", autoLockMinutes: 15, clipboardSeconds: 30 });
    expect(stored).not.toHaveProperty("password");
    expect(loadSettings()).toEqual({ theme: "dark", autoLockMinutes: 15, clipboardSeconds: 30 });
  });
});
