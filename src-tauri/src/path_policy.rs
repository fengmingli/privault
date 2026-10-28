use crate::error::{ErrorCode, VaultError, VaultResult};
use crate::platform::secure_directory;
use std::fs::{self, OpenOptions};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VolumeKind {
    Fixed,
    Removable,
    Network,
}

pub trait VolumeInspector {
    fn kind(&self, path: &Path) -> VaultResult<VolumeKind>;
    fn available_bytes(&self, path: &Path) -> VaultResult<u64>;
}

#[derive(Debug, Clone)]
pub struct ValidatedPath {
    pub path: PathBuf,
    pub volume_kind: VolumeKind,
    pub available_bytes: u64,
}

fn unsupported(message: &str) -> VaultError {
    VaultError::new(ErrorCode::PathUnsupported, message.to_string())
}

fn canonicalize_candidate(path: &Path) -> VaultResult<PathBuf> {
    let mut missing = Vec::new();
    let mut current = path;
    while !current.exists() {
        let name = current
            .file_name()
            .ok_or_else(|| unsupported("存储路径无效"))?;
        missing.push(name.to_os_string());
        current = current
            .parent()
            .ok_or_else(|| unsupported("存储路径无效"))?;
    }
    let mut canonical = fs::canonicalize(current)?;
    for component in missing.iter().rev() {
        canonical.push(component);
    }
    Ok(canonical)
}

pub fn validate_destination(
    path: &Path,
    inspector: &dyn VolumeInspector,
    required_bytes: u64,
    source: Option<&Path>,
) -> VaultResult<ValidatedPath> {
    if !path.is_absolute() || path.parent().is_none() {
        return Err(unsupported("存储路径必须是固定磁盘上的非根目录"));
    }
    let canonical = canonicalize_candidate(path)?;
    if canonical.parent().is_none() {
        return Err(unsupported("不能将文件系统根目录作为保险库目录"));
    }
    if inspector.kind(&canonical)? != VolumeKind::Fixed {
        return Err(unsupported("仅支持本机固定磁盘目录"));
    }
    if let Some(source) = source {
        if canonicalize_candidate(source)? == canonical {
            return Err(VaultError::new(
                ErrorCode::PathConflict,
                "目标目录与当前保险库目录相同",
            ));
        }
    }
    if canonical.join("vault.db").exists() || canonical.join("vault.meta").exists() {
        return Err(VaultError::new(
            ErrorCode::PathConflict,
            "目标目录已有保险库",
        ));
    }
    if canonical.exists() && !canonical.is_dir() {
        return Err(VaultError::new(ErrorCode::PathUnavailable, "目标不是目录"));
    }
    let available_bytes = inspector.available_bytes(&canonical)?;
    if available_bytes < required_bytes {
        return Err(VaultError::new(
            ErrorCode::InsufficientSpace,
            "目标目录可用空间不足",
        ));
    }

    fs::create_dir_all(&canonical)
        .map_err(|_| VaultError::new(ErrorCode::PathUnavailable, "无法创建存储目录"))?;
    let probe = canonical.join(format!(".privault-write-test-{}", uuid::Uuid::new_v4()));
    OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&probe)
        .map_err(|_| VaultError::new(ErrorCode::PathUnavailable, "存储目录不可写"))?;
    fs::remove_file(&probe)?;
    secure_directory(&canonical)?;
    Ok(ValidatedPath {
        path: canonical,
        volume_kind: VolumeKind::Fixed,
        available_bytes,
    })
}
