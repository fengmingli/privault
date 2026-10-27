import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copyText } from "@/lib/clipboard";
import type { VaultEntry } from "@/types/vault";
import { VaultWorkspace } from "./VaultWorkspace";

vi.mock("@/lib/clipboard", () => ({ copyText: vi.fn() }));
const copyMock = vi.mocked(copyText);

function setup(initialEntries?: VaultEntry[]) {
  const user = userEvent.setup();
  const onLock = vi.fn();
  render(<VaultWorkspace onLock={onLock} initialEntries={initialEntries} />);
  return { user, onLock };
}

describe("VaultWorkspace", () => {
  beforeEach(() => copyMock.mockReset());

  it("renders all demo entries and selects a row to show its details", async () => {
    const { user } = setup();
    const list = screen.getByRole("region", { name: "条目列表" });
    for (const title of ["示例 GitHub", "演示门禁笔记", "演示银行卡", "示例证件"]) {
      expect(within(list).getByText(title)).toBeInTheDocument();
    }

    await user.click(within(list).getByRole("button", { name: /演示银行卡/ }));
    const detail = screen.getByRole("region", { name: "条目详情" });
    expect(within(detail).getByRole("heading", { name: "演示银行卡" })).toBeInTheDocument();
    expect(within(detail).getByText("演示银行")).toBeInTheDocument();
  });

  it("filters by category and combines category with search", async () => {
    const { user } = setup();
    const list = screen.getByRole("region", { name: "条目列表" });
    await user.click(screen.getByRole("button", { name: /^登录信息/ }));
    expect(within(list).getByText("示例 GitHub")).toBeInTheDocument();
    expect(within(list).queryByText("演示门禁笔记")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("搜索项目"), "GITHUB");
    expect(within(list).getByText("示例 GitHub")).toBeInTheDocument();
    expect(screen.getByText("1 个项目")).toBeInTheDocument();
  });

  it("clears search and can reset both search and category", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText("搜索项目"), "not-found");
    expect(screen.getByText("没有匹配的项目")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "清除搜索" }));
    expect(screen.getByLabelText("搜索项目")).toHaveValue("");

    await user.click(screen.getByRole("button", { name: /^安全笔记/ }));
    await user.type(screen.getByLabelText("搜索项目"), "GitHub");
    await user.click(screen.getByRole("button", { name: "查看全部项目" }));
    expect(screen.getByLabelText("搜索项目")).toHaveValue("");
    expect(screen.getByRole("button", { name: /^全部项目/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("conceals and reveals the password and reports copy success", async () => {
    const { user } = setup();
    copyMock.mockResolvedValue(true);
    expect(screen.queryByText("Demo-Not-A-Real-Password")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "显示密码" }));
    expect(screen.getByText("Demo-Not-A-Real-Password")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "复制密码" }));
    expect(copyMock).toHaveBeenCalledWith("Demo-Not-A-Real-Password");
    expect(await screen.findByText("密码已复制")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "隐藏密码" }));
    expect(screen.queryByText("Demo-Not-A-Real-Password")).not.toBeInTheDocument();
  });

  it("reports clipboard failure without exposing the value", async () => {
    const { user } = setup();
    copyMock.mockResolvedValue(false);
    await user.click(screen.getByRole("button", { name: "复制密码" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("复制失败，请检查系统权限");
    expect(screen.queryByRole("alert", { name: /Demo-Not/ })).not.toBeInTheDocument();
  });

  it("locks and clears the current workspace", async () => {
    const { user, onLock } = setup();
    await user.click(screen.getByRole("button", { name: "立即锁定" }));
    expect(onLock).toHaveBeenCalledOnce();
  });

  it("distinguishes an empty vault from empty search results", async () => {
    const { user } = setup([]);
    expect(screen.getByText("保险库还是空的")).toBeInTheDocument();
    expect(screen.getByText("选择一个项目")).toBeInTheDocument();
    await user.type(screen.getByLabelText("搜索项目"), "anything");
    expect(screen.getByText("没有匹配的项目")).toBeInTheDocument();
  });

  it("creates a new login through the type picker and editor", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "新建" }));
    const picker = screen.getByRole("dialog", { name: "选择条目类型" });
    await user.click(within(picker).getByRole("button", { name: /登录信息/ }));
    await user.type(screen.getByLabelText("标题"), "新演示账号");
    await user.type(screen.getByLabelText("用户名"), "new@example.com");
    await user.type(screen.getByLabelText("密码"), "demo-password");
    await user.click(screen.getByRole("button", { name: "保存项目" }));
    expect(within(screen.getByRole("region", { name: "条目列表" })).getByText("新演示账号")).toBeInTheDocument();
  });

  it("edits the selected entry and toggles favorite", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "编辑" }));
    await user.clear(screen.getByLabelText("标题"));
    await user.type(screen.getByLabelText("标题"), "更新后的 GitHub 演示");
    await user.click(screen.getByRole("button", { name: "保存项目" }));
    expect(screen.getByRole("heading", { name: "更新后的 GitHub 演示" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "取消收藏" }));
    expect(screen.getByRole("button", { name: /^收藏$/ })).toBeInTheDocument();
  });

  it("keeps or discards a dirty editor after confirmation", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "编辑" }));
    await user.clear(screen.getByLabelText("标题"));
    await user.type(screen.getByLabelText("标题"), "未保存的演示修改");
    await user.click(screen.getByRole("button", { name: "关闭对话框" }));
    await user.click(screen.getByRole("button", { name: "继续编辑" }));
    expect(screen.getByLabelText("标题")).toHaveValue("未保存的演示修改");
    await user.click(screen.getByRole("button", { name: "关闭对话框" }));
    await user.click(screen.getByRole("button", { name: "放弃修改" }));
    expect(screen.queryByRole("dialog", { name: "编辑项目" })).not.toBeInTheDocument();
  });

  it("deletes and undoes deletion of an entry", async () => {
    const { user } = setup();
    const list = screen.getByRole("region", { name: "条目列表" });
    await user.click(screen.getByRole("button", { name: "删除" }));
    expect(screen.getByText(/将删除“示例 GitHub”/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "确认删除" }));
    expect(within(list).queryByText("示例 GitHub")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "撤销" }));
    expect(within(list).getByText("示例 GitHub")).toBeInTheDocument();
  });

  it("requires confirmation before locking with unsaved edits", async () => {
    const { user, onLock } = setup();
    await user.click(screen.getByRole("button", { name: "编辑" }));
    await user.clear(screen.getByLabelText("标题"));
    await user.type(screen.getByLabelText("标题"), "未保存修改");
    await user.click(screen.getByRole("button", { name: "立即锁定" }));
    await user.click(screen.getByRole("button", { name: "放弃并锁定" }));
    expect(onLock).toHaveBeenCalledOnce();
  });

  it("fills a generated password into the current editor", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "新建" }));
    const picker = screen.getByRole("dialog", { name: "选择条目类型" });
    await user.click(within(picker).getByRole("button", { name: /登录信息/ }));
    const editor = screen.getByRole("dialog", { name: "新建登录信息" });
    await user.click(within(editor).getByRole("button", { name: "密码生成器" }));
    const generator = screen.getByRole("dialog", { name: "密码生成器" });
    const generated = within(generator).getByLabelText("生成的密码").textContent;
    await user.click(within(generator).getByRole("button", { name: "填入密码" }));
    expect(screen.getByLabelText("密码")).toHaveValue(generated);
  });
});
