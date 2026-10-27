import { useCallback, useEffect, useState } from "react";
import { loadSettings, saveSettings, type UiSettings } from "@/lib/settings";

export function useSettings() {
  const [settings, setSettings] = useState<UiSettings>(() => loadSettings());

  const updateSettings = useCallback((patch: Partial<UiSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const dark = settings.theme === "dark" || (settings.theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };
    applyTheme();
    if (settings.theme !== "system") return;
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [settings.theme]);

  return { settings, updateSettings };
}
