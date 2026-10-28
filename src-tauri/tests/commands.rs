use privault_ui_lib::commands;
use privault_ui_lib::error::ErrorCode;
use privault_ui_lib::model::{EntryKind, VaultEntry};
use privault_ui_lib::vault::VaultManager;
use std::sync::{Arc, Mutex};

#[test]
fn locked_commands_fail_without_secret_details() {
    let mut manager = VaultManager::new_for_test().unwrap();
    commands::create(&mut manager, "master-password".into()).unwrap();
    let error = commands::list(&manager).unwrap_err();
    assert_eq!(error.code, ErrorCode::Locked);

    let secret = "wrong-secret-password";
    let error = commands::unlock(&mut manager, secret.into()).unwrap_err();
    assert_eq!(error.code, ErrorCode::InvalidCredentials);
    assert!(!error.to_string().contains(secret));
    assert!(!error.to_string().contains("argon2"));
}

#[test]
fn command_writes_serialize_through_manager_mutex() {
    let manager = Arc::new(Mutex::new(VaultManager::new_for_test().unwrap()));
    commands::create(&mut manager.lock().unwrap(), "master-password".into()).unwrap();
    commands::unlock(&mut manager.lock().unwrap(), "master-password".into()).unwrap();
    let mut handles = Vec::new();
    for index in 0..4 {
        let manager = Arc::clone(&manager);
        handles.push(std::thread::spawn(move || {
            let mut entry = VaultEntry::new_empty_for_test(EntryKind::Note);
            entry.common_mut().title = format!("并发条目-{index}");
            commands::upsert(&mut manager.lock().unwrap(), entry).unwrap();
        }));
    }
    for handle in handles {
        handle.join().unwrap();
    }
    assert_eq!(commands::list(&manager.lock().unwrap()).unwrap().len(), 4);
}

#[test]
fn migration_conflict_uses_stable_error_code() {
    let mut manager = VaultManager::new_for_test().unwrap();
    commands::create(&mut manager, "master-password".into()).unwrap();
    let destination = manager.workspace_root().join("target");
    commands::prepare_migration(&mut manager, destination.clone()).unwrap();
    let error = commands::prepare_migration(&mut manager, destination).unwrap_err();
    assert_eq!(error.code, ErrorCode::MigrationInProgress);
}
