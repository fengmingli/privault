import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CreateVaultFlow } from "./CreateVaultFlow";

const defaultLocation = { path: "/fixed/default", isDefault: true, volumeKind: "fixed" };

function setup(overrides: Partial<Parameters<typeof CreateVaultFlow>[0]> = {}) {
  const props = {
    onBack: vi.fn(),
    onCreate: vi.fn().mockResolvedValue({ recoveryKey: "REAL-RECOVERY-KEY" }),
    onComplete: vi.fn().mockResolvedValue(undefined),
    onChooseLocation: vi.fn(),
    onGetLocation: vi.fn().mockResolvedValue(defaultLocation),
    demoMode: false,
    ...overrides,
  } satisfies Parameters<typeof CreateVaultFlow>[0];
  render(<CreateVaultFlow {...props} />);
  return props;
}

describe("CreateVaultFlow", () => {
  it("uses the recovery key returned by the real gateway and defaults to the standard directory", async () => {
    const user = userEvent.setup();
    const { onCreate, onComplete } = setup();
    expect(await screen.findByText(defaultLocation.path)).toBeInTheDocument();
    await user.type(screen.getByLabelText("设置主密码"), "real-password-1");
    await user.type(screen.getByLabelText("确认主密码"), "real-password-1");
    await user.click(screen.getByRole("button", { name: "下一步" }));
    expect(onCreate).toHaveBeenCalledWith("real-password-1", null);
    expect(screen.getByText("REAL-RECOVERY-KEY")).toBeInTheDocument();
    await user.click(screen.getByLabelText("我已离线保存恢复密钥"));
    await user.click(screen.getByRole("button", { name: "解锁保险库" }));
    expect(onComplete).toHaveBeenCalledWith("real-password-1");
  });

  it("toggles the two password fields independently", async () => {
    const user = userEvent.setup();
    setup();
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

  it("passes a selected fixed-disk folder to creation", async () => {
    const user = userEvent.setup();
    const { onCreate, onChooseLocation } = setup({ onChooseLocation: vi.fn().mockResolvedValue("/fixed/custom") });
    await user.click(await screen.findByRole("button", { name: "选择保存文件夹" }));
    expect(await screen.findByText("/fixed/custom")).toBeInTheDocument();
    await user.type(screen.getByLabelText("设置主密码"), "Abcdef1!");
    await user.type(screen.getByLabelText("确认主密码"), "Abcdef1!");
    await user.click(screen.getByRole("button", { name: "下一步" }));
    expect(onChooseLocation).toHaveBeenCalledOnce();
    expect(onCreate).toHaveBeenCalledWith("Abcdef1!", "/fixed/custom");
  });

  it("keeps the current directory when the native picker is cancelled", async () => {
    const user = userEvent.setup();
    const { onCreate, onChooseLocation } = setup({ onChooseLocation: vi.fn().mockResolvedValue(null) });
    await user.click(await screen.findByRole("button", { name: "选择保存文件夹" }));
    await waitFor(() => expect(onChooseLocation).toHaveBeenCalledOnce());
    expect(screen.getByText(defaultLocation.path)).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("restores the default directory before creation", async () => {
    const user = userEvent.setup();
    const { onCreate } = setup({ onChooseLocation: vi.fn().mockResolvedValue("/fixed/custom") });
    await user.click(await screen.findByRole("button", { name: "选择保存文件夹" }));
    await user.click(screen.getByRole("button", { name: "恢复默认目录" }));
    expect(screen.getByText(defaultLocation.path)).toBeInTheDocument();
    await user.type(screen.getByLabelText("设置主密码"), "Abcdef1!");
    await user.type(screen.getByLabelText("确认主密码"), "Abcdef1!");
    await user.click(screen.getByRole("button", { name: "下一步" }));
    expect(onCreate).toHaveBeenCalledWith("Abcdef1!", null);
  });

  it("keeps real location controls out of the browser demo", () => {
    const { onChooseLocation, onGetLocation } = setup({ demoMode: true });
    expect(screen.getByText("浏览器 Demo 使用内存数据，不选择真实保存目录。")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "选择保存文件夹" })).not.toBeInTheDocument();
    expect(onChooseLocation).not.toHaveBeenCalled();
    expect(onGetLocation).not.toHaveBeenCalled();
  });
});
