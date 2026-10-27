import type { VaultEntry } from "@/types/vault";

const DEMO_ENTRIES: VaultEntry[] = [
  {
    id: "note-door",
    kind: "note",
    title: "演示门禁笔记",
    favorite: false,
    body: "门禁演示编号：0000。\n此内容仅用于 UI 原型。",
    notes: "不要在此输入真实门禁信息。",
    customFields: [],
    createdAt: "2026-10-20T08:00:00.000Z",
    updatedAt: "2026-10-25T08:00:00.000Z",
  },
  {
    id: "card-demo",
    kind: "card",
    title: "演示银行卡",
    favorite: false,
    cardholder: "演示用户",
    cardNumber: "0000 0000 0000 0000",
    expiry: "01/30",
    cvv: "000",
    bank: "演示银行",
    notes: "虚构银行卡，仅用于展示字段布局。",
    customFields: [],
    createdAt: "2026-10-21T08:00:00.000Z",
    updatedAt: "2026-10-26T08:00:00.000Z",
  },
  {
    id: "login-github",
    kind: "login",
    title: "示例 GitHub",
    favorite: true,
    username: "demo@example.com",
    password: "Demo-Not-A-Real-Password",
    website: "https://example.com",
    notes: "仅用于界面演示的虚构账号。",
    customFields: [
      { id: "field-backup", label: "备用邮箱", value: "demo@example.com", kind: "text" },
      { id: "field-answer", label: "安全问题", value: "演示答案", kind: "password" },
    ],
    passwordHistory: [
      { id: "history-demo", password: "Old-Demo-Password", changedAt: "2026-09-01T08:00:00.000Z" },
    ],
    createdAt: "2026-09-01T08:00:00.000Z",
    updatedAt: "2026-10-20T08:00:00.000Z",
  },
  {
    id: "identity-demo",
    kind: "identity",
    title: "示例证件",
    favorite: false,
    identityType: "演示证件",
    holder: "演示用户",
    documentNumber: "000000000000000000",
    issuedAt: "2020-01-01",
    expiresAt: "2030-01-01",
    notes: "虚构证件信息，不对应任何真实个人。",
    customFields: [],
    createdAt: "2026-10-22T08:00:00.000Z",
    updatedAt: "2026-10-27T08:00:00.000Z",
  },
];

export function createDemoEntries(): VaultEntry[] {
  return structuredClone(DEMO_ENTRIES);
}
