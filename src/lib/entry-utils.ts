import type { EntryKind, VaultEntry, VaultState } from "@/types/vault";

export function compareEntries(a: VaultEntry, b: VaultEntry): number {
  if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
  const dateDifference = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  return dateDifference || a.title.localeCompare(b.title, "zh-CN");
}

function getEntrySearchText(entry: VaultEntry): string {
  const common = [entry.title, entry.notes];
  if (entry.kind === "login") common.push(entry.username, entry.website);
  if (entry.kind === "note") common.push(entry.body);
  return common.join("\n").toLowerCase();
}

export function filterAndSortEntries(state: VaultState): VaultEntry[] {
  const query = state.query.trim().toLowerCase();
  return state.entries
    .filter((entry) => state.category === "all" || entry.kind === state.category)
    .filter((entry) => !query || getEntrySearchText(entry).includes(query))
    .sort(compareEntries);
}

export function getEntrySummary(entry: VaultEntry): string {
  switch (entry.kind) {
    case "login":
      return entry.username || entry.website || "登录信息";
    case "note":
      return entry.body.split("\n")[0] || entry.notes || "安全笔记";
    case "card":
      return `${entry.bank} · **** ${entry.cardNumber.replace(/\s/g, "").slice(-4)}`;
    case "identity":
      return `${entry.identityType} · ${entry.holder}`;
  }
}

export function createEmptyEntry(kind: EntryKind): VaultEntry {
  const now = new Date().toISOString();
  const base = {
    id: crypto.randomUUID(),
    title: "",
    favorite: false,
    notes: "",
    customFields: [],
    createdAt: now,
    updatedAt: now,
  };

  switch (kind) {
    case "login":
      return { ...base, kind, username: "", password: "", website: "", passwordHistory: [] };
    case "note":
      return { ...base, kind, body: "" };
    case "card":
      return { ...base, kind, cardholder: "", cardNumber: "", expiry: "", cvv: "", bank: "" };
    case "identity":
      return { ...base, kind, identityType: "", holder: "", documentNumber: "", issuedAt: "", expiresAt: "" };
  }
}
