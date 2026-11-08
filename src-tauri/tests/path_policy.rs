use privault_ui_lib::config::{load_config_from, write_config_atomic};
use privault_ui_lib::error::{ErrorCode, VaultResult};
use privault_ui_lib::model::AppConfig;
use privault_ui_lib::path_policy::{validate_destination, VolumeInspector, VolumeKind};
use privault_ui_lib::platform::SystemVolumeInspector;
use std::path::{Path, PathBuf};

struct FakeInspector {
    kind: VolumeKind,
    space: u64,
    network_paths: Vec<PathBuf>,
}

impl FakeInspector {
    fn new(kind: VolumeKind) -> Self {
        Self {
            kind,
            space: u64::MAX,
            network_paths: Vec::new(),
        }
    }
    fn with_space(mut self, space: u64) -> Self {
        self.space = space;
        self
    }
    #[cfg(unix)]
    fn with_network_path(mut self, path: &Path) -> Self {
        self.network_paths.push(path.to_path_buf());
        self
    }
}

impl VolumeInspector for FakeInspector {
    fn kind(&self, path: &Path) -> VaultResult<VolumeKind> {
        if self.network_paths.iter().any(|candidate| candidate == path) {
            Ok(VolumeKind::Network)
        } else {
            Ok(self.kind)
        }
    }
    fn available_bytes(&self, _path: &Path) -> VaultResult<u64> {
        Ok(self.space)
    }
}

#[test]
fn fixed_destination_is_created() {
    let dir = tempfile::TempDir::new().unwrap();
    let candidate = dir.path().join("candidate");
    let inspector = FakeInspector::new(VolumeKind::Fixed);
    let validated = validate_destination(&candidate, &inspector, 1024, None).unwrap();
    assert!(validated.path.exists());
    assert_eq!(validated.volume_kind, VolumeKind::Fixed);
}

#[test]
fn rejects_network_and_removable_volumes_without_creating_target() {
    for kind in [VolumeKind::Network, VolumeKind::Removable] {
        let dir = tempfile::TempDir::new().unwrap();
        let candidate = dir.path().join("candidate");
        let inspector = FakeInspector::new(kind);
        let error = validate_destination(&candidate, &inspector, 1024, None).unwrap_err();
        assert_eq!(error.code, ErrorCode::PathUnsupported);
        assert!(!candidate.exists());
    }
}

#[test]
fn rejects_root_conflict_same_source_and_insufficient_space() {
    let inspector = FakeInspector::new(VolumeKind::Fixed);
    assert_eq!(
        validate_destination(Path::new("/"), &inspector, 1024, None)
            .unwrap_err()
            .code,
        ErrorCode::PathUnsupported
    );

    let dir = tempfile::TempDir::new().unwrap();
    let source = dir.path().join("source");
    std::fs::create_dir(&source).unwrap();
    assert_eq!(
        validate_destination(&source, &inspector, 1024, Some(&source))
            .unwrap_err()
            .code,
        ErrorCode::PathConflict
    );

    let conflict = dir.path().join("conflict");
    std::fs::create_dir(&conflict).unwrap();
    std::fs::write(conflict.join("vault.db"), b"encrypted").unwrap();
    assert_eq!(
        validate_destination(&conflict, &inspector, 1024, None)
            .unwrap_err()
            .code,
        ErrorCode::PathConflict
    );

    let target = dir.path().join("space");
    let limited = FakeInspector::new(VolumeKind::Fixed).with_space(10);
    assert_eq!(
        validate_destination(&target, &limited, 100, None)
            .unwrap_err()
            .code,
        ErrorCode::InsufficientSpace
    );
    assert!(!target.exists());
}

#[cfg(unix)]
#[test]
fn rejects_unwritable_directory() {
    use std::os::unix::fs::PermissionsExt;
    let dir = tempfile::TempDir::new().unwrap();
    let candidate = dir.path().join("readonly");
    std::fs::create_dir(&candidate).unwrap();
    std::fs::set_permissions(&candidate, std::fs::Permissions::from_mode(0o400)).unwrap();
    let inspector = FakeInspector::new(VolumeKind::Fixed);
    assert_eq!(
        validate_destination(&candidate, &inspector, 1024, None)
            .unwrap_err()
            .code,
        ErrorCode::PathUnavailable
    );
    std::fs::set_permissions(&candidate, std::fs::Permissions::from_mode(0o700)).unwrap();
}

#[cfg(unix)]
#[test]
fn rejects_symlink_escape_to_another_volume() {
    let dir = tempfile::TempDir::new().unwrap();
    let actual = dir.path().join("actual");
    let link = dir.path().join("link");
    std::fs::create_dir(&actual).unwrap();
    std::os::unix::fs::symlink(&actual, &link).unwrap();
    let inspector = FakeInspector::new(VolumeKind::Fixed)
        .with_network_path(&std::fs::canonicalize(&actual).unwrap());
    assert_eq!(
        validate_destination(&link, &inspector, 1024, None)
            .unwrap_err()
            .code,
        ErrorCode::PathUnsupported
    );
}

#[test]
fn host_temp_volume_is_fixed() {
    let dir = tempfile::TempDir::new().unwrap();
    let inspector = SystemVolumeInspector;
    assert_eq!(inspector.kind(dir.path()).unwrap(), VolumeKind::Fixed);
    assert!(inspector.available_bytes(dir.path()).unwrap() > 0);
}

#[test]
fn config_round_trip_contains_only_version_and_path() {
    let dir = tempfile::TempDir::new().unwrap();
    let path = dir.path().join("config.json");
    let config = AppConfig {
        version: 1,
        storage_path: dir.path().to_string_lossy().into_owned(),
    };
    write_config_atomic(&path, &config).unwrap();
    let loaded = load_config_from(&path).unwrap();
    assert_eq!(loaded.version, 1);
    assert_eq!(loaded.storage_path, config.storage_path);
    let raw = std::fs::read_to_string(path).unwrap();
    assert!(!raw.contains("masterPassword"));
    assert!(!raw.contains("recoveryKey"));
}
