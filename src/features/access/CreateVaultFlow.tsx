import { useEffect, useState, type FormEvent } from "react";
import { Check, Copy, FolderSearch, Printer, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { copyText } from "@/lib/clipboard";
import { validateMasterPassword } from "@/lib/validation";
import type { RecoveryKeyResult, StorageLocation } from "@/lib/vault-client";
import { DEMO_RECOVERY_KEY } from "@/lib/validation";

interface CreateVaultFlowProps {
  onBack: () => void;
  onCreate: (password: string, destination: string | null) => Promise<RecoveryKeyResult>;
  onComplete: (password: string) => Promise<void>;
  onChooseLocation: () => Promise<string | null>;
  onGetLocation: () => Promise<StorageLocation>;
  demoMode: boolean;
}

export function CreateVaultFlow({ onBack, onCreate, onComplete, onChooseLocation, onGetLocation, demoMode }: CreateVaultFlowProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [recoveryKey, setRecoveryKey] = useState(demoMode ? DEMO_RECOVERY_KEY : "");
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [location, setLocation] = useState<StorageLocation | null>(null);
  const [destination, setDestination] = useState<string | null>(null);
  const [locationError, setLocationError] = useState("");
  const [pickerBusy, setPickerBusy] = useState(false);

  useEffect(() => {
    if (demoMode) return;
    let active = true;
    void onGetLocation().then((current) => {
      if (active) setLocation(current);
    }).catch((reason: unknown) => {
      if (active) setLocationError(reason instanceof Error ? reason.message : "无法读取默认保存目录");
    });
    return () => { active = false; };
  }, [demoMode, onGetLocation]);

  async function chooseDestination() {
    setPickerBusy(true);
    setLocationError("");
    try {
      const selected = await onChooseLocation();
      if (selected !== null) setDestination(selected);
    } catch (reason) {
      setLocationError(reason instanceof Error ? reason.message : "无法选择保存目录");
    } finally {
      setPickerBusy(false);
    }
  }

  async function continueToRecovery(event: FormEvent) {
    event.preventDefault();
    const validationError = validateMasterPassword(password, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await onCreate(password, destination);
      setRecoveryKey(result.recoveryKey);
      setStep(2);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法创建保险库");
    } finally {
      setBusy(false);
    }
  }

  async function copyRecoveryKey() {
    const copied = await copyText(recoveryKey);
    setCopyStatus(copied ? "恢复密钥已复制" : "复制失败，请检查系统权限");
  }

  async function complete() {
    setBusy(true);
    setError("");
    try {
      await onComplete(password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法解锁新保险库");
    } finally {
      setBusy(false);
    }
  }

  if (step === 2) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-medium text-primary">步骤 2 / 2</p>
          <h2 className="text-2xl font-semibold tracking-tight">保存恢复密钥</h2>
          <p className="text-sm leading-6 text-foreground-muted">{demoMode ? "真实产品中它用于重置主密码。请离线保存此密钥。" : "它用于重置主密码。请离线保存此密钥。"}</p>
        </div>
        <div data-print-recovery className="rounded-lg border bg-background p-5 text-center">
          <ShieldCheck className="mx-auto mb-3 h-6 w-6 text-primary" aria-hidden="true" />
          <p className="mb-2 text-xs font-medium text-danger">{demoMode ? "UI 原型示例，不可用于真实恢复" : "恢复密钥仅显示一次"}</p>
          <code className="mono break-all text-sm font-semibold tracking-wider">{recoveryKey}</code>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" onClick={copyRecoveryKey}><Copy className="mr-2 h-4 w-4" aria-hidden="true" />复制</Button>
          <Button type="button" variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" aria-hidden="true" />打印</Button>
        </div>
        {copyStatus && <p role="status" className="text-center text-sm text-foreground-muted">{copyStatus}</p>}
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-5">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
          <span>{demoMode ? "我已离线保存此演示恢复密钥" : "我已离线保存恢复密钥"}</span>
        </label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex gap-3">
          <Button type="button" variant="ghost" onClick={() => setStep(1)}>返回</Button>
          <Button type="button" className="flex-1" disabled={!confirmed || busy} onClick={complete}><Check className="mr-2 h-4 w-4" aria-hidden="true" />{demoMode ? "进入演示保险库" : "解锁保险库"}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-medium text-primary">步骤 1 / 2</p>
        <h2 className="text-2xl font-semibold tracking-tight">{demoMode ? "创建演示保险库" : "创建保险库"}</h2>
        <p className="text-sm leading-6 text-foreground-muted">{demoMode ? "仅验证界面流程，请使用虚构密码。" : "主密码只用于本地密钥派生，不会上传或单独保存。"}</p>
      </div>
      <form onSubmit={continueToRecovery} className="space-y-4" noValidate>
        {demoMode ? (
          <p className="rounded-lg bg-muted p-3 text-xs leading-5 text-foreground-muted">浏览器 Demo 使用内存数据，不选择真实保存目录。</p>
        ) : (
          <div className="space-y-3 rounded-lg border bg-background p-3">
            <p className="text-sm font-medium">保存位置</p>
            <code className="mono block break-all text-xs text-foreground-muted">{destination ?? location?.path ?? "正在读取保存目录…"}</code>
            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" size="sm" disabled={busy || pickerBusy} onClick={() => void chooseDestination()}><FolderSearch className="mr-2 h-4 w-4" aria-hidden="true" />{pickerBusy ? "正在选择…" : "选择保存文件夹"}</Button>
              <Button type="button" variant="outline" size="sm" disabled={busy || pickerBusy || destination === null} onClick={() => setDestination(null)}><RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />恢复默认目录</Button>
            </div>
            {locationError && <p role="alert" className="text-xs leading-5 text-danger">{locationError}</p>}
          </div>
        )}
        <div className="space-y-2">
          <label htmlFor="new-demo-password" className="text-sm font-medium">{demoMode ? "设置主密码（仅演示）" : "设置主密码"}</label>
          <PasswordInput id="new-demo-password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} visibilityLabel="主密码" autoFocus disabled={busy} />
          <p className="text-xs leading-5 text-foreground-muted">{demoMode ? "至少 8 位，包含大写、小写、数字、特殊字符中的至少 3 类；仅用于演示。" : "至少 8 位，包含大写、小写、数字、特殊字符中的至少 3 类；仅用于本机密钥派生，不会单独保存。"}</p>
        </div>
        <div className="space-y-2">
          <label htmlFor="confirm-demo-password" className="text-sm font-medium">确认主密码</label>
          <PasswordInput id="confirm-demo-password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setError(""); }} visibilityLabel="确认密码" disabled={busy} />
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "正在创建…" : "下一步"}</Button>
        <Button type="button" variant="ghost" className="w-full" onClick={onBack}>返回</Button>
      </form>
    </div>
  );
}
