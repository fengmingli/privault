import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EntryEditorDialog } from "./EntryEditorDialog";

describe("EntryEditorDialog", () => {
  it("blocks an empty title and saves a valid new login", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<EntryEditorDialog open entry={null} kind="login" onSave={onSave} onClose={onClose} onDirtyChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "保存项目" }));
    expect(screen.getByText("请输入标题")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("标题"), "新演示登录");
    await user.type(screen.getByLabelText("用户名"), "new@example.com");
    await user.type(screen.getByLabelText("密码"), "demo-password");
    await user.click(screen.getByRole("button", { name: "保存项目" }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0][0]).toMatchObject({ kind: "login", title: "新演示登录", username: "new@example.com" });
  });
});
