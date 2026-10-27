import { fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoLock } from "./use-auto-lock";

describe("useAutoLock", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("locks exactly once after the configured inactivity period", () => {
    const onLock = vi.fn();
    const { unmount } = renderHook(() => useAutoLock({ minutes: 5, onLock, enabled: true }));
    vi.advanceTimersByTime(5 * 60_000 - 1_000);
    expect(onLock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(onLock).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(60_000);
    expect(onLock).toHaveBeenCalledOnce();
    unmount();
  });

  it("resets the deadline on pointer and keyboard activity", () => {
    const onLock = vi.fn();
    renderHook(() => useAutoLock({ minutes: 5, onLock, enabled: true }));
    vi.advanceTimersByTime(4 * 60_000);
    fireEvent.pointerDown(window);
    vi.advanceTimersByTime(4 * 60_000);
    fireEvent.keyDown(window, { key: "a" });
    vi.advanceTimersByTime(5 * 60_000 - 1_000);
    expect(onLock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(onLock).toHaveBeenCalledOnce();
  });

  it("does not run while disabled", () => {
    const onLock = vi.fn();
    renderHook(() => useAutoLock({ minutes: 1, onLock, enabled: false }));
    vi.advanceTimersByTime(120_000);
    expect(onLock).not.toHaveBeenCalled();
  });
});
