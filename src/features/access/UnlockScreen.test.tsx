import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UnlockScreen } from "./UnlockScreen";

describe("UnlockScreen", () => {
  it("passes the supplied real password to the gateway", async () => {
    const user = userEvent.setup();
    const onUnlock = vi.fn().mockResolvedValue(undefined);
    render(<UnlockScreen onBack={vi.fn()} onForgot={vi.fn()} onUnlock={onUnlock} showRecoveryNotice={false} demoMode={false} />);
    await user.type(screen.getByLabelText("主密码"), "real-password-1");
    await user.click(screen.getByRole("button", { name: /^解锁$/ }));
    expect(onUnlock).toHaveBeenCalledWith("real-password-1");
  });
});
