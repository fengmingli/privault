use crate::error::{ErrorCode, VaultError, VaultResult};
use crate::path_policy::{VolumeInspector, VolumeKind};
use std::os::windows::ffi::OsStrExt;
use std::path::Path;
use std::process::Command;
use windows_sys::Win32::Storage::FileSystem::{
    GetDiskFreeSpaceExW, GetDriveTypeW, GetVolumePathNameW, DRIVE_FIXED, DRIVE_REMOTE,
    DRIVE_REMOVABLE,
};

pub struct SystemVolumeInspector;

fn wide(path: &Path) -> Vec<u16> {
    path.as_os_str().encode_wide().chain(Some(0)).collect()
}

fn volume_root(path: &Path) -> VaultResult<Vec<u16>> {
    let path = wide(path);
    let mut root = [0_u16; 1024];
    let success =
        unsafe { GetVolumePathNameW(path.as_ptr(), root.as_mut_ptr(), root.len() as u32) };
    if success == 0 {
        return Err(VaultError::new(
            ErrorCode::PathUnavailable,
            "无法确定卷根目录",
        ));
    }
    Ok(root.to_vec())
}

impl VolumeInspector for SystemVolumeInspector {
    fn kind(&self, path: &Path) -> VaultResult<VolumeKind> {
        let root = volume_root(path)?;
        match unsafe { GetDriveTypeW(root.as_ptr()) } {
            DRIVE_FIXED => Ok(VolumeKind::Fixed),
            DRIVE_REMOVABLE => Ok(VolumeKind::Removable),
            DRIVE_REMOTE => Ok(VolumeKind::Network),
            _ => Ok(VolumeKind::Network),
        }
    }

    fn available_bytes(&self, path: &Path) -> VaultResult<u64> {
        let path = wide(path);
        let mut available = 0_u64;
        let mut total = 0_u64;
        let mut free = 0_u64;
        let success =
            unsafe { GetDiskFreeSpaceExW(path.as_ptr(), &mut available, &mut total, &mut free) };
        if success == 0 {
            return Err(VaultError::new(
                ErrorCode::PathUnavailable,
                "无法读取可用空间",
            ));
        }
        Ok(available)
    }
}

fn current_identity() -> VaultResult<String> {
    let output = Command::new("whoami")
        .output()
        .map_err(|_| VaultError::new(ErrorCode::PathUnavailable, "无法确定当前用户"))?;
    if !output.status.success() {
        return Err(VaultError::new(
            ErrorCode::PathUnavailable,
            "无法确定当前用户",
        ));
    }
    let identity = String::from_utf8_lossy(&output.stdout).trim().to_owned();
    if identity.is_empty() {
        return Err(VaultError::new(
            ErrorCode::PathUnavailable,
            "无法确定当前用户",
        ));
    }
    Ok(identity)
}

pub fn secure_directory(path: &Path) -> VaultResult<()> {
    let identity = current_identity()?;
    let status = Command::new("icacls")
        .arg(path)
        .arg("/inheritance:r")
        .arg("/grant:r")
        .arg(format!("{identity}:(OI)(CI)F"))
        .status()
        .map_err(|_| VaultError::new(ErrorCode::PathUnavailable, "无法设置目录权限"))?;
    if status.success() {
        Ok(())
    } else {
        Err(VaultError::new(
            ErrorCode::PathUnavailable,
            "无法设置目录权限",
        ))
    }
}
