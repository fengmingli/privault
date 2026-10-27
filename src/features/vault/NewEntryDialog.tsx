import { Dialog } from "@/components/ui/dialog";
import type { EntryKind } from "@/types/vault";
import { ENTRY_KIND_META } from "./entry-kind";

const descriptions: Record<EntryKind, string> = {
  login: "账号、密码、网站与密码历史",
  note: "保存私人文本与备注",
  card: "银行卡与付款信息",
  identity: "证件号码与有效日期",
};

interface NewEntryDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (kind: EntryKind) => void;
}

export function NewEntryDialog({ open, onClose, onSelect }: NewEntryDialogProps) {
  return (
    <Dialog open={open} title="选择条目类型" onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(descriptions) as EntryKind[]).map((kind) => {
          const { label, icon: Icon } = ENTRY_KIND_META[kind];
          return (
            <button key={kind} type="button" onClick={() => onSelect(kind)} className="rounded-xl border bg-surface p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent">
              <Icon className="mb-3 h-5 w-5 text-primary" aria-hidden="true" />
              <span className="block text-sm font-medium">{label}</span>
              <span className="mt-1 block text-xs leading-5 text-foreground-muted">{descriptions[kind]}</span>
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}
