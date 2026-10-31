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

export function isValidCardNumber(value: string): boolean {
  const digits = value.replace(/ /g, "");
  if (!/^\d{12,19}$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

export function isValidExpiry(value: string, now = new Date()): boolean {
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return year > currentYear || (year === currentYear && month >= currentMonth);
}

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

export function validateEntry(entry: import("@/types/vault").VaultEntry, now = new Date()): Record<string, string> {
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
    if (!entry.username.trim()) errors.username = "请输入用户名";
    else if (Array.from(entry.username).length > 320) errors.username = "用户名不能超过 320 个字符";
    if (!entry.password) errors.password = "请输入密码";
    else if (Array.from(entry.password).length > 4096) errors.password = "密码不能超过 4096 个字符";
    if (entry.website.length > 2048) errors.website = "网站地址不能超过 2048 个字符";
  }
  if (entry.kind === "note") {
    if (!entry.body.trim()) errors.body = "请输入笔记内容";
    else if (Array.from(entry.body).length > 10000) errors.body = "笔记内容不能超过 10000 个字符";
  }
  if (entry.kind === "card") {
    if (!entry.cardNumber.trim()) errors.cardNumber = "请输入卡号";
    else if (!isValidCardNumber(entry.cardNumber)) errors.cardNumber = "卡号格式不正确";
    if (!entry.expiry) errors.expiry = "请输入有效期";
    else if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(entry.expiry)) errors.expiry = "有效期格式应为 MM/YY";
    else if (!isValidExpiry(entry.expiry, now)) errors.expiry = "有效期不能早于当前月份";
    if (!entry.cvv) errors.cvv = "请输入安全码";
    else if (!/^\d{3,4}$/.test(entry.cvv)) errors.cvv = "安全码应为 3-4 位数字";
  }
  if (entry.kind === "identity") {
    if (!entry.documentNumber.trim()) errors.documentNumber = "请输入证件号码";
    if (entry.issuedAt && !isValidIsoDate(entry.issuedAt)) errors.issuedAt = "日期格式应为 YYYY-MM-DD";
    if (entry.expiresAt && !isValidIsoDate(entry.expiresAt)) errors.expiresAt = "日期格式应为 YYYY-MM-DD";
    if (entry.issuedAt && entry.expiresAt && isValidIsoDate(entry.issuedAt) && isValidIsoDate(entry.expiresAt) && entry.expiresAt < entry.issuedAt) {
      errors.identityDates = "到期日期不能早于签发日期";
    }
  }
  return errors;
}
