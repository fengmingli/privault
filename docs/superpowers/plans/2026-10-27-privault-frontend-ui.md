# Privault Frontend UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, testable Privault desktop UI prototype with local demo state and explicit non-production security boundaries.

**Architecture:** A React + TypeScript + Vite frontend runs in a minimal Tauri 2 shell. Pure domain helpers and reducers own demo behavior, focused React components own presentation, and native browser dialogs provide accessible modal flows without introducing a backend vault API. Demo entries remain in memory; only a strict whitelist of UI preferences may be persisted.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS 3.4, shadcn/ui-style primitives, lucide-react, Vitest, React Testing Library, Playwright, Tauri 2, Rust.

## Global Constraints

- The visible Chinese UI must continuously show `UI 原型，请勿输入真实密码`.
- Demo unlock accepts only `demo`; no real vault, encryption, database, import, or export is implemented.
- Demo entries and edits are memory-only and reset on reload. Never persist passwords, recovery keys, entries, or search terms.
- Only theme, auto-lock minutes, and clipboard countdown preferences may be persisted under one versioned settings key.
- Runtime assets are local. No CDN, remote fonts, analytics, auto-update, HTTP client, or remote images.
- Use semantic HSL design tokens; do not add raw palette classes such as `text-white` or `bg-blue-500` to components.
- Baseline window is 1280×800; minimum target is 1024×700. Mobile and tablet layouts are out of scope.
- Entry kinds are `login`, `note`, `card`, and `identity`; custom field kinds are `text`, `password`, and `date`.
- Password generator length is 12–64 and defaults to 20.
- Password fields default to concealed. Notifications never include the copied value.
- Import/export and native security capabilities show an explicit capability explanation and never report fake success.
- Every task must keep components focused and below 200 lines where practical; split by responsibility rather than expanding a monolithic `App.tsx`.
- Current environment has Node.js 24.15.0 and npm 11.12.1, but Rust/Cargo is not installed. Desktop verification must install or otherwise provide Rust and must not be claimed before it runs.

## File Map

```text
src/
├── App.tsx                         # Locked/unlocked composition and global prototype banner
├── main.tsx                        # React bootstrap
├── index.css                       # HSL tokens and global design-system styles
├── types/vault.ts                  # Entry, field, category, and vault-state contracts
├── data/demo.ts                    # Explicitly fictitious resettable entries
├── lib/
│   ├── clipboard.ts                # Truthful async clipboard result
│   ├── entry-utils.ts              # Search, filter, sort, summaries, entry factories
│   ├── password-generator.ts       # Local generation and entropy estimate
│   ├── settings.ts                 # Validated preference whitelist
│   └── validation.ts               # Access and entry validation
├── state/vault-reducer.ts          # Entry mutations, selection, filters, delete/undo
├── hooks/
│   ├── use-auto-lock.ts            # UI inactivity timer
│   └── use-settings.ts             # Theme application and preference updates
├── components/
│   ├── BrandMark.tsx
│   ├── PrototypeBanner.tsx
│   ├── Toast.tsx
│   └── ui/                         # Button, card, input, dialog primitives
├── features/
│   ├── access/
│   │   ├── AccessFlow.tsx          # Access-screen state machine
│   │   ├── AccessLayout.tsx
│   │   ├── UnlockScreen.tsx
│   │   ├── CreateVaultFlow.tsx
│   │   └── RecoverAccessScreen.tsx
│   └── vault/
│       ├── VaultWorkspace.tsx      # Workspace composition and dialog coordination
│       ├── VaultSidebar.tsx
│       ├── EntryListPane.tsx
│       ├── EntryDetailPane.tsx
│       ├── EntryEditorDialog.tsx
│       ├── EntryKindFields.tsx
│       ├── CustomFieldsEditor.tsx
│       ├── NewEntryDialog.tsx
│       ├── PasswordGeneratorDialog.tsx
│       ├── SettingsDialog.tsx
│       └── CapabilityDialog.tsx
└── test/setup.ts                   # RTL cleanup and browser API mocks

tests/ui.spec.ts                    # Production-preview user paths, screenshots, request audit
src-tauri/                          # Minimal Tauri 2 shell, no vault commands or plugins
```

---

### Task 1: Foundation and Design System

**Files:**
- Create: root Vite configuration and source scaffold through the UI initialization script
- Create: `src/test/setup.ts`, `src/App.test.tsx`, `src/components/BrandMark.tsx`, `src/components/PrototypeBanner.tsx`
- Modify: `package.json`, `vite.config.ts`, `tailwind.config.ts`, `src/index.css`, `src/App.tsx`, `index.html`, `.gitignore`

