import { useState, type FormEvent } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PasswordInput } from "@/components/ui/password-input";
import type { VaultGateway } from "@/lib/vault-client";

interface PvaultDialogProps {
  open: boolean;
  mode: "import" | "export";
  gateway: VaultGateway;
  onClose: () => void;
  onRequireUnlock: () => void;
  onBusyChange: (busy: boolean) => void;
}

export function PvaultDialog({ open, mode, gateway, onClose, onRequireUnlock, onBusyChange }: PvaultDialogProps) {
  const [phase, setPhase] = useState<"idle" | "confirm" | "busy" | "success" | "error">("idle");
  const [source, setSource] = useState("");
  const [exportedPath, setExportedPath] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const busy = phase === "busy";

  function begin() {
    setPhase("busy");
    setError("");
    onBusyChange(true);
  }

  function finish() {
    onBusyChange(false);
  }

  function fail(reason: unknown) {
    setError(reason instanceof Error ? reason.message : "操作失败");
    setPhase("error");
  }

  async function exportArchive() {
    begin();
    try {
      const destination = await gateway.chooseExportPath();
      if (destination === null) {
        setPhase("idle");
        return;
      }
      const result = await gateway.exportPvault(destination);
      setExportedPath(result.path);
      setPhase("success");
    } catch (reason) {
      fail(reason);
    } finally {
      finish();
    }
  }

  async function chooseImport() {
    begin();
    try {
      const selected = await gateway.chooseImportPath();
      if (selected === null) {
        setPhase("idle");
        return;
      }
      setSource(selected);
      setPhase("confirm");
    } catch (reason) {
      fail(reason);
    } finally {
      finish();
    }
  }

  async function confirmImport(event: FormEvent) {
    event.preventDefault();
    const submittedPassword = password;
    setPassword("");
    begin();
    try {
      await gateway.importPvault(source, submittedPassword);
      setPhase("success");
    } catch (reason) {
      fail(reason);
    } finally {
      finish();
    }
  }

  if (gateway.isDemo) {
    return (
      <Dialog open={open} title={mode === "import" ? "导入保险库" : "导出保险库"} onClose={onClose} className="max-w-md">
        <p className="text-sm leading-6 text-foreground-muted">浏览器 Demo 不支持真实 .pvault 导入导出，不会选择、读取或写入文件。</p>
        <Button type="button" className="mt-6 w-full" onClick={onClose}>我知道了</Button>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} title={mode === "import" ? "导入保险库" : "导出保险库"} onClose={onClose} closeDisabled={busy} className="max-w-lg">
      {phase === "idle" && (
        <div className="space-y-5">
          <p className="text-sm leading-6 text-foreground-muted">{mode === "import" ? "选择要导入当前位置的 .pvault 加密文件，验证原主密码后才会写入。" : "将整个加密保险库导出为单个 .pvault 文件，不包含明文条目或凭据。"}</p>
          <Button type="button" className="w-full" onClick={() => void (mode === "import" ? chooseImport() : exportArchive())}>
            {mode === "import" ? <Upload className="mr-2 h-4 w-4" aria-hidden="true" /> : <Download className="mr-2 h-4 w-4" aria-hidden="true" />}
            {mode === "import" ? "导入保险库" : "导出保险库"}
          </Button>
        </div>
      )}
      {phase === "busy" && <p role="status" className="text-sm text-foreground-muted">正在处理加密文件…</p>}
      {phase === "confirm" && (
        <form onSubmit={confirmImport} className="space-y-4">
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm leading-6">
            <p className="font-medium">导入到当前保险库位置</p>
            <p className="mt-1 text-xs leading-5 text-foreground-muted">如果当前位置已有保险库，验证成功后会先自动备份再替换。导入后请使用原保险库主密码解锁。</p>
            <code className="mono mt-2 block break-all text-xs">{source}</code>
          </div>
          <div className="space-y-2">
            <label htmlFor="pvault-master-password" className="text-sm font-medium">原保险库主密码</label>
            <PasswordInput id="pvault-master-password" value={password} onChange={(event) => setPassword(event.target.value)} visibilityLabel="原保险库主密码" autoFocus disabled={busy} />
          </div>
          <Button type="submit" className="w-full" disabled={!password || busy}>确认导入</Button>
        </form>
      )}
      {phase === "error" && <p role="alert" className="text-sm text-danger">{error}</p>}
      {phase === "success" && (
        <div className="space-y-4">
          <p role="status" className="rounded-lg bg-accent p-3 text-sm text-accent-foreground">{mode === "import" ? "导入完成" : "加密保险库已导出"}</p>
          {exportedPath && <code className="mono block break-all text-xs">{exportedPath}</code>}
          <p className="text-xs leading-5 text-foreground-muted">请重新解锁保险库。</p>
          <Button type="button" className="w-full" onClick={onRequireUnlock}>返回解锁</Button>
        </div>
      )}
    </Dialog>
  );
}
