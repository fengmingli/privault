import { useState } from "react";
import { useSettings } from "@/hooks/use-settings";
import { PrototypeBanner } from "@/components/PrototypeBanner";
import { AccessFlow } from "@/features/access/AccessFlow";
import { VaultWorkspace } from "@/features/vault/VaultWorkspace";

function App() {
  const [unlocked, setUnlocked] = useState(false);
  const { settings, updateSettings } = useSettings();

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <PrototypeBanner />
      {unlocked ? <VaultWorkspace onLock={() => setUnlocked(false)} settings={settings} onSettingsChange={updateSettings} /> : <AccessFlow onUnlocked={() => setUnlocked(true)} />}
    </div>
  );
}

export default App;
