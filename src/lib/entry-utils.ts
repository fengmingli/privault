import type { EntryKind, VaultEntry, VaultState } from "@/types/vault";

type SortableEntry = Pick<VaultEntry, "favorite" | "title" | "updatedAt">;

export function compareEntries(a: SortableEntry, b: SortableEntry): number {
  if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
  const dateDifference = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  return dateDifference || a.title.localeCompare(b.title, "zh-CN");
}

export function getEntrySearchText(entry: VaultEntry): string {
  const common = [entry.title, entry.notes];
  if (entry.kind === "login") common.push(entry.username, entry.website);
  if (entry.kind === "note") common.push(entry.body);
  return common.join("\n").toLowerCase();
}

export function toEntrySummary(entry: VaultEntry): import("@/types/vault").EntrySummary {
  return {
    id: entry.id,
    kind: entry.kind,
    title: entry.title,
    favorite: entry.favorite,
    summary: getEntrySummary(entry),
    updatedAt: entry.updatedAt,
    searchText: getEntrySearchText(entry),
  };
}

export function filterAndSortEntries(state: VaultState): import("@/types/vault").EntrySummary[] {
  const query = state.query.trim().toLowerCase();
  return state.entries
    .filter((entry) => state.category !== "favorites" || entry.favorite)
    .filter((entry) => state.category === "all" || state.category === "favorites" || entry.kind === state.category)
    .filter((entry) => !query || `${entry.title}\n${entry.summary}\n${entry.searchText}`.toLowerCase().includes(query))
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

export function prepareEntryForSave(draft: VaultEntry, original: VaultEntry | null, now = new Date().toISOString()): VaultEntry {
  if (draft.kind === "login" && original?.kind === "login" && draft.password !== original.password) {
    return {
      ...draft,
      updatedAt: now,
      passwordHistory: [
        { id: crypto.randomUUID(), password: original.password, changedAt: original.updatedAt },
        ...draft.passwordHistory,
      ],
    };
  }
  return { ...draft, updatedAt: now };
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
