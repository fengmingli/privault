import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { VaultGateway } from "@/lib/vault-client";
import { ChangePasswordDialog } from "./ChangePasswordDialog";

function setup(changeMasterPassword = vi.fn()) {
  const user = userEvent.setup();
  const gateway = { isDemo: false, changeMasterPassword } as unknown as VaultGateway;
  const onClose = vi.fn();
  const onRequireUnlock = vi.fn();
  render(<ChangePasswordDialog open gateway={gateway} onClose={onClose} onRequireUnlock={onRequireUnlock} />);
  return { user, gateway, onClose, onRequireUnlock };
}

async function fillForm(user: ReturnType<typeof userEvent.setup>, current = "Current-pass1!", next = "New-master1!", confirmation = next) {
  await user.type(screen.getByLabelText("当前主密码"), current);
  await user.type(screen.getByLabelText("新主密码"), next);
  await user.type(screen.getByLabelText("确认新主密码"), confirmation);
}

describe("ChangePasswordDialog", () => {
  it("does not call the gateway for an invalid confirmation", async () => {
    const changeMasterPassword = vi.fn();
    const { user, gateway } = setup(changeMasterPassword);
    await fillForm(user, "Current-pass1!", "New-master1!", "Different-master1!");
    await user.click(screen.getByRole("button", { name: "确认修改" }));
    expect(screen.getByRole("alert")).toHaveTextContent("两次输入的密码不一致");
    expect(gateway.changeMasterPassword).not.toHaveBeenCalled();
  });

  it("keeps the dialog open when the current password is rejected", async () => {
    const changeMasterPassword = vi.fn().mockRejectedValue(new Error("当前主密码不正确"));
    const { user, onRequireUnlock, onClose } = setup(changeMasterPassword);
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "确认修改" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("当前主密码不正确");
    expect(onRequireUnlock).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("changes the password and returns to unlock", async () => {
    const changeMasterPassword = vi.fn().mockResolvedValue(undefined);
    const { user, gateway, onRequireUnlock } = setup(changeMasterPassword);
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "确认修改" }));
    expect(await screen.findByText("主密码已修改，请使用新主密码解锁")).toBeInTheDocument();
    expect(gateway.changeMasterPassword).toHaveBeenCalledWith("Current-pass1!", "New-master1!");
    await user.click(screen.getByRole("button", { name: "返回解锁" }));
    expect(onRequireUnlock).toHaveBeenCalledOnce();
  });
});
