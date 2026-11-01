import { invoke } from "@tauri-apps/api/core";
import type { EntrySummary, VaultEntry } from "@/types/vault";

export type { EntrySummary } from "@/types/vault";

export class VaultCommandError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "VaultCommandError";
    this.code = code;
  }
}

export function normalizeVaultError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  if (typeof reason === "object" && reason !== null && "message" in reason && typeof reason.message === "string") {
    const code = "code" in reason && typeof reason.code === "string" ? reason.code : "UnknownError";
    return new VaultCommandError(code, reason.message);
  }
  return new VaultCommandError("UnknownError", "操作失败");
}

async function invokeVault<T>(command: string, args?: Parameters<typeof invoke>[1]): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (reason) {
    throw normalizeVaultError(reason);
  }
}

export interface StorageLocation {
  path: string;
  isDefault: boolean;
  volumeKind: string;
}

export interface VaultStatus {
  state: "empty" | "locked" | "unlocked" | "error";
  location: StorageLocation;
}

export interface RecoveryKeyResult {
  recoveryKey: string;
}

export interface MigrationResult {
  migrationId: string;
}

export interface VaultGateway {
  readonly isDemo: boolean;
  create(masterPassword: string, destination?: string | null): Promise<RecoveryKeyResult>;
  unlock(password: string): Promise<VaultStatus>;
  lock(): Promise<void>;
  status(): Promise<VaultStatus>;
  listEntries(): Promise<EntrySummary[]>;
  getEntry(id: string): Promise<VaultEntry>;
  upsertEntry(entry: VaultEntry): Promise<VaultEntry>;
  deleteEntry(id: string): Promise<void>;
  restoreEntry(id: string): Promise<void>;
  changeMasterPassword(currentPassword: string, newPassword: string): Promise<void>;
  recoverAccess(recoveryKey: string, newMasterPassword: string): Promise<RecoveryKeyResult>;
  chooseExportPath(): Promise<string | null>;
  chooseImportPath(): Promise<string | null>;
  exportPvault(destination: string): Promise<{ path: string }>;
  importPvault(source: string, masterPassword: string): Promise<StorageLocation>;
  getLocation(): Promise<StorageLocation>;
  chooseLocation(): Promise<string | null>;
  prepareMigration(destination: string | null): Promise<MigrationResult>;
  confirmMigration(migrationId: string, masterPassword: string): Promise<StorageLocation>;
  cancelMigration(migrationId: string): Promise<void>;
}

export class TauriVaultGateway implements VaultGateway {
  readonly isDemo = false;
  create(masterPassword: string, destination?: string | null) {
    return invokeVault<RecoveryKeyResult>("vault_create", { masterPassword, destination: destination ?? null });
  }
  unlock(password: string) { return invokeVault<VaultStatus>("vault_unlock", { password }); }
  lock() { return invokeVault<void>("vault_lock"); }
  status() { return invokeVault<VaultStatus>("vault_status"); }
  listEntries() { return invokeVault<EntrySummary[]>("vault_list_entries"); }
  getEntry(id: string) { return invokeVault<VaultEntry>("vault_get_entry", { id }); }
  upsertEntry(entry: VaultEntry) { return invokeVault<VaultEntry>("vault_upsert_entry", { entry }); }
  deleteEntry(id: string) { return invokeVault<void>("vault_delete_entry", { id }); }
  restoreEntry(id: string) { return invokeVault<void>("vault_restore_entry", { id }); }
  changeMasterPassword(currentPassword: string, newPassword: string) {
    return invokeVault<void>("vault_change_master_password", { currentPassword, newPassword });
  }
  recoverAccess(recoveryKey: string, newMasterPassword: string) {
    return invokeVault<RecoveryKeyResult>("vault_recover_access", { recoveryKey, newMasterPassword });
  }
  chooseExportPath() { return invokeVault<string | null>("storage_choose_export_path"); }
  chooseImportPath() { return invokeVault<string | null>("storage_choose_import_path"); }
  exportPvault(destination: string) { return invokeVault<{ path: string }>("storage_export_pvault", { destination }); }
  importPvault(source: string, masterPassword: string) {
    return invokeVault<StorageLocation>("storage_import_pvault", { source, masterPassword });
  }
  getLocation() { return invokeVault<StorageLocation>("storage_get_location"); }
  chooseLocation() { return invokeVault<string | null>("storage_choose_location"); }
  prepareMigration(destination: string | null) { return invokeVault<MigrationResult>("storage_prepare_migration", { destination }); }
  confirmMigration(migrationId: string, masterPassword: string) {
    return invokeVault<StorageLocation>("storage_confirm_migration", { migrationId, masterPassword });
  }
  cancelMigration(migrationId: string) { return invokeVault<void>("storage_cancel_migration", { migrationId }); }
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
