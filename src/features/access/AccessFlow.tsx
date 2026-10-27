import { useState } from "react";
import { Download, LockKeyhole, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccessLayout } from "./AccessLayout";
import { CreateVaultFlow } from "./CreateVaultFlow";
import { RecoverAccessScreen } from "./RecoverAccessScreen";
import { UnlockScreen } from "./UnlockScreen";

type AccessScreen = "welcome" | "unlock" | "create" | "recover";

interface AccessFlowProps {
  onUnlocked: () => void;
}

export function AccessFlow({ onUnlocked }: AccessFlowProps) {
  const [screen, setScreen] = useState<AccessScreen>("welcome");
  const [importNotice, setImportNotice] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState(false);

  return (
    <AccessLayout>
      {screen === "welcome" && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">欢迎使用</h2>
            <p className="text-sm leading-6 text-foreground-muted">选择一个入口，体验完全在本机运行的界面流程。</p>
          </div>
          <div className="space-y-3">
            <Button type="button" className="w-full" onClick={() => setScreen("create")}><Plus className="mr-2 h-4 w-4" aria-hidden="true" />创建演示保险库</Button>
            <Button type="button" variant="outline" className="w-full" onClick={() => setScreen("unlock")}><LockKeyhole className="mr-2 h-4 w-4" aria-hidden="true" />解锁演示保险库</Button>
          </div>
          <div className="border-t pt-5">
            <Button type="button" variant="ghost" className="w-full" onClick={() => setImportNotice((visible) => !visible)}><Download className="mr-2 h-4 w-4" aria-hidden="true" />导入已有保险库</Button>
            {importNotice && <p role="status" className="mt-3 rounded-lg bg-muted p-3 text-center text-xs leading-5 text-foreground-muted">迁移功能尚未接入，不会选择或写入任何文件。</p>}
          </div>
          <p className="text-center text-xs leading-5 text-foreground-muted">当前仅展示界面流程，不会创建真实保险库。</p>
        </div>
      )}
      {screen === "unlock" && <UnlockScreen onBack={() => setScreen("welcome")} onForgot={() => setScreen("recover")} onUnlocked={onUnlocked} showRecoveryNotice={recoveryNotice} />}
      {screen === "create" && <CreateVaultFlow onBack={() => setScreen("welcome")} onComplete={onUnlocked} />}
      {screen === "recover" && <RecoverAccessScreen onBack={() => setScreen("unlock")} onRecovered={() => { setRecoveryNotice(true); setScreen("unlock"); }} />}
    </AccessLayout>
  );
}
