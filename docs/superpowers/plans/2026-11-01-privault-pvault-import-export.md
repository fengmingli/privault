# Privault `.pvault` Import/Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single-file encrypted `.pvault` export and a verified, backup-first, atomic replacement import while preserving the original master/recovery credentials.

**Architecture:** Implement a Rust-only archive module containing exact-entry ZIP serialization, strict limits and SQLCipher verification. Reuse the existing session, workspace, path-policy, backup and atomic file patterns, then expose native file pickers and typed frontend gateway methods.

**Tech Stack:** Rust, `zip 9.2.0` with `deflate`, SQLCipher, Tauri 2, React 19, TypeScript, Vitest/Testing Library, Playwright, Appium Mac2/WebdriverIO.

## Global Constraints

- Archive entries are exactly `vault.db`, `vault.meta`, and `manifest.json`; no `config.json`, plaintext entries, passwords or recovery keys.
- Import retains original credentials, requires the source master password, backs up before replacement, and restores the original workspace on failure.
- No overwrite of an existing export file, no arbitrary frontend filesystem capability, no sync/merge, and no Windows verification claim.
- Preserve `main`, use no subagents, and record changes in `docs/development-process.md`.

---

### Task 1: Archive Format and Export

**Files:**
- Create: `src-tauri/src/pvault.rs`
- Create: `src-tauri/tests/pvault.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/vault/mod.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/path_policy.rs`
- Modify: `src-tauri/Cargo.toml`

**Interfaces:**
- `PvaultManifest { formatVersion: u32, createdAt: String }`.
- `write_pvault(destination, db_path, meta_path)` writes exactly three entries and rejects existing targets.
- `read_pvault(source, staging_dir)` enforces exact entries, per-entry/total size limits and manifest version before returning staged paths.
- `VaultManager::export_pvault(destination) -> VaultResult<PathBuf>` checks integrity, locks and exports.
- Commands: `storage_choose_export_path()`, `storage_choose_import_path()`, `storage_export_pvault(destination)`.

- [ ] **Step 1: Add failing export tests**

Create `src-tauri/tests/pvault.rs` with a manager fixture containing a valid marker login. Add tests that:

```rust
#[test]
fn export_contains_only_encrypted_vault_files_and_manifest() {
    // Create manager, unlock, export to a temp path, and inspect the ZIP.
    // Assert exact entries, manifest version 1, no config.json, and no marker plaintext in vault.db.
}

#[test]
fn existing_export_target_is_not_overwritten() {
    // Pre-create destination.pvault, call export, assert error and unchanged bytes.
}
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `cd src-tauri && cargo test --test pvault`
Expected: FAIL because the archive module and export command do not exist.

- [ ] **Step 3: Implement strict archive writing and native pickers**

Add to `Cargo.toml`:

```toml
zip = { version = "9.2.0", default-features = false, features = ["deflate"] }
```

In `src/pvault.rs`, implement `PvaultManifest`, exact-entry writing, source file-size checks, and atomic temporary-file rename. In `src-tauri/src/path_policy.rs`, add `validate_archive_destination` using the existing canonicalization, fixed-volume, permission, link and space checks without treating an existing vault as an export conflict. Reject an existing `.pvault` target separately. `manifest.json` contains only `formatVersion` and `createdAt`.

Implement `read_pvault` in the same module with exact entry names, no extra/duplicate entries, a 64 MiB archive cap, 64 KiB manifest cap, 128 MiB total uncompressed cap, and a maximum 200:1 compression ratio. Read entries by exact name rather than extracting paths, so Zip Slip cannot occur.

In `VaultManager`, require an unlocked session, call `verify_integrity`, lock, and call `write_pvault`. Add `rfd` save/open pickers filtered to `pvault`, and Tauri command wrappers that never expose raw file access to the frontend.

- [ ] **Step 4: Run archive tests and full Rust verification**

Run: `cd src-tauri && cargo test && cargo fmt --check && cargo clippy --all-targets -- -D warnings`
Expected: export, conflict, and existing Rust tests pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/pvault.rs src-tauri/src/lib.rs src-tauri/src/vault/mod.rs src-tauri/src/commands.rs src-tauri/tests/pvault.rs
git commit -m "feat: add encrypted pvault export"
```

---

### Task 2: Verified Import with Backup and Rollback

**Files:**
- Modify: `src-tauri/src/pvault.rs`
- Modify: `src-tauri/src/vault/mod.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/tests/pvault.rs`

**Interfaces:**
- `VaultManager::import_pvault(source, master_password) -> VaultResult<StorageLocation>`.
- `storage_import_pvault(source, masterPassword) -> StorageLocation`.
- Import returns the current location, not the source path, and leaves the session locked.

- [ ] **Step 1: Add failing import, wrong-password, and rollback tests**

In `src-tauri/tests/pvault.rs`, add:

```rust
#[test]
fn import_roundtrip_preserves_entries_favorites_and_credentials() {
    // Export a vault with a favorite marker, import into another manager,
    // unlock with the original password, and assert entry/favorite and recovery unlock.
}

#[test]
fn wrong_password_and_corrupt_archive_keep_current_vault() {
    // Start with a different current vault, attempt bad imports,
    // and assert current path, entry content and config are unchanged.
}

#[test]
fn replacement_failure_restores_original_files_and_keeps_backup() {
    // Force the current vault.db replacement to fail, assert original bytes and backup exist.
}
```

Also cover extra entries, duplicate entries, `../evil`, missing manifest, invalid manifest version, missing db/meta and oversized input.

- [ ] **Step 2: Run import tests and confirm RED**

