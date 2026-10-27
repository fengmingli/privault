export type ThemePreference = "light" | "dark" | "system";
export type AutoLockMinutes = 1 | 5 | 15;
export type ClipboardSeconds = 15 | 30 | 60;

export interface UiSettings {
  theme: ThemePreference;
  autoLockMinutes: AutoLockMinutes;
  clipboardSeconds: ClipboardSeconds;
}

export const SETTINGS_STORAGE_KEY = "privault.prototype.ui-settings.v1";
export const DEFAULT_SETTINGS: UiSettings = { theme: "system", autoLockMinutes: 5, clipboardSeconds: 30 };

function sanitizeSettings(value: unknown): UiSettings {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    theme: data.theme === "light" || data.theme === "dark" || data.theme === "system" ? data.theme : DEFAULT_SETTINGS.theme,
    autoLockMinutes: data.autoLockMinutes === 1 || data.autoLockMinutes === 5 || data.autoLockMinutes === 15 ? data.autoLockMinutes : DEFAULT_SETTINGS.autoLockMinutes,
    clipboardSeconds: data.clipboardSeconds === 15 || data.clipboardSeconds === 30 || data.clipboardSeconds === 60 ? data.clipboardSeconds : DEFAULT_SETTINGS.clipboardSeconds,
  };
}

export function loadSettings(storage: Storage = localStorage): UiSettings {
  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    return raw ? sanitizeSettings(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: UiSettings, storage: Storage = localStorage): void {
  storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(sanitizeSettings(settings)));
}
