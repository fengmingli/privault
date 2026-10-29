import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { createEmptyEntry, prepareEntryForSave } from "@/lib/entry-utils";
import { validateEntry } from "@/lib/validation";
import type { EntryKind, VaultEntry } from "@/types/vault";
import { CustomFieldsEditor } from "./CustomFieldsEditor";
import { PasswordGeneratorDialog } from "./PasswordGeneratorDialog";
import { ENTRY_KIND_META } from "./entry-kind";
import { EntryKindFields } from "./EntryKindFields";

interface EntryEditorDialogProps {
  open: boolean;
  entry: VaultEntry | null;
  kind: EntryKind;
  onSave: (entry: VaultEntry) => void;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
  busy?: boolean;
}

export function EntryEditorDialog({ open, entry, kind, onSave, onClose, onDirtyChange, busy = false }: EntryEditorDialogProps) {
  const [original, setOriginal] = useState<VaultEntry | null>(null);
  const [draft, setDraft] = useState<VaultEntry | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmClose, setConfirmClose] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const dirty = Boolean(original && draft && JSON.stringify(original) !== JSON.stringify(draft));

  useEffect(() => {
    if (!open) return;
    const base = entry ? structuredClone(entry) : createEmptyEntry(kind);
    setOriginal(base);
    setDraft(structuredClone(base));
    setErrors({});
    setConfirmClose(false);
    setGeneratorOpen(false);
  }, [open, entry, kind]);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  function patch(patch: Record<string, unknown>) {
    setDraft((current) => current ? { ...current, ...patch } as VaultEntry : current);
  }

  function requestClose() {
    if (dirty) setConfirmClose(true);
    else onClose();
  }

  function save() {
    if (!draft) return;
    const nextErrors = validateEntry(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) onSave(prepareEntryForSave(draft, entry));
  }

  const title = entry ? "编辑项目" : `新建${ENTRY_KIND_META[kind].label}`;
  return (
    <>
      <Dialog open={open} title={title} onClose={requestClose} className="max-w-2xl">
        {draft && <form onSubmit={(event) => { event.preventDefault(); save(); }} className="space-y-5" noValidate>
          <div className="space-y-2"><label htmlFor="entry-title" className="text-sm font-medium">标题</label><input id="entry-title" className="control" value={draft.title} onChange={(event) => patch({ title: event.target.value })} autoFocus />{errors.title && <p role="alert" className="text-sm text-danger">{errors.title}</p>}</div>
          <EntryKindFields entry={draft} errors={errors} onChange={patch} onOpenGenerator={() => setGeneratorOpen(true)} />
          <div className="space-y-2"><label htmlFor="entry-notes" className="text-sm font-medium">备注</label><textarea id="entry-notes" className="control" value={draft.notes} onChange={(event) => patch({ notes: event.target.value })} />{errors.notes && <p role="alert" className="text-sm text-danger">{errors.notes}</p>}</div>
          <CustomFieldsEditor fields={draft.customFields} error={errors.customFields} onChange={(customFields) => patch({ customFields })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={draft.favorite} onChange={(event) => patch({ favorite: event.target.checked })} />收藏此项目</label>
          <div className="flex justify-end gap-3 border-t pt-5"><Button type="button" variant="outline" onClick={requestClose}>取消</Button><Button type="submit" disabled={busy}>保存项目</Button></div>
        </form>}
      </Dialog>
      <ConfirmDialog open={confirmClose} title="放弃未保存修改？" description="当前表单有尚未保存的内容，关闭后这些修改将丢失。" confirmLabel="放弃修改" cancelLabel="继续编辑" destructive onConfirm={() => { setConfirmClose(false); onDirtyChange(false); onClose(); }} onCancel={() => setConfirmClose(false)} />
      <PasswordGeneratorDialog open={generatorOpen} onClose={() => setGeneratorOpen(false)} onUse={(password) => { patch({ password }); setGeneratorOpen(false); }} />
    </>
  );
}
