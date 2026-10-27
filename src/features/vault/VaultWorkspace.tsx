import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Toast, type ToastMessage, type ToastTone } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { filterAndSortEntries } from "@/lib/entry-utils";
import { createInitialVaultState, vaultReducer } from "@/state/vault-reducer";
import type { Category, EntryKind, VaultEntry } from "@/types/vault";
import { EntryDetailPane } from "./EntryDetailPane";
import { EntryEditorDialog } from "./EntryEditorDialog";
import { EntryListPane } from "./EntryListPane";
import { NewEntryDialog } from "./NewEntryDialog";
import { VaultSidebar } from "./VaultSidebar";

interface VaultWorkspaceProps {
  onLock: () => void;
  initialEntries?: VaultEntry[];
}

export function VaultWorkspace({ onLock, initialEntries }: VaultWorkspaceProps) {
  const [state, dispatch] = useReducer(vaultReducer, initialEntries, createInitialVaultState);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [editor, setEditor] = useState<{ open: boolean; entry: VaultEntry | null; kind: EntryKind }>({ open: false, entry: null, kind: "login" });
  const [editorDirty, setEditorDirty] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<VaultEntry | null>(null);
  const [lockConfirm, setLockConfirm] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const visibleEntries = useMemo(() => filterAndSortEntries(state), [state]);
  const selectedEntry = state.entries.find((entry) => entry.id === state.selectedId) ?? null;

  useEffect(() => {
    if (visibleEntries.length === 0 && state.selectedId !== null) dispatch({ type: "select", id: null });
    else if (visibleEntries.length > 0 && !visibleEntries.some((entry) => entry.id === state.selectedId)) dispatch({ type: "select", id: visibleEntries[0].id });
  }, [state.selectedId, visibleEntries]);

  const notify = useCallback((message: string, tone: ToastTone) => setToast({ id: crypto.randomUUID(), message, tone }), []);
  const closeToast = useCallback(() => setToast(null), []);

  function openEditor(entry: VaultEntry | null, kind: EntryKind = entry?.kind ?? "login") {
    setEditorDirty(false);
    setEditor({ open: true, entry, kind });
  }

  function closeEditor() {
    setEditorDirty(false);
    setEditor((current) => ({ ...current, open: false }));
  }

  function saveEntry(entry: VaultEntry) {
    dispatch({ type: "upsert", entry });
    closeEditor();
    notify("项目已保存", "success");
  }

  function performLock() {
    setLockConfirm(false);
    setNewOpen(false);
    setDeleteCandidate(null);
    closeEditor();
    dispatch({ type: "clear-sensitive-view" });
    onLock();
  }

  function requestLock() {
    if (editorDirty) setLockConfirm(true);
    else performLock();
  }

  function confirmDelete() {
    if (!deleteCandidate) return;
    dispatch({ type: "remove", id: deleteCandidate.id });
    setDeleteCandidate(null);
    setToast({ id: crypto.randomUUID(), message: "项目已删除", tone: "info", actionLabel: "撤销", onAction: () => { dispatch({ type: "undo-delete" }); setToast(null); } });
  }

  function showAll() {
    dispatch({ type: "set-query", query: "" });
    dispatch({ type: "set-category", category: "all" });
  }

  return (
    <main className="grid min-h-0 flex-1 grid-cols-[72px_280px_minmax(0,1fr)] overflow-hidden min-[1100px]:grid-cols-[216px_320px_minmax(0,1fr)]">
      <VaultSidebar entries={state.entries} category={state.category} onCategory={(category: Category) => dispatch({ type: "set-category", category })} onLock={requestLock} />
      <EntryListPane entries={visibleEntries} totalCount={state.entries.length} selectedId={state.selectedId} query={state.query} onQuery={(query) => dispatch({ type: "set-query", query })} onSelect={(id) => dispatch({ type: "select", id })} onClearSearch={() => dispatch({ type: "set-query", query: "" })} onShowAll={showAll} onNew={() => setNewOpen(true)} searchInputRef={searchInputRef} />
      <EntryDetailPane key={selectedEntry?.id ?? "empty"} entry={selectedEntry} onNotify={notify} onEdit={() => selectedEntry && openEditor(selectedEntry)} onDelete={() => setDeleteCandidate(selectedEntry)} onToggleFavorite={() => selectedEntry && dispatch({ type: "toggle-favorite", id: selectedEntry.id })} />
      <NewEntryDialog open={newOpen} onClose={() => setNewOpen(false)} onSelect={(kind) => { setNewOpen(false); openEditor(null, kind); }} />
      <EntryEditorDialog open={editor.open} entry={editor.entry} kind={editor.kind} onSave={saveEntry} onClose={closeEditor} onDirtyChange={setEditorDirty} />
      <ConfirmDialog open={deleteCandidate !== null} title="删除这个项目？" description={deleteCandidate ? `将删除“${deleteCandidate.title}”。此原型可通过撤销恢复。` : ""} confirmLabel="确认删除" cancelLabel="取消" destructive onConfirm={confirmDelete} onCancel={() => setDeleteCandidate(null)} />
      <ConfirmDialog open={lockConfirm} title="放弃未保存修改？" description="锁定将放弃当前表单中的未保存内容，并清除搜索词和已显示密码。" confirmLabel="放弃并锁定" cancelLabel="继续编辑" destructive onConfirm={performLock} onCancel={() => setLockConfirm(false)} />
      <Toast toast={toast} onClose={closeToast} />
    </main>
  );
}
