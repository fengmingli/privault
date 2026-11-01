pub mod commands;
pub mod config;
pub mod crypto;
pub mod error;
pub mod metadata;
pub mod migration;
pub mod model;
pub mod path_policy;
pub mod platform;
pub mod pvault;
pub mod storage;
pub mod vault;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let manager = vault::VaultManager::new().unwrap_or_else(|_| {
        vault::VaultManager::new_recovery_mode().expect("failed to initialize recovery mode")
    });
    tauri::Builder::default()
        .manage(std::sync::Mutex::new(manager))
        .invoke_handler(tauri::generate_handler![
            commands::vault_create,
            commands::vault_unlock,
            commands::vault_lock,
            commands::vault_status,
            commands::vault_list_entries,
            commands::vault_get_entry,
            commands::vault_upsert_entry,
            commands::vault_delete_entry,
            commands::vault_restore_entry,
            commands::vault_change_master_password,
            commands::vault_recover_access,
            commands::storage_choose_export_path,
            commands::storage_choose_import_path,
            commands::storage_export_pvault,
            commands::storage_get_location,
            commands::storage_choose_location,
            commands::storage_prepare_migration,
            commands::storage_confirm_migration,
            commands::storage_cancel_migration,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Privault UI prototype");
}
