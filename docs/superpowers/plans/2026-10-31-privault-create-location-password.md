# Privault Create Location and Password Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow direct creation into a user-selected fixed-disk folder, enforce the new 8-character/3-class password policy with visibility controls, and change the first-step action to “下一步”.

**Architecture:** Extend the existing Rust creation path with an optional validated destination while preserving default creation and config-last commit. Add a typed optional destination through the frontend gateway and creation form, plus a shared password input and matching frontend/Rust password rules.

**Tech Stack:** Rust, SQLCipher, Tauri 2 commands, React 19, TypeScript, Vitest/Testing Library, Playwright, Appium Mac2/WebdriverIO.

## Global Constraints

- Only new passwords are affected: create, change-master-password and recovery. Existing passwords still unlock.
- Minimum 8 Unicode code points and at least 3 of: ASCII uppercase, ASCII lowercase, ASCII digit, non-whitespace/non-ASCII-alphanumeric special character.
- Destination selection uses only the native Rust picker; no path text input, network/removable volumes, root directories, dangerous links or overwriting.
- `null` destination means the existing default directory. Browser Demo never invokes real path commands.
- Preserve `feature/frontend-ui`; no subagents, no Windows verification claim, and record environment/code changes in `docs/development-process.md`.

---

### Task 1: Rust Password Policy

**Files:**
- Modify: `src-tauri/src/vault/mod.rs`
- Modify: `src-tauri/tests/session.rs`
- Modify: `src-tauri/tests/commands.rs`
- Modify: `src-tauri/tests/migration.rs`

**Interfaces:**
- Consumes: Existing `VaultManager::validate_password`, `create`, `change_master_password`, and `recover_access`.
- Produces: One policy accepting values such as `Master-pass1!` and rejecting `Ab1!` and `abcdefgh`; all later Rust tests use compliant test passwords.

- [ ] **Step 1: Write the failing policy test**

Append to `src-tauri/tests/session.rs`:

```rust
#[test]
fn new_master_password_requires_length_and_three_character_classes() {
    for password in ["Ab1!", "abcdefgh", "ABCDEFGH", "12345678", "!!!!!!!!"] {
        let mut manager = VaultManager::new_for_test().unwrap();
        assert!(manager.create(password.into()).is_err(), "must reject {password}");
    }
    for password in ["Abcdef1!", "Abcdefg1", "abcdef1!", "ABCDEF1!"] {
        let mut manager = VaultManager::new_for_test().unwrap();
        manager.create(password.into()).unwrap();
        manager.unlock(password.into()).unwrap();
    }
}
```

- [ ] **Step 2: Run the new test and confirm RED**

Run: `cd src-tauri && cargo test --test session new_master_password_requires_length_and_three_character_classes`
Expected: FAIL because current validation only checks 12 characters and has no character-class rule.

- [ ] **Step 3: Implement the policy and update test fixtures**

In `src-tauri/src/vault/mod.rs`, replace `validate_password` with:

```rust
fn validate_password(password: &str) -> VaultResult<()> {
    if password.chars().count() < 8 {
        return Err(VaultError::new(ErrorCode::InvalidInput, "主密码至少 8 位"));
    }
    let mut classes = 0;
    classes += usize::from(password.chars().any(|c| c.is_ascii_uppercase()));
    classes += usize::from(password.chars().any(|c| c.is_ascii_lowercase()));
    classes += usize::from(password.chars().any(|c| c.is_ascii_digit()));
    classes += usize::from(password.chars().any(|c| !c.is_ascii_alphanumeric() && !c.is_whitespace()));
    if classes < 3 {
        return Err(VaultError::new(
            ErrorCode::InvalidInput,
            "主密码需包含大写、小写、数字、特殊字符中的至少 3 类",
        ));
    }
    Ok(())
}
```

Use `Master-pass1!` for existing create/unlock fixtures and `New-master1!` for changed/recovered passwords in `src-tauri/tests/session.rs`, `commands.rs`, and `migration.rs`. Keep intentionally wrong credentials such as `wrong-password` unchanged. Direct crypto-slot tests do not call this policy and need no mechanical secret logging or output changes.

- [ ] **Step 4: Run Rust verification**

