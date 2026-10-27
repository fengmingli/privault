import { useEffect } from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ToastTone = "success" | "error" | "info";
export interface ToastMessage {
  id: string;
  message: string;
  tone: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastProps {
  toast: ToastMessage | null;
  onClose: () => void;
}

export function Toast({ toast, onClose }: ToastProps) {
  useEffect(() => {
    if (!toast || toast.tone === "error" || toast.actionLabel) return;
    const timer = window.setTimeout(onClose, 4000);
    return () => window.clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;
  const Icon = toast.tone === "error" ? XCircle : CheckCircle2;
  return (
    <div role={toast.tone === "error" ? "alert" : "status"} className="fixed bottom-6 right-6 z-50 flex max-w-sm items-center gap-3 rounded-xl border bg-surface-raised px-4 py-3 text-sm shadow-panel animate-slide-up">
      <Icon className={toast.tone === "error" ? "h-4 w-4 shrink-0 text-danger" : "h-4 w-4 shrink-0 text-primary"} aria-hidden="true" />
      <span>{toast.message}</span>
      {toast.actionLabel && <Button type="button" variant="link" size="sm" onClick={toast.onAction}>{toast.actionLabel}</Button>}
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="关闭通知" onClick={onClose}><X className="h-4 w-4" aria-hidden="true" /></Button>
    </div>
  );
}
