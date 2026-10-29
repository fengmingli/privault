import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { isValidDemoRecoveryKey, isValidRecoveryKey, validateMasterPassword } from "@/lib/validation";
import type { RecoveryKeyResult } from "@/lib/vault-client";

interface RecoverAccessScreenProps {
  onBack: () => void;
  onRecover: (recoveryKey: string, newMasterPassword: string) => Promise<RecoveryKeyResult>;
  onRecovered: () => void;
  demoMode: boolean;
}

export function RecoverAccessScreen({ onBack, onRecover, onRecovered, demoMode }: RecoverAccessScreenProps) {
  const [recoveryKey, setRecoveryKey] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [nextRecoveryKey, setNextRecoveryKey] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    const validRecoveryKey = demoMode ? isValidDemoRecoveryKey(recoveryKey) : isValidRecoveryKey(recoveryKey);
    if (!validRecoveryKey) nextErrors.recoveryKey = "恢复密钥格式不正确";
    const passwordError = validateMasterPassword(password, confirmation);
    if (passwordError) nextErrors.password = passwordError;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setBusy(true);
    try {
      const result = await onRecover(recoveryKey, password);
      setNextRecoveryKey(result.recoveryKey);
    } catch (reason) {
      setErrors({ recoveryKey: reason instanceof Error ? reason.message : "恢复访问失败" });
    } finally {
      setBusy(false);
    }
  }

  if (nextRecoveryKey) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">保存新的恢复密钥</h2>
          <p className="text-sm leading-6 text-foreground-muted">旧恢复密钥已失效。新密钥只显示一次，请离线保存。</p>
        </div>
        <div className="rounded-lg border bg-background p-5 text-center"><code className="mono break-all text-sm font-semibold tracking-wider">{nextRecoveryKey}</code></div>
        <label className="flex items-start gap-3 text-sm leading-5"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" /><span>我已离线保存新恢复密钥</span></label>
        <Button type="button" className="w-full" disabled={!confirmed} onClick={onRecovered}>返回解锁</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">恢复访问</h2>
        <p className="text-sm leading-6 text-foreground-muted">{demoMode ? "只验证演示输入，不会修改真实保险库或重置凭据。" : "使用恢复密钥重置主密码，操作只在本机完成。"}</p>
      </div>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <label htmlFor="recovery-key" className="text-sm font-medium">{demoMode ? "演示恢复密钥" : "恢复密钥"}</label>
          <input id="recovery-key" value={recoveryKey} onChange={(event) => setRecoveryKey(event.target.value)} className="control mono" autoComplete="off" autoFocus disabled={busy} />
          {errors.recoveryKey && <p role="alert" className="text-sm text-danger">{errors.recoveryKey}</p>}
        </div>
        <div className="space-y-2">
          <label htmlFor="recover-new-password" className="text-sm font-medium">{demoMode ? "新主密码（仅演示）" : "新主密码"}</label>
          <input id="recover-new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="control" autoComplete="off" disabled={busy} />
        </div>
        <div className="space-y-2">
          <label htmlFor="recover-confirm-password" className="text-sm font-medium">确认新主密码</label>
          <input id="recover-confirm-password" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="control" autoComplete="off" disabled={busy} />
          {errors.password && <p role="alert" className="text-sm text-danger">{errors.password}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "正在验证…" : demoMode ? "验证演示恢复信息" : "重置主密码"}</Button>
        <Button type="button" variant="ghost" className="w-full" onClick={onBack}>返回解锁</Button>
      </form>
    </div>
  );
}
