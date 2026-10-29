import { createDemoEntries } from "@/data/demo";
import { filterAndSortEntries, toEntrySummary } from "@/lib/entry-utils";
import { isValidDemoRecoveryKey } from "@/lib/validation";
import type { EntrySummary, MigrationResult, RecoveryKeyResult, StorageLocation, VaultGateway, VaultStatus } from "@/lib/vault-client";
import type { VaultEntry } from "@/types/vault";

export class DemoVaultGateway implements VaultGateway {
  readonly isDemo = true;
  private entries: VaultEntry[];
  private deleted: { entry: VaultEntry; index: number } | null = null;
  private unlocked = true;
  private masterPassword = "demo";

  constructor(entries: VaultEntry[] = createDemoEntries()) {
    this.entries = structuredClone(entries);
  }

  private location(): StorageLocation {
    return { path: "浏览器演示模式", isDefault: true, volumeKind: "demo" };
  }

  private requireUnlocked() {
    if (!this.unlocked) throw new Error("保险库已锁定");
  }

  private summaries(): EntrySummary[] {
    this.requireUnlocked();
    return filterAndSortEntries({ entries: this.entries.map(toEntrySummary), selectedId: null, category: "all", query: "", lastDeleted: null });
  }

  async create(masterPassword: string): Promise<RecoveryKeyResult> {
    this.masterPassword = masterPassword;
    this.unlocked = true;
    return { recoveryKey: "DEMO-4C7Q-9M2X-6K8P" };
  }

  async unlock(password: string): Promise<VaultStatus> {
    if (password !== this.masterPassword) throw new Error("演示密码不正确");
    this.unlocked = true;
    return this.status();
  }

  async lock(): Promise<void> {
    this.unlocked = false;
  }

  async status(): Promise<VaultStatus> {
    return { state: this.unlocked ? "unlocked" : "locked", location: this.location() };
  }

  async listEntries(): Promise<EntrySummary[]> {
    return this.summaries();
  }

  async getEntry(id: string): Promise<VaultEntry> {
    this.requireUnlocked();
    const entry = this.entries.find((item) => item.id === id);
    if (!entry) throw new Error("条目不存在");
    return structuredClone(entry);
  }

  async upsertEntry(entry: VaultEntry): Promise<VaultEntry> {
    this.requireUnlocked();
    const index = this.entries.findIndex((item) => item.id === entry.id);
    if (index >= 0) this.entries[index] = structuredClone(entry);
    else this.entries.push(structuredClone(entry));
    this.deleted = null;
    return structuredClone(entry);
  }

  async deleteEntry(id: string): Promise<void> {
    this.requireUnlocked();
    const index = this.entries.findIndex((entry) => entry.id === id);
    if (index < 0) throw new Error("条目不存在");
    this.deleted = { entry: this.entries[index], index };
    this.entries.splice(index, 1);
  }

  async restoreEntry(id: string): Promise<void> {
    this.requireUnlocked();
    if (!this.deleted || this.deleted.entry.id !== id) throw new Error("没有可撤销的条目");
    this.entries.splice(Math.min(this.deleted.index, this.entries.length), 0, this.deleted.entry);
    this.deleted = null;
  }

  async changeMasterPassword(currentPassword: string, newPassword: string): Promise<void> {
    if (currentPassword !== "demo") throw new Error("演示密码不正确");
    if (newPassword.length < 12) throw new Error("主密码至少需要 12 位");
  }

  async recoverAccess(recoveryKey: string, _newMasterPassword: string): Promise<RecoveryKeyResult> {
    if (!isValidDemoRecoveryKey(recoveryKey)) throw new Error("恢复密钥格式不正确");
    return { recoveryKey: "DEMO-4C7Q-9M2X-6K8P" };
  }

  async getLocation(): Promise<StorageLocation> {
    return this.location();
  }

  async chooseLocation(): Promise<string | null> {
    return null;
  }

  async prepareMigration(_destination: string): Promise<MigrationResult> {
    throw new Error("浏览器演示模式不支持真实路径迁移");
  }

  async confirmMigration(_migrationId: string, _masterPassword: string): Promise<StorageLocation> {
    throw new Error("浏览器演示模式不支持真实路径迁移");
  }

  async cancelMigration(_migrationId: string): Promise<void> {
    throw new Error("浏览器演示模式不支持真实路径迁移");
  }
}

export function createDemoGateway(entries?: VaultEntry[]): DemoVaultGateway {
  return new DemoVaultGateway(entries);
}
