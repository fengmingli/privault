import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Toast, type ToastMessage, type ToastTone } from "@/components/Toast";
import { createDemoEntries } from "@/data/demo";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAutoLock } from "@/hooks/use-auto-lock";
import { createDemoGateway } from "@/lib/demo-gateway";
import { filterAndSortEntries } from "@/lib/entry-utils";
import { DEFAULT_SETTINGS, type UiSettings } from "@/lib/settings";
import type { VaultGateway } from "@/lib/vault-client";
import { createInitialVaultState, vaultReducer } from "@/state/vault-reducer";
import type { Category, EntryKind, VaultEntry } from "@/types/vault";
import { CapabilityDialog, type Capability } from "./CapabilityDialog";
import { EntryDetailPane } from "./EntryDetailPane";
import { EntryEditorDialog } from "./EntryEditorDialog";
import { EntryListPane } from "./EntryListPane";
import { NewEntryDialog } from "./NewEntryDialog";
import { PasswordGeneratorDialog } from "./PasswordGeneratorDialog";
import { SettingsDialog } from "./SettingsDialog";
import { VaultSidebar } from "./VaultSidebar";

interface VaultWorkspaceProps {
  onLock: () => void;
  initialEntries?: VaultEntry[];
  gateway?: VaultGateway;
  settings?: UiSettings;
  onSettingsChange?: (patch: Partial<UiSettings>) => void;
}

const ignoreSettingsChange = () => {};

