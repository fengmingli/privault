import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PasswordInput } from "@/components/ui/password-input";
import { validateMasterPassword } from "@/lib/validation";
import type { VaultGateway } from "@/lib/vault-client";

interface ChangePasswordDialogProps {
  open: boolean;
  gateway: VaultGateway;
  onClose: () => void;
  onRequireUnlock: () => void;
}

export function ChangePasswordDialog({ open, gateway, onClose, onRequireUnlock }: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const validationError = validateMasterPassword(newPassword, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }
    const submittedCurrentPassword = currentPassword;
    setCurrentPassword("");
    setBusy(true);
    setError("");
    try {
      await gateway.changeMasterPassword(submittedCurrentPassword, newPassword);
      setNewPassword("");
      setConfirmation("");
      setSucceeded(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法修改主密码");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} title="修改主密码" onClose={succeeded ? onRequireUnlock : onClose} closeDisabled={busy} className="max-w-md">
      {succeeded ? (
        <div className="space-y-5">
          <p role="status" className="rounded-lg bg-accent p-3 text-sm leading-6 text-accent-foreground">主密码已修改，请使用新主密码解锁</p>
          <Button type="button" className="w-full" onClick={onRequireUnlock}>返回解锁</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <p className="text-sm leading-6 text-foreground-muted">验证当前主密码后设置新密码。修改成功后需要重新解锁。</p>
          <div className="space-y-2">
            <label htmlFor="change-current-password" className="text-sm font-medium">当前主密码</label>
            <PasswordInput id="change-current-password" value={currentPassword} onChange={(event) => { setCurrentPassword(event.target.value); setError(""); }} visibilityLabel="当前主密码" autoFocus disabled={busy} />
          </div>
          <div className="space-y-2">
            <label htmlFor="change-new-password" className="text-sm font-medium">新主密码</label>
            <PasswordInput id="change-new-password" value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setError(""); }} visibilityLabel="新主密码" disabled={busy} />
            <p className="text-xs leading-5 text-foreground-muted">至少 8 位，包含大写、小写、数字、特殊字符中的至少 3 类。</p>
          </div>
          <div className="space-y-2">
            <label htmlFor="change-confirm-password" className="text-sm font-medium">确认新主密码</label>
            <PasswordInput id="change-confirm-password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setError(""); }} visibilityLabel="确认新主密码" disabled={busy} />
          </div>
          {error && <p role="alert" className="text-sm leading-5 text-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || !currentPassword || !newPassword || !confirmation}>{busy ? "正在修改…" : "确认修改"}</Button>
        </form>
      )}
    </Dialog>
  );
}
