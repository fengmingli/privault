import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CustomField, CustomFieldKind } from "@/types/vault";

interface CustomFieldsEditorProps {
  fields: CustomField[];
  error?: string;
  onChange: (fields: CustomField[]) => void;
}

export function CustomFieldsEditor({ fields, error, onChange }: CustomFieldsEditorProps) {
  function update(id: string, patch: Partial<CustomField>) {
    onChange(fields.map((field) => field.id === id ? { ...field, ...patch } : field));
  }

  return (
    <section className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between"><h3 className="text-sm font-medium">自定义字段</h3><Button type="button" variant="ghost" size="sm" onClick={() => onChange([...fields, { id: crypto.randomUUID(), label: "", value: "", kind: "text" }])}><Plus className="mr-1 h-4 w-4" />添加自定义字段</Button></div>
      {fields.map((field, index) => (
        <div key={field.id} className="grid grid-cols-[1fr_120px] gap-3 rounded-lg bg-muted p-3">
          <div className="space-y-2"><label className="text-xs text-foreground-muted" htmlFor={`field-label-${field.id}`}>字段名称 {index + 1}</label><input id={`field-label-${field.id}`} className="control h-9 bg-surface" value={field.label} onChange={(event) => update(field.id, { label: event.target.value })} /></div>
          <div className="space-y-2"><label className="text-xs text-foreground-muted" htmlFor={`field-kind-${field.id}`}>类型</label><select id={`field-kind-${field.id}`} className="control h-9 bg-surface" value={field.kind} onChange={(event) => update(field.id, { kind: event.target.value as CustomFieldKind })}><option value="text">文本</option><option value="password">密码</option><option value="date">日期</option></select></div>
          <div className="col-span-2 flex gap-2"><input aria-label={`字段值 ${index + 1}`} type={field.kind === "password" ? "password" : field.kind === "date" ? "date" : "text"} className="control h-9 bg-surface" value={field.value} onChange={(event) => update(field.id, { value: event.target.value })} /><Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label={`删除字段 ${index + 1}`} onClick={() => onChange(fields.filter((item) => item.id !== field.id))}><Trash2 className="h-4 w-4" /></Button></div>
        </div>
      ))}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </section>
  );
}
