use crate::error::{ErrorCode, VaultError, VaultResult};
use crate::model::{AppConfig, StorageLocation};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct Workspace {
    root: PathBuf,
}

impl Workspace {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn db_path(&self) -> PathBuf {
        self.root.join("vault.db")
    }

    pub fn meta_path(&self) -> PathBuf {
        self.root.join("vault.meta")
    }

    pub fn location(&self) -> VaultResult<StorageLocation> {
        Ok(StorageLocation {
            path: self.root.to_string_lossy().into_owned(),
            is_default: self.root == default_vault_dir()?,
            volume_kind: "fixed".into(),
        })
    }
}

pub fn default_vault_dir() -> VaultResult<PathBuf> {
    dirs::data_local_dir()
        .map(|path| path.join("Privault"))
        .ok_or_else(|| VaultError::new(ErrorCode::PathUnavailable, "无法确定本地数据目录"))
}

pub fn default_config_path() -> VaultResult<PathBuf> {
    Ok(default_vault_dir()?.join("config.json"))
}

pub fn load_config() -> VaultResult<AppConfig> {
    load_config_from(&default_config_path()?)
}

pub fn load_config_from(path: &Path) -> VaultResult<AppConfig> {
    if !path.exists() {
        return Ok(AppConfig {
            version: 1,
            storage_path: default_vault_dir()?.to_string_lossy().into_owned(),
        });
    }
    let raw = fs::read_to_string(path)?;
    let config: AppConfig = serde_json::from_str(&raw).map_err(|_| VaultError::corrupt())?;
    if config.version != 1
        || config.storage_path.is_empty()
        || !Path::new(&config.storage_path).is_absolute()
    {
        return Err(VaultError::new(
            ErrorCode::PathUnavailable,
            "存储路径配置无效",
        ));
    }
    Ok(config)
}

fn sync_parent(path: &Path) -> VaultResult<()> {
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    #[cfg(unix)]
    fs::File::open(parent)?.sync_all()?;
    #[cfg(windows)]
    let _ = parent;
    Ok(())
}

pub fn write_config_atomic(path: &Path, config: &AppConfig) -> VaultResult<()> {
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    fs::create_dir_all(parent)?;
    crate::platform::secure_directory(parent)?;
    let temporary = path.with_extension(format!("{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            file.set_permissions(fs::Permissions::from_mode(0o600))?;
        }
        let bytes = serde_json::to_vec_pretty(config)?;
        file.write_all(&bytes)?;
        file.sync_all()?;
        fs::rename(&temporary, path)?;
        sync_parent(path)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}
