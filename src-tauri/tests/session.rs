use privault_ui_lib::model::{EntryKind, VaultEntry, VaultStatusKind};
use privault_ui_lib::vault::VaultManager;

fn note(title: &str) -> VaultEntry {
    let mut entry = VaultEntry::new_empty_for_test(EntryKind::Note);
    entry.common_mut().title = title.into();
    entry
}

#[test]
fn create_unlock_restart_and_lock_workflow() {
    let mut manager = VaultManager::new_for_test().unwrap();
    let created = manager.create("Master-pass1!".into()).unwrap();
    assert_eq!(manager.status().state, VaultStatusKind::Locked);
    assert!(manager.unlock("wrong-password".into()).is_err());
    manager.unlock("Master-pass1!".into()).unwrap();
    manager.upsert_entry(note("重启验证条目")).unwrap();
    manager.lock().unwrap();
    assert!(manager.list_entries().is_err());

    let root = manager.workspace_root();
    drop(manager);
    let mut reopened = VaultManager::new_at_for_test(&root).unwrap();
    reopened.unlock("Master-pass1!".into()).unwrap();
    assert_eq!(reopened.list_entries().unwrap().len(), 1);
    assert!(!created.recovery_key.is_empty());
}

#[test]
fn recovery_rotates_key_and_preserves_entries() {
    let mut manager = VaultManager::new_for_test().unwrap();
    let created = manager.create("Master-pass1!".into()).unwrap();
    manager.unlock("Master-pass1!".into()).unwrap();
    manager.upsert_entry(note("恢复测试条目")).unwrap();
    manager.lock().unwrap();
    let old_recovery = created.recovery_key.clone();
    let recovered = manager
        .recover_access(old_recovery.clone(), "new-Master-pass1!".into())
        .unwrap();
    assert_ne!(old_recovery, recovered.recovery_key);
    assert!(manager
        .recover_access(old_recovery, "another-Master-pass1!".into())
        .is_err());
    manager.unlock("new-Master-pass1!".into()).unwrap();
    assert_eq!(manager.list_entries().unwrap().len(), 1);
}

#[test]
fn master_password_change_requires_current_password() {
    let mut manager = VaultManager::new_for_test().unwrap();
    manager.create("Master-pass1!".into()).unwrap();
    manager.unlock("Master-pass1!".into()).unwrap();
    assert!(manager
        .change_master_password("wrong-password".into(), "new-Master-pass1!".into())
        .is_err());
    manager
        .change_master_password("Master-pass1!".into(), "new-Master-pass1!".into())
        .unwrap();
    assert!(manager.unlock("Master-pass1!".into()).is_err());
    manager.unlock("new-Master-pass1!".into()).unwrap();
}

#[test]
fn create_is_rejected_when_vault_already_exists() {
    let mut manager = VaultManager::new_for_test().unwrap();
    manager.create("Master-pass1!".into()).unwrap();
    assert!(manager.create("another-Master-pass1!".into()).is_err());
}

#[test]
fn metadata_database_mismatch_fails_closed() {
    let root = {
        let mut manager = VaultManager::new_for_test().unwrap();
        manager.create("Master-pass1!".into()).unwrap();
        manager.workspace_root()
    };
    std::fs::remove_file(root.join("vault.meta")).unwrap();
    assert!(VaultManager::new_at_for_test(&root).is_err());
}

#[test]
fn new_master_password_requires_length_and_three_character_classes() {
    for password in ["Ab1!", "abcdefgh", "ABCDEFGH", "12345678", "!!!!!!!!"] {
        let mut manager = VaultManager::new_for_test().unwrap();
        assert!(
            manager.create(password.into()).is_err(),
            "must reject {password}"
        );
    }
    for password in ["Abcdef1!", "Abcdefg1", "abcdef1!", "ABCDEF1!"] {
        let mut manager = VaultManager::new_for_test().unwrap();
        manager.create(password.into()).unwrap();
        manager.unlock(password.into()).unwrap();
    }
}

#[test]
fn creates_directly_in_a_custom_fixed_directory() {
    let fixture = tempfile::TempDir::new().unwrap();
    let destination = fixture.path().join("custom-vault");
    let mut manager = VaultManager::new_for_test().unwrap();
    manager
        .create_at("Master-pass1!".into(), Some(destination.clone()))
        .unwrap();
    assert!(destination.join("vault.db").exists());
    assert!(destination.join("vault.meta").exists());
    manager.unlock("Master-pass1!".into()).unwrap();
    assert_eq!(
        manager.current_location().unwrap().path,
        destination
            .canonicalize()
            .unwrap()
            .to_string_lossy()
            .into_owned()
    );
}

#[test]
fn rejected_custom_destination_preserves_the_original_workspace() {
    let fixture = tempfile::TempDir::new().unwrap();
    let destination = fixture.path().join("occupied");
    std::fs::create_dir_all(&destination).unwrap();
    std::fs::write(destination.join("vault.db"), b"do-not-overwrite").unwrap();
    let mut manager = VaultManager::new_for_test().unwrap();
    let original = manager.workspace_root();
    assert!(manager
        .create_at("Master-pass1!".into(), Some(destination.clone()))
        .is_err());
    assert_eq!(manager.workspace_root(), original);
    assert_eq!(
        std::fs::read(destination.join("vault.db")).unwrap(),
        b"do-not-overwrite"
    );
}

#[test]
fn failed_custom_creation_restores_the_original_workspace() {
    let fixture = tempfile::TempDir::new().unwrap();
    let destination = fixture.path().join("custom-vault");
    let mut manager = VaultManager::new_for_test().unwrap();
    let original = manager.workspace_root();
    manager.set_config_file_for_test(fixture.path());
    assert!(manager
        .create_at("Master-pass1!".into(), Some(destination.clone()))
        .is_err());
    assert_eq!(manager.workspace_root(), original);
    assert!(!destination.join("vault.db").exists());
    assert!(!destination.join("vault.meta").exists());

    manager.set_config_file_for_test(&original.join("config.json"));
    manager.create("Master-pass1!".into()).unwrap();
    assert_eq!(manager.workspace_root(), original);
}
