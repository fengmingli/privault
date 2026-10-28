use crate::crypto::VaultMeta;
use crate::error::{VaultError, VaultResult};
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

pub fn read_meta(path: &Path) -> VaultResult<VaultMeta> {
    let raw = fs::read_to_string(path).map_err(|_| VaultError::corrupt())?;
    let meta = serde_json::from_str(&raw).map_err(|_| VaultError::corrupt())?;
    Ok(meta)
}

fn sync_parent(path: &Path) -> VaultResult<()> {
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    #[cfg(unix)]
    File::open(parent)?.sync_all()?;
    #[cfg(windows)]
    let _ = parent;
    Ok(())
}

fn temporary_path(path: &Path) -> PathBuf {
    path.with_extension(format!("{}.tmp", uuid::Uuid::new_v4()))
}

pub fn write_meta_atomic(path: &Path, meta: &VaultMeta) -> VaultResult<()> {
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    fs::create_dir_all(parent)?;
    if path.exists() {
        let backups = parent.join("backups");
        fs::create_dir_all(&backups)?;
        fs::copy(
            path,
            backups.join(format!("metadata-{}.meta", uuid::Uuid::new_v4())),
        )?;
    }

    let temporary = temporary_path(path);
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
        let bytes = serde_json::to_vec_pretty(meta)?;
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