Run: `cd src-tauri && cargo test --test pvault import_roundtrip && cargo test --test pvault wrong_password && cargo test --test pvault replacement_failure`
Expected: FAIL because import/replace is absent.

- [ ] **Step 3: Implement verified backup-first import**

In `VaultManager::import_pvault`:

1. Require unlocked or empty current session and lock it.
2. Read archive into a private temporary staging directory.
3. Call `read_meta`, `unwrap_dek` with the source password, `open_database`, and `verify_integrity`.
4. If the current vault exists, copy `vault.db` and `vault.meta` to `backups/import-<timestamp>-<uuid>` and sync them.
5. Atomically move staged files into the current workspace without changing `config.json`; on error restore original bytes and remove staging files.
6. Return `current_location()` while locked. Source archive remains unchanged.

Use the existing `MigrationFs` abstraction for copy/rename/sync/remove operations so failure injection matches current migration tests. Add the Tauri wrapper with stable sanitized errors.

- [ ] **Step 4: Run full Rust verification**

Run: `cd src-tauri && cargo test && cargo fmt --check && cargo clippy --all-targets -- -D warnings`
Expected: all roundtrip, malicious archive, rollback and existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/pvault.rs src-tauri/src/vault/mod.rs src-tauri/src/commands.rs src-tauri/tests/pvault.rs
git commit -m "feat: add verified pvault import and rollback"
```

---

### Task 3: Typed Gateway and Import/Export Dialogs

**Files:**
- Create: `src/features/vault/PvaultDialog.tsx`
- Create: `src/features/vault/PvaultDialog.test.tsx`
- Modify: `src/lib/vault-client.ts`
- Modify: `src/lib/vault-gateway.test.ts`
- Modify: `src/lib/demo-gateway.ts`
- Modify: `src/features/vault/SettingsDialog.tsx`
- Modify: `src/features/vault/VaultWorkspace.tsx`

**Interfaces:**
- Gateway methods `chooseExportPath()`, `chooseImportPath()`, `exportPvault(destination)`, `importPvault(source, masterPassword)`.
- `PvaultDialog` supports `mode: "import" | "export"`, picker cancellation, source-password input for import, explicit replacement confirmation, busy and sanitized error states.
- Demo explains that no real file is read/written; it never simulates a real archive.

- [ ] **Step 1: Write failing gateway and dialog tests**

In `src/lib/vault-gateway.test.ts`, assert exact command names/arguments for both pickers, export and import. In `PvaultDialog.test.tsx`, cover:

- Export picker cancellation does not call export.
- Export success shows path and returns to unlock.
- Import requires replacement confirmation and source password.
- Wrong password shows sanitized error and keeps current location.
- Demo mode shows the no-real-file explanation without invoking gateway methods.

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm test -- src/lib/vault-gateway.test.ts src/features/vault/PvaultDialog.test.tsx`
Expected: FAIL because methods and dialog are absent.

- [ ] **Step 3: Implement gateway and dialogs**

Add typed methods to `VaultGateway` and `TauriVaultGateway`, mapping to `storage_choose_export_path`, `storage_choose_import_path`, `storage_export_pvault`, and `storage_import_pvault`. Keep Demo methods local and unsupported.

Replace the old capability buttons with real import/export actions in `SettingsDialog`. `PvaultDialog` first invokes the appropriate picker, then shows export confirmation or import replacement/password form. Use `PasswordInput` for the source password and do not retain it after submit. Reuse `migrationActive` to block entry writes while archive work runs, and return to unlock on success.

- [ ] **Step 4: Run frontend verification**

Run: `npm run lint && npm test && npm run build && npm run test:e2e`
Expected: all checks pass and browser tests perform no real file operations.

- [ ] **Step 5: Commit**

```bash
git add src/features/vault src/lib/vault-client.ts src/lib/vault-gateway.test.ts src/lib/demo-gateway.ts
git commit -m "feat: add pvault import export dialogs"
```

---

### Task 4: Real Desktop Roundtrip, Documentation, and Release

**Files:**
- Modify: `tests/desktop-smoke.mjs`
- Modify: `README.md`
- Modify: `docs/development-process.md`

**Interfaces:**
- Desktop smoke exports an isolated `.pvault`, imports it into a separate temporary workspace, and verifies marker entry, favorite state, original password and backup.

- [ ] **Step 1: Extend desktop roundtrip**

After the existing migration/favorite checks, export to `TEST_ROOT/export.pvault`. In a separate `TEST_ROOT/imported` workspace, first create a sacrificial current vault, then import the archive to replace it and unlock with the original source password. Assert marker/favorite persistence, current config path, and an `backups/import-*` directory. Add native file-picker helpers using `PathTextField` and ensure file panels close before clicking Open/Save.

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

Expected: all checks and the desktop export/import roundtrip pass without touching real user data.

- [ ] **Step 3: Update documentation and release**

Document archive contents, replacement/backup behavior, original credential retention, malicious archive limits, test totals and Windows-unverified status. Ask the user to lock and close the installed app before replacing it, then run:

```bash
npx tauri build --bundles app
codesign --force --deep --sign - src-tauri/target/release/bundle/macos/Privault.app
codesign --verify --deep --strict --verbose=2 src-tauri/target/release/bundle/macos/Privault.app
ditto src-tauri/target/release/bundle/macos/Privault.app "$HOME/Applications/Privault.app"
open "$HOME/Applications/Privault.app"
```

Expected: strict ad-hoc signature validation and launch succeed. Record results in `docs/development-process.md`.

- [ ] **Step 4: Commit**

```bash
git add tests/desktop-smoke.mjs README.md docs/development-process.md
git commit -m "test: verify pvault roundtrip and release"
```
