import { useEffect, useState } from "react";
import { PrototypeBanner } from "@/components/PrototypeBanner";
import { AccessFlow } from "@/features/access/AccessFlow";
import { AccessLayout } from "@/features/access/AccessLayout";
import { Button } from "@/components/ui/button";
import { VaultWorkspace } from "@/features/vault/VaultWorkspace";
import { useSettings } from "@/hooks/use-settings";
import { createVaultGateway } from "@/lib/gateway";

function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [hasUnlocked, setHasUnlocked] = useState(false);
  const { settings, updateSettings } = useSettings();
  const [gateway] = useState(() => createVaultGateway());
  const [startupReady, setStartupReady] = useState(gateway.isDemo);
  const [startupScreen, setStartupScreen] = useState<"welcome" | "unlock">("welcome");
  const [startupError, setStartupError] = useState("");
  const [startupAttempt, setStartupAttempt] = useState(0);

  useEffect(() => {
    if (gateway.isDemo) return;
    let active = true;
    void gateway.status().then((status) => {
      if (!active) return;
      if (status.state === "empty") setStartupScreen("welcome");
      else if (status.state === "locked") setStartupScreen("unlock");
      else if (status.state === "unlocked") {
        setHasUnlocked(true);
        setUnlocked(true);
      } else setStartupError("保险库状态异常。请重试；不会创建或覆盖任何数据。");
    }).catch((reason: unknown) => {
      if (active) setStartupError(reason instanceof Error ? reason.message : "无法读取本地保险库状态");
    }).finally(() => {
      if (active) setStartupReady(true);
    });
    return () => { active = false; };
  }, [gateway, startupAttempt]);

  function retryStartup() {
    setStartupReady(false);
    setStartupError("");
    setStartupAttempt((attempt) => attempt + 1);
  }

  function unlock() {
    setHasUnlocked(true);
    setUnlocked(true);
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <PrototypeBanner realMode={!gateway.isDemo} />
      {startupError ? (
        <AccessLayout>
          <div className="space-y-5">
            <h2 className="text-2xl font-semibold tracking-tight">无法打开本地保险库</h2>
            <p role="alert" className="text-sm leading-6 text-danger">{startupError}</p>
            <Button type="button" onClick={retryStartup}>重试</Button>
          </div>
        </AccessLayout>
      ) : !startupReady ? (
        <AccessLayout><p role="status" className="text-sm text-foreground-muted">正在检查本地保险库…</p></AccessLayout>
      ) : unlocked ? <VaultWorkspace gateway={gateway} onLock={() => setUnlocked(false)} settings={settings} onSettingsChange={updateSettings} /> : <AccessFlow gateway={gateway} initialScreen={hasUnlocked ? "unlock" : startupScreen} onUnlocked={unlock} />}
    </div>
  );
}

export default App;
