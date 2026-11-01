import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { VaultGateway } from "@/lib/vault-client";
import { PvaultDialog } from "./PvaultDialog";

function createGateway(overrides: Partial<VaultGateway> = {}): VaultGateway {
  return {
    isDemo: false,
    chooseExportPath: vi.fn(),
    chooseImportPath: vi.fn(),
    exportPvault: vi.fn(),
    importPvault: vi.fn(),
    ...overrides,
  } as unknown as VaultGateway;
}

function setup(mode: "import" | "export", overrides: Partial<VaultGateway> = {}) {
  const user = userEvent.setup();
  const gateway = createGateway(overrides);
  const onClose = vi.fn();
  const onRequireUnlock = vi.fn();
  const onBusyChange = vi.fn();
  render(<PvaultDialog open mode={mode} gateway={gateway} onClose={onClose} onRequireUnlock={onRequireUnlock} onBusyChange={onBusyChange} />);
  return { user, gateway, onClose, onRequireUnlock, onBusyChange };
}

describe("PvaultDialog", () => {
  it("does not export when the native picker is cancelled", async () => {
    const { user, gateway, onRequireUnlock } = setup("export", { chooseExportPath: vi.fn().mockResolvedValue(null) });
    await user.click(screen.getByRole("button", { name: "导出保险库" }));
    await waitFor(() => expect(gateway.chooseExportPath).toHaveBeenCalledOnce());
    expect(gateway.exportPvault).not.toHaveBeenCalled();
    expect(onRequireUnlock).not.toHaveBeenCalled();
  });

  it("exports an encrypted archive and returns to unlock", async () => {
    const { user, onRequireUnlock } = setup("export", {
      chooseExportPath: vi.fn().mockResolvedValue("/fixed/export.pvault"),
      exportPvault: vi.fn().mockResolvedValue({ path: "/fixed/export.pvault" }),
    });
    await user.click(screen.getByRole("button", { name: "导出保险库" }));
    expect(await screen.findByText("加密保险库已导出")).toBeInTheDocument();
    expect(screen.getByText("/fixed/export.pvault")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "返回解锁" }));
    expect(onRequireUnlock).toHaveBeenCalledOnce();
  });

  it("requires replacement confirmation and source password before import", async () => {
    const { user, onRequireUnlock } = setup("import", {
      chooseImportPath: vi.fn().mockResolvedValue("/fixed/source.pvault"),
      importPvault: vi.fn().mockRejectedValue(new Error("主密码不正确")),
    });
    await user.click(screen.getByRole("button", { name: "导入保险库" }));
    expect(screen.getByText("导入到当前保险库位置")).toBeInTheDocument();
    await user.type(screen.getByLabelText("原保险库主密码"), "Wrong-master1!");
    await user.click(screen.getByRole("button", { name: "确认导入" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("主密码不正确");
    expect(onRequireUnlock).not.toHaveBeenCalled();
  });

  it("imports after verification and returns to unlock", async () => {
    const { user, gateway, onRequireUnlock } = setup("import", {
      chooseImportPath: vi.fn().mockResolvedValue("/fixed/source.pvault"),
      importPvault: vi.fn().mockResolvedValue({ path: "/fixed/current", isDefault: true, volumeKind: "fixed" }),
    });
    await user.click(screen.getByRole("button", { name: "导入保险库" }));
    await user.type(screen.getByLabelText("原保险库主密码"), "Master-pass1!");
    await user.click(screen.getByRole("button", { name: "确认导入" }));
    expect(await screen.findByText("导入完成")).toBeInTheDocument();
    expect(screen.queryByText("导入完成，原保险库已备份")).not.toBeInTheDocument();
    expect(gateway.importPvault).toHaveBeenCalledWith("/fixed/source.pvault", "Master-pass1!");
    await user.click(screen.getByRole("button", { name: "返回解锁" }));
    expect(onRequireUnlock).toHaveBeenCalledOnce();
  });

  it("does not perform real archive operations in demo mode", () => {
    const { gateway } = setup("import", { isDemo: true });
    expect(screen.getByText("浏览器 Demo 不支持真实 .pvault 导入导出，不会选择、读取或写入文件。")).toBeInTheDocument();
    expect(gateway.chooseImportPath).not.toHaveBeenCalled();
    expect(gateway.importPvault).not.toHaveBeenCalled();
  });
});
