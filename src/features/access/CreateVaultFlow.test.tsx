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
    await user.click(screen.getByRole("button", { name: "下一步" }));
    expect(onCreate).toHaveBeenCalledWith("real-password-1");
    expect(screen.getByText("REAL-RECOVERY-KEY")).toBeInTheDocument();
    await user.click(screen.getByLabelText("我已离线保存恢复密钥"));
    await user.click(screen.getByRole("button", { name: "解锁保险库" }));
    expect(onComplete).toHaveBeenCalledWith("real-password-1");
  });

  it("toggles the two password fields independently", async () => {
    const user = userEvent.setup();
    render(<CreateVaultFlow onBack={vi.fn()} onCreate={vi.fn()} onComplete={vi.fn()} demoMode={false} />);
    const password = screen.getByLabelText("设置主密码");
    const confirmation = screen.getByLabelText("确认主密码");
    await user.click(screen.getByRole("button", { name: "显示主密码" }));
    expect(password).toHaveAttribute("type", "text");
    expect(confirmation).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "显示确认密码" }));
    expect(confirmation).toHaveAttribute("type", "text");
    expect(password).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "隐藏主密码" }));
    expect(password).toHaveAttribute("type", "password");
  });
});
