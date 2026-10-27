import { LockKeyhole, WandSparkles } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Category, VaultEntry } from "@/types/vault";
import { CATEGORIES } from "./entry-kind";

interface VaultSidebarProps {
  entries: VaultEntry[];
  category: Category;
  onCategory: (category: Category) => void;
  onLock: () => void;
  onGenerator: () => void;
}

export function VaultSidebar({ entries, category, onCategory, onLock, onGenerator }: VaultSidebarProps) {
  return (
    <aside className="flex min-h-0 flex-col border-r bg-surface">
      <div className="flex h-20 items-center gap-3 border-b px-3 min-[1100px]:px-5">
        <BrandMark className="h-9 w-9 rounded-lg" />
        <div className="hidden min-[1100px]:block">
          <p className="text-sm font-semibold tracking-tight">Privault</p>
          <h2 className="mt-0.5 text-xs font-normal text-foreground-muted">演示保险库</h2>
        </div>
      </div>
      <nav aria-label="保险库分类" className="flex-1 space-y-1 overflow-y-auto p-2 min-[1100px]:p-3">
        {CATEGORIES.map(({ id, label, icon: Icon }) => {
          const count = id === "all" ? entries.length : entries.filter((entry) => entry.kind === id).length;
          return (
            <button key={id} type="button" aria-label={`${label} ${count}`} aria-pressed={category === id} title={label} onClick={() => onCategory(id)} className={cn("flex h-10 w-full items-center justify-center gap-3 rounded-lg px-2 text-sm transition-colors min-[1100px]:justify-between min-[1100px]:px-3", category === id ? "bg-accent font-medium text-accent-foreground" : "text-foreground-muted hover:bg-muted hover:text-foreground")}>
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="hidden min-[1100px]:inline">{label}</span>
              </span>
              <span className="hidden text-xs text-foreground-muted min-[1100px]:inline">{count}</span>
            </button>
          );
        })}
      </nav>
      <div className="space-y-1 border-t p-2 min-[1100px]:p-3">
        <Button type="button" variant="ghost" title="密码生成器" onClick={onGenerator} className="w-full px-2 min-[1100px]:justify-start">
          <WandSparkles className="h-4 w-4 shrink-0 min-[1100px]:mr-2" aria-hidden="true" />
          <span className="hidden min-[1100px]:inline">密码生成器</span>
        </Button>
        <Button type="button" variant="ghost" title="立即锁定" onClick={onLock} className="w-full px-2 min-[1100px]:justify-start">
          <LockKeyhole className="h-4 w-4 shrink-0 min-[1100px]:mr-2" aria-hidden="true" />
          <span className="hidden min-[1100px]:inline">立即锁定</span>
        </Button>
      </div>
    </aside>
  );
}
