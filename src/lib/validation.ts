export const DEMO_RECOVERY_KEY = "DEMO-4C7Q-9M2X-6K8P";

export function validateMasterPassword(password: string, confirmation: string): string | null {
  if (password.length < 12) return "请使用至少 12 位的演示主密码";
  if (password !== confirmation) return "两次输入的密码不一致";
  return null;
}

export function isValidDemoRecoveryKey(value: string): boolean {
  return /^DEMO(?:-[A-Z0-9]{4}){3}$/.test(value.trim().toUpperCase());
}
