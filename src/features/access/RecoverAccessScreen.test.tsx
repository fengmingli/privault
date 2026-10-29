import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecoverAccessScreen } from "./RecoverAccessScreen";

describe("RecoverAccessScreen", () => {
  it("shows the newly rotated recovery key before returning to unlock", async () => {
    const user = userEvent.setup();
    const onRecover = vi.fn().mockResolvedValue({ recoveryKey: "NEW-RECOVERY-KEY" });
    const onRecovered = vi.fn();
    const recoveryKey = `${Array.from({ length: 14 }, () => "AAAA").join("-")}-AA`;
    render(<RecoverAccessScreen onBack={vi.fn()} onRecover={onRecover} onRecovered={onRecovered} demoMode={false} />);
    await user.type(screen.getByLabelText("恢复密钥"), recoveryKey);
    await user.type(screen.getByLabelText("新主密码"), "new-password-1");
    await user.type(screen.getByLabelText("确认新主密码"), "new-password-1");
    await user.click(screen.getByRole("button", { name: "重置主密码" }));
    expect(onRecover).toHaveBeenCalledWith(recoveryKey, "new-password-1");
    expect(screen.getByText("NEW-RECOVERY-KEY")).toBeInTheDocument();
    await user.click(screen.getByLabelText("我已离线保存新恢复密钥"));
    await user.click(screen.getByRole("button", { name: "返回解锁" }));
    expect(onRecovered).toHaveBeenCalledOnce();
  });
});
