import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DemoVaultGateway } from "./demo-gateway";
import { normalizeVaultError, TauriVaultGateway, VaultCommandError } from "./vault-client";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const invokeMock = vi.mocked(invoke);

describe("VaultGateway", () => {
  beforeEach(() => invokeMock.mockReset());

  it("maps typed methods to exact Tauri command names and arguments", async () => {
    const gateway = new TauriVaultGateway();
    await gateway.unlock("secret-password");
    expect(invokeMock).toHaveBeenCalledWith("vault_unlock", { password: "secret-password" });
    await gateway.prepareMigration("/tmp/destination");
    expect(invokeMock).toHaveBeenCalledWith("storage_prepare_migration", { destination: "/tmp/destination" });
    await gateway.confirmMigration("migration-id", "secret-password");
    expect(invokeMock).toHaveBeenCalledWith("storage_confirm_migration", { migrationId: "migration-id", masterPassword: "secret-password" });
  });

  it("preserves structured Tauri error codes and safe messages", () => {
    const error = normalizeVaultError({ code: "InvalidCredentials", message: "主密码不正确" });
    expect(error).toBeInstanceOf(VaultCommandError);
    expect(error).toMatchObject({ code: "InvalidCredentials", message: "主密码不正确" });
  });

  it("keeps browser demo operations away from Tauri", async () => {
    const gateway = new DemoVaultGateway();
    await gateway.unlock("demo");
    expect((await gateway.listEntries()).length).toBe(4);
    const created = await gateway.create("demo-password-1");
    expect(created.recoveryKey).toBe("DEMO-4C7Q-9M2X-6K8P");
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("supports demo edit, delete, restore, and lock without persistence", async () => {
    const gateway = new DemoVaultGateway();
    const entries = await gateway.listEntries();
    const first = await gateway.getEntry(entries[0].id);
    first.title = "更新演示条目";
    await gateway.upsertEntry(first);
    expect((await gateway.getEntry(first.id)).title).toBe("更新演示条目");
    await gateway.deleteEntry(first.id);
    expect((await gateway.listEntries()).some((entry) => entry.id === first.id)).toBe(false);
    await gateway.restoreEntry(first.id);
    expect((await gateway.listEntries()).some((entry) => entry.id === first.id)).toBe(true);
    await gateway.lock();
    await expect(gateway.listEntries()).rejects.toThrow();
  });
});
