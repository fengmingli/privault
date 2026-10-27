import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Toast, type ToastMessage, type ToastTone } from "@/components/Toast";
import { filterAndSortEntries } from "@/lib/entry-utils";
import { createInitialVaultState, vaultReducer } from "@/state/vault-reducer";
import type { Category, VaultEntry } from "@/types/vault";
import { EntryDetailPane } from "./EntryDetailPane";
import { EntryListPane } from "./EntryListPane";
import { VaultSidebar } from "./VaultSidebar";

interface VaultWorkspaceProps {
  onLock: () => void;
  initialEntries?: VaultEntry[];
}

export function VaultWorkspace({ onLock, initialEntries }: VaultWorkspaceProps) {
  const [state, dispatch] = useReducer(vaultReducer, initialEntries, createInitialVaultState);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const visibleEntries = useMemo(() => filterAndSortEntries(state), [state]);
  const selectedEntry = state.entries.find((entry) => entry.id === state.selectedId) ?? null;

  useEffect(() => {
    if (visibleEntries.length === 0 && state.selectedId !== null) {
      dispatch({ type: "select", id: null });
    } else if (visibleEntries.length > 0 && !visibleEntries.some((entry) => entry.id === state.selectedId)) {
      dispatch({ type: "select", id: visibleEntries[0].id });
    }
  }, [state.selectedId, visibleEntries]);

  const notify = useCallback((message: string, tone: ToastTone) => {
    setToast({ id: crypto.randomUUID(), message, tone });
  }, []);
  const closeToast = useCallback(() => setToast(null), []);

  function lock() {
    dispatch({ type: "clear-sensitive-view" });
    onLock();
  }

  function showAll() {
    dispatch({ type: "set-query", query: "" });
    dispatch({ type: "set-category", category: "all" });
  }

  return (
    <main className="grid min-h-0 flex-1 grid-cols-[72px_280px_minmax(0,1fr)] overflow-hidden min-[1100px]:grid-cols-[216px_320px_minmax(0,1fr)]">
      <VaultSidebar entries={state.entries} category={state.category} onCategory={(category: Category) => dispatch({ type: "set-category", category })} onLock={lock} />
      <EntryListPane entries={visibleEntries} totalCount={state.entries.length} selectedId={state.selectedId} query={state.query} onQuery={(query) => dispatch({ type: "set-query", query })} onSelect={(id) => dispatch({ type: "select", id })} onClearSearch={() => dispatch({ type: "set-query", query: "" })} onShowAll={showAll} searchInputRef={searchInputRef} />
      <EntryDetailPane key={selectedEntry?.id ?? "empty"} entry={selectedEntry} onNotify={notify} />
      <Toast toast={toast} onClose={closeToast} />
    </main>
  );
}
