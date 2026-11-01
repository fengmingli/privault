import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App access flows", () => {
  it("shows the product identity and persistent prototype warning", () => {
    render(<App />);
    expect(screen.getByText("Privault")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "把重要信息，留在本机。" })).toBeInTheDocument();
    expect(screen.getByText("UI 原型，请勿输入真实密码")).toBeInTheDocument();
  });

  it("rejects a wrong demo password and unlocks with demo", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "解锁演示保险库" }));
    await user.type(screen.getByLabelText("演示密码"), "wrong");
    await user.click(screen.getByRole("button", { name: /^解锁$/ }));
    expect(screen.getByText("演示密码不正确")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("演示密码"));
    await user.type(screen.getByLabelText("演示密码"), "demo");
    await user.click(screen.getByRole("button", { name: /^解锁$/ }));
    expect(screen.getByRole("heading", { name: "演示保险库" })).toBeInTheDocument();
  });

  it("validates creation and requires offline recovery-key confirmation", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "创建演示保险库" }));
    await user.type(screen.getByLabelText("设置主密码（仅演示）"), "demo-password-1");
    await user.type(screen.getByLabelText("确认主密码"), "demo-password-2");
    await user.click(screen.getByRole("button", { name: "下一步" }));
    expect(screen.getByText("两次输入的密码不一致")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("确认主密码"));
    await user.type(screen.getByLabelText("确认主密码"), "demo-password-1");
    await user.click(screen.getByRole("button", { name: "下一步" }));
    expect(screen.getByText("DEMO-4C7Q-9M2X-6K8P")).toBeInTheDocument();
    const enter = screen.getByRole("button", { name: "进入演示保险库" });
    expect(enter).toBeDisabled();
    await user.click(screen.getByLabelText("我已离线保存此演示恢复密钥"));
    await user.click(enter);
    expect(screen.getByRole("heading", { name: "演示保险库" })).toBeInTheDocument();
  });

  it("returns to the unlock screen after manually locking an unlocked vault", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "解锁演示保险库" }));
    await user.type(screen.getByLabelText("演示密码"), "demo");
    await user.click(screen.getByRole("button", { name: /^解锁$/ }));
    await user.click(screen.getByRole("button", { name: "立即锁定" }));
    expect(screen.getByLabelText("演示密码")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "解锁演示保险库" })).not.toBeInTheDocument();
  });

  it("explains import without selecting or writing files", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "导入已有保险库" }));
    expect(screen.getByText("本期不支持导入或导出保险库文件，不会选择或写入任何文件。")).toBeInTheDocument();
  });

  it("validates demo recovery access without claiming a real reset", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "解锁演示保险库" }));
    await user.click(screen.getByRole("button", { name: "使用恢复密钥" }));
    await user.type(screen.getByLabelText("演示恢复密钥"), "invalid");
    await user.type(screen.getByLabelText("新主密码（仅演示）"), "demo-password-1");
    await user.type(screen.getByLabelText("确认新主密码"), "demo-password-1");
    await user.click(screen.getByRole("button", { name: "验证演示恢复信息" }));
    expect(screen.getByText("恢复密钥格式不正确")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("演示恢复密钥"));
    await user.type(screen.getByLabelText("演示恢复密钥"), "DEMO-4C7Q-9M2X-6K8P");
    await user.click(screen.getByRole("button", { name: "验证演示恢复信息" }));
    await user.click(screen.getByLabelText("我已离线保存新恢复密钥"));
    await user.click(screen.getByRole("button", { name: "返回解锁" }));
    expect(screen.getByText("界面验证已通过，未修改任何真实保险库。")).toBeInTheDocument();
    expect(screen.getByLabelText("演示密码")).toBeInTheDocument();
  });
});
