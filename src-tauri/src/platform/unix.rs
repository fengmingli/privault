use crate::error::{ErrorCode, VaultError, VaultResult};
use crate::path_policy::{VolumeInspector, VolumeKind};
use std::ffi::{CStr, CString};
use std::path::{Path, PathBuf};
use std::process::Command;

pub struct SystemVolumeInspector;

fn c_string(path: &Path) -> VaultResult<CString> {
    CString::new(path.to_string_lossy().as_bytes())
        .map_err(|_| VaultError::new(ErrorCode::PathUnsupported, "路径包含无效字符"))
}

fn existing_ancestor(path: &Path) -> VaultResult<PathBuf> {
    let mut current = path;
    while !current.exists() {
        current = current
            .parent()
            .ok_or_else(|| VaultError::new(ErrorCode::PathUnavailable, "无法读取卷信息"))?;
    }
    Ok(current.to_path_buf())
}

fn stat(path: &Path) -> VaultResult<libc::statfs> {
    let path = c_string(&existing_ancestor(path)?)?;
    let mut stats = unsafe { std::mem::zeroed::<libc::statfs>() };
    let result = unsafe { libc::statfs(path.as_ptr(), &mut stats) };
    if result != 0 {
        return Err(VaultError::new(
            ErrorCode::PathUnavailable,
            "无法读取卷信息",
        ));
    }
    Ok(stats)
}

fn plist_bool(output: &str, key: &str) -> bool {
    output
        .split(&format!("<key>{key}</key>"))
        .nth(1)
        .map(|rest| rest.trim_start().starts_with("<true/>"))
        .unwrap_or(false)
}

fn mount_point(stats: &libc::statfs) -> VaultResult<PathBuf> {
    let mount = unsafe { CStr::from_ptr(stats.f_mntonname.as_ptr()) };
    if mount.is_empty() {
        return Err(VaultError::new(
            ErrorCode::PathUnavailable,
            "无法确定卷挂载点",
        ));
    }
    Ok(PathBuf::from(mount.to_string_lossy().into_owned()))
}

fn is_removable(path: &Path) -> VaultResult<bool> {
    let output = Command::new("diskutil")
        .args(["info", "-plist"])
        .arg(path)
        .output()
        .map_err(|_| VaultError::new(ErrorCode::PathUnsupported, "无法确认卷是否可移动"))?;
    if !output.status.success() {
        return Err(VaultError::new(
            ErrorCode::PathUnsupported,
            "无法确认卷是否可移动",
        ));
    }
    let plist = String::from_utf8_lossy(&output.stdout);
    Ok(plist_bool(&plist, "Removable") || plist_bool(&plist, "Ejectable"))
}

impl VolumeInspector for SystemVolumeInspector {
    fn kind(&self, path: &Path) -> VaultResult<VolumeKind> {
        let stats = stat(path)?;
        if stats.f_flags & libc::MNT_LOCAL as u32 == 0 {
            return Ok(VolumeKind::Network);
        }
        if is_removable(&mount_point(&stats)?)? {
            Ok(VolumeKind::Removable)
        } else {
            Ok(VolumeKind::Fixed)
        }
    }

    fn available_bytes(&self, path: &Path) -> VaultResult<u64> {
        let stats = stat(path)?;
        Ok(stats.f_bavail as u64 * stats.f_bsize as u64)
    }
}

pub fn secure_directory(path: &Path) -> VaultResult<()> {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o700))?;
    Ok(())
}
