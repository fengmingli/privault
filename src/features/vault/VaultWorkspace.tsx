import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createDemoEntries } from "@/data/demo";

interface VaultWorkspaceProps {
  onLock: () => void;
}

export function VaultWorkspace({ onLock }: VaultWorkspaceProps) {
  const entries = createDemoEntries();
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <section className="w-full max-w-md rounded-xl border bg-surface p-8 text-center shadow-panel">
        <h2 className="text-2xl font-semibold">演示保险库</h2>
        <p className="mt-3 text-sm text-foreground-muted">{entries.length} 个虚构演示条目，数据仅保留在内存中。</p>
        <Button type="button" variant="outline" className="mt-6" onClick={onLock}><LockKeyhole className="mr-2 h-4 w-4" aria-hidden="true" />立即锁定</Button>
      </section>
    </main>
  );
}
