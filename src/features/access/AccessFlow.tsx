import { useCallback, useState } from "react";
import { Download, LockKeyhole, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VaultGateway } from "@/lib/vault-client";
import { PvaultDialog } from "@/features/vault/PvaultDialog";
import { AccessLayout } from "./AccessLayout";
import { CreateVaultFlow } from "./CreateVaultFlow";
import { RecoverAccessScreen } from "./RecoverAccessScreen";
import { UnlockScreen } from "./UnlockScreen";

type AccessScreen = "welcome" | "unlock" | "create" | "recover";

interface AccessFlowProps {
  gateway: VaultGateway;
  onUnlocked: () => void;
  initialScreen?: AccessScreen;
}

export function AccessFlow({ gateway, onUnlocked, initialScreen = "welcome" }: AccessFlowProps) {
  const [screen, setScreen] = useState<AccessScreen>(initialScreen);
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState(false);
  const demoMode = gateway.isDemo;
  const chooseLocation = useCallback(() => gateway.chooseLocation(), [gateway]);
  const getLocation = useCallback(() => gateway.getLocation(), [gateway]);
  const layout = screen === "unlock" || screen === "recover" ? "focused" : "split";

  return (
    <AccessLayout variant={layout}>
      {screen === "welcome" && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">欢迎使用</h2>
            <p className="text-sm leading-6 text-foreground-muted">{demoMode ? "选择一个入口，体验完全在本机运行的界面流程。" : "创建新保险库，或输入主密码解锁本机保险库。"}</p>
          </div>
          <div className="space-y-3">
            <Button type="button" className="w-full" disabled={importBusy} onClick={() => setScreen("create")}><Plus className="mr-2 h-4 w-4" aria-hidden="true" />创建{demoMode ? "演示" : ""}保险库</Button>
            <Button type="button" variant="outline" className="w-full" disabled={importBusy} onClick={() => setScreen("unlock")}><LockKeyhole className="mr-2 h-4 w-4" aria-hidden="true" />解锁{demoMode ? "演示" : ""}保险库</Button>
          </div>
          <div className="border-t pt-5">
            <Button type="button" variant="ghost" className="w-full" disabled={importBusy} onClick={() => setImportOpen(true)}><Download className="mr-2 h-4 w-4" aria-hidden="true" />导入已有保险库</Button>
          </div>
          <p className="text-center text-xs leading-5 text-foreground-muted">{demoMode ? "当前仅展示界面流程，不会创建真实保险库。" : "私密数据仅由本机加密核心写入固定磁盘。"}</p>
        </div>
      )}
      {screen === "unlock" && <UnlockScreen onBack={() => setScreen("welcome")} onForgot={() => setScreen("recover")} onUnlock={async (password) => { await gateway.unlock(password); onUnlocked(); }} showRecoveryNotice={recoveryNotice} demoMode={demoMode} />}
      {screen === "create" && <CreateVaultFlow onBack={() => setScreen("welcome")} onCreate={(password, destination) => gateway.create(password, destination)} onComplete={async (password) => { await gateway.unlock(password); onUnlocked(); }} onChooseLocation={chooseLocation} onGetLocation={getLocation} demoMode={demoMode} />}
      {screen === "recover" && <RecoverAccessScreen onBack={() => setScreen("unlock")} onRecover={(key, password) => gateway.recoverAccess(key, password)} onRecovered={() => { setRecoveryNotice(true); setScreen("unlock"); }} demoMode={demoMode} />}
      {importOpen && <PvaultDialog open mode="import" gateway={gateway} onClose={() => setImportOpen(false)} onRequireUnlock={() => { setImportOpen(false); setScreen("unlock"); }} onBusyChange={setImportBusy} />}
    </AccessLayout>
  );
}
