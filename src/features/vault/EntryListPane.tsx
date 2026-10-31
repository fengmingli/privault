import type { RefObject } from "react";
import { Plus, Search, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Category, EntrySummary } from "@/types/vault";
import { ENTRY_KIND_META } from "./entry-kind";

interface EntryListPaneProps {
  entries: EntrySummary[];
  category: Category;
  totalCount: number;
  selectedId: string | null;
  query: string;
  onQuery: (query: string) => void;
  onSelect: (id: string) => void;
  onClearSearch: () => void;
  onShowAll: () => void;
  onNew: () => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
}

export function EntryListPane({ entries, category, totalCount, selectedId, query, onQuery, onSelect, onClearSearch, onShowAll, onNew, searchInputRef }: EntryListPaneProps) {
  const favoritesEmpty = category === "favorites" && entries.length === 0 && totalCount > 0 && !query.trim();
  const emptyTitle = favoritesEmpty ? "还没有收藏项目" : totalCount === 0 && !query ? "保险库还是空的" : "没有匹配的项目";
  const emptyDescription = favoritesEmpty ? "收藏条目后将在这里显示。" : totalCount === 0 && !query ? "新建条目后将在这里显示。" : "试试其他关键词，或清除当前筛选条件。";
  return (
    <section aria-label="条目列表" className="flex min-h-0 flex-col border-r bg-surface">
      <div className="flex items-center gap-2 border-b p-4">
        <label className="relative block flex-1">
          <span className="sr-only">搜索项目</span>
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-foreground-muted" aria-hidden="true" />
          <input ref={searchInputRef} aria-label="搜索项目" type="search" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="搜索项目…" className="control pl-9" autoComplete="off" />
        </label>
        <Button type="button" size="icon" aria-label="新建" title="新建项目" onClick={onNew}><Plus className="h-4 w-4" aria-hidden="true" /></Button>
      </div>
      <div className="flex items-center justify-between px-4 py-3 text-xs text-foreground-muted">
        <span>{entries.length} 个项目</span>
        <span>收藏优先</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {entries.length > 0 ? (
          <ul className="space-y-1">
            {entries.map((entry) => {
              const { icon: Icon, label } = ENTRY_KIND_META[entry.kind];
              return (
                <li key={entry.id}>
                  <button type="button" aria-pressed={selectedId === entry.id} onClick={() => onSelect(entry.id)} className={cn("w-full rounded-lg border border-transparent p-3 text-left transition-colors", selectedId === entry.id ? "border-primary/15 bg-accent" : "hover:bg-muted")}>
                    <span className="flex items-start gap-3">
                      <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", selectedId === entry.id ? "bg-surface text-primary" : "bg-muted text-foreground-muted")}><Icon className="h-4 w-4" aria-hidden="true" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{entry.title}</span>
                          {entry.favorite && <><Star className="h-3.5 w-3.5 shrink-0 fill-current text-primary" aria-hidden="true" /><span className="sr-only">已收藏</span></>}
                        </span>
                        <span className="mt-1 block truncate text-xs text-foreground-muted">{entry.summary}</span>
                        <span className="mt-2 block text-[11px] text-foreground-muted/80">{label}</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-5 text-center">
            <Search className="mb-3 h-6 w-6 text-foreground-muted" aria-hidden="true" />
            <h3 className="text-sm font-medium">{emptyTitle}</h3>
            <p className="mt-2 text-xs leading-5 text-foreground-muted">{emptyDescription}</p>
            {totalCount === 0 && !query ? <Button type="button" size="sm" className="mt-4" onClick={onNew}><Plus className="mr-1 h-4 w-4" />新建第一个项目</Button> : (query || totalCount > 0) && <div className="mt-4 flex flex-col gap-2"><Button type="button" variant="outline" size="sm" onClick={onClearSearch} disabled={!query}>清除搜索</Button><Button type="button" variant="ghost" size="sm" onClick={onShowAll}>查看全部项目</Button></div>}
          </div>
        )}
      </div>
    </section>
  );
}
