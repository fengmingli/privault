import { useState, type FormEvent } from "react";
import { ArrowLeft, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UnlockScreenProps {
  onBack: () => void;
  onForgot: () => void;
  onUnlocked: () => void;
  showRecoveryNotice: boolean;
}

export function UnlockScreen({ onBack, onForgot, onUnlocked, showRecoveryNotice }: UnlockScreenProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== "demo") {
      setError("演示密码不正确");
      return;
    }
    onUnlocked();
  }

  return (
    <div className="space-y-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground"><KeyRound className="h-5 w-5" aria-hidden="true" /></div>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">解锁保险库</h2>
        <p className="text-sm leading-6 text-foreground-muted">输入演示密码，查看本地界面原型。</p>
      </div>
      {showRecoveryNotice && <p role="status" className="rounded-lg bg-accent p-3 text-sm text-accent-foreground">界面验证已通过，未修改任何真实保险库。</p>}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <label htmlFor="demo-password" className="text-sm font-medium">演示密码</label>
          <input id="demo-password" type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} className="control mono" autoComplete="off" autoFocus aria-describedby="demo-password-hint" />
          <p id="demo-password-hint" className="text-xs text-foreground-muted">演示密码：<code className="mono font-semibold text-foreground">demo</code></p>
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" className="w-full">解锁</Button>
      </form>
      <div className="flex items-center justify-between text-sm">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />返回</Button>
        <Button type="button" variant="link" size="sm" onClick={onForgot}>使用恢复密钥</Button>
      </div>
    </div>
  );
}
