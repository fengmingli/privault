# Privault Local Encrypted Vault Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the demo-only desktop prototype with a real offline SQLCipher vault whose storage directory can be changed safely through a verified, backed-up migration workflow.

**Architecture:** Rust owns keys, database connections, configuration, path policy and migrations behind serialized Tauri commands. React retains the approved UI but calls a typed gateway; browser previews remain explicitly demo-only while the Tauri desktop uses the real encrypted vault. Storage migration is two-phase and updates the path configuration only after a target copy unlocks successfully.

**Tech Stack:** Rust, Tauri 2, SQLCipher/rusqlite, Argon2id, XChaCha20-Poly1305, serde, React, TypeScript, Vitest, React Testing Library, Playwright.

## Global Constraints

- Application runtime is offline. No cloud account, sync, telemetry, updater, remote assets or HTTP/filesystem plugins for the frontend.
- All private data is encrypted by Rust before disk writes. No plaintext database, WAL, temp database, password, recovery key or sensitive log output.
- Use SQLCipher with `vault.db` and `vault.meta`; DEK is random 256-bit material wrapped separately by Argon2id-derived master and recovery keys using XChaCha20-Poly1305.
- macOS default: `~/Library/Application Support/Privault/`; Windows default: `%LOCALAPPDATA%\Privault/`.
- Only fixed local volumes are accepted. Reject network/removable volumes, root directories, unsafe link escapes, unwritable targets and existing `vault.db` or `vault.meta` conflicts.
- Path migration keeps the source and an encrypted backup. Configuration changes only after target unlock, integrity verification and atomic file replacement. Never silently overwrite or merge.
- This phase excludes `.pvault` import/export, backup-restore UI, native clipboard clearing, sleep locking, biometrics, attachments and installers.
- Demo entries must never be written into a real vault. Browser previews remain marked as demos; the prototype warning is removed from real Tauri only after the real create/restart/unlock/migrate workflow passes.
- `vault.meta` contains only format, vault ID, algorithm, KDF and wrapped-key data. `config.json` contains only format version and storage path.
- Every Tauri write and migration is serialized through one session lock. The frontend never receives arbitrary filesystem capability.
- Rust/Cargo installation requires an explicit user confirmation at execution time. Do not install it implicitly. Windows verification cannot be claimed without running on Windows.

## File Map

```text
src-tauri/
├── Cargo.toml
├── src/
│   ├── main.rs / lib.rs
│   ├── error.rs                 # Stable codes and sanitized messages
│   ├── model.rs                 # Serde DTOs shared with TypeScript
│   ├── crypto/
│   │   ├── mod.rs               # DEK and key-slot API
│   │   ├── argon.rs             # KDF profiles and calibration
│   │   └── recovery.rs          # 256-bit recovery key + checksum
│   ├── metadata.rs              # VaultMeta and atomic persistence
│   ├── storage/
│   │   ├── mod.rs               # SQLCipher open/pragmas/repository
│   │   └── schema.sql           # Versioned schema
│   ├── config.rs                # Default paths and config.json
│   ├── path_policy.rs           # Fixed-volume and destination validation
│   ├── migration.rs             # Prepare/confirm/cancel state machine
│   ├── vault/
│   │   ├── mod.rs               # Session and use cases
│   │   └── entries.rs           # Validation, history, delete/restore
│   ├── platform/
│   │   ├── mod.rs               # VolumeInspector abstraction
│   │   ├── unix.rs              # statfs/statvfs and permissions
│   │   └── windows.rs           # DRIVE_FIXED, space and ACL
│   └── commands.rs              # Serialized Tauri API
├── tests/
│   ├── crypto.rs
│   ├── storage.rs
│   ├── session.rs
│   ├── path_policy.rs
│   └── migration.rs
src/
├── lib/
│   ├── vault-client.ts          # Gateway interface and Tauri implementation
│   └── demo-gateway.ts          # Existing in-memory browser behavior
├── features/access/             # Real create/unlock/recovery through gateway
└── features/vault/
    ├── StorageLocationCard.tsx
    └── MigrationDialog.tsx
tests/
├── ui.spec.ts                   # Existing browser coverage plus settings states
└── desktop-smoke.mjs            # Real Tauri WebDriver workflow
```

