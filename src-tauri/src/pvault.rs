use crate::error::{ErrorCode, VaultError, VaultResult};
use crate::path_policy::validate_archive_destination;
use crate::platform::{secure_directory, SystemVolumeInspector};
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

const MAX_ARCHIVE_BYTES: u64 = 64 * 1024 * 1024;
const MAX_MANIFEST_BYTES: u64 = 64 * 1024;
const MAX_TOTAL_UNCOMPRESSED_BYTES: u64 = 128 * 1024 * 1024;
const MAX_COMPRESSION_RATIO: u64 = 200;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PvaultManifest {
    pub format_version: u32,
    pub created_at: String,
}

pub struct PvaultContents {
    pub db_path: PathBuf,
    pub meta_path: PathBuf,
}

fn invalid(message: &str) -> VaultError {
    VaultError::new(ErrorCode::InvalidInput, message.to_string())
}

fn write_entry(writer: &mut ZipWriter<std::fs::File>, name: &str, bytes: &[u8]) -> VaultResult<()> {
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o600);
    writer.start_file(name, options)?;
    writer.write_all(bytes)?;
    Ok(())
}

pub fn write_pvault(destination: &Path, db_path: &Path, meta_path: &Path) -> VaultResult<PathBuf> {
    let required = fs::metadata(db_path)?.len() + fs::metadata(meta_path)?.len();
    let destination = validate_archive_destination(destination, &SystemVolumeInspector, required)?;
    let temporary = destination.with_extension(format!("{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| {
        let file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)?;
        let mut writer = ZipWriter::new(file);
        write_entry(&mut writer, "vault.db", &fs::read(db_path)?)?;
        write_entry(&mut writer, "vault.meta", &fs::read(meta_path)?)?;
        let manifest = PvaultManifest {
            format_version: 1,
            created_at: chrono::Utc::now().to_rfc3339(),
        };
        write_entry(
            &mut writer,
            "manifest.json",
            &serde_json::to_vec_pretty(&manifest)?,
        )?;
        let file = writer.finish()?;
        file.sync_all()?;
        fs::rename(&temporary, &destination)?;
        Ok(destination.clone())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

fn read_limited_entry(
    archive: &mut ZipArchive<std::fs::File>,
    name: &str,
    limit: u64,
) -> VaultResult<Vec<u8>> {
    let entry = archive.by_name(name)?;
    let uncompressed = entry.size();
    let compressed = entry.compressed_size();
    if uncompressed > limit || (compressed > 0 && uncompressed / compressed > MAX_COMPRESSION_RATIO)
    {
        return Err(invalid("保险库文件超出安全大小限制"));
    }
    let mut bytes = Vec::new();
    entry.take(limit + 1).read_to_end(&mut bytes)?;
    if bytes.len() as u64 > limit {
        return Err(invalid("保险库文件超出安全大小限制"));
    }
    Ok(bytes)
}

pub fn read_pvault(source: &Path, staging_dir: &Path) -> VaultResult<PvaultContents> {
    if fs::metadata(source)?.len() > MAX_ARCHIVE_BYTES {
        return Err(invalid("保险库文件超出安全大小限制"));
    }
    let file = std::fs::File::open(source)?;
    let mut archive = ZipArchive::new(file)?;
    if archive.len() != 3 {
        return Err(invalid(
            "保险库文件必须包含 vault.db、vault.meta 和 manifest.json",
        ));
    }
    let mut names = std::collections::HashSet::new();
    for index in 0..archive.len() {
        let name = archive
            .by_index(index)?
            .name()
            .map_err(|_| invalid("保险库文件包含无效条目"))?
            .to_string();
        if !names.insert(name) {
            return Err(invalid("保险库文件包含重复条目"));
        }
    }
    let expected = ["vault.db", "vault.meta", "manifest.json"];
    if names.len() != expected.len() || expected.iter().any(|name| !names.contains(*name)) {
        return Err(invalid(
            "保险库文件必须包含 vault.db、vault.meta 和 manifest.json",
        ));
    }

    let manifest_bytes = read_limited_entry(&mut archive, "manifest.json", MAX_MANIFEST_BYTES)?;
    let manifest: PvaultManifest = serde_json::from_slice(&manifest_bytes)?;
    if manifest.format_version != 1
        || chrono::DateTime::parse_from_rfc3339(&manifest.created_at).is_err()
    {
        return Err(invalid("不支持的保险库文件格式版本"));
    }
    let db_bytes = read_limited_entry(&mut archive, "vault.db", MAX_TOTAL_UNCOMPRESSED_BYTES)?;
    let meta_bytes = read_limited_entry(
        &mut archive,
        "vault.meta",
        MAX_TOTAL_UNCOMPRESSED_BYTES - db_bytes.len() as u64,
    )?;

    fs::create_dir_all(staging_dir)?;
    secure_directory(staging_dir)?;
    let db_path = staging_dir.join("vault.db");
    let meta_path = staging_dir.join("vault.meta");
    for (path, bytes) in [(&db_path, &db_bytes), (&meta_path, &meta_bytes)] {
        let mut file = OpenOptions::new().write(true).create_new(true).open(path)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            file.set_permissions(fs::Permissions::from_mode(0o600))?;
        }
        file.write_all(bytes)?;
        file.sync_all()?;
    }
    Ok(PvaultContents { db_path, meta_path })
}