Run: `cd src-tauri && cargo test && cargo fmt --check && cargo clippy --all-targets -- -D warnings`
Expected: all tests pass, including the new policy test.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/vault/mod.rs src-tauri/tests
git commit -m "feat: enforce new master password policy"
```

---

### Task 2: Frontend Password Rules, Visibility, and Step Label

**Files:**
- Create: `src/components/ui/password-input.tsx`
- Modify: `src/lib/validation.ts`
- Modify: `src/lib/validation.test.ts`
- Modify: `src/lib/demo-gateway.ts`
- Modify: `src/features/access/CreateVaultFlow.tsx`
- Modify: `src/features/access/CreateVaultFlow.test.tsx`
- Modify: `src/features/access/RecoverAccessScreen.tsx`
- Modify: `src/features/access/RecoverAccessScreen.test.tsx`
- Modify: `src/App.test.tsx`
- Modify: `tests/ui.spec.ts`

**Interfaces:**
- Produces: `getMasterPasswordRuleError(password)`, `validateMasterPassword(password, confirmation)`, and `PasswordInput` with `id`, `value`, `onChange`, `disabled`, `autoFocus`, and `visibilityLabel` props.
- Keeps `onCreate(password)` unchanged until Task 4.

- [ ] **Step 1: Write failing validation and visibility tests**

In `src/lib/validation.test.ts`, add:

```ts
it("requires at least 8 code points and three character classes", () => {
  expect(validateMasterPassword("Ab1!", "Ab1!")).toBe("主密码至少 8 位");
  expect(validateMasterPassword("abcdefgh", "abcdefgh")).toBe("主密码需包含大写、小写、数字、特殊字符中的至少 3 类");
  expect(validateMasterPassword("Abcdef1!", "Abcdef1!")).toBeNull();
  expect(validateMasterPassword("Abcdefg1", "Abcdefg1")).toBeNull();
});
```

In `CreateVaultFlow.test.tsx`, add a test that types `Abcdef1!` into both fields, clicks `下一步`, and clicks `显示主密码` and `显示确认密码`, asserting that only the corresponding input changes from `password` to `text`.

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm test -- src/lib/validation.test.ts src/features/access/CreateVaultFlow.test.tsx src/App.test.tsx`
Expected: FAIL on the new rule, missing visibility buttons, and missing `下一步` label.

- [ ] **Step 3: Implement validation and the shared input**

In `src/lib/validation.ts`:

```ts
export function getMasterPasswordRuleError(password: string): string | null {
  if (Array.from(password).length < 8) return "主密码至少 8 位";
  const classes = [
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9\s]/.test(password),
  ].filter(Boolean).length;
  if (classes < 3) return "主密码需包含大写、小写、数字、特殊字符中的至少 3 类";
  return null;
}

export function validateMasterPassword(password: string, confirmation: string): string | null {
  const ruleError = getMasterPasswordRuleError(password);
  if (ruleError) return ruleError;
  if (password !== confirmation) return "两次输入的密码不一致";
  return null;
}
```

Create `PasswordInput` using Lucide `Eye`/`EyeOff`, a relative wrapper, `control pr-11`, and an icon button whose accessible label is `${visible ? "隐藏" : "显示"}${visibilityLabel}`. Use it for both create and recovery password fields. Update hints to `至少 8 位，包含大写、小写、数字、特殊字符中的至少 3 类` and the first-step button to `下一步`. Update `DemoVaultGateway.changeMasterPassword` to use the same single-password rule.

- [ ] **Step 4: Run focused verification**

Run: `npm test -- src/lib/validation.test.ts src/features/access/CreateVaultFlow.test.tsx src/features/access/RecoverAccessScreen.test.tsx src/App.test.tsx && npm run lint`
Expected: all focused tests and lint pass. Update only create-flow E2E selectors from `继续` to `下一步`; retain `继续编辑` elsewhere.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/password-input.tsx src/lib src/features/access src/App.test.tsx tests/ui.spec.ts
git commit -m "feat: improve password setup controls"
```

---

### Task 3: Rust Creation into an Optional Destination

**Files:**
- Modify: `src-tauri/src/vault/mod.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/tests/session.rs`
- Modify: `src-tauri/tests/commands.rs`

**Interfaces:**
- Produces: `VaultManager::create_at(master_password: String, destination: Option<PathBuf>)`, `commands::create_at(manager, master_password, destination)`, and Tauri `vault_create(masterPassword, destination: Option<String>)`.
- Existing `create(masterPassword)` remains the default wrapper.

- [ ] **Step 1: Write failing destination and rollback tests**

Add to `src-tauri/tests/session.rs`:

```rust
#[test]
fn creates_directly_in_a_custom_fixed_directory() {
    let fixture = tempfile::TempDir::new().unwrap();
    let destination = fixture.path().join("custom-vault");
    let mut manager = VaultManager::new_for_test().unwrap();
    manager.create_at("Master-pass1!".into(), Some(destination.clone())).unwrap();
    assert!(destination.join("vault.db").exists());
    assert!(destination.join("vault.meta").exists());
    manager.unlock("Master-pass1!".into()).unwrap();
    assert_eq!(manager.current_location().unwrap().path, destination.canonicalize().unwrap().to_string_lossy());
}