---

### Task 1: Rust Toolchain, Dependencies, Domain Types, and Errors

**Files:**
- Modify: `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`
- Create: `src-tauri/src/error.rs`, `src-tauri/src/model.rs`, `src-tauri/tests/model.rs`

**Interfaces:**
- Produces: `VaultError`, `ErrorCode`, `VaultEntry`, `EntrySummary`, `VaultStatus`, `StorageLocation`, `AppConfig`.
- All DTOs serialize with existing frontend `camelCase` and `kind` conventions.

- [ ] **Step 1: Confirm toolchain consent and install only if approved**

Ask explicitly before changing the host. After approval:

```bash
if ! command -v cargo >/dev/null 2>&1; then brew install rust; fi
rustc --version
cargo --version
```

Expected: both versions print. Without approval or a working toolchain, stop and report the blocker rather than generating unverified Rust code.

- [ ] **Step 2: Add pinned-by-lockfile project dependencies**

```bash
cd src-tauri
cargo add serde --features derive
cargo add serde_json
cargo add thiserror
cargo add zeroize
cargo add argon2
cargo add chacha20poly1305
cargo add getrandom
cargo add sha2
cargo add base32
cargo add hex
cargo add uuid --features v4,serde
cargo add chrono --features clock,serde
cargo add rusqlite --features bundled-sqlcipher-vendored-openssl
cargo add dirs
cargo add rfd
cargo add libc
cargo add windows-sys --target 'cfg(windows)' --features Win32_Storage_FileSystem,Win32_Security,Win32_Security_Authorization
cargo add tempfile --dev
cargo generate-lockfile
```

Expected: `Cargo.lock` is created with SQLCipher and vendored OpenSSL; no system SQLCipher dependency is required.

- [ ] **Step 3: Write failing DTO and error tests**

`src-tauri/tests/model.rs` must assert JSON shapes:

```rust
#[test]
fn login_entry_uses_frontend_discriminated_union() {
    let entry = VaultEntry::new_empty_for_test(EntryKind::Login);
    let json = serde_json::to_value(&entry).unwrap();
    assert_eq!(json["kind"], "login");
    assert!(json["customFields"].is_array());
    assert!(json["passwordHistory"].is_array());
    assert!(json.get("created_at").is_none());
}

#[test]
fn errors_have_stable_code_and_no_secret_details() {
    let error = VaultError::new(ErrorCode::InvalidCredentials, "无法解锁，请检查凭据或保险库完整性");
    let json = serde_json::to_value(&error).unwrap();
    assert_eq!(json["code"], "INVALID_CREDENTIALS");
    assert!(!json.to_string().contains("argon2"));
}
```

Run: `cargo test --test model`

Expected: FAIL because model/error modules do not exist.

- [ ] **Step 4: Implement models and stable errors**

Define `EntryKind` as `login | note | card | identity`, `CustomFieldKind` as `text | password | date`, and `VaultEntry` as a serde-tagged union matching TypeScript. `EntrySummary` omits all secrets. `VaultStatus` is `empty | locked | unlocked | error` plus `StorageLocation`. `AppConfig` contains only `version` and `storagePath`.

Define all spec error codes in SCREAMING_SNAKE_CASE. `VaultError` exposes only `code` and a sanitized `message`; internal errors stay in Rust and never include SQL, keys or stack traces.

Run:

```bash
cargo test --test model
cargo fmt --check
cargo clippy --all-targets -- -D warnings
```

Expected: model tests and static checks PASS.