**Interfaces:**
- Produces: `BrandMark(): JSX.Element`, `PrototypeBanner(): JSX.Element`, semantic Tailwind colors, and `npm test`, `npm run build` commands.

- [ ] **Step 1: Scaffold into a temporary directory and copy only source/configuration files into the repository**

```bash
rm -rf /tmp/privault-ui-scaffold
(cd /tmp && bash /Users/lifengming/.agents/skills/ui-designer/scripts/init-project.sh privault-ui-scaffold)
rsync -a --exclude node_modules --exclude .git /tmp/privault-ui-scaffold/ ./
rm -rf /tmp/privault-ui-scaffold
npm install
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test @tauri-apps/cli
npm pkg set name=privault 'scripts.test=vitest run' 'scripts.test:watch=vitest' 'scripts.test:e2e=playwright test' 'scripts.tauri=tauri'
```

Expected: `package.json` exists, `npm install` exits 0, and the existing `docs/` directory remains untouched.

- [ ] **Step 2: Configure Vite, tests, scripts, and ignored artifacts**

Use this complete `vite.config.ts`:

```ts
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  clearScreen: false,
  server: { host: "127.0.0.1", port: 1420, strictPort: true },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
    exclude: ["tests/**", "node_modules/**", "dist/**", "src-tauri/**"],
  },
});
```

Use this complete `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => cleanup());

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

HTMLDialogElement.prototype.showModal = function showModal() {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function close() {
  this.removeAttribute("open");
};
```

Write `.gitignore`:

```gitignore
node_modules/
dist/
test-results/
playwright-report/
src-tauri/target/
src-tauri/gen/
*.local
.DS_Store
.worktrees/
.superpowers/
```

Set `<html lang="zh-CN">` and `<title>Privault — 本地隐私保险库 UI 原型</title>` in `index.html`.

- [ ] **Step 3: Write the failing application smoke test**

Create `src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App foundation", () => {
  it("shows the product identity and persistent prototype warning", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Privault" })).toBeInTheDocument();
    expect(screen.getByText("UI 原型，请勿输入真实密码")).toBeInTheDocument();
  });
});
```

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because the scaffold renders `Welcome` and has no prototype warning.

- [ ] **Step 4: Define semantic tokens before implementing the screen**

Replace the scaffold palettes in `src/index.css` with these role values and retain the Tailwind directives:

```css
:root {
  --background: 40 20% 98%;
  --surface: 0 0% 100%;
  --surface-raised: 0 0% 100%;
  --foreground: 180 10% 12%;
  --foreground-muted: 180 5% 36%;
  --border: 40 8% 84%;
  --input: 40 8% 80%;
  --primary: 176 72% 25%;
  --primary-foreground: 0 0% 100%;
  --primary-hover: 176 76% 20%;
  --accent: 168 30% 92%;
  --accent-foreground: 176 65% 18%;
  --warning: 38 92% 42%;
  --warning-foreground: 30 90% 14%;
  --danger: 0 68% 42%;
  --danger-foreground: 0 0% 100%;
  --focus-ring: 176 72% 32%;
  --selection: 170 40% 84%;
  --radius: 0.625rem;
}

.dark {
  --background: 180 12% 8%;
  --surface: 180 10% 11%;
  --surface-raised: 180 9% 14%;
  --foreground: 40 20% 94%;
  --foreground-muted: 40 6% 68%;
  --border: 180 7% 23%;
  --input: 180 7% 30%;
  --primary: 168 55% 52%;
  --primary-foreground: 176 70% 10%;
  --primary-hover: 168 60% 60%;
  --accent: 176 25% 18%;
  --accent-foreground: 168 55% 75%;
  --warning: 38 90% 60%;
  --warning-foreground: 30 90% 10%;
  --danger: 0 68% 48%;
  --danger-foreground: 0 0% 100%;
  --focus-ring: 168 60% 60%;
  --selection: 176 35% 27%;
  --radius: 0.625rem;
}
```

Add global rules that apply `bg-background`, `text-foreground`, local system font stacks, visible `focus-visible` rings, `::selection` using `--selection`, and reduced-motion suppression. Map `surface`, `surface-raised`, `foreground-muted`, `primary-hover`, `warning`, `danger`, and `focus-ring` in `tailwind.config.ts`; alias shadcn names `muted-foreground` to `--foreground-muted`, `ring` to `--focus-ring`, and `destructive` to `--danger`.

- [ ] **Step 5: Implement the minimal branded shell**

`BrandMark` renders a local inline SVG shield/keyhole with `aria-hidden="true"` and semantic `text-primary` styling. `PrototypeBanner` has `role="status"` and exactly this copy:

```tsx
export function PrototypeBanner() {
  return (
    <div role="status" className="flex min-h-8 items-center justify-center border-b border-warning/30 bg-warning/10 px-4 py-1.5 text-center text-xs font-medium text-foreground">
      UI 原型，请勿输入真实密码
    </div>
  );
}
```

Compose the brand, banner, and `Privault` heading in `App.tsx`. Use only semantic token classes.

Run:

```bash
npm test -- src/App.test.tsx
npm run build
```

Expected: one passing test and a successful Vite production build.

- [ ] **Step 6: Commit the testable foundation**

```bash
git add . ':!docs'
git commit -m "feat: establish Privault UI design system"
```

---

### Task 2: Vault Domain, Demo Data, Search, and Reducer

**Files:**
- Create: `src/types/vault.ts`, `src/data/demo.ts`, `src/lib/entry-utils.ts`, `src/state/vault-reducer.ts`
- Test: `src/lib/entry-utils.test.ts`, `src/state/vault-reducer.test.ts`

**Interfaces:**
- Produces: `VaultEntry`, `EntryKind`, `Category`, `VaultState`, `VaultAction`.
- Produces: `createDemoEntries(): VaultEntry[]`, `createEmptyEntry(kind: EntryKind): VaultEntry`.
- Produces: `filterAndSortEntries(state: VaultState): VaultEntry[]`, `getEntrySummary(entry: VaultEntry): string`.
- Produces: `createInitialVaultState(entries?: VaultEntry[]): VaultState`, `vaultReducer(state, action): VaultState`.

- [ ] **Step 1: Define discriminated entry types and exact reducer actions**

Create `src/types/vault.ts` with these public contracts:

```ts
export type EntryKind = "login" | "note" | "card" | "identity";
export type Category = "all" | EntryKind;
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
export interface NoteEntry extends BaseEntry { kind: "note"; body: string }
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

export interface VaultState {
  entries: VaultEntry[];
  selectedId: string | null;
  category: Category;
  query: string;
  lastDeleted: { entry: VaultEntry; index: number } | null;
}

export type VaultAction =
  | { type: "select"; id: string | null }
  | { type: "set-query"; query: string }
  | { type: "set-category"; category: Category }
  | { type: "upsert"; entry: VaultEntry }
  | { type: "toggle-favorite"; id: string }
  | { type: "remove"; id: string }
  | { type: "undo-delete" }
  | { type: "clear-sensitive-view" };
```

- [ ] **Step 2: Write failing utility and reducer tests**

Cover these exact behaviors in `entry-utils.test.ts`:

```ts
it("combines category filtering with case-insensitive search and favorite sorting", () => {
  const state = createInitialVaultState();
  const filtered = filterAndSortEntries({ ...state, category: "login", query: "GITHUB" });
  expect(filtered).toHaveLength(1);
  expect(filtered[0].title).toBe("示例 GitHub");

  const sorted = filterAndSortEntries({ ...state, category: "all", query: "" });
  expect(sorted[0].favorite).toBe(true);
  expect(sorted.map((entry) => entry.id)).not.toEqual(state.entries.map((entry) => entry.id));
});
```

Cover deletion and restoration in `vault-reducer.test.ts`:

```ts
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
  const initial = { ...createInitialVaultState(), query: "secret", lastDeleted: null };
  const cleared = vaultReducer(initial, { type: "clear-sensitive-view" });
  expect(cleared.query).toBe("");
  expect(cleared.selectedId).toBeNull();
  expect(cleared.lastDeleted).toBeNull();
});
```

Run: `npm test -- src/lib/entry-utils.test.ts src/state/vault-reducer.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement deterministic demo data and pure utilities**

Create at least four fictitious entries titled `示例 GitHub`, `演示门禁笔记`, `演示银行卡`, and `示例证件`. Use reserved domains such as `example.com`, names such as `演示用户`, and card/document values containing only `0`. Every entry has fixed ISO timestamps; at least one entry is a favorite, and the source array order deliberately differs from favorite-first display order. The GitHub entry has one password-history item. `createDemoEntries` returns `structuredClone(DEMO_ENTRIES)` so tests and reloads cannot share mutated objects.

Implement search against title, username, website, notes, and note body; category filtering; favorite-first then descending-`updatedAt` sorting. Implement `createEmptyEntry` with `crypto.randomUUID()`, current ISO timestamps, empty type-specific fields, and no password history.

The sorting comparator must be pure:

```ts
export function compareEntries(a: VaultEntry, b: VaultEntry): number {
  if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}