#[test]
fn rejected_custom_destination_preserves_the_original_workspace() {
    let fixture = tempfile::TempDir::new().unwrap();
    let destination = fixture.path().join("occupied");
    std::fs::create_dir_all(&destination).unwrap();
    std::fs::write(destination.join("vault.db"), b"do-not-overwrite").unwrap();
    let mut manager = VaultManager::new_for_test().unwrap();
    let original = manager.workspace_root();
    assert!(manager.create_at("Master-pass1!".into(), Some(destination)).is_err());
    assert_eq!(manager.workspace_root(), original);
}
```

Also test config-write failure using `set_config_file_for_test` pointed at a directory, asserting that `workspace_root()` returns the original after `create_at` fails.

- [ ] **Step 2: Run destination tests and confirm RED**

Run: `cd src-tauri && cargo test --test session custom_fixed_directory -- --nocapture && cargo test --test session rejected_custom_destination -- --nocapture`
Expected: FAIL because `create_at` does not exist.

- [ ] **Step 3: Implement optional destination creation and command mapping**

In `VaultManager`, split the current creation body into `create_in_current_workspace(master_password)`. Import `crate::path_policy::validate_destination` and `crate::platform::SystemVolumeInspector`. Keep `create(master_password)` as `create_at(master_password, None)`, and use this structure for `create_at`:

```rust
pub fn create_at(&mut self, master_password: String, destination: Option<PathBuf>) -> VaultResult<RecoveryKeyResult> {
    Self::validate_password(&master_password)?;
    let original_workspace = self.workspace.clone();
    let original_config = self.config.clone();
    if let Some(path) = destination {
        let validated = validate_destination(
            &path,
            &SystemVolumeInspector,
            1_048_576,
            None,
        )?;
        self.workspace = Workspace::new(validated.path.clone());
        self.config.storage_path = validated.path.to_string_lossy().into_owned();
    }
    let result = self.create_in_current_workspace(master_password);
    if result.is_err() {
        self.workspace = original_workspace;
        self.config = original_config;
    }
    result
}
```

The existing `create_in_current_workspace` retains the session-empty/conflict checks, SQLCipher/meta creation, and config-last atomic write. This avoids recursive `create ↔ create_at` calls and restores in-memory state on every failure.

In `commands.rs`, add:

```rust
pub fn create_at(
    manager: &mut VaultManager,
    master_password: String,
    destination: Option<PathBuf>,
) -> VaultResult<RecoveryKeyResult> {
    manager.create_at(master_password, destination)
}
```

Change `vault_create` to accept `destination: Option<String>` and pass `destination.map(PathBuf::from)` through `create_at`. Do not change `storage_choose_location` or add frontend filesystem capabilities.

- [ ] **Step 4: Run Rust verification**

Run: `cd src-tauri && cargo test && cargo fmt --check && cargo clippy --all-targets -- -D warnings`
Expected: all destination, rollback, and existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/vault/mod.rs src-tauri/src/commands.rs src-tauri/tests
git commit -m "feat: create vault directly in selected directory"
```

---

### Task 4: Creation Location UI and Typed Gateway

**Files:**
- Modify: `src/lib/vault-client.ts`
- Modify: `src/lib/vault-gateway.test.ts`
- Modify: `src/lib/demo-gateway.ts`
- Modify: `src/features/access/AccessFlow.tsx`
- Modify: `src/features/access/CreateVaultFlow.tsx`
- Modify: `src/features/access/CreateVaultFlow.test.tsx`
- Modify: `src/App.test.tsx`
- Modify: `tests/ui.spec.ts`
- Modify: `tests/desktop-smoke.mjs`

