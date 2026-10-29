import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { AutoLockMinutes, ClipboardSeconds, ThemePreference, UiSettings } from "@/lib/settings";
import type { Capability } from "./CapabilityDialog";
import type { VaultGateway } from "@/lib/vault-client";
import { StorageLocationCard } from "./StorageLocationCard";

interface SettingsDialogProps {
  open: boolean;
  settings: UiSettings;
  onChange: (patch: Partial<UiSettings>) => void;
  onClose: () => void;
  onCapability: (capability: Capability) => void;
  gateway: VaultGateway;
  onMigrationActiveChange: (active: boolean) => void;
  onRequireUnlock: () => void;
}

export function SettingsDialog({ open, settings, onChange, onClose, onCapability, gateway, onMigrationActiveChange, onRequireUnlock }: SettingsDialogProps) {
  return (
    <Dialog open={open} title="设置" onClose={onClose} className="max-w-xl">
      <div className="space-y-6">
        <section className="space-y-3"><h3 className="text-sm font-semibold">外观</h3><div role="radiogroup" aria-label="外观主题" className="grid grid-cols-3 gap-2">{(["light", "dark", "system"] as ThemePreference[]).map((theme) => <label key={theme} className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="radio" name="theme" value={theme} checked={settings.theme === theme} onChange={() => onChange({ theme })} className="h-4 w-4 accent-primary" />{theme === "light" ? "浅色" : theme === "dark" ? "深色" : "跟随系统"}</label>)}</div></section>
        <section className="space-y-4 border-t pt-5"><h3 className="text-sm font-semibold">锁定与剪贴板</h3><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label htmlFor="auto-lock" className="text-sm font-medium">自动锁定</label><select id="auto-lock" className="control" value={settings.autoLockMinutes} onChange={(event) => onChange({ autoLockMinutes: Number(event.target.value) as AutoLockMinutes })}><option value="1">1 分钟</option><option value="5">5 分钟</option><option value="15">15 分钟</option></select></div><div className="space-y-2"><label htmlFor="clipboard-seconds" className="text-sm font-medium">剪贴板倒计时</label><select id="clipboard-seconds" className="control" value={settings.clipboardSeconds} onChange={(event) => onChange({ clipboardSeconds: Number(event.target.value) as ClipboardSeconds })}><option value="15">15 秒</option><option value="30">30 秒</option><option value="60">60 秒</option></select></div></div><button type="button" onClick={() => onCapability("native-security")} className="flex w-full items-center justify-between rounded-lg bg-muted p-3 text-left text-xs text-foreground-muted"><span>原生剪贴板清理与系统休眠锁定</span><span className="ml-3 rounded-full border px-2 py-1">待接入安全核心</span></button></section>
        <section className="space-y-3 border-t pt-5"><h3 className="text-sm font-semibold">存储位置</h3><StorageLocationCard gateway={gateway} onMigrationActiveChange={onMigrationActiveChange} onRequireUnlock={onRequireUnlock} /></section>
        <section className="space-y-3 border-t pt-5"><h3 className="text-sm font-semibold">数据迁移</h3><p className="text-xs leading-5 text-foreground-muted">当前仅展示迁移入口，不会选择或写入真实文件。</p><div className="grid grid-cols-2 gap-3"><Button type="button" variant="outline" onClick={() => onCapability("import")}><Upload className="mr-2 h-4 w-4" />导入保险库</Button><Button type="button" variant="outline" onClick={() => onCapability("export")}><Download className="mr-2 h-4 w-4" />导出保险库</Button></div></section>
      </div>
    </Dialog>
  );
}
