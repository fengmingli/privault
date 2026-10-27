import { useState } from "react";
import { Copy, Eye, EyeOff, FileKey, Pencil, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/clipboard";
import type { VaultEntry } from "@/types/vault";
import type { ToastTone } from "@/components/Toast";
import { ENTRY_KIND_META } from "./entry-kind";

interface EntryDetailPaneProps {
  entry: VaultEntry | null;
  onNotify: (message: string, tone: ToastTone) => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}

type CopyHandler = (label: string, value: string) => void;

function TextField({ label, value, onCopy, multiline = false }: { label: string; value: string; onCopy: CopyHandler; multiline?: boolean }) {
  if (!value) return null;
  return (
    <div className="border-b py-4 last:border-0">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-foreground-muted">{label}</span>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onCopy(label, value)}><Copy className="mr-1 h-3.5 w-3.5" aria-hidden="true" />复制{label}</Button>
      </div>
      <p className={multiline ? "whitespace-pre-wrap break-words text-sm leading-6" : "mono break-all text-sm leading-6"}>{value}</p>
    </div>
  );
}

function SecretValue({ label, value, onCopy }: { label: string; value: string; onCopy: CopyHandler }) {
  const [visible, setVisible] = useState(false);
  if (!value) return null;
  return (
    <div className="border-b py-4 last:border-0">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-foreground-muted">{label}</span>
        <div className="flex">
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setVisible((current) => !current)}>{visible ? <EyeOff className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="mr-1 h-3.5 w-3.5" aria-hidden="true" />}{visible ? `隐藏${label}` : `显示${label}`}</Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onCopy(label, value)}><Copy className="mr-1 h-3.5 w-3.5" aria-hidden="true" />复制{label}</Button>
        </div>
      </div>
      <p className="mono break-all text-sm leading-6 tracking-wide">{visible ? value : "••••••••••••"}</p>
    </div>
  );
}

function EntryFields({ entry, onCopy }: { entry: VaultEntry; onCopy: CopyHandler }) {
  switch (entry.kind) {
    case "login":
      return <><TextField label="用户名" value={entry.username} onCopy={onCopy} /><SecretValue label="密码" value={entry.password} onCopy={onCopy} /><TextField label="网站" value={entry.website} onCopy={onCopy} /></>;
    case "note":
      return <TextField label="笔记内容" value={entry.body} onCopy={onCopy} multiline />;
    case "card":
      return <><TextField label="持卡人" value={entry.cardholder} onCopy={onCopy} /><SecretValue label="卡号" value={entry.cardNumber} onCopy={onCopy} /><TextField label="有效期" value={entry.expiry} onCopy={onCopy} /><SecretValue label="安全码" value={entry.cvv} onCopy={onCopy} /><TextField label="发卡行" value={entry.bank} onCopy={onCopy} /></>;
    case "identity":
      return <><TextField label="证件类型" value={entry.identityType} onCopy={onCopy} /><TextField label="持有人" value={entry.holder} onCopy={onCopy} /><SecretValue label="证件号码" value={entry.documentNumber} onCopy={onCopy} /><TextField label="签发日期" value={entry.issuedAt} onCopy={onCopy} /><TextField label="到期日期" value={entry.expiresAt} onCopy={onCopy} /></>;
  }
}

export function EntryDetailPane({ entry, onNotify, onEdit, onDelete, onToggleFavorite }: EntryDetailPaneProps) {
  async function onCopy(label: string, value: string) {
    const copied = await copyText(value);
    onNotify(copied ? `${label}已复制` : "复制失败，请检查系统权限", copied ? "success" : "error");
  }

  if (!entry) {
    return <section aria-label="条目详情" className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-8 text-center"><div><FileKey className="mx-auto mb-4 h-8 w-8 text-foreground-muted" aria-hidden="true" /><h2 className="text-base font-medium">选择一个项目</h2><p className="mt-2 text-sm text-foreground-muted">从列表中选择条目以查看详情。</p></div></section>;
  }

  const { label, icon: Icon } = ENTRY_KIND_META[entry.kind];
  return (
    <section aria-label="条目详情" className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-8 lg:px-10">
        <header className="border-b pb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Icon className="h-5 w-5" aria-hidden="true" /></div>
              <div className="min-w-0">
                <div className="flex items-center gap-2"><h2 className="break-words text-2xl font-semibold tracking-tight">{entry.title}</h2>{entry.favorite && <Star className="h-4 w-4 fill-current text-primary" aria-label="已收藏" />}</div>
                <p className="mt-1.5 text-sm text-foreground-muted">{label} · 更新于 {new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(new Date(entry.updatedAt))}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={onToggleFavorite}><Star className="mr-1 h-4 w-4" aria-hidden="true" />{entry.favorite ? "取消收藏" : "收藏"}</Button>
              <Button type="button" variant="outline" size="sm" onClick={onEdit}><Pencil className="mr-1 h-4 w-4" aria-hidden="true" />编辑</Button>
              <Button type="button" variant="ghost" size="sm" className="text-danger hover:bg-danger/10 hover:text-danger" onClick={onDelete}><Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />删除</Button>
            </div>
          </div>
        </header>
        <div className="py-2"><EntryFields entry={entry} onCopy={onCopy} /></div>
        {entry.customFields.length > 0 && <section className="border-t pt-4"><h3 className="text-sm font-semibold">自定义字段</h3>{entry.customFields.map((field) => field.kind === "password" ? <SecretValue key={`${entry.id}-${field.id}`} label={field.label} value={field.value} onCopy={onCopy} /> : <TextField key={field.id} label={field.label} value={field.value} onCopy={onCopy} />)}</section>}
        {entry.notes && <section className="mt-4 rounded-lg bg-muted p-4"><h3 className="text-xs font-medium text-foreground-muted">备注</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{entry.notes}</p></section>}
        {entry.kind === "login" && entry.passwordHistory.length > 0 && <details className="mt-6 border-t pt-4"><summary className="cursor-pointer text-sm font-medium">密码历史（{entry.passwordHistory.length}）</summary><div className="mt-2">{entry.passwordHistory.map((item, index) => <div key={item.id}><p className="mt-4 text-xs text-foreground-muted">更换于 {new Intl.DateTimeFormat("zh-CN").format(new Date(item.changedAt))}</p><SecretValue label={`历史密码 ${index + 1}`} value={item.password} onCopy={onCopy} /></div>)}</div></details>}
      </div>
    </section>
  );
}
