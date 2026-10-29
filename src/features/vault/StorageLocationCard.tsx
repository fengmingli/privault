import { useEffect, useState } from "react";
import { FolderCog, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StorageLocation, VaultGateway } from "@/lib/vault-client";
import { MigrationDialog, type MigrationPhase } from "./MigrationDialog";

interface StorageLocationCardProps {
  gateway: VaultGateway;
  onMigrationActiveChange: (active: boolean) => void;
  onRequireUnlock: () => void;
}

interface MigrationState {
  phase: MigrationPhase;
  destination: string | null;
  migrationId?: string;
  newLocation?: StorageLocation;
  error?: string;
  cancelBusy: boolean;
}

function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}

export function StorageLocationCard({ gateway, onMigrationActiveChange, onRequireUnlock }: StorageLocationCardProps) {
  const [location, setLocation] = useState<StorageLocation | null>(null);
  const [loadError, setLoadError] = useState("");
  const [pickerBusy, setPickerBusy] = useState(false);
  const [migration, setMigration] = useState<MigrationState | null>(null);

  useEffect(() => {
    if (gateway.isDemo) return;
    let active = true;
    void gateway.getLocation()
      .then((current) => { if (active) setLocation(current); })
      .catch((reason: unknown) => { if (active) setLoadError(errorMessage(reason, "无法读取存储目录")); });
    return () => { active = false; };
  }, [gateway]);

  async function startMigration(destination: string | null) {
    if (migration) return;
    onMigrationActiveChange(true);
    setMigration({ phase: "preparing", destination, cancelBusy: false });
    try {
      const result = await gateway.prepareMigration(destination);
      setMigration({ phase: "awaiting-password", destination, migrationId: result.migrationId, cancelBusy: false });
    } catch (reason) {
      setMigration({ phase: "error", destination, error: errorMessage(reason, "无法准备存储迁移"), cancelBusy: false });
    }
  }

  async function chooseDestination() {
    if (pickerBusy || migration) return;
    setPickerBusy(true);
    setLoadError("");
    try {
      const destination = await gateway.chooseLocation();
      if (destination !== null) await startMigration(destination);
    } catch (reason) {
      setLoadError(errorMessage(reason, "无法选择存储目录"));
    } finally {
      setPickerBusy(false);
    }
  }

  async function confirmMigration(password: string) {
    if (!migration?.migrationId || migration.phase !== "awaiting-password") return;
    const { migrationId, destination } = migration;
    setMigration({ phase: "confirming", destination, migrationId, cancelBusy: false });
    try {
      const newLocation = await gateway.confirmMigration(migrationId, password);
      setLocation(newLocation);
      setMigration({ phase: "success", destination, newLocation, cancelBusy: false });
    } catch (reason) {
      setMigration({ phase: "error", destination, error: errorMessage(reason, "目标保险库验证失败"), cancelBusy: false });
    }
  }

  function finishMigration() {
    setMigration(null);
    onMigrationActiveChange(false);
    onRequireUnlock();
  }

  async function cancelMigration() {
    if (!migration?.migrationId || migration.cancelBusy) return;
    const { migrationId, destination } = migration;
    setMigration({ ...migration, cancelBusy: true });
    try {
      await gateway.cancelMigration(migrationId);
      finishMigration();
    } catch (reason) {
      setMigration({ phase: "error", destination, error: errorMessage(reason, "无法取消迁移"), cancelBusy: false });
    }
  }

  if (gateway.isDemo) {
    return <p className="text-xs leading-5 text-foreground-muted">浏览器 Demo 使用内存数据，不显示或修改真实存储路径。</p>;
  }

  return (
    <>
      <div className="space-y-3">
        {location ? (
          <div className="rounded-lg border bg-background p-3">
            <code className="mono block break-all text-xs">{location.path}</code>
            <p className="mt-2 text-xs text-foreground-muted">本机固定磁盘 · 加密存储</p>
          </div>
        ) : !loadError && <p role="status" className="text-xs text-foreground-muted">正在读取存储目录…</p>}
        {loadError && <p role="alert" className="text-xs leading-5 text-danger">{loadError}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" disabled={!location || pickerBusy || migration !== null} onClick={() => void chooseDestination()}><FolderCog className="mr-2 h-4 w-4" aria-hidden="true" />{pickerBusy ? "正在选择…" : "更改存储目录"}</Button>
          <Button type="button" variant="outline" disabled={!location || location.isDefault || pickerBusy || migration !== null} onClick={() => void startMigration(null)}><RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />恢复默认目录</Button>
        </div>
      </div>
      {migration && location && (
        <MigrationDialog
          phase={migration.phase}
          destination={migration.destination}
          currentLocation={location}
          newLocation={migration.newLocation}
          error={migration.error}
          cancelBusy={migration.cancelBusy}
          onConfirm={confirmMigration}
          onCancel={() => void cancelMigration()}
          onFinish={finishMigration}
        />
      )}
    </>
  );
}
