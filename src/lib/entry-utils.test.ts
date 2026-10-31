import { describe, expect, it } from "vitest";
import { createDemoEntries } from "@/data/demo";
import { compareEntries, createEmptyEntry, filterAndSortEntries, getEntrySummary } from "@/lib/entry-utils";
import { createInitialVaultState } from "@/state/vault-reducer";

describe("demo entries", () => {
  it("returns independent copies of fictitious data", () => {
    const first = createDemoEntries();
    first[0].title = "changed";
    expect(createDemoEntries()[0].title).not.toBe("changed");
    expect(first).toHaveLength(4);
  });

  it.each(["login", "note", "card", "identity"] as const)("creates an empty %s entry", (kind) => {
    const entry = createEmptyEntry(kind);
    expect(entry.kind).toBe(kind);
    expect(entry.id).not.toBe("");
    expect(entry.title).toBe("");
    expect(entry.customFields).toEqual([]);
    expect(Date.parse(entry.createdAt)).not.toBeNaN();
  });
});

describe("entry utilities", () => {
  it("combines category filtering with case-insensitive search", () => {
    const state = createInitialVaultState();
    const filtered = filterAndSortEntries({ ...state, category: "login", query: "GITHUB" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe("示例 GitHub");
  });

  it("filters only favorite entries and still applies search", () => {
    const state = createInitialVaultState();
    const favorites = filterAndSortEntries({ ...state, category: "favorites" });
    expect(favorites.every((entry) => entry.favorite)).toBe(true);
    expect(filterAndSortEntries({ ...state, category: "favorites", query: "github" })).toHaveLength(1);
  });

  it("matches secure-note body text", () => {
    const state = createInitialVaultState();
    const filtered = filterAndSortEntries({ ...state, query: "门禁演示编号" });
    expect(filtered.map((entry) => entry.id)).toEqual(["note-door"]);
  });

  it("sorts favorites first and then most recently updated", () => {
    const sorted = filterAndSortEntries({ ...createInitialVaultState(), query: "" });
    expect(sorted.map((entry) => entry.id)).toEqual(["login-github", "identity-demo", "card-demo", "note-door"]);
  });

  it("does not mutate entries while comparing them", () => {
    const [first, second] = createDemoEntries();
    const snapshot = structuredClone([first, second]);
    expect(() => compareEntries(first, second)).not.toThrow();
    expect([first, second]).toEqual(snapshot);
  });

  it("creates a concise summary for each entry kind", () => {
    const summaries = Object.fromEntries(createDemoEntries().map((entry) => [entry.kind, getEntrySummary(entry)]));
    expect(summaries.login).toBe("demo@example.com");
    expect(summaries.note).toContain("门禁演示编号");
    expect(summaries.card).toBe("演示银行 · **** 0000");
    expect(summaries.identity).toBe("演示证件 · 演示用户");
  });
});
