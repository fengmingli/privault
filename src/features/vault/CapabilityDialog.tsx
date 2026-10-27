import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export type Capability = "import" | "export" | "native-security";

const content: Record<Capability, { title: string; body: string }> = {
  import: { title: "导入保险库", body: "导入功能尚未接入安全核心，不会选择、读取或修改任何文件。" },
  export: { title: "导出保险库", body: "导出功能尚未接入安全核心，不会创建或写入任何文件。" },
  "native-security": { title: "原生安全能力", body: "剪贴板定时清理与系统休眠锁定需要 Rust 和操作系统能力，当前仅展示偏好设置，不提供安全保证。" },
};

interface CapabilityDialogProps {
  open: boolean;
  capability: Capability;
  onClose: () => void;
}

export function CapabilityDialog({ open, capability, onClose }: CapabilityDialogProps) {
  const current = content[capability];
  return (
    <Dialog open={open} title={current.title} onClose={onClose} className="max-w-md">
      <p className="text-sm leading-6 text-foreground-muted">{current.body}</p>
      <p className="mt-3 rounded-lg bg-muted p-3 text-xs leading-5 text-foreground-muted">真实数据迁移与原生安全能力将在后续独立阶段实现。</p>
      <Button type="button" className="mt-6 w-full" onClick={onClose}>我知道了</Button>
    </Dialog>
  );
}
