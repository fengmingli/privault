# Privault Favorites and Core Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete favorites view and enforce the approved core-field rules in both the frontend editor and Rust persistence boundary.

**Architecture:** Extend the existing `favorite` flag into a dedicated `favorites` category, reusing current summary persistence and selection behavior. Centralize core validation in the existing frontend `validateEntry` and Rust `validate_entry`, with deterministic Luhn/date helpers and field-level errors.

**Tech Stack:** React 19, TypeScript, Vitest/Testing Library, Rust, SQLCipher, Playwright, Appium Mac2/WebdriverIO.

## Global Constraints

- `Category = "all" | "favorites" | EntryKind`; no schema migration is required.
- Login username/password and note body are required; card number uses 12–19 digits plus Luhn, expiry is `MM/YY` and not before the current month, CVV is 3–4 digits; identity document number is required and dates must be valid/ordered.
- Other fields remain optional. Master-password policy is unchanged.
- Frontend and Rust use Unicode code-point lengths and the same user-facing rules; invalid entries never reach SQLCipher.
- Preserve `main`, no subagents, no Windows verification claim, and record changes in `docs/development-process.md`.

---

### Task 1: Independent Favorites Feature

**Files:**
- Modify: `src/types/vault.ts`
- Modify: `src/features/vault/entry-kind.ts`
- Modify: `src/features/vault/VaultSidebar.tsx`
- Modify: `src/lib/entry-utils.ts`
- Modify: `src/lib/entry-utils.test.ts`
- Modify: `src/features/vault/EntryListPane.tsx`
- Modify: `src/features/vault/VaultWorkspace.tsx`
- Modify: `src/features/vault/VaultWorkspace.test.tsx`

**Interfaces:**
- Produces `Category = "all" | "favorites" | EntryKind`.
- `VaultSidebar` computes favorites count separately from kind counts.
- `filterAndSortEntries` applies favorite filtering before query filtering.
- `EntryListPane` accepts `category: Category` and shows `还没有收藏项目` for a favorites empty state without a search query.

- [ ] **Step 1: Write failing favorites tests**

In `src/lib/entry-utils.test.ts`, add:

```ts
it("filters only favorite entries and still applies search", () => {
  const state = createInitialVaultState();
  const favorites = filterAndSortEntries({ ...state, category: "favorites" });
  expect(favorites.every((entry) => entry.favorite)).toBe(true);
  expect(filterAndSortEntries({ ...state, category: "favorites", query: "github" })).toHaveLength(1);
});
```

In `VaultWorkspace.test.tsx`, add a test that opens `收藏 1`, verifies only `示例 GitHub`, clicks `取消收藏`, and asserts that `还没有收藏项目` and `收藏 0` appear while other entries remain in `全部项目`.

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm test -- src/lib/entry-utils.test.ts src/features/vault/VaultWorkspace.test.tsx`
Expected: FAIL because `favorites` has no category/filter/empty state.

- [ ] **Step 3: Implement the independent category**

Use `Star` from Lucide and insert `{ id: "favorites", label: "收藏", icon: Star }` after `all` in `CATEGORIES`. Extend `Category` in `src/types/vault.ts`.

In `VaultSidebar`, use:

```ts
const count = id === "all"
  ? entries.length
  : id === "favorites"
    ? entries.filter((entry) => entry.favorite).length
    : entries.filter((entry) => entry.kind === id).length;
```

In `filterAndSortEntries`, add a favorite predicate before the existing kind predicate:

```ts
.filter((entry) => state.category !== "favorites" || entry.favorite)
```

Pass `category={state.category}` into `EntryListPane`, and select the favorites empty text only when `category === "favorites" && entries.length === 0 && totalCount > 0 && !query.trim()`. Keep the current truly-empty-vault and no-search-result messages for other categories.

- [ ] **Step 4: Run focused verification**

Run: `npm test -- src/lib/entry-utils.test.ts src/features/vault/VaultWorkspace.test.tsx && npm run lint`
Expected: favorites tests and existing workspace tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/types/vault.ts src/features/vault src/lib/entry-utils.ts src/lib/entry-utils.test.ts
git commit -m "feat: add independent favorites view"
```

