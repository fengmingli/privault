use privault_ui_lib::error::{ErrorCode, VaultResult};
use privault_ui_lib::migration::{MigrationFs, StdMigrationFs};
use privault_ui_lib::model::{EntryKind, VaultEntry};
use privault_ui_lib::vault::VaultManager;
use std::path::{Path, PathBuf};
use std::sync::Arc;

struct Fixture {
    manager: VaultManager,
    source: PathBuf,
    destination: PathBuf,
    _dir: tempfile::TempDir,
}

impl Fixture {
    fn new() -> Self {
        Self::with_fs(Arc::new(StdMigrationFs))
    }

    fn with_fs(fs: Arc<dyn MigrationFs + Send + Sync>) -> Self {
        let dir = tempfile::TempDir::new().unwrap();
        let source = dir.path().join("source");
        let destination = dir.path().join("destination");
        std::fs::create_dir(&source).unwrap();
        let mut manager = VaultManager::new_at_for_test(&source).unwrap();
        manager.create("master-password".into()).unwrap();
        manager.unlock("master-password".into()).unwrap();
        let mut entry = VaultEntry::new_empty_for_test(EntryKind::Note);
        entry.common_mut().title = "迁移验证条目".into();
        manager.upsert_entry(entry).unwrap();
        manager.set_migration_fs_for_test(fs);
        Self {
            manager,
            source,
            destination,
            _dir: dir,
        }
    }

    fn prepare(&mut self) -> String {
        self.manager
            .prepare_migration(self.destination.clone())
            .unwrap()
    }
}

#[test]
fn successful_migration_preserves_data_and_backups() {
    let mut fixture = Fixture::new();
    let id = fixture.prepare();
    fixture
        .manager
        .confirm_migration(id, "master-password".into())
        .unwrap();
    assert_eq!(
        fixture.manager.current_location().unwrap().path,
        std::fs::canonicalize(&fixture.destination)
            .unwrap()
            .to_string_lossy()
    );
    assert!(fixture.source.join("vault.db").exists());
    assert!(fixture.source.join("backups").exists());
    assert!(fixture.destination.join("vault.db").exists());
    fixture.manager.unlock("master-password".into()).unwrap();
    assert_eq!(fixture.manager.list_entries().unwrap().len(), 1);
    drop(fixture.manager);
    let mut reopened = VaultManager::new_at_for_test(&fixture.destination).unwrap();
    reopened.unlock("master-password".into()).unwrap();
    assert_eq!(reopened.list_entries().unwrap().len(), 1);
}

#[test]
fn abandoned_prepare_keeps_source_unlockable() {
    let mut fixture = Fixture::new();
    fixture.prepare();
    let source = fixture.source.clone();
    drop(fixture.manager);
    assert!(!fixture.destination.join("vault.db").exists());
    let mut reopened = VaultManager::new_at_for_test(&source).unwrap();
    reopened.unlock("master-password".into()).unwrap();
    assert_eq!(reopened.list_entries().unwrap().len(), 1);
}

#[test]
fn failed_target_verification_keeps_original_location() {
    let mut fixture = Fixture::new();
    let id = fixture.prepare();
    assert!(fixture
        .manager
        .confirm_migration(id, "wrong-password".into())
        .is_err());
    assert_eq!(
        fixture.manager.current_location().unwrap().path,
        fixture.source.to_string_lossy()
    );
    assert!(fixture.source.join("vault.db").exists());
    assert!(fixture.source.join("backups").exists());
    assert!(!fixture.destination.join("vault.db").exists());
    fixture.manager.unlock("master-password".into()).unwrap();
    assert_eq!(fixture.manager.list_entries().unwrap().len(), 1);
}