- [ ] **Step 5: Commit the compilable foundation**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src src-tauri/tests/model.rs
git commit -m "feat: establish Rust vault domain and dependencies"
```

---

### Task 2: DEK, Key Slots, and Recovery Keys

**Files:**
- Create: `src-tauri/src/crypto/mod.rs`, `argon.rs`, `recovery.rs`, `src-tauri/src/metadata.rs`, `src-tauri/tests/crypto.rs`

**Interfaces:**
- Produces: `Dek`, `KdfParams`, `KeySlot`, `VaultMeta`, `KeySlotKind`.
- Produces: `create_meta(master, recovery) -> (VaultMeta, Dek)`, `unwrap_dek(meta, credential, kind) -> Result<Dek>`.
- Produces: `replace_master_slot`, `replace_recovery_slot`, `encode_recovery_key`, `decode_recovery_key`.
- Test KDF profile is fast; production profile calibrates near 500ms.

- [ ] **Step 1: Write failing crypto tests**

Cover:

```rust
#[test]
fn master_and_recovery_unlock_the_same_dek() {
    let (meta, expected) = create_meta_for_test("master-password", "recovery-password").unwrap();
    let master = unwrap_dek(&meta, "master-password", KeySlotKind::Master).unwrap();
    let recovery = unwrap_dek(&meta, "recovery-password", KeySlotKind::Recovery).unwrap();
    assert_eq!(master.expose(), expected.expose());
}

