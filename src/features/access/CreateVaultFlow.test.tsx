import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CreateVaultFlow } from "./CreateVaultFlow";

describe("CreateVaultFlow", () => {
  it("uses the recovery key returned by the real gateway", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue({ recoveryKey: "REAL-RECOVERY-KEY" });
    const onComplete = vi.fn().mockResolvedValue(undefined);
    render(<CreateVaultFlow onBack={vi.fn()} onCreate={onCreate} onComplete={onComplete} demoMode={false} />);
    await user.type(screen.getByLabelText("设置主密码"), "real-password-1");
    await user.type(screen.getByLabelText("确认主密码"), "real-password-1");
    await user.click(screen.getByRole("button", { name: "继续" }));
    expect(onCreate).toHaveBeenCalledWith("real-password-1");
    expect(screen.getByText("REAL-RECOVERY-KEY")).toBeInTheDocument();
    await user.click(screen.getByLabelText("我已离线保存恢复密钥"));
    await user.click(screen.getByRole("button", { name: "解锁保险库" }));
    expect(onComplete).toHaveBeenCalledWith("real-password-1");
  });
});
