import { useState } from "react";
import { Copy, RefreshCw, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { copyText } from "@/lib/clipboard";
import { DEFAULT_GENERATOR_OPTIONS, estimatePasswordStrength, generatePassword, getGeneratorAlphabet, type GeneratorOptions } from "@/lib/password-generator";

interface PasswordGeneratorDialogProps {
  open: boolean;
  onClose: () => void;
  onUse?: (password: string) => void;
}

export function PasswordGeneratorDialog({ open, ...props }: PasswordGeneratorDialogProps) {
  if (!open) return null;
  return <GeneratorContent {...props} />;
}

function GeneratorContent({ onClose, onUse }: Omit<PasswordGeneratorDialogProps, "open">) {
  const [options, setOptions] = useState<GeneratorOptions>(DEFAULT_GENERATOR_OPTIONS);
  const [password, setPassword] = useState(() => generatePassword(DEFAULT_GENERATOR_OPTIONS));
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  function update(patch: Partial<GeneratorOptions>) {
    const next = { ...options, ...patch };
    setOptions(next);
    setCopyStatus("");
    if (!getGeneratorAlphabet(next)) {
      setError("至少选择一种字符类型");
      setPassword("");
      return;
    }
    setError("");
    setPassword(generatePassword(next));
  }

  async function copy() {
    const copied = await copyText(password);
    setCopyStatus(copied ? "密码已复制" : "复制失败，请检查系统权限");
  }

  const strength = getGeneratorAlphabet(options) ? estimatePasswordStrength(options) : null;
  return (
    <Dialog open title="密码生成器" onClose={onClose} className="max-w-xl">
      <div className="space-y-6">
        <div className="rounded-xl border bg-background p-4">
          <div className="flex items-start gap-3"><WandSparkles className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><output aria-label="生成的密码" className="mono break-all text-sm leading-6">{password || "请至少选择一种字符类型"}</output></div>
          {strength && <p className="mt-3 text-xs text-foreground-muted">强度：{strength.label} · 约 {strength.bits} 位熵</p>}
        </div>
        <div className="space-y-2">
          <div className="flex justify-between"><label htmlFor="generator-length" className="text-sm font-medium">密码长度</label><output className="mono text-sm">{options.length}</output></div>
          <input id="generator-length" type="range" min="12" max="64" value={options.length} onChange={(event) => update({ length: Number(event.target.value) })} className="w-full accent-primary" />
          <div className="flex justify-between text-xs text-foreground-muted"><span>12</span><span>64</span></div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {([["uppercase", "大写字母"], ["lowercase", "小写字母"], ["numbers", "数字"], ["symbols", "符号"]] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-primary" checked={options[key]} onChange={(event) => update({ [key]: event.target.checked })} />{label}</label>)}
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={options.excludeAmbiguous} onChange={(event) => update({ excludeAmbiguous: event.target.checked })} />排除易混淆字符（Il1O0o）</label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {copyStatus && <p role="status" className="text-sm text-foreground-muted">{copyStatus}</p>}
        <div className="flex flex-wrap justify-end gap-3 border-t pt-5">
          <Button type="button" variant="outline" onClick={() => update({})} disabled={!getGeneratorAlphabet(options)}><RefreshCw className="mr-2 h-4 w-4" />重新生成</Button>
          <Button type="button" variant="outline" onClick={copy} disabled={!password}><Copy className="mr-2 h-4 w-4" />复制</Button>
          {onUse && <Button type="button" disabled={!password} onClick={() => { onUse(password); onClose(); }}>填入密码</Button>}
        </div>
      </div>
    </Dialog>
  );
}