#[test]
fn wrong_credentials_and_tampered_slots_fail() {
    let (mut meta, _) = create_meta_for_test("master-password", "recovery-password").unwrap();
    assert!(unwrap_dek(&meta, "wrong-password", KeySlotKind::Master).is_err());
    meta.master.nonce[0] ^= 1;
    assert!(unwrap_dek(&meta, "master-password", KeySlotKind::Master).is_err());
}
```

Add tests for recovery checksum rejection, master replacement preserving DEK, recovery replacement invalidating the old key, and zeroization on drop.

Run: `cargo test --test crypto`

Expected: FAIL because crypto/metadata modules are missing.

- [ ] **Step 2: Implement Argon2id, wrapping, and recovery encoding**

Use 32 random bytes for DEK and recovery entropy. Append a 4-byte SHA-256 checksum to recovery entropy, encode with Crockford Base32, and group in blocks of four. Validate length, checksum and normalization on decode.

Use `argon2::Argon2::hash_password_into` with stored `m_cost`, `t_cost`, `p_cost` and a 16-byte salt. Wrap using `XChaCha20Poly1305` with a 24-byte random nonce and AAD containing format version, vault ID, slot kind, algorithm version and KDF parameters. Store no raw DEK or password.

- [ ] **Step 3: Implement atomic VaultMeta persistence**

`VaultMeta` supports master/recovery slots and format version 1. Writes use a same-directory temporary file, `sync_all`, atomic rename and directory sync. The previous file is retained under an encrypted-backup directory before replacement.

Run:

```bash
cargo test --test crypto
cargo fmt --check
cargo clippy --all-targets -- -D warnings
```

Expected: all crypto tests PASS; wrong credentials and tampering fail closed.

- [ ] **Step 4: Commit the crypto slice**

```bash
git add src-tauri/src/crypto src-tauri/src/metadata.rs src-tauri/tests/crypto.rs
git commit -m "feat: add vault key slots and recovery keys"
```

---

### Task 3: SQLCipher Schema and Encrypted Entry Repository

**Files:**
- Create: `src-tauri/src/storage/mod.rs`, `schema.sql`, `src-tauri/src/vault/entries.rs`, `src-tauri/tests/storage.rs`

**Interfaces:**
- Produces: `open_database(path, &Dek) -> Result<Connection>`.
- Produces: `list_entries`, `get_entry`, `upsert_entry`, `delete_entry`, `restore_entry`, `verify_integrity`.
- All write operations increment global revision in the same transaction.

- [ ] **Step 1: Write failing encrypted-repository tests**

Use `tempfile::TempDir` and a test DEK. Test every entry kind, Unicode, search, favorite/update sorting, custom fields, password history, soft delete/restore, restart persistence, invalid credentials, SQLCipher integrity, and a plaintext-marker audit:

```rust
#[test]
fn data_survives_reopen_without_plaintext_marker() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("vault.db");
    let dek = Dek::new_for_test();
    let marker = "PRIVATE-MARKER-7f3c9a";
    {
        let mut db = open_database(&path, &dek).unwrap();
        let mut entry = VaultEntry::new_empty_for_test(EntryKind::Login);
        entry.common_mut().title = marker.to_string();
        upsert_entry(&mut db, entry).unwrap();
    }
    let bytes = std::fs::read(&path).unwrap();
    assert!(!bytes.windows(marker.len()).any(|window| window == marker.as_bytes()));
    let db = open_database(&path, &dek).unwrap();
    assert_eq!(list_entries(&db).unwrap()[0].title, marker);
}
```

Also assert wrong DEK cannot read the database and `journal_mode` is not WAL.

Run: `cargo test --test storage`

Expected: FAIL because storage/repository modules do not exist.

- [ ] **Step 2: Add versioned SQLCipher schema and safe open configuration**

Create `entries`, `custom_fields`, `password_history`, `vault_state`, and `schema_migrations`. Enforce foreign keys, cascade child deletion, non-null kind/checks, and case-insensitive custom-label uniqueness per entry. Store common fields in `entries` and variant fields in `payload_json`.

Opening applies the DEK without logging it, then sets `foreign_keys=ON`, `secure_delete=ON`, `temp_store=MEMORY`, `journal_mode=DELETE`, `synchronous=FULL`, and SQLCipher version-appropriate security settings. Run migrations only after successful key application.

- [ ] **Step 3: Implement transactional entry operations**

`upsert_entry` validates the entry, writes common/payload/custom fields in one transaction, and inserts old login password only when changed. `delete_entry` and `restore_entry` update `deleted_at`. `list_entries` excludes deleted entries and returns only summaries. `verify_integrity` runs SQLCipher integrity check plus a read query.

Run:

```bash
cargo test --test storage
cargo fmt --check
cargo clippy --all-targets -- -D warnings
```

Expected: repository tests PASS, database bytes contain no marker, and wrong keys fail.

- [ ] **Step 4: Commit encrypted persistence**

```bash
git add src-tauri/src/storage src-tauri/src/vault/entries.rs src-tauri/tests/storage.rs
git commit -m "feat: add SQLCipher encrypted entry storage"
```

---

### Task 4: Vault Creation, Unlock, Lock, Password Change, and Recovery

**Files:**
- Create: `src-tauri/src/vault/mod.rs`, `src-tauri/tests/session.rs`
- Modify: `src-tauri/src/metadata.rs`, `src-tauri/src/config.rs`

**Interfaces:**
- Produces: `VaultManager` with `create`, `unlock`, `lock`, `status`, `change_master_password`, `recover_access`.
- Session states: `Empty`, `Locked(Workspace)`, `Unlocked { workspace, connection, dek }`.

- [ ] **Step 1: Write failing session tests**

Cover creation conflict, correct/wrong unlock, locked command rejection, restart unlock, lock clearing session, current-password verification, recovery resetting master and rotating recovery key, and metadata/database mismatch:

```rust
#[test]
fn recovery_rotates_key_and_preserves_entries() {
    let mut manager = VaultManager::new_for_test().unwrap();
    let created = manager.create("master-password".into()).unwrap();
    manager.unlock("master-password".into()).unwrap();
    let mut entry = VaultEntry::new_empty_for_test(EntryKind::Note);
    entry.common_mut().title = "恢复测试条目".into();
    manager.upsert_entry(entry).unwrap();
    manager.lock().unwrap();
    let old_recovery = created.recovery_key.clone();
    let recovered = manager.recover_access(old_recovery.clone(), "new-master-password".into()).unwrap();
    assert_ne!(old_recovery, recovered.recovery_key);
    assert!(manager.recover_access(old_recovery, "another-master-password".into()).is_err());
    manager.unlock("new-master-password".into()).unwrap();
    assert_eq!(manager.list_entries().unwrap().len(), 1);
}
```

Run: `cargo test --test session`

Expected: FAIL because session manager is not implemented.

- [ ] **Step 2: Implement session transitions and config-aware workspace loading**

`create` requires no existing vault. `unlock` unwraps DEK before opening SQLCipher and creates no session on failure. `lock` closes the connection and clears key material. Missing or mismatched metadata/database returns `VAULT_CORRUPT`; an unavailable configured directory returns `PATH_UNAVAILABLE` without falling back.

- [ ] **Step 3: Implement password change and recovery**

Both operations verify their credential, preserve DEK and entries, atomically replace key slots, and clear the old session. Recovery rotates the recovery key and returns it once. No operation logs the old/new credential.

Run:

```bash
cargo test --test session
cargo test --test crypto --test storage
cargo fmt --check
cargo clippy --all-targets -- -D warnings
```

Expected: session plus previous crypto/storage suites PASS.

- [ ] **Step 4: Commit the session slice**

```bash
git add src-tauri/src/vault src-tauri/src/metadata.rs src-tauri/src/config.rs src-tauri/tests/session.rs
git commit -m "feat: add encrypted vault session lifecycle"
```

---

### Task 5: Fixed-Disk Path Policy and Configuration

**Files:**
- Create: `src-tauri/src/path_policy.rs`, `src-tauri/src/platform/mod.rs`, `unix.rs`, `windows.rs`, `src-tauri/tests/path_policy.rs`
- Modify: `src-tauri/src/config.rs`

**Interfaces:**
- Produces: `VolumeKind { Fixed, Removable, Network }`, `VolumeInspector`, `validate_destination(path, inspector) -> ValidatedPath`.
- Produces: `load_config`, `default_vault_dir`, `write_config_atomic`.

- [ ] **Step 1: Write failing path-policy tests with a fake volume inspector**

Cover fixed acceptance, removable/network/root rejection, existing vault conflict, same-source rejection, unwritable target, insufficient space, Unix link escape, and unavailable configured path. Tests use temp directories and a mock inspector, not actual U disks or network shares.

```rust
#[test]
fn rejects_network_volume_without_creating_target() {
    let dir = TempDir::new().unwrap();
    let candidate = dir.path().join("candidate");
    let inspector = FakeInspector::new(VolumeKind::Network).with_space(u64::MAX);
    assert!(matches!(validate_destination(&candidate, &inspector), Err(VaultError { code: ErrorCode::PathUnsupported, .. })));
    assert!(!candidate.exists());
}
```

Run: `cargo test --test path_policy`

Expected: FAIL because path policy is missing.

- [ ] **Step 2: Implement portable validation and platform inspectors**

Canonicalize existing ancestors before creating a directory. Reject link/reparse escapes, root, same-source and conflicts before writing. macOS uses local-volume and `statvfs` checks plus `0700`/`0600`; Windows uses `DRIVE_FIXED`, free-space checks and a protected current-owner ACL on app-created files/directories.

`config.json` remains in the default directory and contains only `version` and `storagePath`. Config writes use temporary file, sync and rename. Startup never silently selects another path.

Run:

```bash
cargo test --test path_policy
cargo fmt --check
cargo clippy --all-targets -- -D warnings
```

Expected: path tests PASS on the host; Windows-only code compiles when a Windows target is available.

- [ ] **Step 3: Commit path policy**

```bash
git add src-tauri/src/path_policy.rs src-tauri/src/platform src-tauri/src/config.rs src-tauri/tests/path_policy.rs
git commit -m "feat: enforce fixed local vault storage paths"
```

---

### Task 6: Two-Phase Storage Migration with Fault-Injection Tests

**Files:**
- Create: `src-tauri/src/migration.rs`, `src-tauri/tests/migration.rs`
- Modify: `src-tauri/src/vault/mod.rs`, `src-tauri/src/config.rs`

**Interfaces:**
- Produces: `prepare_migration(destination) -> MigrationId`, `confirm_migration(id, masterPassword) -> StorageLocation`, `cancel_migration(id)`.
- Produces: `MigrationFs` abstraction with production and fault-injected implementations.

- [ ] **Step 1: Write failing migration state-machine tests**

Cover success, wrong-password rollback, destination conflict, backup failure, copy failure, integrity failure, rename failure, config failure, cancellation, crash before/after config commit, and write/migration mutual exclusion.

```rust
#[test]
fn failed_target_verification_keeps_original_location() {
    let fixture = MigrationFixture::new().unwrap();
    let migration = fixture.manager.prepare_migration(fixture.destination.clone()).unwrap();
    assert!(fixture.manager.confirm_migration(migration.id, "wrong-password".into()).is_err());
    assert_eq!(fixture.manager.current_location().unwrap().path, fixture.source);
    assert!(fixture.source.join("vault.db").exists());
    assert!(fixture.source.join("backups").exists());
    assert!(!fixture.destination.join("vault.db").exists());
}
```

Run: `cargo test --test migration`

Expected: FAIL because migration state machine is missing.

- [ ] **Step 2: Implement prepare/cancel with encrypted backups**

Preparation requires no active write/migration, closes the current session, copies `vault.db` and `vault.meta` into a unique source backup and unique target temp files, syncs both, and returns an operation ID. Source files are never deleted. Cancel removes only operation-owned temp files and preserves the original configuration.

- [ ] **Step 3: Implement confirm/commit and failure recovery**

Confirmation unlocks the target temp copy with the supplied master password, checks SQLCipher integrity and reads entries. Only then rename temp files, sync the target directory, and atomically write config last. Clean up only operation-owned files on active failures; after process crashes, preserve both encrypted copies and never infer ownership for deletion.

Run:

```bash
cargo test --test migration
cargo test --test session --test path_policy
cargo fmt --check
cargo clippy --all-targets -- -D warnings
```

Expected: migration and previous suites PASS, including every injected failure.

- [ ] **Step 4: Commit migration**

```bash
git add src-tauri/src/migration.rs src-tauri/src/vault src-tauri/src/config.rs src-tauri/tests/migration.rs
git commit -m "feat: add verified vault storage migration"
```

---

### Task 7: Serialized Tauri Commands and Native Directory Selection

**Files:**
- Create: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`, `src-tauri/tests/commands.rs`