**Interfaces:**
- `VaultGateway.create(masterPassword: string, destination?: string | null): Promise<RecoveryKeyResult>`.
- `CreateVaultFlow` consumes `onCreate(password, destination)`, `onChooseLocation()`, and `onGetLocation()`. `null` means default.
- Desktop uses a compliant fake master password such as `Desktop-Master1!` and clicks `下一步`.

- [ ] **Step 1: Write failing gateway and creation-location tests**

In `src/lib/vault-gateway.test.ts`, call `create("Master-pass1!", "/tmp/custom")` and expect:

```ts
expect(invokeMock).toHaveBeenCalledWith("vault_create", {
  masterPassword: "Master-pass1!",
  destination: "/tmp/custom",
});
```

In `CreateVaultFlow.test.tsx`, mock `onChooseLocation` returning `/fixed/custom`, `onGetLocation` returning the default location, and `onCreate` resolving a recovery key. Assert that:

- The default path is shown initially.
- Picker cancel preserves it and does not call `onCreate`.
- Selecting `/fixed/custom` displays it and submits `onCreate("Abcdef1!", "/fixed/custom")`.
- `恢复默认目录` submits `null` on a subsequent creation.
- Demo mode shows no real directory button and never calls the location callbacks.

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm test -- src/lib/vault-gateway.test.ts src/features/access/CreateVaultFlow.test.tsx src/App.test.tsx`
Expected: FAIL because destination parameters and location UI are absent.

- [ ] **Step 3: Implement gateway and location UI**

Change `TauriVaultGateway.create` to invoke `vault_create` with `{ masterPassword, destination: destination ?? null }`; keep Demo destination in memory only.

Add location props to `CreateVaultFlow`. Load location only when `demoMode === false`, keep `destination: string | null` initially `null`, and display `destination ?? location?.path`. `选择保存文件夹` awaits the native picker; `null` means cancel with no state change. `恢复默认目录` sets `destination` to `null`. Call `onCreate(password, destination)` and retain the selected directory and password inputs on errors.

In `AccessFlow`, bind `gateway.create`, `gateway.chooseLocation`, and `gateway.getLocation` correctly so Demo methods retain `this`.

- [ ] **Step 4: Run frontend and browser verification**

Run: `npm run lint && npm test && npm run build && npm run test:e2e`
Expected: all checks pass; no browser test invokes a real path.

- [ ] **Step 5: Commit**

```bash
git add src/lib src/features/access src/App.test.tsx tests/ui.spec.ts tests/desktop-smoke.mjs
git commit -m "feat: choose vault folder during creation"
```

---

### Task 5: Desktop Acceptance, Documentation, and Release Update

**Files:**
- Modify: `README.md`
- Modify: `docs/development-process.md`
- Modify: `.superpowers/sdd/local-vault-progress.md` (local ignored progress only)

**Interfaces:**
- Uses the new create signature and compliant desktop password. Produces repeatable macOS evidence and an updated local release installation.

- [ ] **Step 1: Run full frontend and Rust verification**

```bash
npm run lint
npm test
npm run build
npm run test:e2e
cd src-tauri && cargo test && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cd ..
```

Expected: all pass.

- [ ] **Step 2: Run the real desktop lifecycle**

Run: `npm run test:desktop`
Expected: create with the new password and selected/default location, entry persistence across restart, native-path migration, second restart with identical data, config and plaintext audit all pass.

- [ ] **Step 3: Update documentation**

Document the 8-character/3-class rule, create-time directory selection and rollback in `README.md` and `docs/development-process.md`. Include exact test totals, desktop result, code changes, and continued Windows-unverified status. Do not alter the ignored progress file as if it were a tracked substitute for the development document.

- [ ] **Step 4: Rebuild and reinstall release**

If the installed app is running, ask the user to lock and close it first; do not terminate an instance with possible unsaved edits. Then run:

```bash
npx tauri build --bundles app
codesign --force --deep --sign - src-tauri/target/release/bundle/macos/Privault.app
codesign --verify --deep --strict --verbose=2 src-tauri/target/release/bundle/macos/Privault.app
ditto src-tauri/target/release/bundle/macos/Privault.app "$HOME/Applications/Privault.app"
open "$HOME/Applications/Privault.app"
```

Expected: strict ad-hoc signature verification passes and the updated release launches. Do not claim Apple notarization or automatic updates.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/development-process.md
git commit -m "docs: record creation workflow verification"
```
