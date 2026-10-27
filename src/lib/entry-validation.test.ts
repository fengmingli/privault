import { describe, expect, it } from "vitest";
import { createDemoEntries } from "@/data/demo";
import { prepareEntryForSave } from "@/lib/entry-utils";
import { validateEntry } from "@/lib/validation";
import type { LoginEntry, VaultEntry } from "@/types/vault";

function entryOfKind<T extends VaultEntry["kind"]>(kind: T): Extract<VaultEntry, { kind: T }> {
  return createDemoEntries().find((entry): entry is Extract<VaultEntry, { kind: T }> => entry.kind === kind)!;
}

describe("entry validation", () => {
  it("requires a nonempty title of at most 120 characters", () => {
    const entry = entryOfKind("login");
    expect(validateEntry({ ...entry, title: "  " }).title).toBe("请输入标题");
    expect(validateEntry({ ...entry, title: "x".repeat(121) }).title).toBe("标题不能超过 120 个字符");
  });

  it("validates custom-field names, lengths, and duplicates", () => {
    const entry = entryOfKind("login");
    const fields = [
      { id: "a", label: "重复名称", value: "one", kind: "text" as const },
      { id: "b", label: "重复名称", value: "two", kind: "text" as const },
    ];
    expect(validateEntry({ ...entry, customFields: fields }).customFields).toBe("自定义字段名称不能重复");
    expect(validateEntry({ ...entry, customFields: [{ ...fields[0], label: "x".repeat(41) }] }).customFields).toBe("字段名称不能超过 40 个字符");
    expect(validateEntry({ ...entry, customFields: [{ ...fields[0], value: "x".repeat(4001) }] }).customFields).toBe("字段值不能超过 4000 个字符");
  });

  it("validates card expiry and identity date order", () => {
    const card = entryOfKind("card");
    expect(validateEntry({ ...card, expiry: "13/30" }).expiry).toBe("有效期格式应为 MM/YY");
    const identity = entryOfKind("identity");
    expect(validateEntry({ ...identity, issuedAt: "2031-01-01", expiresAt: "2030-01-01" }).identityDates).toBe("到期日期不能早于签发日期");
  });

  it("accepts all valid demo entries", () => {
    for (const entry of createDemoEntries()) expect(validateEntry(entry)).toEqual({});
  });
});

describe("prepareEntryForSave", () => {
  it("archives the previous login password only when it changes", () => {
    const original = entryOfKind("login");
    const now = "2026-10-27T12:00:00.000Z";
    const changed = prepareEntryForSave({ ...original, password: "new-demo-value" }, original, now) as LoginEntry;
    expect(changed.passwordHistory[0].password).toBe(original.password);
    expect(changed.passwordHistory[0].changedAt).toBe(original.updatedAt);
    expect(changed.updatedAt).toBe(now);

    const unchanged = prepareEntryForSave(original, original, now) as LoginEntry;
    expect(unchanged.passwordHistory).toHaveLength(original.passwordHistory.length);
  });
});
