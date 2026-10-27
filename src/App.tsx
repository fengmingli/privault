import { useState } from "react";
import { PrototypeBanner } from "@/components/PrototypeBanner";
import { AccessFlow } from "@/features/access/AccessFlow";
import { VaultWorkspace } from "@/features/vault/VaultWorkspace";

function App() {
  const [unlocked, setUnlocked] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <PrototypeBanner />
      {unlocked ? <VaultWorkspace onLock={() => setUnlocked(false)} /> : <AccessFlow onUnlocked={() => setUnlocked(true)} />}
    </div>
  );
}

export default App;
