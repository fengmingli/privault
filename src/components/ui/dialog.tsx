import { useEffect, useId, useRef, type PropsWithChildren } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DialogProps extends PropsWithChildren {
  open: boolean;
  title: string;
  onClose: () => void;
  className?: string;
}

export function Dialog({ open, title, onClose, className, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }} className={cn("fixed inset-0 m-auto w-[92vw] max-w-lg overflow-hidden rounded-xl border bg-surface-raised p-0 text-foreground shadow-panel backdrop:bg-foreground/35", className)}>
      <div className="max-h-[82vh] overflow-y-auto p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-xl font-semibold tracking-tight">{title}</h2>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="关闭对话框" onClick={onClose}><X className="h-4 w-4" aria-hidden="true" /></Button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
