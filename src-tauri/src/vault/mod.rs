pub mod entries;

use crate::config::{
    default_config_path, default_vault_dir, load_config, write_config_atomic, Workspace,
};
use crate::crypto::{
    create_meta_with_params, create_slot_for_credential, replace_master_slot, unwrap_dek, Dek,
    KdfParams, KeySlotKind,
};
use crate::error::{ErrorCode, VaultError, VaultResult};
use crate::metadata::{read_meta, write_meta_atomic};
use crate::migration::{MigrationFs, MigrationOperation, StdMigrationFs};
use crate::model::{
    AppConfig, EntryKind, EntrySummary, RecoveryKeyResult, VaultEntry, VaultStatus, VaultStatusKind,
};
use crate::storage::{
    self, delete_entry, get_entry, list_entries, restore_entry, search_entries, upsert_entry,
    verify_integrity,
};
use rusqlite::Connection;
use std::path::{Path, PathBuf};
use std::sync::Arc;

pub(crate) enum SessionState {
    Empty,
    Locked,
    Unlocked { connection: Connection, _dek: Dek },
}

pub struct VaultManager {
    pub(crate) config: AppConfig,
    pub(crate) config_file: PathBuf,
    pub(crate) workspace: Workspace,
    pub(crate) session: SessionState,
    kdf: KdfParams,
    pub(crate) migration: Option<MigrationOperation>,
    pub(crate) migration_fs: Arc<dyn MigrationFs>,
}

impl VaultManager {
    pub fn new() -> VaultResult<Self> {
        let config = load_config()?;
        let config_file = default_config_path()?;
        Self::with_config(config, config_file, KdfParams::calibrated())
    }

