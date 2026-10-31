export type EntryKind = "login" | "note" | "card" | "identity";
export type Category = "all" | "favorites" | EntryKind;
export type CustomFieldKind = "text" | "password" | "date";

export interface CustomField {
  id: string;
  label: string;
  value: string;
  kind: CustomFieldKind;
}

export interface PasswordHistoryItem {
  id: string;
  password: string;
  changedAt: string;
}

interface BaseEntry {
  id: string;
  title: string;
  favorite: boolean;
  notes: string;
  customFields: CustomField[];
  createdAt: string;
  updatedAt: string;
}

export interface LoginEntry extends BaseEntry {
  kind: "login";
  username: string;
  password: string;
  website: string;
  passwordHistory: PasswordHistoryItem[];
}

export interface NoteEntry extends BaseEntry {
  kind: "note";
  body: string;
}

export interface CardEntry extends BaseEntry {
  kind: "card";
  cardholder: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
  bank: string;
}

export interface IdentityEntry extends BaseEntry {
  kind: "identity";
  identityType: string;
  holder: string;
  documentNumber: string;
  issuedAt: string;
  expiresAt: string;
}

export type VaultEntry = LoginEntry | NoteEntry | CardEntry | IdentityEntry;

export interface EntrySummary {
  id: string;
  kind: EntryKind;
  title: string;
  favorite: boolean;
  summary: string;
  updatedAt: string;
  searchText: string;
}

export interface VaultState {
  entries: EntrySummary[];
  selectedId: string | null;
  category: Category;
  query: string;
  lastDeleted: { entry: EntrySummary; index: number } | null;
}

export type VaultAction =
  | { type: "select"; id: string | null }
  | { type: "set-query"; query: string }
  | { type: "set-category"; category: Category }
  | { type: "upsert"; entry: VaultEntry }
  | { type: "toggle-favorite"; id: string }
  | { type: "remove"; id: string }
  | { type: "undo-delete" }
  | { type: "replace-entries"; entries: EntrySummary[] }
  | { type: "clear-sensitive-view" };
