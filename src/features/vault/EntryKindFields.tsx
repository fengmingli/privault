import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VaultEntry } from "@/types/vault";

interface EntryKindFieldsProps {
  entry: VaultEntry;
  errors: Record<string, string>;
  onChange: (patch: Record<string, unknown>) => void;
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return <div className="space-y-2"><label htmlFor={id} className="text-sm font-medium">{label}</label>{children}{error && <p role="alert" className="text-sm text-danger">{error}</p>}</div>;
}

export function EntryKindFields({ entry, errors, onChange }: EntryKindFieldsProps) {
  const [showPassword, setShowPassword] = useState(false);

  if (entry.kind === "note") {
    return <Field id="entry-body" label="笔记内容"><textarea id="entry-body" className="control min-h-32" value={entry.body} onChange={(event) => onChange({ body: event.target.value })} /></Field>;
  }
  if (entry.kind === "card") {
    return <><Field id="entry-cardholder" label="持卡人"><input id="entry-cardholder" className="control" value={entry.cardholder} onChange={(event) => onChange({ cardholder: event.target.value })} /></Field><Field id="entry-card-number" label="卡号"><input id="entry-card-number" className="control mono" value={entry.cardNumber} onChange={(event) => onChange({ cardNumber: event.target.value })} /></Field><div className="grid grid-cols-2 gap-4"><Field id="entry-expiry" label="有效期" error={errors.expiry}><input id="entry-expiry" className="control mono" placeholder="MM/YY" value={entry.expiry} onChange={(event) => onChange({ expiry: event.target.value })} /></Field><Field id="entry-cvv" label="安全码"><input id="entry-cvv" type="password" className="control mono" value={entry.cvv} onChange={(event) => onChange({ cvv: event.target.value })} /></Field></div><Field id="entry-bank" label="发卡行"><input id="entry-bank" className="control" value={entry.bank} onChange={(event) => onChange({ bank: event.target.value })} /></Field></>;
  }
  if (entry.kind === "identity") {
    return <><Field id="entry-identity-type" label="证件类型"><input id="entry-identity-type" className="control" value={entry.identityType} onChange={(event) => onChange({ identityType: event.target.value })} /></Field><Field id="entry-holder" label="持有人"><input id="entry-holder" className="control" value={entry.holder} onChange={(event) => onChange({ holder: event.target.value })} /></Field><Field id="entry-document-number" label="证件号码"><input id="entry-document-number" type="password" className="control mono" value={entry.documentNumber} onChange={(event) => onChange({ documentNumber: event.target.value })} /></Field><div className="grid grid-cols-2 gap-4"><Field id="entry-issued-at" label="签发日期"><input id="entry-issued-at" type="date" className="control" value={entry.issuedAt} onChange={(event) => onChange({ issuedAt: event.target.value })} /></Field><Field id="entry-expires-at" label="到期日期" error={errors.identityDates}><input id="entry-expires-at" type="date" className="control" value={entry.expiresAt} onChange={(event) => onChange({ expiresAt: event.target.value })} /></Field></div></>;
  }
  return <><Field id="entry-username" label="用户名" error={errors.username}><input id="entry-username" className="control" value={entry.username} onChange={(event) => onChange({ username: event.target.value })} /></Field><Field id="entry-password" label="密码"><div className="relative"><input id="entry-password" type={showPassword ? "text" : "password"} className="control pr-11" value={entry.password} onChange={(event) => onChange({ password: event.target.value })} /><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 h-8 w-8" aria-label={showPassword ? "隐藏输入密码" : "显示输入密码"} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button></div></Field><Field id="entry-website" label="网站" error={errors.website}><input id="entry-website" className="control" value={entry.website} onChange={(event) => onChange({ website: event.target.value })} /></Field></>;
}
