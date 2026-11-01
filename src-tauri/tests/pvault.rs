use privault_ui_lib::error::{ErrorCode, VaultResult};
use privault_ui_lib::migration::{MigrationFs, StdMigrationFs};
use privault_ui_lib::model::{EntryKind, VaultEntry};
use privault_ui_lib::vault::VaultManager;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};

fn manager_with_marker() -> (VaultManager, String) {
    let mut manager = VaultManager::new_for_test().unwrap();
    let created = manager.create("Master-pass1!".into()).unwrap();
    manager.unlock("Master-pass1!".into()).unwrap();
    let mut entry = VaultEntry::new_empty_for_test(EntryKind::Login);
    entry.common_mut().title = "PRIVATE-PVAULT-MARKER".into();
    entry.common_mut().favorite = true;
    let VaultEntry::Login(login) = &mut entry else {
        panic!("wrong kind")
    };
    login.username = "archive@example.com".into();
    login.password = "archive-entry-password".into();
    manager.upsert_entry(entry).unwrap();
    (manager, created.recovery_key)
}

#[test]
fn export_contains_only_encrypted_vault_files_and_manifest() {
    let dir = tempfile::TempDir::new().unwrap();
    let destination = dir.path().join("export.pvault");
    let (mut manager, _) = manager_with_marker();
    manager.export_pvault(destination.clone()).unwrap();

    let bytes = std::fs::read(&destination).unwrap();
    assert!(!bytes
        .windows(b"PRIVATE-PVAULT-MARKER".len())
        .any(|window| window == b"PRIVATE-PVAULT-MARKER"));
    let file = std::fs::File::open(&destination).unwrap();
    let mut archive = zip::ZipArchive::new(file).unwrap();
    let mut names = (0..archive.len())
        .map(|index| archive.by_index(index).unwrap().name().unwrap().to_string())
        .collect::<Vec<_>>();
    names.sort();
    assert_eq!(names, ["manifest.json", "vault.db", "vault.meta"]);

    let mut manifest = String::new();
    archive
        .by_name("manifest.json")
        .unwrap()
        .read_to_string(&mut manifest)
        .unwrap();
    let manifest: serde_json::Value = serde_json::from_str(&manifest).unwrap();
    assert_eq!(manifest["formatVersion"], 1);
    assert!(manifest["createdAt"].is_string());
    assert!(archive.by_name("config.json").is_err());
}

#[test]
fn existing_export_target_is_not_overwritten() {
    let dir = tempfile::TempDir::new().unwrap();
    let destination = dir.path().join("export.pvault");
    std::fs::write(&destination, b"do-not-overwrite").unwrap();
    let (mut manager, _) = manager_with_marker();
    assert!(manager.export_pvault(destination.clone()).is_err());
    assert_eq!(std::fs::read(destination).unwrap(), b"do-not-overwrite");
}

#[test]
fn import_roundtrip_preserves_entries_favorites_and_credentials() {
    let dir = tempfile::TempDir::new().unwrap();
    let destination = dir.path().join("export.pvault");
    let (mut source, recovery) = manager_with_marker();
    source.export_pvault(destination.clone()).unwrap();

    let mut imported = VaultManager::new_for_test().unwrap();
    imported.create("Master-pass1!".into()).unwrap();
    imported.unlock("Master-pass1!".into()).unwrap();
    imported
        .import_pvault(destination, "Master-pass1!".into())
        .unwrap();
    imported.unlock("Master-pass1!".into()).unwrap();
    let entries = imported.list_entries().unwrap();
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].title, "PRIVATE-PVAULT-MARKER");
    assert!(entries[0].favorite);

    imported.lock().unwrap();
    let next_recovery = imported
        .recover_access(recovery, "New-master1!".into())
        .unwrap();
    assert!(!next_recovery.recovery_key.is_empty());
    imported.unlock("New-master1!".into()).unwrap();
}

#[test]
fn import_from_empty_state_is_unlockable() {
    let dir = tempfile::TempDir::new().unwrap();
    let destination = dir.path().join("export.pvault");
    let (mut source, _) = manager_with_marker();
    source.export_pvault(destination.clone()).unwrap();
    let mut imported = VaultManager::new_for_test().unwrap();
    imported
        .import_pvault(destination, "Master-pass1!".into())
        .unwrap();
    imported.unlock("Master-pass1!".into()).unwrap();
    assert_eq!(
        imported.list_entries().unwrap()[0].title,
        "PRIVATE-PVAULT-MARKER"
    );
}

