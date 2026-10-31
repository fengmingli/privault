export const DEMO_RECOVERY_KEY = "DEMO-4C7Q-9M2X-6K8P";

export function getMasterPasswordRuleError(password: string): string | null {
  if (Array.from(password).length < 8) return "主密码至少 8 位";
  const classes = [
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9\s]/.test(password),
  ].filter(Boolean).length;
  if (classes < 3) return "主密码需包含大写、小写、数字、特殊字符中的至少 3 类";
  return null;
}

export function validateMasterPassword(password: string, confirmation: string): string | null {
  const ruleError = getMasterPasswordRuleError(password);
  if (ruleError) return ruleError;
  if (password !== confirmation) return "两次输入的密码不一致";
  return null;
}

export function isValidRecoveryKey(value: string): boolean {
  const normalized = value.replace(/[-\s]/g, "").toUpperCase();
  return normalized.length === 58 && /^[0-9A-HJKMNPQRSTV-Z]+$/.test(normalized);
}

export function isValidDemoRecoveryKey(value: string): boolean {
  return /^DEMO(?:-[A-Z0-9]{4}){3}$/.test(value.trim().toUpperCase());
}

export function validateEntry(entry: import("@/types/vault").VaultEntry): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!entry.title.trim()) errors.title = "请输入标题";
  else if (entry.title.length > 120) errors.title = "标题不能超过 120 个字符";
  if (entry.notes.length > 10000) errors.notes = "备注不能超过 10000 个字符";

  const labels = entry.customFields.map((field) => field.label.trim().toLowerCase());
  if (entry.customFields.some((field) => !field.label.trim())) errors.customFields = "请填写每个自定义字段的名称";
  else if (entry.customFields.some((field) => field.label.length > 40)) errors.customFields = "字段名称不能超过 40 个字符";
  else if (entry.customFields.some((field) => field.value.length > 4000)) errors.customFields = "字段值不能超过 4000 个字符";
  else if (new Set(labels).size !== labels.length) errors.customFields = "自定义字段名称不能重复";

  if (entry.kind === "login") {
    if (entry.username.length > 320) errors.username = "用户名不能超过 320 个字符";
    if (entry.website.length > 2048) errors.website = "网站地址不能超过 2048 个字符";
  }
  if (entry.kind === "card" && entry.expiry && !/^(0[1-9]|1[0-2])\/\d{2}$/.test(entry.expiry)) {
    errors.expiry = "有效期格式应为 MM/YY";
  }
  if (entry.kind === "identity" && entry.issuedAt && entry.expiresAt && entry.expiresAt < entry.issuedAt) {
    errors.identityDates = "到期日期不能早于签发日期";
  }
  return errors;
}