#[test]
fn cancel_removes_only_temporary_target_files() {
    let mut fixture = Fixture::new();
    let id = fixture.prepare();
    fixture.manager.cancel_migration(id).unwrap();
    assert!(!fixture.destination.join("vault.db").exists());
    assert_eq!(
        fixture.manager.current_location().unwrap().path,
        fixture.source.to_string_lossy()
    );
    fixture.manager.unlock("master-password".into()).unwrap();
}

#[test]
fn migration_cannot_run_twice() {
    let mut fixture = Fixture::new();
    fixture.prepare();
    assert_eq!(
        fixture
            .manager
            .prepare_migration(fixture.destination.clone())
            .unwrap_err()
            .code,
        ErrorCode::MigrationInProgress
    );
}

#[derive(Default)]
struct FaultFs {
    fail_copy: bool,
    fail_backup: bool,
    fail_rename: bool,
    corrupt_target: bool,
}

impl MigrationFs for FaultFs {
    fn create_dir_all(&self, path: &Path) -> VaultResult<()> {
        StdMigrationFs.create_dir_all(path)
    }
    fn copy(&self, source: &Path, destination: &Path) -> VaultResult<u64> {
        if self.fail_backup && destination.to_string_lossy().contains("backups") {
            return Err(privault_ui_lib::error::VaultError::io());
        }
        if self.fail_copy {
            return Err(privault_ui_lib::error::VaultError::io());
        }
        if self.corrupt_target && destination.to_string_lossy().contains(".tmp") {
            std::fs::write(destination, b"not-a-vault")?;
            return Ok(11);
        }
        StdMigrationFs.copy(source, destination)
    }
    fn sync_file(&self, path: &Path) -> VaultResult<()> {
        StdMigrationFs.sync_file(path)
    }
    fn sync_dir(&self, path: &Path) -> VaultResult<()> {
        StdMigrationFs.sync_dir(path)
    }
    fn rename(&self, source: &Path, destination: &Path) -> VaultResult<()> {
        if self.fail_rename {
            return Err(privault_ui_lib::error::VaultError::io());
        }
        StdMigrationFs.rename(source, destination)
    }
    fn remove_file(&self, path: &Path) -> VaultResult<()> {
        StdMigrationFs.remove_file(path)
    }
}

#[test]
fn copy_backup_and_integrity_failures_do_not_switch_location() {
    for fault in [
        FaultFs {
            fail_copy: true,
            ..Default::default()
        },
        FaultFs {
            fail_backup: true,
            ..Default::default()
        },
        FaultFs {
            corrupt_target: true,
            ..Default::default()
        },
        FaultFs {
            fail_rename: true,
            ..Default::default()
        },
    ] {
        let mut fixture = Fixture::with_fs(Arc::new(fault));
        let result = fixture
            .manager
            .prepare_migration(fixture.destination.clone());
        let result = match result {
            Ok(id) => fixture
                .manager
                .confirm_migration(id, "master-password".into()),
            Err(error) => Err(error),
        };
        assert!(result.is_err());
        assert_eq!(
            fixture.manager.current_location().unwrap().path,
            fixture.source.to_string_lossy()
        );
        assert!(fixture.source.join("vault.db").exists());
        assert!(!fixture.destination.join("vault.db").exists());
        fixture.manager.unlock("master-password".into()).unwrap();
    }
}

#[test]
fn config_write_failure_keeps_original_vault() {
    let mut fixture = Fixture::new();
    let id = fixture.prepare();
    let config_directory = fixture.source.join("config-is-a-directory");
    std::fs::create_dir(&config_directory).unwrap();
    fixture.manager.set_config_file_for_test(&config_directory);
    assert!(fixture
        .manager
        .confirm_migration(id, "master-password".into())
        .is_err());
    assert_eq!(
        fixture.manager.current_location().unwrap().path,
        fixture.source.to_string_lossy()
    );
    assert!(fixture.source.join("vault.db").exists());
    assert!(!fixture.destination.join("vault.db").exists());
    fixture.manager.unlock("master-password".into()).unwrap();
}