    #[doc(hidden)]
    pub fn new_for_test() -> VaultResult<Self> {
        let path = std::env::temp_dir().join(format!("privault-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&path)?;
        Self::with_config(
            AppConfig {
                version: 1,
                storage_path: path.to_string_lossy().into_owned(),
            },
            path.join("config.json"),
            KdfParams::testing(),
        )
    }

    #[doc(hidden)]
    pub fn new_at_for_test(root: &Path) -> VaultResult<Self> {
        Self::with_config(
            AppConfig {
                version: 1,
                storage_path: root.to_string_lossy().into_owned(),
            },
            root.join("config.json"),
            KdfParams::testing(),
        )
    }

    fn with_config(config: AppConfig, config_file: PathBuf, kdf: KdfParams) -> VaultResult<Self> {
        let workspace = Workspace::new(PathBuf::from(&config.storage_path));
        let root = workspace.root();
        if !root.exists() && root != default_vault_dir()? {
            return Err(VaultError::new(
                ErrorCode::PathUnavailable,
                "配置的存储目录不可用",
            ));
        }
        let session = match (workspace.db_path().exists(), workspace.meta_path().exists()) {
            (false, false) => SessionState::Empty,
            (true, true) => SessionState::Locked,
            _ => return Err(VaultError::corrupt()),
        };
        Ok(Self {
            config,
            config_file,
            workspace,
            session,
            kdf,
            migration: None,
            migration_fs: Arc::new(StdMigrationFs),
        })
    }

    #[doc(hidden)]
    pub fn set_migration_fs_for_test(&mut self, fs: Arc<dyn MigrationFs>) {
        self.migration_fs = fs;
    }

    #[doc(hidden)]
    pub fn set_config_file_for_test(&mut self, path: &Path) {
        self.config_file = path.to_path_buf();
    }

    pub fn workspace_root(&self) -> PathBuf {
        self.workspace.root().to_path_buf()
    }

    pub fn current_location(&self) -> VaultResult<crate::model::StorageLocation> {
        self.workspace.location()
    }

    pub fn status(&self) -> VaultStatus {
        VaultStatus {
            state: match self.session {
                SessionState::Empty => VaultStatusKind::Empty,
                SessionState::Locked => VaultStatusKind::Locked,
                SessionState::Unlocked { .. } => VaultStatusKind::Unlocked,
            },
            location: self
                .current_location()
                .expect("default directory must be available"),
        }
    }

    fn validate_password(password: &str) -> VaultResult<()> {
        if password.chars().count() < 12 {
            Err(VaultError::new(
                ErrorCode::InvalidInput,
                "主密码至少需要 12 位",
            ))
        } else {
            Ok(())
        }
    }

    pub fn create(&mut self, master_password: String) -> VaultResult<RecoveryKeyResult> {
        if !matches!(self.session, SessionState::Empty)
            || self.workspace.db_path().exists()
            || self.workspace.meta_path().exists()
        {
            return Err(VaultError::new(
                ErrorCode::VaultAlreadyExists,
                "当前目录已有保险库",
            ));
        }
        Self::validate_password(&master_password)?;
        let root = self.workspace.root();
        std::fs::create_dir_all(root)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(root, std::fs::Permissions::from_mode(0o700))?;
        }
        let recovery_key = crate::crypto::generate_recovery_key()?;
        let (meta, dek) = create_meta_with_params(&master_password, &recovery_key, self.kdf)?;
        let db_path = self.workspace.db_path();
        let meta_path = self.workspace.meta_path();
        storage::open_database(&db_path, &dek)?;
        if let Err(error) = write_meta_atomic(&meta_path, &meta) {
            let _ = std::fs::remove_file(&db_path);
            return Err(error);
        }
        if let Err(error) = write_config_atomic(&self.config_file, &self.config) {
            let _ = std::fs::remove_file(&db_path);
            let _ = std::fs::remove_file(&meta_path);
            return Err(error);
        }
        self.session = SessionState::Locked;
        Ok(RecoveryKeyResult { recovery_key })
    }

    pub fn unlock(&mut self, password: String) -> VaultResult<VaultStatus> {
        if matches!(self.session, SessionState::Unlocked { .. }) {
            return Ok(self.status());
        }
        if matches!(self.session, SessionState::Empty) {
            return Err(VaultError::new(ErrorCode::VaultNotFound, "保险库不存在"));
        }
        let meta = read_meta(&self.workspace.meta_path())?;
        let dek = unwrap_dek(&meta, &password, KeySlotKind::Master)?;
        let connection = storage::open_database(&self.workspace.db_path(), &dek)?;
        verify_integrity(&connection)?;
        self.session = SessionState::Unlocked {
            connection,
            _dek: dek,
        };
        Ok(self.status())
    }

    pub fn lock(&mut self) -> VaultResult<()> {
        self.session = if matches!(self.session, SessionState::Empty) {
            SessionState::Empty
        } else {
            SessionState::Locked
        };
        Ok(())
    }

    pub fn list_entries(&self) -> VaultResult<Vec<EntrySummary>> {
        match &self.session {
            SessionState::Unlocked { connection, .. } => list_entries(connection),
            _ => Err(VaultError::new(ErrorCode::Locked, "保险库已锁定")),
        }
    }

    pub fn search_entries(
        &self,
        kind: Option<EntryKind>,
        query: &str,
    ) -> VaultResult<Vec<EntrySummary>> {
        match &self.session {
            SessionState::Unlocked { connection, .. } => search_entries(connection, kind, query),
            _ => Err(VaultError::new(ErrorCode::Locked, "保险库已锁定")),
        }
    }

    pub fn get_entry(&self, id: &str) -> VaultResult<VaultEntry> {
        match &self.session {
            SessionState::Unlocked { connection, .. } => get_entry(connection, id),
            _ => Err(VaultError::new(ErrorCode::Locked, "保险库已锁定")),
        }
    }

    pub fn upsert_entry(&mut self, entry: VaultEntry) -> VaultResult<VaultEntry> {
        match &mut self.session {
            SessionState::Unlocked { connection, .. } => upsert_entry(connection, entry),
            _ => Err(VaultError::new(ErrorCode::Locked, "保险库已锁定")),
        }
    }

    pub fn delete_entry(&mut self, id: &str) -> VaultResult<()> {
        match &mut self.session {
            SessionState::Unlocked { connection, .. } => delete_entry(connection, id),
            _ => Err(VaultError::new(ErrorCode::Locked, "保险库已锁定")),
        }
    }

    pub fn restore_entry(&mut self, id: &str) -> VaultResult<()> {
        match &mut self.session {
            SessionState::Unlocked { connection, .. } => restore_entry(connection, id),
            _ => Err(VaultError::new(ErrorCode::Locked, "保险库已锁定")),
        }
    }

    pub fn change_master_password(&mut self, current: String, new: String) -> VaultResult<()> {
        if !matches!(self.session, SessionState::Unlocked { .. }) {
            return Err(VaultError::new(ErrorCode::Locked, "保险库已锁定"));
        }
        Self::validate_password(&new)?;
        let mut meta = read_meta(&self.workspace.meta_path())?;
        unwrap_dek(&meta, &current, KeySlotKind::Master)?;
        replace_master_slot(&mut meta, &current, &new)?;
        write_meta_atomic(&self.workspace.meta_path(), &meta)?;
        self.lock()
    }

    pub fn recover_access(
        &mut self,
        recovery_key: String,
        new_master: String,
    ) -> VaultResult<RecoveryKeyResult> {
        if matches!(self.session, SessionState::Empty) {
            return Err(VaultError::new(ErrorCode::VaultNotFound, "保险库不存在"));
        }
        Self::validate_password(&new_master)?;
        let mut meta = read_meta(&self.workspace.meta_path())?;
        let dek = unwrap_dek(&meta, &recovery_key, KeySlotKind::Recovery)?;
        let connection = storage::open_database(&self.workspace.db_path(), &dek)?;
        verify_integrity(&connection)?;
        drop(connection);
        let next_recovery = crate::crypto::generate_recovery_key()?;
        meta.master = create_slot_for_credential(
            &dek,
            &new_master,
            KeySlotKind::Master,
            &meta.vault_id,
            KdfParams::calibrated(),
        )?;
        meta.recovery = create_slot_for_credential(
            &dek,
            &next_recovery,
            KeySlotKind::Recovery,
            &meta.vault_id,
            KdfParams::calibrated(),
        )?;
        write_meta_atomic(&self.workspace.meta_path(), &meta)?;
        self.lock()?;
        Ok(RecoveryKeyResult {
            recovery_key: next_recovery,
        })
    }
}
