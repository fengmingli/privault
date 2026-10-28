use privault_ui_lib::error::{ErrorCode, VaultError};
use privault_ui_lib::model::{AppConfig, EntryKind, VaultEntry};

#[test]
fn login_entry_uses_frontend_discriminated_union() {
    let entry = VaultEntry::new_empty_for_test(EntryKind::Login);
    let json = serde_json::to_value(&entry).unwrap();
    assert_eq!(json["kind"], "login");
    assert!(json["customFields"].is_array());
    assert!(json["passwordHistory"].is_array());
    assert!(json["createdAt"].is_string());
    assert!(json.get("created_at").is_none());
}

#[test]
fn errors_have_stable_code_and_no_secret_details() {
    let error = VaultError::new(
        ErrorCode::InvalidCredentials,
        "无法解锁，请检查凭据或保险库完整性",
    );
    let json = serde_json::to_value(&error).unwrap();
    assert_eq!(json["code"], "INVALID_CREDENTIALS");
    assert!(!json.to_string().contains("argon2"));
}

#[test]
fn app_config_contains_only_version_and_storage_path() {
    let config = AppConfig {
        version: 1,
        storage_path: "/tmp/private-vault".into(),
    };
    let json = serde_json::to_value(&config).unwrap();
    assert_eq!(json["version"], 1);
    assert_eq!(json["storagePath"], "/tmp/private-vault");
    assert_eq!(json.as_object().unwrap().len(), 2);
}
