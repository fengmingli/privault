use crate::config::{write_config_atomic, Workspace};
use crate::crypto::{unwrap_dek, KeySlotKind};
use crate::error::{ErrorCode, VaultError, VaultResult};
use crate::metadata::read_meta;
use crate::model::{MigrationId, StorageLocation};
use crate::path_policy::validate_destination;
use crate::platform::{secure_directory, SystemVolumeInspector};
use crate::storage::{open_database, verify_integrity};
use crate::vault::{SessionState, VaultManager};
use std::fs::{self, File};
use std::path::{Path, PathBuf};

pub trait MigrationFs: Send + Sync {
    fn create_dir_all(&self, path: &Path) -> VaultResult<()>;
    fn copy(&self, source: &Path, destination: &Path) -> VaultResult<u64>;
    fn sync_file(&self, path: &Path) -> VaultResult<()>;
    fn sync_dir(&self, path: &Path) -> VaultResult<()>;
    fn rename(&self, source: &Path, destination: &Path) -> VaultResult<()>;
    fn remove_file(&self, path: &Path) -> VaultResult<()>;
}

#[derive(Debug, Clone, Copy)]
pub struct StdMigrationFs;

impl MigrationFs for StdMigrationFs {
    fn create_dir_all(&self, path: &Path) -> VaultResult<()> {
        fs::create_dir_all(path)?;
        Ok(())
    }

    fn copy(&self, source: &Path, destination: &Path) -> VaultResult<u64> {
        Ok(fs::copy(source, destination)?)
    }

    fn sync_file(&self, path: &Path) -> VaultResult<()> {
        File::open(path)?.sync_all()?;
        Ok(())
    }

    fn sync_dir(&self, path: &Path) -> VaultResult<()> {
        #[cfg(unix)]
        File::open(path)?.sync_all()?;
        #[cfg(windows)]
        let _ = path;
        Ok(())
    }

    fn rename(&self, source: &Path, destination: &Path) -> VaultResult<()> {
        fs::rename(source, destination)?;
        Ok(())
    }

    fn remove_file(&self, path: &Path) -> VaultResult<()> {
        match fs::remove_file(path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(error.into()),
        }
    }
}

#[derive(Clone)]
pub(crate) struct MigrationOperation {
    id: MigrationId,
    source: PathBuf,
    destination: PathBuf,
    temp_db: PathBuf,
    temp_meta: PathBuf,
}

impl VaultManager {
    fn cleanup_migration_files(&self, operation: &MigrationOperation) {
        for path in [
            &operation.temp_db,
            &operation.temp_meta,
            &operation.destination.join("vault.db"),
            &operation.destination.join("vault.meta"),
        ] {
            let _ = self.migration_fs.remove_file(path);
        }
    }

    pub fn prepare_migration(&mut self, destination: PathBuf) -> VaultResult<MigrationId> {
        if self.migration.is_some() {
            return Err(VaultError::new(
                ErrorCode::MigrationInProgress,
                "已有存储迁移正在进行",
            ));
        }
        if matches!(self.session, SessionState::Empty) {
            return Err(VaultError::new(ErrorCode::VaultNotFound, "保险库不存在"));
        }
        self.lock()?;
        let source = self.workspace_root();
        let required = fs::metadata(source.join("vault.db"))?.len()
            + fs::metadata(source.join("vault.meta"))?.len();
        let validated = validate_destination(
            &destination,
            &SystemVolumeInspector,
            required.saturating_mul(2).saturating_add(1_048_576),
            Some(&source),
        )?;
        let destination = validated.path;
        let id = uuid::Uuid::new_v4().to_string();
        let backup = source.join("backups").join(format!(
            "migration-{}-{}",
            chrono::Utc::now().format("%Y%m%dT%H%M%SZ"),
            id
        ));
        let temp_db = destination.join(format!(".vault-{id}.db.tmp"));
        let temp_meta = destination.join(format!(".vault-{id}.meta.tmp"));
        let operation = MigrationOperation {
            id: id.clone(),
            source: source.clone(),
            destination,
            temp_db,
            temp_meta,
        };

        let result = (|| {
            self.migration_fs.create_dir_all(&backup)?;
            secure_directory(&backup)?;
            self.migration_fs
                .copy(&source.join("vault.db"), &backup.join("vault.db"))?;
            self.migration_fs
                .copy(&source.join("vault.meta"), &backup.join("vault.meta"))?;
            self.migration_fs.sync_file(&backup.join("vault.db"))?;
            self.migration_fs.sync_file(&backup.join("vault.meta"))?;
            self.migration_fs.sync_dir(&backup)?;
            self.migration_fs
                .copy(&source.join("vault.db"), &operation.temp_db)?;
            self.migration_fs
                .copy(&source.join("vault.meta"), &operation.temp_meta)?;
            self.migration_fs.sync_file(&operation.temp_db)?;
            self.migration_fs.sync_file(&operation.temp_meta)?;
            self.migration_fs.sync_dir(&operation.destination)
        })();
        if let Err(error) = result {
            self.cleanup_migration_files(&operation);
            return Err(error);
        }
        self.migration = Some(operation);
        Ok(id)
    }

    pub fn confirm_migration(
        &mut self,
        id: MigrationId,
        master_password: String,
    ) -> VaultResult<StorageLocation> {
        let operation = self
            .migration
            .clone()
            .filter(|operation| operation.id == id)
            .ok_or_else(|| {
                VaultError::new(ErrorCode::MigrationNotFound, "迁移操作不存在或已结束")
            })?;
        let source = operation.source.clone();
        let result = (|| {
            let meta = read_meta(&operation.temp_meta)?;
            let dek = unwrap_dek(&meta, &master_password, KeySlotKind::Master)?;
            let connection = open_database(&operation.temp_db, &dek)?;
            verify_integrity(&connection)?;
            drop(connection);

            self.migration_fs
                .rename(&operation.temp_db, &operation.destination.join("vault.db"))?;
            self.migration_fs.rename(
                &operation.temp_meta,
                &operation.destination.join("vault.meta"),
            )?;
            self.migration_fs.sync_dir(&operation.destination)?;
            self.config.storage_path = operation.destination.to_string_lossy().into_owned();
            write_config_atomic(&self.config_file, &self.config)?;
            self.workspace = Workspace::new(operation.destination.clone());
            self.current_location()
        })();
        if let Err(error) = result {
            self.config.storage_path = source.to_string_lossy().into_owned();
            self.workspace = Workspace::new(source.clone());
            self.cleanup_migration_files(&operation);
            self.migration = None;
            return Err(error);
        }
        self.migration = None;
        result
    }

    pub fn cancel_migration(&mut self, id: MigrationId) -> VaultResult<()> {
        let operation = self
            .migration
            .clone()
            .filter(|operation| operation.id == id)
            .ok_or_else(|| {
                VaultError::new(ErrorCode::MigrationNotFound, "迁移操作不存在或已结束")
            })?;
        self.cleanup_migration_files(&operation);
        self.migration = None;
        Ok(())
    }
}
