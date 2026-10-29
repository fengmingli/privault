import { useState, type FormEvent } from "react";
import { CheckCircle2, Copy, FolderCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { StorageLocation } from "@/lib/vault-client";

export type MigrationPhase = "preparing" | "awaiting-password" | "confirming" | "success" | "error";

interface MigrationDialogProps {
  phase: MigrationPhase;
  destination: string | null;
  currentLocation: StorageLocation;
  newLocation?: StorageLocation;
  error?: string;
  cancelBusy: boolean;
  onConfirm: (password: string) => Promise<void>;
  onCancel: () => void;
  onFinish: () => void;
}

export function MigrationDialog({ phase, destination, currentLocation, newLocation, error, cancelBusy, onConfirm, onCancel, onFinish }: MigrationDialogProps) {
  const [password, setPassword] = useState("");
  const busy = phase === "preparing" || phase === "confirming" || cancelBusy;
  const closeDisabled = phase === "preparing" || phase === "confirming" || cancelBusy;

  function submit(event: FormEvent) {
    event.preventDefault();
    const submittedPassword = password;
    setPassword("");
    void onConfirm(submittedPassword);
  }

  function cancel() {
    setPassword("");
    onCancel();
  }

  return (
    <Dialog open title="迁移存储目录" onClose={phase === "awaiting-password" ? cancel : onFinish} closeDisabled={closeDisabled} className="max-w-lg">
      <div className="space-y-5">
        <div className="rounded-lg bg-muted p-3 text-xs leading-5 text-foreground-muted">
          <p>目标：{destination ?? "Privault 默认目录"}</p>
          <p>只复制加密保险库文件，不覆盖目标同名文件。</p>
        </div>

        {phase === "preparing" && (
          <ol className="space-y-3 text-sm" aria-label="迁移准备进度">
            <li className="flex items-center gap-2"><Copy className="h-4 w-4 text-primary" aria-hidden="true" />正在创建加密备份并复制到临时文件…</li>
            <li className="text-foreground-muted">随后将验证目标保险库，再切换配置。</li>
          </ol>
        )}

        {(phase === "awaiting-password" || phase === "confirming") && (
          <>
            <div className="space-y-2 rounded-lg border p-3 text-sm">
              <p className="flex items-center gap-2 text-success"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />备份与复制已完成</p>
              <p className="text-foreground-muted">{phase === "confirming" ? "正在验证目标保险库并切换配置…" : "输入主密码以验证目标副本。验证成功前不会更改存储配置。"}</p>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="migration-master-password" className="text-sm font-medium">主密码</label>
                <input id="migration-master-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="control" autoComplete="off" autoFocus disabled={busy} />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="ghost" disabled={busy} onClick={cancel}>{cancelBusy ? "正在取消…" : "取消迁移"}</Button>
                <Button type="submit" disabled={!password || busy}>{phase === "confirming" ? "正在验证…" : "验证并迁移"}</Button>
              </div>
            </form>
          </>
        )}

        {phase === "error" && (
          <div className="space-y-4">
            <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm leading-6 text-danger">{error ?? "迁移失败"}</p>
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">存储目录未更改</p>
              <code className="mono mt-2 block break-all text-xs text-foreground-muted">{currentLocation.path}</code>
              <p className="mt-2 text-xs leading-5 text-foreground-muted">保险库已锁定。返回解锁后可再次尝试。</p>
            </div>
            <Button type="button" className="w-full" onClick={onFinish}>返回解锁</Button>
          </div>
        )}

        {phase === "success" && newLocation && (
          <div className="space-y-4">
            <p role="status" className="flex items-start gap-2 rounded-lg bg-accent p-3 text-sm leading-6 text-accent-foreground"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />存储位置已更新，请重新解锁</p>
            <div className="rounded-lg border p-3">
              <code className="mono block break-all text-xs">{newLocation.path}</code>
              <p className="mt-2 flex items-center gap-2 text-xs text-foreground-muted"><FolderCheck className="h-4 w-4" aria-hidden="true" />原库和加密备份均已保留</p>
            </div>
            <Button type="button" className="w-full" onClick={onFinish}>返回解锁</Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