**Interfaces:**
- Produces exactly the spec commands and DTOs. Tauri state is `Mutex<VaultManager>`.
- Produces `storage_choose_location() -> Option<String>` using Rust `rfd`; no frontend fs/dialog plugin.

- [ ] **Step 1: Write failing command-state tests**

Call command functions directly with a test manager. Verify locked entry commands fail, wrong credentials produce only stable code/message, writes serialize, migration conflicts return `MIGRATION_IN_PROGRESS`, and no response contains a test secret.

Run: `cargo test --test commands`

Expected: FAIL because commands are not wired.

- [ ] **Step 2: Implement commands and register the exact handler list**

Wrap each manager use case with DTO validation and `Result<T, VaultError>`. Register `VaultManager` in Tauri state and only the spec commands in `generate_handler!`. Do not add arbitrary read/write/path commands. `storage_choose_location` returns `None` on cancel and never changes config by itself.

Keep capabilities limited to the application window and these local commands. Do not add HTTP, shell, fs, dialog, clipboard, updater or process plugins.

Run:

```bash
cargo test
cargo fmt --check
cargo clippy --all-targets -- -D warnings
```

Expected: all Rust tests PASS with pristine output.

- [ ] **Step 3: Commit the native API**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs src-tauri/capabilities/default.json src-tauri/tests/commands.rs
git commit -m "feat: expose serialized local vault commands"
```

---

### Task 8: Typed Frontend Gateway and Real Access Flows

**Files:**
- Create: `src/lib/vault-client.ts`, `src/lib/demo-gateway.ts`, `src/lib/vault-gateway.test.ts`
- Modify: `src/App.tsx`, `src/features/access/AccessFlow.tsx`, `UnlockScreen.tsx`, `CreateVaultFlow.tsx`, `RecoverAccessScreen.tsx`, `src/features/vault/VaultWorkspace.tsx`

**Interfaces:**
- Produces `VaultGateway` matching the Tauri commands, `TauriVaultGateway`, and `DemoVaultGateway`.
- Real Tauri uses real commands; browser tests/previews keep the existing explicit demo behavior.

- [ ] **Step 1: Write failing gateway and access integration tests**

Mock the gateway, not Tauri IPC internals. Verify real create returns and requires recovery-key confirmation, wrong unlock preserves the form, real entries load on unlock, lock clears data, and browser demo never calls Tauri. Assert no demo entry is sent to `vault_upsert_entry` during initialization.

Run:

```bash
npm test -- src/lib/vault-gateway.test.ts src/App.test.tsx
```

Expected: FAIL because access flows are not gateway-driven.

- [ ] **Step 2: Implement the typed gateway and async vault state**

`vault-client.ts` wraps `invoke` with exact argument/return types and stable error mapping. `DemoVaultGateway` preserves current in-memory tests. `TauriVaultGateway` invokes only registered commands. Workspace loads summaries/full entries through the gateway, awaits mutations before updating UI, disables conflicting actions during writes, and clears sensitive state on lock/error.

- [ ] **Step 3: Convert access flows without importing demo data**

Creation uses the real returned recovery key in Tauri and the demo key in browser. Recovery displays the newly rotated key once. Unlock uses supplied credentials, not the hard-coded `demo` in Tauri. The prototype banner remains in browser demo mode and is removed from real Tauri only after Task 10 acceptance.

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all frontend tests, including existing flows, PASS with no demo-to-real writes.

- [ ] **Step 4: Commit the real data adapter**

```bash
git add src/lib/vault-client.ts src/lib/demo-gateway.ts src/lib/vault-gateway.test.ts src/App.tsx src/App.test.tsx src/features
git commit -m "feat: connect desktop UI to encrypted vault gateway"
```

---

### Task 9: Storage Location Settings and Migration UI

**Files:**
- Create: `src/features/vault/StorageLocationCard.tsx`, `MigrationDialog.tsx`, `StorageLocationCard.test.tsx`
- Modify: `src/features/vault/SettingsDialog.tsx`, `VaultWorkspace.tsx`, `src/lib/vault-client.ts`, `src/lib/demo-gateway.ts`, `tests/ui.spec.ts`

**Interfaces:**
- Consumes storage commands from Task 7 and gateway from Task 8.
- Produces two-phase migration UI with `preparing | awaiting-password | confirming | success | error` states.

- [ ] **Step 1: Write failing storage-location UI tests**

Cover current-path display, native picker cancel, fixed-path start, awaiting-password state, wrong password preserving original location, success returning to unlock, restore-default using the same flow, and migration blocking entry writes. Browser demo shows capability explanation rather than a fake encrypted path.

Run: `npm test -- src/features/vault/StorageLocationCard.test.tsx src/features/vault/VaultWorkspace.test.tsx`

Expected: FAIL because storage location UI is absent.

- [ ] **Step 2: Implement the settings card and migration dialog**

Show normalized current path and `本机固定磁盘 · 加密存储` only in real Tauri. Buttons `更改存储目录` and `恢复默认目录` call the same prepare/confirm flow. The dialog displays backup/copy/verification stages and disables entry edits. Failure shows the sanitized reason and unchanged location; success tells the user to unlock again.

- [ ] **Step 3: Add browser regression coverage and full frontend verification**

Keep existing E2E behavior in demo mode and add settings/cancel/error states. Then run:

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```

