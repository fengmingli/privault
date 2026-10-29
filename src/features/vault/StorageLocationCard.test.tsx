import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { StorageLocation, VaultGateway } from "@/lib/vault-client";
import { StorageLocationCard } from "./StorageLocationCard";

const currentLocation: StorageLocation = { path: "/fixed/current", isDefault: false, volumeKind: "fixed" };
const nextLocation: StorageLocation = { path: "/fixed/next", isDefault: false, volumeKind: "fixed" };

function createGateway(overrides: Partial<VaultGateway> = {}): VaultGateway {
  return {
    isDemo: false,
    create: vi.fn(),
    unlock: vi.fn(),
    lock: vi.fn(),
    status: vi.fn(),
    listEntries: vi.fn(),
    getEntry: vi.fn(),
    upsertEntry: vi.fn(),
    deleteEntry: vi.fn(),
    restoreEntry: vi.fn(),
    changeMasterPassword: vi.fn(),
    recoverAccess: vi.fn(),
    getLocation: vi.fn().mockResolvedValue(currentLocation),
    chooseLocation: vi.fn(),
    prepareMigration: vi.fn(),
    confirmMigration: vi.fn(),
    cancelMigration: vi.fn(),
    ...overrides,
  } as VaultGateway;
}

function setup(overrides: Partial<VaultGateway> = {}) {
  const user = userEvent.setup();
  const gateway = createGateway(overrides);
  const onMigrationActiveChange = vi.fn();
  const onRequireUnlock = vi.fn();
  render(<StorageLocationCard gateway={gateway} onMigrationActiveChange={onMigrationActiveChange} onRequireUnlock={onRequireUnlock} />);
  return { user, gateway, onMigrationActiveChange, onRequireUnlock };
}

describe("StorageLocationCard", () => {
  it("shows the normalized real path and fixed-volume storage label", async () => {
    setup();
    expect(await screen.findByText(currentLocation.path)).toBeInTheDocument();
    expect(screen.getByText("本机固定磁盘 · 加密存储")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更改存储目录" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "恢复默认目录" })).toBeEnabled();
  });

  it("explains the browser demo without displaying a fake encrypted path", () => {
    const { gateway } = setup({ isDemo: true });
    expect(screen.getByText("浏览器 Demo 使用内存数据，不显示或修改真实存储路径。")).toBeInTheDocument();
    expect(screen.queryByText("本机固定磁盘 · 加密存储")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "更改存储目录" })).not.toBeInTheDocument();
    expect(gateway.getLocation).not.toHaveBeenCalled();
  });

  it("does nothing when the native directory picker is cancelled", async () => {
    const { user, gateway, onMigrationActiveChange } = setup({ chooseLocation: vi.fn().mockResolvedValue(null) });
    await user.click(await screen.findByRole("button", { name: "更改存储目录" }));
    await waitFor(() => expect(gateway.chooseLocation).toHaveBeenCalledOnce());
    expect(gateway.prepareMigration).not.toHaveBeenCalled();
    expect(onMigrationActiveChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "迁移存储目录" })).not.toBeInTheDocument();
  });

  it("prepares a fixed-disk destination and awaits the master password", async () => {
    const { user, gateway, onMigrationActiveChange } = setup({
      chooseLocation: vi.fn().mockResolvedValue(nextLocation.path),
      prepareMigration: vi.fn().mockResolvedValue({ migrationId: "migration-1" }),
    });
    await user.click(await screen.findByRole("button", { name: "更改存储目录" }));
    const dialog = await screen.findByRole("dialog", { name: "迁移存储目录" });
    expect(gateway.prepareMigration).toHaveBeenCalledWith(nextLocation.path);
    expect(onMigrationActiveChange).toHaveBeenCalledWith(true);
    expect(within(dialog).getByText("备份与复制已完成")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("主密码")).toBeInTheDocument();
  });

  it("keeps the original location after a wrong password and requires unlock", async () => {
    const { user, onRequireUnlock } = setup({
      chooseLocation: vi.fn().mockResolvedValue(nextLocation.path),
      prepareMigration: vi.fn().mockResolvedValue({ migrationId: "migration-1" }),
      confirmMigration: vi.fn().mockRejectedValue(new Error("主密码不正确")),
    });
    await user.click(await screen.findByRole("button", { name: "更改存储目录" }));
    const dialog = await screen.findByRole("dialog", { name: "迁移存储目录" });
    await user.type(within(dialog).getByLabelText("主密码"), "wrong-password");
    await user.click(within(dialog).getByRole("button", { name: "验证并迁移" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("主密码不正确");
    expect(within(dialog).getByText("存储目录未更改")).toBeInTheDocument();
    expect(within(dialog).getByText(currentLocation.path)).toBeInTheDocument();
    expect(onRequireUnlock).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "返回解锁" }));
    expect(onRequireUnlock).toHaveBeenCalledOnce();
  });

  it("shows the verified new location and returns to unlock after success", async () => {
    const { user, onRequireUnlock } = setup({
      chooseLocation: vi.fn().mockResolvedValue(nextLocation.path),
      prepareMigration: vi.fn().mockResolvedValue({ migrationId: "migration-1" }),
      confirmMigration: vi.fn().mockResolvedValue(nextLocation),
    });
    await user.click(await screen.findByRole("button", { name: "更改存储目录" }));
    const dialog = await screen.findByRole("dialog", { name: "迁移存储目录" });
    await user.type(within(dialog).getByLabelText("主密码"), "correct-password");
    await user.click(within(dialog).getByRole("button", { name: "验证并迁移" }));
    expect(await within(dialog).findByText("存储位置已更新，请重新解锁")).toBeInTheDocument();
    expect(within(dialog).getByText(nextLocation.path)).toBeInTheDocument();
    expect(within(dialog).getByText("原库和加密备份均已保留")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "返回解锁" }));
    expect(onRequireUnlock).toHaveBeenCalledOnce();
  });

  it("uses the same migration flow with a Rust-resolved default destination", async () => {
    const { user, gateway } = setup({ prepareMigration: vi.fn().mockResolvedValue({ migrationId: "migration-default" }) });
    await user.click(await screen.findByRole("button", { name: "恢复默认目录" }));
    expect(await screen.findByRole("dialog", { name: "迁移存储目录" })).toBeInTheDocument();
    expect(gateway.prepareMigration).toHaveBeenCalledWith(null);
    expect(gateway.chooseLocation).not.toHaveBeenCalled();
  });

  it("cancels a prepared migration before returning to unlock", async () => {
    const { user, gateway, onRequireUnlock } = setup({
      chooseLocation: vi.fn().mockResolvedValue(nextLocation.path),
      prepareMigration: vi.fn().mockResolvedValue({ migrationId: "migration-1" }),
      cancelMigration: vi.fn().mockResolvedValue(undefined),
    });
    await user.click(await screen.findByRole("button", { name: "更改存储目录" }));
    const dialog = await screen.findByRole("dialog", { name: "迁移存储目录" });
    await user.click(within(dialog).getByRole("button", { name: "取消迁移" }));
    await waitFor(() => expect(gateway.cancelMigration).toHaveBeenCalledWith("migration-1"));
    expect(onRequireUnlock).toHaveBeenCalledOnce();
  });
});
