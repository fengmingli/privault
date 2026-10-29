import { describe, expect, it } from "vitest";
import { createDemoEntries } from "@/data/demo";
import { createEmptyEntry, toEntrySummary } from "@/lib/entry-utils";
import { createInitialVaultState, vaultReducer } from "@/state/vault-reducer";

describe("vaultReducer", () => {
  it("updates query, category, and selection", () => {
    const initial = createInitialVaultState();
    const queried = vaultReducer(initial, { type: "set-query", query: "demo" });
    const categorized = vaultReducer(queried, { type: "set-category", category: "note" });
    const selected = vaultReducer(categorized, { type: "select", id: "note-door" });
    expect(selected).toMatchObject({ query: "demo", category: "note", selectedId: "note-door" });
    expect(initial.query).toBe("");
  });

  it("adds a new entry and selects it", () => {
    const initial = createInitialVaultState();
    const entry = createEmptyEntry("note");
    const next = vaultReducer(initial, { type: "upsert", entry });
    expect(next.entries).toHaveLength(initial.entries.length + 1);
    expect(next.selectedId).toBe(entry.id);
  });

  it("replaces an existing entry by id", () => {
    const initial = createInitialVaultState();
    const original = createDemoEntries()[0];
    const next = vaultReducer(initial, { type: "upsert", entry: { ...original, title: "更新后的演示标题" } });
    expect(next.entries).toHaveLength(initial.entries.length);
    expect(next.entries.find((entry) => entry.id === original.id)?.title).toBe("更新后的演示标题");
  });

  it("toggles favorite without mutating the previous state", () => {
    const initial = createInitialVaultState();
    const target = initial.entries[0];
    const next = vaultReducer(initial, { type: "toggle-favorite", id: target.id });
    expect(next.entries[0].favorite).toBe(!target.favorite);
    expect(initial.entries[0].favorite).toBe(target.favorite);
  });

  it("deletes and restores the same entry at its original index", () => {
    const initial = createInitialVaultState();
    const target = initial.entries[1];
    const removed = vaultReducer(initial, { type: "remove", id: target.id });
    expect(removed.entries).toHaveLength(initial.entries.length - 1);
    expect(removed.lastDeleted?.entry.id).toBe(target.id);

    const restored = vaultReducer(removed, { type: "undo-delete" });
    expect(restored.entries[1]).toEqual(target);
    expect(restored.selectedId).toBe(target.id);
    expect(restored.lastDeleted).toBeNull();
  });

  it("clears search, selection, and deletion history on lock", () => {
    const populated = createInitialVaultState();
    const removed = vaultReducer(populated, { type: "remove", id: populated.entries[0].id });
    const initial = { ...removed, query: "secret" };
    const cleared = vaultReducer(initial, { type: "clear-sensitive-view" });
    expect(cleared.query).toBe("");
    expect(cleared.selectedId).toBeNull();
    expect(cleared.lastDeleted).toBeNull();
    expect(cleared.entries).toBe(initial.entries);
  });

  it("replaces demo entries from a gateway and selects the first visible entry", () => {
    const initial = createInitialVaultState([]);
    const entries = createDemoEntries();
    const next = vaultReducer(initial, { type: "replace-entries", entries: entries.map(toEntrySummary) });
    expect(next.entries).toHaveLength(4);
    expect(next.selectedId).toBe("login-github");
  });
});