Expected: all frontend checks PASS; no browser test writes a real path or vault.

- [ ] **Step 4: Commit storage settings**

```bash
git add src/features/vault src/lib/vault-client.ts src/lib/demo-gateway.ts tests/ui.spec.ts
git commit -m "feat: add safe storage location settings"
```

---

### Task 10: Real Desktop Acceptance, Security Audit, and Documentation

**Files:**
- Modify: `README.md`, `src/components/PrototypeBanner.tsx`, `src-tauri/src/config.rs`, `src-tauri/tauri.conf.json` only if verification requires a correction
- Create: `scripts/verify-local-vault.sh`, `tests/desktop-smoke.mjs`

**Interfaces:**
- Produces a repeatable local verification command using an isolated test configuration directory, never the user's real vault.

- [ ] **Step 1: Add a real desktop WebDriver smoke harness**

After separate approval for desktop test tooling, install `tauri-driver` and WebdriverIO, and enable the platform driver:

```bash
cargo install tauri-driver --locked
safaridriver --enable
npm install -D webdriverio
```

Windows uses a matching `msedgedriver` instead of `safaridriver`. If driver installation or enablement is not approved, record desktop UI verification as open rather than substituting a file-layer test. `config.rs` accepts `PRIVAULT_CONFIG_DIR` only in debug/test builds; production builds ignore that override.

