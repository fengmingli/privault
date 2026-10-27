import { createDemoEntries } from "@/data/demo";
import { filterAndSortEntries } from "@/lib/entry-utils";
import type { VaultEntry, VaultState, VaultAction } from "@/types/vault";

export function createInitialVaultState(entries?: VaultEntry[]): VaultState {
  const initial: VaultState = {
    entries: entries ?? createDemoEntries(),
    selectedId: null,
    category: "all",
    query: "",
    lastDeleted: null,
  };
  return { ...initial, selectedId: filterAndSortEntries(initial)[0]?.id ?? null };
}

export function vaultReducer(state: VaultState, action: VaultAction): VaultState {
  switch (action.type) {
    case "select":
      return { ...state, selectedId: action.id };
    case "set-query":
      return { ...state, query: action.query };
    case "set-category":
      return { ...state, category: action.category };
    case "upsert": {
      const exists = state.entries.some((entry) => entry.id === action.entry.id);
      return {
        ...state,
        entries: exists
          ? state.entries.map((entry) => (entry.id === action.entry.id ? action.entry : entry))
          : [...state.entries, action.entry],
        selectedId: action.entry.id,
        lastDeleted: null,
      };
    }
    case "toggle-favorite":
      return {
        ...state,
        entries: state.entries.map((entry) =>
          entry.id === action.id ? { ...entry, favorite: !entry.favorite } : entry,
        ),
      };
    case "remove": {
      const index = state.entries.findIndex((entry) => entry.id === action.id);
      if (index < 0) return state;
      const entry = state.entries[index];
      const entries = state.entries.filter((item) => item.id !== action.id);
      const next = { ...state, entries, lastDeleted: { entry, index } };
      return {
        ...next,
        selectedId: state.selectedId === action.id ? filterAndSortEntries(next)[0]?.id ?? null : state.selectedId,
      };
    }
    case "undo-delete": {
      if (!state.lastDeleted) return state;
      const entries = [...state.entries];
      const index = Math.min(state.lastDeleted.index, entries.length);
      entries.splice(index, 0, state.lastDeleted.entry);
      return { ...state, entries, selectedId: state.lastDeleted.entry.id, lastDeleted: null };
    }
    case "clear-sensitive-view":
      return { ...state, query: "", selectedId: null, lastDeleted: null };
  }
}