export function VaultWorkspace({ onLock, initialEntries, gateway, settings = DEFAULT_SETTINGS, onSettingsChange = ignoreSettingsChange }: VaultWorkspaceProps) {
  const [defaultGateway] = useState(() => createDemoGateway(initialEntries));
  const activeGateway = gateway ?? defaultGateway;
  const [state, dispatch] = useReducer(vaultReducer, initialEntries ?? (gateway ? [] : undefined), createInitialVaultState);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [editor, setEditor] = useState<{ open: boolean; entry: VaultEntry | null; kind: EntryKind }>({ open: false, entry: null, kind: "login" });
  const [editorDirty, setEditorDirty] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<VaultEntry | null>(null);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [capability, setCapability] = useState<Capability | null>(null);
  const [lockConfirm, setLockConfirm] = useState(false);
  const [writeBusy, setWriteBusy] = useState(false);
  const [migrationActive, setMigrationActive] = useState(false);
  const writesBlocked = writeBusy || migrationActive;
  const searchInputRef = useRef<HTMLInputElement>(null);
  const visibleEntries = useMemo(() => filterAndSortEntries(state), [state]);
  const [loadedEntry, setLoadedEntry] = useState<VaultEntry | null>(() => {
    if (gateway) return null;
    const candidates = initialEntries ?? createDemoEntries();
    const selectedId = createInitialVaultState(initialEntries).selectedId;
    return candidates.find((entry) => entry.id === selectedId) ?? null;
  });
  const selectedEntry = loadedEntry?.id === state.selectedId ? loadedEntry : null;

  const notify = useCallback((message: string, tone: ToastTone) => setToast({ id: crypto.randomUUID(), message, tone }), []);
  const closeToast = useCallback(() => setToast(null), []);
  const reportError = useCallback((reason: unknown) => notify(reason instanceof Error ? reason.message : "操作失败", "error"), [notify]);

  useEffect(() => {
    let active = true;
    void activeGateway.listEntries()
      .then((entries) => { if (active) dispatch({ type: "replace-entries", entries }); })
      .catch(reportError);
    return () => { active = false; };
  }, [activeGateway, reportError]);

  useEffect(() => {
    let active = true;
    if (!state.selectedId) return () => { active = false; };
    void activeGateway.getEntry(state.selectedId)
      .then((entry) => { if (active) setLoadedEntry(entry); })
      .catch((error) => { if (active) reportError(error); });
    return () => { active = false; };
  }, [state.selectedId, activeGateway, reportError]);

  useEffect(() => {
    if (visibleEntries.length === 0 && state.selectedId !== null) dispatch({ type: "select", id: null });
    else if (visibleEntries.length > 0 && !visibleEntries.some((entry) => entry.id === state.selectedId)) dispatch({ type: "select", id: visibleEntries[0].id });
  }, [state.selectedId, visibleEntries]);

  function openEditor(entry: VaultEntry | null, kind: EntryKind = entry?.kind ?? "login") {
    if (writesBlocked) return;
    setEditorDirty(false);
    setEditor({ open: true, entry, kind });
  }

  const closeEditor = useCallback(() => {
    setEditorDirty(false);
    setEditor((current) => ({ ...current, open: false }));
  }, []);

  async function saveEntry(entry: VaultEntry) {
    if (writesBlocked) return;
    setWriteBusy(true);
    try {
      const saved = await activeGateway.upsertEntry(entry);
      dispatch({ type: "upsert", entry: saved });
      setLoadedEntry(saved);
      closeEditor();
      notify("项目已保存", "success");
    } catch (reason) {
      reportError(reason);
    } finally {
      setWriteBusy(false);
    }
  }

  const performLock = useCallback(async () => {
    try {
      await activeGateway.lock();
    } catch (reason) {
      reportError(reason);
    } finally {
      setLockConfirm(false);
      setNewOpen(false);
      setDeleteCandidate(null);
      setGeneratorOpen(false);
      setSettingsOpen(false);
      setCapability(null);
      setMigrationActive(false);
      setLoadedEntry(null);
      closeEditor();
      dispatch({ type: "clear-sensitive-view" });
      onLock();
    }
  }, [activeGateway, closeEditor, onLock, reportError]);

  const requestLock = useCallback(() => {
    if (migrationActive) return;
    if (editorDirty) setLockConfirm(true);
    else void performLock();
  }, [editorDirty, migrationActive, performLock]);

  async function confirmDelete() {
    if (!deleteCandidate || writesBlocked) return;
    setWriteBusy(true);
    const deletedId = deleteCandidate.id;
    try {
      await activeGateway.deleteEntry(deletedId);
      dispatch({ type: "remove", id: deletedId });
      setDeleteCandidate(null);
      setToast({ id: crypto.randomUUID(), message: "项目已删除", tone: "info", actionLabel: "撤销", onAction: () => {
        void activeGateway.restoreEntry(deletedId).then(() => {
          dispatch({ type: "undo-delete" });
          setToast({ id: crypto.randomUUID(), message: "项目已恢复", tone: "success" });
        }).catch(reportError);
      } });
    } catch (reason) {
      reportError(reason);
    } finally {
      setWriteBusy(false);
    }
  }

  async function toggleFavorite() {
    if (!selectedEntry || writesBlocked) return;
    setWriteBusy(true);
    try {
      const full = await activeGateway.getEntry(selectedEntry.id);
      full.favorite = !full.favorite;
      const saved = await activeGateway.upsertEntry(full);
      dispatch({ type: "upsert", entry: saved });
      setLoadedEntry(saved);
    } catch (reason) {
      reportError(reason);
    } finally {
      setWriteBusy(false);
    }
  }

  function showAll() {
    dispatch({ type: "set-query", query: "" });
    dispatch({ type: "set-category", category: "all" });
  }

  useAutoLock({ minutes: settings.autoLockMinutes, onLock: performLock, enabled: !migrationActive });

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (!event.metaKey && !event.ctrlKey) return;
      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      } else if (key === "n" && !writesBlocked) {
        event.preventDefault();
        setNewOpen(true);
      } else if (key === "l" && event.shiftKey) {
        event.preventDefault();
        requestLock();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [requestLock, writesBlocked]);

  return (
    <main aria-busy={writesBlocked} className="grid min-h-0 flex-1 grid-cols-[72px_280px_minmax(0,1fr)] overflow-hidden min-[1100px]:grid-cols-[216px_320px_minmax(0,1fr)]">
      <VaultSidebar entries={state.entries} category={state.category} onCategory={(category: Category) => dispatch({ type: "set-category", category })} onLock={requestLock} onGenerator={() => setGeneratorOpen(true)} onSettings={() => setSettingsOpen(true)} demoMode={activeGateway.isDemo} />
      <EntryListPane entries={visibleEntries} totalCount={state.entries.length} selectedId={state.selectedId} query={state.query} onQuery={(query) => dispatch({ type: "set-query", query })} onSelect={(id) => dispatch({ type: "select", id })} onClearSearch={() => dispatch({ type: "set-query", query: "" })} onShowAll={showAll} onNew={() => { if (!writesBlocked) setNewOpen(true); }} searchInputRef={searchInputRef} />
      <EntryDetailPane key={selectedEntry?.id ?? "empty"} entry={selectedEntry} onNotify={notify} onEdit={() => selectedEntry && openEditor(selectedEntry)} onDelete={() => { if (!writesBlocked) setDeleteCandidate(selectedEntry); }} onToggleFavorite={() => void toggleFavorite()} />
      <NewEntryDialog open={newOpen} onClose={() => setNewOpen(false)} onSelect={(kind) => { setNewOpen(false); openEditor(null, kind); }} />
      {editor.open && <EntryEditorDialog open entry={editor.entry} kind={editor.kind} onSave={saveEntry} onClose={closeEditor} onDirtyChange={setEditorDirty} busy={writesBlocked} />}
      <ConfirmDialog open={deleteCandidate !== null} title="删除这个项目？" description={deleteCandidate ? `将删除“${deleteCandidate.title}”。${activeGateway.isDemo ? "此原型可通过撤销恢复。" : "删除后可在本次会话中撤销。"}` : ""} confirmLabel="确认删除" cancelLabel="取消" destructive onConfirm={confirmDelete} onCancel={() => setDeleteCandidate(null)} />
      <ConfirmDialog open={lockConfirm} title="放弃未保存修改？" description="锁定将放弃当前表单中的未保存内容，并清除搜索词和已显示密码。" confirmLabel="放弃并锁定" cancelLabel="继续编辑" destructive onConfirm={performLock} onCancel={() => setLockConfirm(false)} />
      <SettingsDialog open={settingsOpen} settings={settings} onChange={onSettingsChange} onClose={() => setSettingsOpen(false)} onCapability={setCapability} gateway={activeGateway} onMigrationActiveChange={setMigrationActive} onRequireUnlock={() => void performLock()} />
      <CapabilityDialog open={capability !== null} capability={capability ?? "native-security"} onClose={() => setCapability(null)} />
      <PasswordGeneratorDialog open={generatorOpen} onClose={() => setGeneratorOpen(false)} />
      <Toast toast={toast} onClose={closeToast} />
    </main>
  );
}