`tests/desktop-smoke.mjs` connects to `tauri-driver` on `127.0.0.1:4444` with these capabilities:

```js
const browser = await remote({
  hostname: "127.0.0.1",
  port: 4444,
  logLevel: "silent",
  capabilities: {
    browserName: "tauri",
    "tauri:options": { application: "src-tauri/target/debug/privault-ui" },
  },
});
```

`scripts/verify-local-vault.sh` builds frontend/Rust, starts `tauri-driver` with a temporary debug/test-only `PRIVAULT_CONFIG_DIR`, and runs the WebDriver script. The script creates a vault, adds a marker entry, deletes and recreates the application session, unlocks, migrates to a second temporary fixed-disk directory, unlocks again, and verifies the same entry. A shell trap stops only its own driver and cleans only its own temp directories. It never prints credentials or entry contents.

- [ ] **Step 2: Run complete verification**

```bash
npm test
npm run lint
npm run build
npm run test:e2e
cd src-tauri && cargo test && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cd ..
./scripts/verify-local-vault.sh
```

Expected: all commands exit 0 and the real desktop smoke harness passes create/restart/unlock/migrate/re-unlock with identical data. Do not remove the real-Tauri prototype warning until this output exists.

- [ ] **Step 3: Audit secrets, capabilities, and plaintext artifacts**

