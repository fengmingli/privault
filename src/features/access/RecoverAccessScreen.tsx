import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { isValidDemoRecoveryKey, validateMasterPassword } from "@/lib/validation";

interface RecoverAccessScreenProps {
  onBack: () => void;
  onRecovered: () => void;
}

export function RecoverAccessScreen({ onBack, onRecovered }: RecoverAccessScreenProps) {
  const [recoveryKey, setRecoveryKey] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!isValidDemoRecoveryKey(recoveryKey)) nextErrors.recoveryKey = "恢复密钥格式不正确";
    const passwordError = validateMasterPassword(password, confirmation);
    if (passwordError) nextErrors.password = passwordError;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) onRecovered();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">恢复访问</h2>
        <p className="text-sm leading-6 text-foreground-muted">只验证演示输入，不会修改真实保险库或重置凭据。</p>
      </div>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <label htmlFor="recovery-key" className="text-sm font-medium">演示恢复密钥</label>
          <input id="recovery-key" value={recoveryKey} onChange={(event) => setRecoveryKey(event.target.value)} className="control mono" autoComplete="off" autoFocus />
          {errors.recoveryKey && <p role="alert" className="text-sm text-danger">{errors.recoveryKey}</p>}
        </div>
        <div className="space-y-2">
          <label htmlFor="recover-new-password" className="text-sm font-medium">新主密码（仅演示）</label>
          <input id="recover-new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="control" autoComplete="off" />
        </div>
        <div className="space-y-2">
          <label htmlFor="recover-confirm-password" className="text-sm font-medium">确认新主密码</label>
          <input id="recover-confirm-password" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="control" autoComplete="off" />
          {errors.password && <p role="alert" className="text-sm text-danger">{errors.password}</p>}
        </div>
        <Button type="submit" className="w-full">验证演示恢复信息</Button>
        <Button type="button" variant="ghost" className="w-full" onClick={onBack}>返回解锁</Button>
      </form>
    </div>
  );
}
