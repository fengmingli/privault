import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { VaultGateway } from "@/lib/vault-client";
import { AccessFlow } from "./AccessFlow";

type Screen = NonNullable<Parameters<typeof AccessFlow>[0]["initialScreen"]>;

function setup(initialScreen: Screen, overrides: Partial<VaultGateway> = {}) {
  const gateway = { isDemo: true, ...overrides } as VaultGateway;
  render(<AccessFlow gateway={gateway} onUnlocked={vi.fn()} initialScreen={initialScreen} />);
  return { gateway };
}

describe("AccessFlow layout", () => {
  it.each([
    ["welcome", "split"],
    ["create", "split"],
    ["unlock", "focused"],
    ["recover", "focused"],
  ] as const)("maps %s to %s layout", (initialScreen, layout) => {
    setup(initialScreen);
    expect(screen.getByRole("main")).toHaveAttribute("data-layout", layout);
  });

  it("removes repeated branding and promotional tags", () => {
    setup("welcome");
    expect(screen.queryByText("PRIVAULT")).not.toBeInTheDocument();
    expect(screen.queryByText("完全离线设计")).not.toBeInTheDocument();
    expect(screen.queryByText("Mac · Windows")).not.toBeInTheDocument();
    expect(screen.queryByText("本地数据")).not.toBeInTheDocument();
    expect(screen.getByText("把重要信息，留在本机。")).toBeInTheDocument();
  });

  it("keeps focused access free of the marketing panel", () => {
    setup("unlock");
    expect(screen.getByText("Privault")).toBeInTheDocument();
    expect(screen.queryByText("把重要信息，留在本机。")).not.toBeInTheDocument();
    expect(screen.getByLabelText("演示密码")).toBeInTheDocument();
  });

  it("imports a real pvault from welcome and returns to unlock", async () => {
    const user = userEvent.setup();
    const { gateway } = setup("welcome", {
      isDemo: false,
      chooseImportPath: vi.fn().mockResolvedValue("/fixed/source.pvault"),
      importPvault: vi.fn().mockResolvedValue({ path: "/fixed/current", isDefault: true, volumeKind: "fixed" }),
    });
    await user.click(screen.getByRole("button", { name: "导入已有保险库" }));
    expect(screen.queryByText("本期不支持导入或导出保险库文件，不会选择或写入任何文件。")).not.toBeInTheDocument();
    const dialog = screen.getByRole("dialog", { name: "导入保险库" });
    await user.click(within(dialog).getByRole("button", { name: "导入保险库" }));
    await user.type(screen.getByLabelText("原保险库主密码"), "Master-pass1!");
    await user.click(screen.getByRole("button", { name: "确认导入" }));
    expect(await screen.findByText("导入完成")).toBeInTheDocument();
    expect(gateway.importPvault).toHaveBeenCalledWith("/fixed/source.pvault", "Master-pass1!");
    await user.click(screen.getByRole("button", { name: "返回解锁" }));
    expect(await screen.findByLabelText("主密码")).toBeInTheDocument();
  });

  it("does not perform real file operations from the demo welcome screen", async () => {
    const user = userEvent.setup();
    const { gateway } = setup("welcome", { chooseImportPath: vi.fn(), importPvault: vi.fn() });
    await user.click(screen.getByRole("button", { name: "导入已有保险库" }));
    expect(screen.getByText("浏览器 Demo 不支持真实 .pvault 导入导出，不会选择、读取或写入文件。")).toBeInTheDocument();
    expect(gateway.chooseImportPath).not.toHaveBeenCalled();
    expect(gateway.importPvault).not.toHaveBeenCalled();
  });
});