```bash
rg -n 'fetch\(|axios|XMLHttpRequest|WebSocket\(' src src-tauri/src || true
rg -n 'println!|eprintln!|dbg!|log::|tracing::' src-tauri/src || true
rg -n 'fs::|read_to_string|write\(' src/lib src/features || true
```

Review every match. Confirm no network client, secret logging or direct frontend vault file access. Inspect test vault bytes and temp files for the marker. Confirm config contains only version/path and metadata contains no plaintext credential.

- [ ] **Step 4: Update documentation and mark platform evidence accurately**

README documents real encrypted storage, default paths, fixed-volume restrictions, migration behavior, recovery-key responsibility, demo-browser boundary, verification commands, and remaining exclusions. Record actual macOS results separately from Windows. Do not claim Windows verification without running the same Rust tests and desktop smoke workflow there.

- [ ] **Step 5: Commit the verified vertical slice**

```bash
git add README.md src/components/PrototypeBanner.tsx scripts/verify-local-vault.sh tests/desktop-smoke.mjs package.json package-lock.json src-tauri/tauri.conf.json
git commit -m "feat: verify real encrypted vault workflow"
```

## Completion Evidence

This phase is complete only when all of the following are supported by fresh command output:

- Rust crypto, storage, session, path, migration and command tests pass, including fault injection and tamper cases.
- Frontend unit/integration tests, lint, production build and Chrome E2E pass without demo-to-real writes.
- The real Tauri create/restart/unlock/migrate/re-unlock smoke test passes with identical data.
- Sensitive marker scans show no plaintext database or temporary artifacts.
- Source vault and migration backups survive every tested failure; config never points to a partial target.
- Actual platform results are reported precisely, and any uninstalled prerequisite or unrun Windows verification remains explicitly open.
