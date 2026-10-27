import { useState, type FormEvent } from "react";
import { Check, Copy, Printer, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/clipboard";
import { DEMO_RECOVERY_KEY, validateMasterPassword } from "@/lib/validation";

interface CreateVaultFlowProps {
  onBack: () => void;
  onComplete: () => void;
}

export function CreateVaultFlow({ onBack, onComplete }: CreateVaultFlowProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");

  function continueToRecovery(event: FormEvent) {
    event.preventDefault();
    const validationError = validateMasterPassword(password, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }
    setStep(2);
  }

  async function copyRecoveryKey() {
    const copied = await copyText(DEMO_RECOVERY_KEY);
    setCopyStatus(copied ? "演示恢复密钥已复制" : "复制失败，请检查系统权限");
  }

  if (step === 2) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-medium text-primary">步骤 2 / 2</p>
          <h2 className="text-2xl font-semibold tracking-tight">保存恢复密钥</h2>
          <p className="text-sm leading-6 text-foreground-muted">真实产品中它用于重置主密码。以下仅为不可用的演示示例。</p>
        </div>
        <div data-print-recovery className="rounded-lg border bg-background p-5 text-center">
          <ShieldCheck className="mx-auto mb-3 h-6 w-6 text-primary" aria-hidden="true" />
          <p className="mb-2 text-xs font-medium text-danger">UI 原型示例，不可用于真实恢复</p>
          <code className="mono break-all text-sm font-semibold tracking-wider">{DEMO_RECOVERY_KEY}</code>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" onClick={copyRecoveryKey}><Copy className="mr-2 h-4 w-4" aria-hidden="true" />复制</Button>
          <Button type="button" variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" aria-hidden="true" />打印</Button>
        </div>
        {copyStatus && <p role="status" className="text-center text-sm text-foreground-muted">{copyStatus}</p>}
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-5">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
          <span>我已离线保存此演示恢复密钥</span>
        </label>
        <div className="flex gap-3">
          <Button type="button" variant="ghost" onClick={() => setStep(1)}>返回</Button>
          <Button type="button" className="flex-1" disabled={!confirmed} onClick={onComplete}><Check className="mr-2 h-4 w-4" aria-hidden="true" />进入演示保险库</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-medium text-primary">步骤 1 / 2</p>
        <h2 className="text-2xl font-semibold tracking-tight">创建演示保险库</h2>
        <p className="text-sm leading-6 text-foreground-muted">仅验证界面流程，请使用虚构密码。</p>
      </div>
      <form onSubmit={continueToRecovery} className="space-y-4" noValidate>
        <div className="space-y-2">
          <label htmlFor="new-demo-password" className="text-sm font-medium">设置主密码（仅演示）</label>
          <input id="new-demo-password" type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} className="control" autoComplete="off" autoFocus />
          <p className="text-xs text-foreground-muted">至少 12 位，不会保存或用于真实加密。</p>
        </div>
        <div className="space-y-2">
          <label htmlFor="confirm-demo-password" className="text-sm font-medium">确认主密码</label>
          <input id="confirm-demo-password" type="password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setError(""); }} className="control" autoComplete="off" />
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" className="w-full">继续</Button>
        <Button type="button" variant="ghost" className="w-full" onClick={onBack}>返回</Button>
      </form>
    </div>
  );
}