---

### Task 2: Frontend Core Validation and Editor Errors

**Files:**
- Modify: `src/lib/validation.ts`
- Modify: `src/lib/entry-validation.test.ts`
- Modify: `src/features/vault/EntryKindFields.tsx`
- Modify: `src/features/vault/EntryEditorDialog.test.tsx`

**Interfaces:**
- `validateEntry(entry, now = new Date())` returns field errors.
- `isValidCardNumber(value)` and `isValidExpiry(value, now)` are exported for deterministic unit tests.
- `EntryKindFields` displays `password`, `body`, `cardNumber`, `cvv`, `documentNumber`, `issuedAt`, `expiresAt`, and existing errors.

- [ ] **Step 1: Write failing core validation tests**

In `src/lib/entry-validation.test.ts`, add tests for:

```ts
const now = new Date("2026-10-31T00:00:00Z");

expect(validateEntry({ ...login, username: " " }).username).toBe("请输入用户名");
expect(validateEntry({ ...login, password: "" }).password).toBe("请输入密码");
expect(validateEntry({ ...note, body: "  " }).body).toBe("请输入笔记内容");
expect(validateEntry({ ...card, cardNumber: "1234 5678 9012" }).cardNumber).toBe("卡号格式不正确");
expect(validateEntry({ ...card, expiry: "09/26" }, now).expiry).toBe("有效期不能早于当前月份");
expect(validateEntry({ ...card, cvv: "12" }).cvv).toBe("安全码应为 3-4 位数字");
expect(validateEntry({ ...identity, documentNumber: " " }).documentNumber).toBe("请输入证件号码");
expect(validateEntry({ ...identity, issuedAt: "2026-02-30" }).issuedAt).toBe("日期格式应为 YYYY-MM-DD");
```

Also assert that a card with number `0000 0000 0000 0000`, expiry `10/26`, and CVV `000` is accepted, and every existing demo entry remains valid. In `EntryEditorDialog.test.tsx`, add a card test asserting the card-number/CVV errors are visible and `onSave` is not called.

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm test -- src/lib/entry-validation.test.ts src/features/vault/EntryEditorDialog.test.tsx`
Expected: FAIL on missing rules and missing field errors.

- [ ] **Step 3: Implement deterministic frontend rules**

Use `Array.from(value).length` for new length checks. Add:

```ts
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
```

`isValidExpiry` requires the existing `MM/YY` shape, then compares `(year, month)` with the injected current year/month; the current month is valid. ISO date checks require both the string shape and a real calendar date. Add required username/password/body/documentNumber and CVV rules, preserving all existing rules. Use field messages matching the tests and the approved design.

Map those errors into `EntryKindFields` using each `Field` component's `error` prop, including login password, note body, card number/CVV, and identity document/date fields.

- [ ] **Step 4: Run focused verification**

Run: `npm test -- src/lib/entry-validation.test.ts src/features/vault/EntryEditorDialog.test.tsx && npm run lint`
Expected: all validation and editor tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation.ts src/lib/entry-validation.test.ts src/features/vault/EntryKindFields.tsx src/features/vault/EntryEditorDialog.test.tsx
git commit -m "feat: validate core entry fields in editor"
```

---

### Task 3: Rust Core Validation at Persistence Boundary

**Files:**
- Modify: `src-tauri/src/vault/entries.rs`
- Modify: `src-tauri/tests/storage.rs`

**Interfaces:**
- Extends existing `validate_entry(&VaultEntry) -> VaultResult<()>` with the same core rules.
- Uses `chrono::{Datelike, NaiveDate, Utc}` for current-month and real-date checks. Existing `ErrorCode::InvalidInput` is retained.

- [ ] **Step 1: Write failing persistence tests**

In `src-tauri/tests/storage.rs`, update the `populated` card fixture with `card.cvv = "000".into()`, then add:

```rust
#[test]
fn rejects_invalid_core_entry_fields() {
    let dir = tempfile::TempDir::new().unwrap();
    let path = dir.path().join("vault.db");
    let mut db = open_database(&path, &Dek::new_for_test()).unwrap();

    let mut login = populated(EntryKind::Login);
    login.username = " ".into();
    assert!(upsert_entry(&mut db, login).is_err());

    let mut note = populated(EntryKind::Note);
    note.body = "  ".into();
    assert!(upsert_entry(&mut db, note).is_err());

    let mut card = populated(EntryKind::Card);
    card.card_number = "1234 5678 9012".into();
    assert!(upsert_entry(&mut db, card).is_err());

    let mut identity = populated(EntryKind::Identity);
    identity.document_number = " ".into();
    assert!(upsert_entry(&mut db, identity).is_err());
}
```

Add separate tests for an expired card and invalid identity date, then upsert a fully populated card and assert success.

- [ ] **Step 2: Run tests and confirm RED**

Run: `cd src-tauri && cargo test --test storage rejects_invalid_core_entry_fields`
Expected: FAIL because username/body/card/document rules are not enforced.

- [ ] **Step 3: Implement Rust validation and helpers**

In `src-tauri/src/vault/entries.rs`, add small private helpers:

- `luhn_valid(digits: &str) -> bool` using the same right-to-left doubling rule as the frontend.
- `expiry_valid(value: &str, current_year: i32, current_month: u32) -> bool` requiring exact `MM/YY` and comparing year/month.
- `iso_date_valid(value: &str) -> bool` using `NaiveDate::parse_from_str(value, "%Y-%m-%d")`.

Add required login username/password and note body, card number/expiry/CVV, and identity document/date checks. Use messages consistent with the frontend. Keep existing title/notes/custom-field rules and password-history behavior. `card.cvv` in the shared test fixture is `000`, so existing valid card persistence remains valid.

- [ ] **Step 4: Run full Rust verification**

Run: `cd src-tauri && cargo test && cargo fmt --check && cargo clippy --all-targets -- -D warnings`
Expected: all new and existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/vault/entries.rs src-tauri/tests/storage.rs
git commit -m "feat: enforce core entry validation in Rust"
```

---

### Task 4: Full Acceptance, Documentation, and Release Update

**Files:**
- Modify: `tests/desktop-smoke.mjs`
- Modify: `README.md`
- Modify: `docs/development-process.md`
- Modify: `.superpowers/sdd/local-vault-progress.md` (ignored local progress only)

**Interfaces:**
- Uses existing desktop marker entry. Adds favorite toggle/category verification to the real desktop smoke without accessing real user data.

- [ ] **Step 1: Add desktop favorite verification**

After final migration unlock and marker assertion, click the detail `收藏` toggle, open the sidebar favorites category by its accessible `收藏 1` label, and verify the marker remains visible. Use `waitText` only after the async save completes; do not print entry contents or credentials.

- [ ] **Step 2: Run full verification**

```bash
npm run lint
npm test
npm run build
npm run test:e2e
cd src-tauri && cargo test && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cd ..
npm audit --registry=https://registry.npmjs.org
npm run test:desktop
```

Expected: all tests, audit, and desktop create/custom-location/restart/migrate/favorites flows pass.

- [ ] **Step 3: Update documentation**

Document the independent favorites view, exact core-field rules, frontend/Rust validation boundary, test totals, desktop result, and Windows-unverified status in `README.md` and `docs/development-process.md`.

- [ ] **Step 4: Rebuild and reinstall release**

Ask the user to lock and close the installed app before replacing it; do not terminate possible unsaved edits. Then run:

```bash
npx tauri build --bundles app
codesign --force --deep --sign - src-tauri/target/release/bundle/macos/Privault.app
codesign --verify --deep --strict --verbose=2 src-tauri/target/release/bundle/macos/Privault.app
ditto src-tauri/target/release/bundle/macos/Privault.app "$HOME/Applications/Privault.app"
open "$HOME/Applications/Privault.app"
```

Expected: strict ad-hoc verification passes and updated release launches. Record the result in `docs/development-process.md`.

- [ ] **Step 5: Commit**

```bash
git add tests/desktop-smoke.mjs README.md docs/development-process.md
git commit -m "test: verify favorites and core validation"
```