#[test]
fn import_from_locked_state_is_unlockable() {
    let dir = tempfile::TempDir::new().unwrap();
    let destination = dir.path().join("export.pvault");
    let (mut source, _) = manager_with_marker();
    source.export_pvault(destination.clone()).unwrap();
    let mut imported = VaultManager::new_for_test().unwrap();
    imported.create("Current-pass1!".into()).unwrap();
    imported
        .import_pvault(destination, "Master-pass1!".into())
        .unwrap();
    imported.unlock("Master-pass1!".into()).unwrap();
    assert_eq!(
        imported.list_entries().unwrap()[0].title,
        "PRIVATE-PVAULT-MARKER"
    );
}

#[test]
fn wrong_password_and_corrupt_archive_keep_current_vault() {
    let dir = tempfile::TempDir::new().unwrap();
    let destination = dir.path().join("export.pvault");
    let (mut source, _) = manager_with_marker();
    source.export_pvault(destination.clone()).unwrap();

    let mut current = VaultManager::new_for_test().unwrap();
    current.create("Master-pass1!".into()).unwrap();
    current.unlock("Master-pass1!".into()).unwrap();
    assert!(current
        .import_pvault(destination.clone(), "Wrong-master1!".into())
        .is_err());
    current.unlock("Master-pass1!".into()).unwrap();
    assert_eq!(current.list_entries().unwrap().len(), 0);

    std::fs::write(&destination, b"not-a-zip").unwrap();
    assert!(current
        .import_pvault(destination, "Master-pass1!".into())
        .is_err());
    current.unlock("Master-pass1!".into()).unwrap();
    assert_eq!(current.list_entries().unwrap().len(), 0);
}

struct FailSecondRenameFs {
    inner: StdMigrationFs,
    renames: AtomicUsize,
}

impl MigrationFs for FailSecondRenameFs {
    fn create_dir_all(&self, path: &Path) -> VaultResult<()> {
        self.inner.create_dir_all(path)
    }
    fn copy(&self, source: &Path, destination: &Path) -> VaultResult<u64> {
        self.inner.copy(source, destination)
    }
    fn sync_file(&self, path: &Path) -> VaultResult<()> {
        self.inner.sync_file(path)
    }
    fn sync_dir(&self, path: &Path) -> VaultResult<()> {
        self.inner.sync_dir(path)
    }
    fn remove_file(&self, path: &Path) -> VaultResult<()> {
        self.inner.remove_file(path)
    }
    fn rename(&self, source: &Path, destination: &Path) -> VaultResult<()> {
        self.renames.fetch_add(1, Ordering::SeqCst);
        if self.renames.load(Ordering::SeqCst) == 2 {
            return Err(privault_ui_lib::error::VaultError::new(
                ErrorCode::IoError,
                "injected rename failure",
            ));
        }
        self.inner.rename(source, destination)
    }
}

#[test]
fn replacement_failure_restores_original_files_and_keeps_backup() {
    let dir = tempfile::TempDir::new().unwrap();
    let destination = dir.path().join("export.pvault");
    let (mut source, _) = manager_with_marker();
    source.export_pvault(destination.clone()).unwrap();

    let mut current = VaultManager::new_for_test().unwrap();
    current.create("Master-pass1!".into()).unwrap();
    current.unlock("Master-pass1!".into()).unwrap();
    current.set_migration_fs_for_test(Arc::new(FailSecondRenameFs {
        inner: StdMigrationFs,
        renames: AtomicUsize::new(0),
    }));
    let original_root = current.workspace_root();
    assert!(current
        .import_pvault(destination, "Master-pass1!".into())
        .is_err());
    assert_eq!(current.workspace_root(), original_root);
    assert!(original_root.join("backups").exists());
    current.unlock("Master-pass1!".into()).unwrap();
    assert_eq!(current.list_entries().unwrap().len(), 0);
}

#[test]
fn archive_rejects_extra_duplicate_and_parent_path_entries() {
    let dir = tempfile::TempDir::new().unwrap();
    let source = dir.path().join("bad.pvault");
    let file = std::fs::File::create(&source).unwrap();
    let mut writer = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default();
    writer.start_file("manifest.json", options).unwrap();
    writer
        .write_all(br#"{"formatVersion":1,"createdAt":"2026-11-01T00:00:00Z"}"#)
        .unwrap();
    writer.start_file("vault.db", options).unwrap();
    writer.write_all(b"db").unwrap();
    writer.start_file("vault.meta", options).unwrap();
    writer.write_all(b"meta").unwrap();
    writer.start_file("../evil", options).unwrap();
    writer.write_all(b"evil").unwrap();
    writer.finish().unwrap();
    let staging = dir.path().join("staging");
    assert!(privault_ui_lib::pvault::read_pvault(&source, &staging).is_err());
}
