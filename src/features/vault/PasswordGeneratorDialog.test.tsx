import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PasswordGeneratorDialog } from "./PasswordGeneratorDialog";

afterEach(() => vi.restoreAllMocks());

describe("PasswordGeneratorDialog", () => {
  it("regenerates when length changes and validates enabled groups", async () => {
    const user = userEvent.setup();
    render(<PasswordGeneratorDialog open onClose={vi.fn()} />);
    expect(screen.getByLabelText("生成的密码")).toHaveTextContent(/^.{20}$/);

    fireEvent.change(screen.getByLabelText("密码长度"), { target: { value: "32" } });
    expect(screen.getByLabelText("生成的密码")).toHaveTextContent(/^.{32}$/);

    for (const label of ["大写字母", "小写字母", "数字", "符号"]) await user.click(screen.getByLabelText(label));
    expect(screen.getByText("至少选择一种字符类型")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新生成" })).toBeDisabled();
  });

  it("creates a different deterministic value on regenerate", async () => {
    let value = 0;
    vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
      (array as Uint32Array)[0] = value++;
      return array;
    });
    const user = userEvent.setup();
    render(<PasswordGeneratorDialog open onClose={vi.fn()} />);
    const first = screen.getByLabelText("生成的密码").textContent;
    await user.click(screen.getByRole("button", { name: "重新生成" }));
    expect(screen.getByLabelText("生成的密码").textContent).not.toBe(first);
  });

  it("fills the visible password into the current editor", async () => {
    const user = userEvent.setup();
    const onUse = vi.fn();
    const onClose = vi.fn();
    render(<PasswordGeneratorDialog open onClose={onClose} onUse={onUse} />);
    const password = screen.getByLabelText("生成的密码").textContent;
    await user.click(screen.getByRole("button", { name: "填入密码" }));
    expect(onUse).toHaveBeenCalledWith(password);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
