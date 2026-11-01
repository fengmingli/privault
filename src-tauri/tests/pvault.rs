use privault_ui_lib::model::{EntryKind, VaultEntry};
use privault_ui_lib::vault::VaultManager;
use std::io::Read;

fn manager_with_marker() -> VaultManager {
    let mut manager = VaultManager::new_for_test().unwrap();
    manager.create("Master-pass1!".into()).unwrap();
    manager.unlock("Master-pass1!".into()).unwrap();
    let mut entry = VaultEntry::new_empty_for_test(EntryKind::Login);
    entry.common_mut().title = "PRIVATE-PVAULT-MARKER".into();
    entry.common_mut().favorite = true;
    let VaultEntry::Login(login) = &mut entry else {
        panic!("wrong kind")
    };
    login.username = "archive@example.com".into();
    login.password = "archive-entry-password".into();
    manager.upsert_entry(entry).unwrap();
    manager
}

#[test]
fn export_contains_only_encrypted_vault_files_and_manifest() {
    let dir = tempfile::TempDir::new().unwrap();
    let destination = dir.path().join("export.pvault");
    let mut manager = manager_with_marker();
    manager.export_pvault(destination.clone()).unwrap();

    let bytes = std::fs::read(&destination).unwrap();
    assert!(!bytes
        .windows(b"PRIVATE-PVAULT-MARKER".len())
        .any(|window| window == b"PRIVATE-PVAULT-MARKER"));
    let file = std::fs::File::open(&destination).unwrap();
    let mut archive = zip::ZipArchive::new(file).unwrap();
    let mut names = (0..archive.len())
        .map(|index| archive.by_index(index).unwrap().name().unwrap().to_string())
        .collect::<Vec<_>>();
    names.sort();
    assert_eq!(names, ["manifest.json", "vault.db", "vault.meta"]);

    let mut manifest = String::new();
    archive
        .by_name("manifest.json")
        .unwrap()
        .read_to_string(&mut manifest)
        .unwrap();
    let manifest: serde_json::Value = serde_json::from_str(&manifest).unwrap();
    assert_eq!(manifest["formatVersion"], 1);
    assert!(manifest["createdAt"].is_string());
    assert!(archive.by_name("config.json").is_err());
}

#[test]
fn existing_export_target_is_not_overwritten() {
    let dir = tempfile::TempDir::new().unwrap();
    let destination = dir.path().join("export.pvault");
    std::fs::write(&destination, b"do-not-overwrite").unwrap();
    let mut manager = manager_with_marker();
    assert!(manager.export_pvault(destination.clone()).is_err());
    assert_eq!(std::fs::read(destination).unwrap(), b"do-not-overwrite");
}