```

- [ ] **Step 4: Implement reducer mutations**

`upsert` replaces by ID or appends, then selects the saved ID. `remove` stores the original index and chooses the next visible entry only when the selected entry was removed. `undo-delete` restores at the original index and clears `lastDeleted`. `clear-sensitive-view` returns the original entries plus empty query, null selection, and null deletion history. Reducer operations do not mutate the prior state.

Run: `npm test -- src/lib/entry-utils.test.ts src/state/vault-reducer.test.ts`

Expected: all utility and reducer tests PASS.

- [ ] **Step 5: Commit the domain slice**

```bash
git add src/types src/data src/lib/entry-utils.ts src/lib/entry-utils.test.ts src/state
 git commit -m "feat: add demo vault domain and state"
```

---

### Task 3: Access Flows and Truthful Clipboard Boundary

**Files:**
- Create: `src/lib/validation.ts`, `src/lib/validation.test.ts`, `src/lib/clipboard.ts`, `src/features/access/*`, `src/features/vault/VaultWorkspace.tsx`
- Modify: `src/App.tsx`, `src/App.test.tsx`, `src/index.css`

**Interfaces:**
- Produces: `validateMasterPassword(password, confirmation): string | null`.
- Produces: `isValidDemoRecoveryKey(value): boolean`; accepted format is `DEMO-XXXX-XXXX-XXXX` with uppercase alphanumeric groups.
- Produces: `copyText(value: string): Promise<boolean>`.
- Consumes: `VaultWorkspace({ onLock }: { onLock: () => void })` as the temporary post-unlock destination.
- Produces: `AccessFlow({ onUnlocked }: { onUnlocked: () => void })`.

- [ ] **Step 1: Write failing validation and access tests**

Validation tests must assert: passwords under 12 characters fail; mismatch fails; valid matching passwords return null; recovery key accepts `DEMO-4C7Q-9M2X-6K8P` after trimming and rejects non-demo values.

Access integration tests must complete these paths:

```tsx
it("rejects a wrong demo password and unlocks with demo", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "解锁演示保险库" }));
  await user.type(screen.getByLabelText("演示密码"), "wrong");
  await user.click(screen.getByRole("button", { name: "解锁" }));
  expect(screen.getByText("演示密码不正确")).toBeInTheDocument();

  await user.clear(screen.getByLabelText("演示密码"));
  await user.type(screen.getByLabelText("演示密码"), "demo");
  await user.click(screen.getByRole("button", { name: "解锁" }));
  expect(screen.getByText("演示保险库")).toBeInTheDocument();
});
```

Add a creation-flow test that enters mismatched passwords, verifies the inline error, completes matching passwords, verifies that the recovery confirmation checkbox is required, checks it, and enters the demo workspace.

Run: `npm test -- src/lib/validation.test.ts src/App.test.tsx`

Expected: FAIL on missing validation and access controls.

- [ ] **Step 2: Implement pure validation and clipboard functions**

```ts
export async function copyText(value: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
```

Validation returns Chinese inline messages, never logs inputs, and normalizes recovery keys with `.trim().toUpperCase()` before checking the exact demo pattern.

- [ ] **Step 3: Build the access screens**

Use a shared centered `AccessLayout` with a local brand panel and a form card. Implement these explicit screen transitions in `AccessFlow`:

```ts
type AccessScreen = "welcome" | "unlock" | "create" | "recover";
```

`UnlockScreen` exposes a button named `解锁演示保险库` for first-run navigation, labels the password input `演示密码`, displays `演示密码：demo`, and calls `onUnlocked` only for `demo`. `CreateVaultFlow` has credentials and recovery-key steps, displays `DEMO-4C7Q-9M2X-6K8P` as non-production sample text, and requires the saved-offline checkbox. Its copy button awaits `copyText` and reports the actual result; its print button calls `window.print()`, and `@media print` rules in `src/index.css` print only the demo recovery panel with its non-production warning. `RecoverAccessScreen` validates the demo recovery key and replacement password, then returns to unlock without claiming a real reset. Welcome/import controls open a local explanation dialog stating that file migration is not connected.

Create a minimal `VaultWorkspace` showing `演示保险库` and a working `立即锁定` button; Task 4 replaces only its internal workspace composition while retaining the `onLock` contract. `App.tsx` owns only the unlocked boolean and global banner so locking unmounts all sensitive demo views.

- [ ] **Step 4: Verify access paths and production build**

```bash
npm test -- src/lib/validation.test.ts src/App.test.tsx
npm run build
```

Expected: all access tests PASS; no secrets are written to storage or logs.

- [ ] **Step 5: Commit the access slice**

```bash
git add src/App.tsx src/App.test.tsx src/lib/validation.ts src/lib/validation.test.ts src/lib/clipboard.ts src/features
 git commit -m "feat: add offline vault access UI flows"
```

---

### Task 4: Three-Pane Vault Workspace

**Files:**
- Create: `src/features/vault/VaultSidebar.tsx`, `EntryListPane.tsx`, `EntryDetailPane.tsx`, `src/components/Toast.tsx`
- Modify: `src/features/vault/VaultWorkspace.tsx`, `src/App.test.tsx`
- Test: `src/features/vault/VaultWorkspace.test.tsx`

**Interfaces:**
- Consumes: all Task 2 domain functions and `copyText` from Task 3.
- Produces: `VaultWorkspace({ onLock, initialEntries? }: { onLock: () => void; initialEntries?: VaultEntry[] })`.

- [ ] **Step 1: Write failing workspace interaction tests**

Use Testing Library to verify: all four demo entries render; selecting `登录信息` filters notes/cards/identities; searching `GITHUB` leaves one result; clearing search restores the category; selecting a row updates the detail heading; password starts concealed; `显示密码` reveals it; copy success shows `密码已复制`; rejected clipboard promises show `复制失败，请检查系统权限`; `立即锁定` calls `onLock`. Render once with `initialEntries={[]}` to verify the empty-vault action, and use a category/search combination with no matches to verify the distinct empty-result action.

Mock only the clipboard boundary:

```ts
vi.mock("@/lib/clipboard", () => ({ copyText: vi.fn() }));
const copyMock = vi.mocked(copyText);
copyMock.mockResolvedValue(true);
```

Run: `npm test -- src/features/vault/VaultWorkspace.test.tsx`

Expected: FAIL because the three-pane controls do not exist.

- [ ] **Step 2: Implement the sidebar and list pane**

`VaultSidebar` shows category counts derived from all entries, selected-category styles using `bg-accent`, and text labels in addition to icons. `EntryListPane` owns a labelled search input, result count, favorite indicators, type icon, title, summary, and formatted update date. Search remains controlled by `VaultWorkspace`. Empty search results include buttons `清除搜索` and `查看全部项目`.

Use CSS grid with `grid-cols-[216px_320px_minmax(0,1fr)]`; below 1100px use `grid-cols-[72px_280px_minmax(0,1fr)]`, hide sidebar text visually while retaining `aria-label` and `title`.

- [ ] **Step 3: Implement detail fields and copy feedback**

`EntryDetailPane` renders type-specific fields, notes, custom fields, and login password history. A reusable internal `SecretValue` resets concealment whenever `entry.id` changes. Copy buttons have accessible names such as `复制密码` and notifications contain only field labels. `Toast` uses `role="status"` for success and `role="alert"` for failure.

- [ ] **Step 4: Compose reducer, filtering, selection, and lock cleanup**

`VaultWorkspace` uses `useReducer(vaultReducer, initialEntries, createInitialVaultState)`, derives visible entries with `filterAndSortEntries`, and passes stable callbacks to the panes. Lock dispatches `clear-sensitive-view` before calling `onLock`. Search and selection never enter persistent storage.

Run:

```bash
npm test -- src/features/vault/VaultWorkspace.test.tsx src/App.test.tsx
npm run build
```

Expected: workspace and prior access tests PASS.

- [ ] **Step 5: Commit the workspace slice**

```bash
git add src/components/Toast.tsx src/features/vault src/App.test.tsx
 git commit -m "feat: build three-pane vault workspace"
```

---

### Task 5: Entry Creation, Editing, Dirty Guards, Delete, and Undo

**Files:**
- Create: `src/components/ui/dialog.tsx`, `src/components/ui/confirm-dialog.tsx`, `src/features/vault/NewEntryDialog.tsx`, `EntryEditorDialog.tsx`, `EntryKindFields.tsx`, `CustomFieldsEditor.tsx`
- Modify: `src/lib/validation.ts`, `src/lib/entry-utils.ts`, `src/features/vault/VaultWorkspace.tsx`, `EntryDetailPane.tsx`
- Test: `src/lib/entry-validation.test.ts`, `src/features/vault/EntryEditorDialog.test.tsx`, `VaultWorkspace.test.tsx`

**Interfaces:**
- Produces: `validateEntry(entry: VaultEntry): Record<string, string>`.
- Produces: `prepareEntryForSave(draft: VaultEntry, original: VaultEntry | null, now?: string): VaultEntry`.
- Produces: `EntryEditorDialog({ open, entry, kind, onSave, onClose, onDirtyChange }: { open: boolean; entry: VaultEntry | null; kind: EntryKind; onSave: (entry: VaultEntry) => void; onClose: () => void; onDirtyChange: (dirty: boolean) => void })`.
- Consumes: reducer `upsert`, `remove`, `undo-delete`, and `toggle-favorite` actions.

- [ ] **Step 1: Write failing validation and save-preparation tests**

Test empty title, title longer than 120 characters, custom-field labels longer than 40 characters, values longer than 4000 characters, duplicate case-insensitive custom-field labels, malformed card expiry not matching `MM/YY`, identity expiry earlier than issue date, and valid entries. For a login password change, assert that the old password is prepended to history and `updatedAt` changes; for an unchanged password, assert no new history item.

```ts
it("archives the previous login password only when it changes", () => {
  const original = createDemoEntries().find((entry): entry is LoginEntry => entry.kind === "login")!;
  const changed = prepareEntryForSave({ ...original, password: "new-demo-value" }, original, "2026-10-27T12:00:00.000Z");
  expect(changed.kind).toBe("login");
  if (changed.kind === "login") {
    expect(changed.passwordHistory[0].password).toBe(original.password);
    expect(changed.updatedAt).toBe("2026-10-27T12:00:00.000Z");
  }
});
```

Run: `npm test -- src/lib/entry-validation.test.ts`

Expected: FAIL because validation and save preparation are missing.

- [ ] **Step 2: Implement validation and save preparation**

`validateEntry` returns field-keyed messages and never throws for empty values. `prepareEntryForSave` returns the same discriminated kind, updates `updatedAt`, and for changed login passwords creates a history item with `crypto.randomUUID()`, the old password, and the prior `updatedAt` as `changedAt`.

- [ ] **Step 3: Implement accessible native dialogs and dynamic forms**

The shared dialog wraps native `<dialog>`, calls `showModal()`/`close()` in response to `open`, handles `cancel`, labels the dialog with its heading ID, and restores focus through native dialog behavior. `NewEntryDialog` offers four type buttons with icons and descriptions.

`EntryEditorDialog` clones the source entry or uses `createEmptyEntry(kind)`, maintains a controlled draft, calls `onDirtyChange` based on JSON equality with the original, and renders common fields plus `EntryKindFields` and `CustomFieldsEditor`. Save displays validation errors without closing; successful save computes `preparedEntry = prepareEntryForSave(draft, originalEntry)` and calls `onSave(preparedEntry)`. Close and cancel with dirty state open a styled confirmation offering `继续编辑` and `放弃修改`.

- [ ] **Step 4: Add workspace edit, favorite, delete, undo, and lock guards**

Add `新建` to the list header and `编辑`, `收藏`, `删除` to details. Saving dispatches `upsert` and closes the editor. Delete opens a confirmation containing the entry title, dispatches `remove`, and shows a toast with `撤销`; undo dispatches `undo-delete`. Manual lock while the editor is dirty requires `放弃并锁定`; auto-lock added later bypasses drafts and unmounts the workspace.

Add integration tests for create, edit, cancelled close, delete/undo, favorite toggle, and generator-button presence. Run:

```bash
npm test -- src/lib/entry-validation.test.ts src/features/vault/EntryEditorDialog.test.tsx src/features/vault/VaultWorkspace.test.tsx
npm run build
```

Expected: all entry mutation tests PASS.

- [ ] **Step 5: Commit the editor slice**

```bash
git add src/components/ui src/components/Toast.tsx src/features/vault src/lib/entry-utils.ts src/lib/validation.ts src/lib/entry-validation.test.ts
 git commit -m "feat: add demo entry editing workflows"
```

---

### Task 6: Password Generator and Editor Integration

**Files:**
- Create: `src/lib/password-generator.ts`, `src/lib/password-generator.test.ts`, `src/features/vault/PasswordGeneratorDialog.tsx`, `src/features/vault/PasswordGeneratorDialog.test.tsx`
- Modify: `src/features/vault/EntryEditorDialog.tsx`, `VaultSidebar.tsx`, `VaultWorkspace.tsx`

**Interfaces:**
- Produces: `GeneratorOptions`, `DEFAULT_GENERATOR_OPTIONS`, `generatePassword(options, randomInt?)`, `estimatePasswordStrength(options)`.
- Produces: `PasswordGeneratorDialog({ open, onClose, onUse? })`; `onUse` is present only when launched from an editor.

- [ ] **Step 1: Write failing generator unit and UI tests**

Test default length 20, minimum/maximum validation, no enabled character groups, exclusion of `Il1O0o`, deterministic generation with injected random integers, and entropy estimation. UI tests verify changing length regenerates, disabling every group shows `至少选择一种字符类型`, `重新生成` changes deterministic output, and `填入密码` invokes `onUse` with the visible value.

```ts
it("uses only the enabled alphabet and requested length", () => {
  const options = { ...DEFAULT_GENERATOR_OPTIONS, length: 12, uppercase: false, numbers: false, symbols: false };
  const values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const password = generatePassword(options, () => values.shift() ?? 0);
  expect(password).toHaveLength(12);
  expect(password).toMatch(/^[a-z]+$/);
});
```

Run: `npm test -- src/lib/password-generator.test.ts src/features/vault/PasswordGeneratorDialog.test.tsx`

Expected: FAIL because generator modules do not exist.

- [ ] **Step 2: Implement unbiased local random selection**

Define options with `length`, `uppercase`, `lowercase`, `numbers`, `symbols`, and `excludeAmbiguous`. The default `randomInt(max)` uses `crypto.getRandomValues` with rejection sampling so modulo bias is not introduced. `generatePassword` throws `RangeError` for length outside 12–64 and `Error("至少选择一种字符类型")` for an empty alphabet. Strength returns approximate entropy `length * log2(alphabet.length)` with labels `较弱` below 60 bits, `良好` below 90 bits, and `很强` at 90 bits or above.

- [ ] **Step 3: Implement generator dialog and both launch paths**

Use a range input plus numeric output for length, native checkboxes for character groups, a monospace password output, strength meter with text, and buttons `重新生成`, `复制`, and conditional `填入密码`. Copy reports actual clipboard results. Sidebar launch has no fill button; editor launch replaces only the draft password and leaves the form unsaved until the user saves.

Run:

```bash
npm test -- src/lib/password-generator.test.ts src/features/vault/PasswordGeneratorDialog.test.tsx src/features/vault/VaultWorkspace.test.tsx
npm run build
```

Expected: generator and regression tests PASS.

- [ ] **Step 4: Commit the generator slice**

```bash
git add src/lib/password-generator* src/features/vault
 git commit -m "feat: add interactive demo password generator"
```

---

### Task 7: Settings, Themes, Auto-Lock, Shortcuts, and Capability States

**Files:**
- Create: `src/lib/settings.ts`, `src/lib/settings.test.ts`, `src/hooks/use-settings.ts`, `src/hooks/use-auto-lock.ts`, `src/hooks/use-auto-lock.test.tsx`, `src/features/vault/SettingsDialog.tsx`, `CapabilityDialog.tsx`
- Modify: `src/App.tsx`, `src/features/vault/VaultWorkspace.tsx`, `VaultSidebar.tsx`, `src/index.css`

**Interfaces:**
- Produces: `UiSettings`, `DEFAULT_SETTINGS`, `loadSettings(storage?)`, `saveSettings(settings, storage?)`.
- Produces: `useSettings(): { settings, updateSettings }`.
- Produces: `useAutoLock({ minutes, onLock, enabled })`.
- Consumes: `CapabilityDialog({ open, capability: "import" | "export" | "native-security", onClose })`.

- [ ] **Step 1: Write failing preference and inactivity tests**

Settings tests must prove malformed JSON returns defaults, unknown keys are dropped, invalid enum values return defaults, and saving under `privault.prototype.ui-settings.v1` serializes only `theme`, `autoLockMinutes`, and `clipboardSeconds`.

Auto-lock tests use fake timers and a harness with `minutes=5`: advancing 4 minutes 59 seconds does not lock; advancing one more second locks once; a `pointerdown` or `keydown` resets the deadline; manual lock remains immediate.

Run: `npm test -- src/lib/settings.test.ts src/hooks/use-auto-lock.test.tsx`

Expected: FAIL because settings and timer modules do not exist.

- [ ] **Step 2: Implement settings validation and system theme behavior**

`UiSettings` allows theme `light | dark | system`, auto-lock `1 | 5 | 15`, and clipboard countdown `15 | 30 | 60`. Defaults are system, 5, and 30. `useSettings` applies/removes `.dark` on `document.documentElement`, listens for system changes only in system mode, and persists only through `saveSettings`.

- [ ] **Step 3: Implement settings and capability dialogs**

Settings contains native radio/checkbox/select controls for the three preference groups. Import/export buttons open `CapabilityDialog` with exact explanatory copy that no file is selected or written. Native clipboard and system-sleep rows display `待接入安全核心`; the clipboard preference is stored but never represented as an active native guarantee.

- [ ] **Step 4: Wire timers and global keyboard shortcuts**

`VaultWorkspace` receives settings from `App`. Auto-lock dispatches `clear-sensitive-view`, closes dialogs without preserving drafts, and calls `onLock`. Add `Cmd/Ctrl+K` to focus search, `Cmd/Ctrl+N` to open type selection, and `Cmd/Ctrl+Shift+L` to invoke the guarded manual lock. Shortcuts do not replace visible controls.

Run:

```bash
npm test
npm run build
```

Expected: the complete unit/integration suite PASSes and the production build succeeds.

- [ ] **Step 5: Commit settings and lifecycle behavior**

```bash
git add src/App.tsx src/index.css src/hooks src/lib/settings* src/features/vault
 git commit -m "feat: add themes settings and auto-lock UI"
```

---

### Task 8: Tauri Shell, Offline Audit, and Visual Verification

**Files:**
- Create: `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`
- Create: `playwright.config.ts`, `tests/ui.spec.ts`
- Modify: `package.json` only if script reconciliation is required

**Interfaces:**
- Consumes: the complete frontend and `npm run build` output in `dist/`.
- Produces: a local Tauri window and Playwright screenshots at 1280×800 and 1024×700. No Rust vault commands are added.

- [ ] **Step 1: Add the minimal Tauri 2 shell**

Use `src-tauri/src/main.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    privault_ui_lib::run()
}
```

Use `src-tauri/src/lib.rs`:

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Privault UI prototype");
}
```

Use `src-tauri/build.rs`:

```rust
fn main() {
    tauri_build::build()
}
```

`Cargo.toml` defines package `privault-ui`, library `privault_ui_lib`, `tauri = { version = "2", features = [] }`, and `tauri-build = { version = "2", features = [] }`. The Tauri config uses product name `Privault`, identifier `com.privault.prototype`, dev URL `http://127.0.0.1:1420`, frontend dist `../dist`, a 1280×800 main window with 1024×700 minimum, and bundling disabled for this prototype. The only capability is `core:default` on `main`; do not add HTTP, shell, filesystem, dialog, clipboard, updater, or process plugins.

Set a restrictive CSP allowing local scripts/styles/images and Tauri IPC only, with `object-src 'none'`, `base-uri 'none'`, and `frame-src 'none'`. Any development-only exception must not be added to the production frontend.

- [ ] **Step 2: Add production-preview Playwright coverage**

Configure Playwright to run `npm run build && npm run preview` on `http://127.0.0.1:4173`, use Chromium with `clipboard-read` and `clipboard-write` permissions for the success path, and save screenshots under `test-results/`. Install its browser when absent:

```bash
npx playwright install chromium
```

`tests/ui.spec.ts` must automate:

1. Unlock with `demo`, search GitHub, show and copy a password, then lock.
2. Create a login, generate and fill a password, save, delete, and undo.
3. Verify wrong-password, empty-search, invalid-generator, and unsaved-close states.
4. Switch light/dark themes and capture `privault-1280-light.png` and `privault-1280-dark.png`.
5. Set viewport 1024×700 and capture `privault-1024-light.png` without horizontal document overflow.
6. Record every request and assert that no URL has a host other than `127.0.0.1` or `localhost`.

The overflow assertion is:

```ts
const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
expect(hasOverflow).toBe(false);
```

- [ ] **Step 3: Run the complete frontend verification**

```bash
npm test
npm run build
npm run test:e2e
```

Expected: unit/integration/e2e tests PASS, three screenshots exist, and the remote-request assertion is empty. Inspect the screenshots with the image-reading tool; correct clipping, weak contrast, broken focus, or placeholder imagery before proceeding.

- [ ] **Step 4: Verify the desktop shell with an actual Rust toolchain**

On this Mac, install Rust only if it remains absent:

```bash
if ! command -v cargo >/dev/null 2>&1; then brew install rust; fi
rustc --version
cargo --version
npm run tauri build
```

Expected: Rust and Cargo versions print, Tauri compiles the release binary, and no vault-related Rust commands or network plugins exist. If installation or a platform prerequisite fails, record the exact blocker and do not claim desktop verification.

- [ ] **Step 5: Run final static audits and commit**

```bash
rg -n 'fetch\(|axios|XMLHttpRequest|https?://' src index.html src-tauri/src src-tauri/capabilities || true
git diff --check
git status --short
```

Expected: no runtime remote-resource or HTTP-client matches; no whitespace errors. Review `package.json`, Tauri capabilities, and storage calls to confirm the global constraints. Then commit:

```bash
git add package.json package-lock.json playwright.config.ts tests src-tauri src
 git commit -m "feat: package and verify Privault desktop UI prototype"
```

## Completion Evidence

The implementation is complete only when all applicable Task 8 commands have run and their actual output supports these claims:

- Unit, integration, and end-to-end tests pass.
- Production frontend build succeeds. Full desktop completion additionally requires a successful Tauri build; any unavailable prerequisite leaves desktop verification open and must be reported explicitly.
- Screenshots at 1280×800 and 1024×700 have been visually inspected in both required themes where captured.
- Main create/edit/generate/copy/delete/undo/lock flows work with fictitious in-memory data.
- No remote runtime resources, sensitive persistence, fake migration success, or undisclosed security claims are present.
