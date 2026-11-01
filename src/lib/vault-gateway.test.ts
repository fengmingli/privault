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

  it("passes an optional creation destination to the real command", async () => {
    const gateway = new TauriVaultGateway();
    await gateway.create("Master-pass1!", "/tmp/custom");
    expect(invokeMock).toHaveBeenCalledWith("vault_create", {
      masterPassword: "Master-pass1!",
      destination: "/tmp/custom",
    });
  });

  it("maps pvault pickers, export and import commands", async () => {
    const gateway = new TauriVaultGateway();
    await gateway.chooseExportPath();
    expect(invokeMock).toHaveBeenCalledWith("storage_choose_export_path", undefined);
    await gateway.chooseImportPath();
    expect(invokeMock).toHaveBeenCalledWith("storage_choose_import_path", undefined);
    await gateway.exportPvault("/fixed/export.pvault");
    expect(invokeMock).toHaveBeenCalledWith("storage_export_pvault", { destination: "/fixed/export.pvault" });
    await gateway.importPvault("/fixed/source.pvault", "Master-pass1!");
    expect(invokeMock).toHaveBeenCalledWith("storage_import_pvault", {
      source: "/fixed/source.pvault",
      masterPassword: "Master-pass1!",
    });
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

  it("uses the changed demo master password for subsequent unlocks", async () => {
    const gateway = new DemoVaultGateway();
    await gateway.changeMasterPassword("demo", "New-demo1!");
    await gateway.lock();
    await expect(gateway.unlock("demo")).rejects.toThrow("演示密码不正确");
    await gateway.unlock("New-demo1!");
    expect((await gateway.status()).state).toBe("unlocked");
  });
});
