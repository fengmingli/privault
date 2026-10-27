import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, description, confirmLabel, cancelLabel, destructive = false, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Dialog open={open} title={title} onClose={onCancel} className="max-w-md">
      <p className="text-sm leading-6 text-foreground-muted">{description}</p>
      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>{cancelLabel}</Button>
        <Button type="button" variant={destructive ? "destructive" : "default"} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Dialog>
  );
}
