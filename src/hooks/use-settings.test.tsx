import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { SETTINGS_STORAGE_KEY } from "@/lib/settings";
import { useSettings } from "./use-settings";

describe("useSettings", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("applies dark mode and persists theme changes", () => {
    const { result } = renderHook(() => useSettings());
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    act(() => result.current.updateSettings({ theme: "dark" }));
    expect(result.current.settings.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!).theme).toBe("dark");
    act(() => result.current.updateSettings({ theme: "light" }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
