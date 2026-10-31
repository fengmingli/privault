use crate::config::default_vault_dir;
use crate::error::{ErrorCode, VaultError, VaultResult};
use crate::model::{
    EntrySummary, MigrationResult, RecoveryKeyResult, StorageLocation, VaultEntry, VaultStatus,
};
use crate::vault::VaultManager;
use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};
use tauri::State;

fn guard<'a>(
    state: &'a State<'_, Mutex<VaultManager>>,
) -> VaultResult<MutexGuard<'a, VaultManager>> {
    state
        .lock()
        .map_err(|_| VaultError::new(ErrorCode::IoError, "保险库状态不可用"))
}

fn with_manager<T>(
    state: &State<'_, Mutex<VaultManager>>,
    operation: impl FnOnce(&mut VaultManager) -> VaultResult<T>,
) -> VaultResult<T> {
    operation(&mut *guard(state)?)
}

pub fn create(
    manager: &mut VaultManager,
    master_password: String,
) -> VaultResult<RecoveryKeyResult> {
    manager.create(master_password)
}

pub fn create_at(
    manager: &mut VaultManager,
    master_password: String,
    destination: Option<PathBuf>,
) -> VaultResult<RecoveryKeyResult> {
    manager.create_at(master_password, destination)
}

pub fn unlock(manager: &mut VaultManager, password: String) -> VaultResult<VaultStatus> {
    manager.unlock(password)
}

pub fn lock(manager: &mut VaultManager) -> VaultResult<()> {
    manager.lock()
}

pub fn status(manager: &VaultManager) -> VaultStatus {
    manager.status()
}

pub fn list(manager: &VaultManager) -> VaultResult<Vec<EntrySummary>> {
    manager.list_entries()
}

pub fn get(manager: &VaultManager, id: String) -> VaultResult<VaultEntry> {
    manager.get_entry(&id)
}

pub fn upsert(manager: &mut VaultManager, entry: VaultEntry) -> VaultResult<VaultEntry> {
    manager.upsert_entry(entry)
}

pub fn delete(manager: &mut VaultManager, id: String) -> VaultResult<()> {
    manager.delete_entry(&id)
}

pub fn restore(manager: &mut VaultManager, id: String) -> VaultResult<()> {
    manager.restore_entry(&id)
}

pub fn change_password(
    manager: &mut VaultManager,
    current: String,
    new: String,
) -> VaultResult<()> {
    manager.change_master_password(current, new)
}

pub fn recover(
    manager: &mut VaultManager,
    recovery_key: String,
    new_master: String,
) -> VaultResult<RecoveryKeyResult> {
    manager.recover_access(recovery_key, new_master)
}

pub fn location(manager: &VaultManager) -> VaultResult<StorageLocation> {
    manager.current_location()
}

pub fn prepare_migration(manager: &mut VaultManager, destination: PathBuf) -> VaultResult<String> {
    manager.prepare_migration(destination)
}

pub fn confirm_migration(
    manager: &mut VaultManager,
    id: String,
    master_password: String,
) -> VaultResult<StorageLocation> {
    manager.confirm_migration(id, master_password)
}

pub fn cancel_migration(manager: &mut VaultManager, id: String) -> VaultResult<()> {
    manager.cancel_migration(id)
}

#[tauri::command(rename_all = "camelCase")]
pub fn vault_create(
    state: State<'_, Mutex<VaultManager>>,
    master_password: String,
    destination: Option<String>,
) -> VaultResult<RecoveryKeyResult> {
    with_manager(&state, |manager| {
        create_at(manager, master_password, destination.map(PathBuf::from))
    })
}

#[tauri::command(rename_all = "camelCase")]
pub fn vault_unlock(
    state: State<'_, Mutex<VaultManager>>,
    password: String,
) -> VaultResult<VaultStatus> {
    with_manager(&state, |manager| unlock(manager, password))
}

#[tauri::command]
pub fn vault_lock(state: State<'_, Mutex<VaultManager>>) -> VaultResult<()> {
    with_manager(&state, lock)
}

#[tauri::command]
pub fn vault_status(state: State<'_, Mutex<VaultManager>>) -> VaultStatus {
    status(&guard(&state).expect("vault state must be available"))
}

#[tauri::command]
pub fn vault_list_entries(state: State<'_, Mutex<VaultManager>>) -> VaultResult<Vec<EntrySummary>> {
    with_manager(&state, |manager| list(manager))
}

#[tauri::command]
pub fn vault_get_entry(
    state: State<'_, Mutex<VaultManager>>,
    id: String,
) -> VaultResult<VaultEntry> {
    with_manager(&state, |manager| get(manager, id))
}

#[tauri::command]
pub fn vault_upsert_entry(
    state: State<'_, Mutex<VaultManager>>,
    entry: VaultEntry,
) -> VaultResult<VaultEntry> {
    with_manager(&state, |manager| upsert(manager, entry))
}

#[tauri::command]
pub fn vault_delete_entry(state: State<'_, Mutex<VaultManager>>, id: String) -> VaultResult<()> {
    with_manager(&state, |manager| delete(manager, id))
}

#[tauri::command]
pub fn vault_restore_entry(state: State<'_, Mutex<VaultManager>>, id: String) -> VaultResult<()> {
    with_manager(&state, |manager| restore(manager, id))
}

#[tauri::command(rename_all = "camelCase")]
pub fn vault_change_master_password(
    state: State<'_, Mutex<VaultManager>>,
    current_password: String,
    new_password: String,
) -> VaultResult<()> {
    with_manager(&state, |manager| {
        change_password(manager, current_password, new_password)
    })
}

#[tauri::command(rename_all = "camelCase")]
pub fn vault_recover_access(
    state: State<'_, Mutex<VaultManager>>,
    recovery_key: String,
    new_master_password: String,
) -> VaultResult<RecoveryKeyResult> {
    with_manager(&state, |manager| {
        recover(manager, recovery_key, new_master_password)
    })
}

#[tauri::command]
pub fn storage_get_location(state: State<'_, Mutex<VaultManager>>) -> VaultResult<StorageLocation> {
    with_manager(&state, |manager| location(manager))
}

#[tauri::command]
pub fn storage_choose_location() -> Option<String> {
    rfd::FileDialog::new()
        .pick_folder()
        .map(|path| path.to_string_lossy().into_owned())
}

fn resolve_migration_destination(destination: Option<String>) -> VaultResult<PathBuf> {
    match destination {
        Some(path) => Ok(PathBuf::from(path)),
        None => default_vault_dir(),
    }
}

#[tauri::command]
pub fn storage_prepare_migration(
    state: State<'_, Mutex<VaultManager>>,
    destination: Option<String>,
) -> VaultResult<MigrationResult> {
    let destination = resolve_migration_destination(destination)?;
    let migration_id = with_manager(&state, |manager| prepare_migration(manager, destination))?;
    Ok(MigrationResult { migration_id })
}

#[tauri::command(rename_all = "camelCase")]
pub fn storage_confirm_migration(
    state: State<'_, Mutex<VaultManager>>,
    migration_id: String,
    master_password: String,
) -> VaultResult<StorageLocation> {
    with_manager(&state, |manager| {
        confirm_migration(manager, migration_id, master_password)
    })
}

#[tauri::command(rename_all = "camelCase")]
pub fn storage_cancel_migration(
    state: State<'_, Mutex<VaultManager>>,
    migration_id: String,
) -> VaultResult<()> {
    with_manager(&state, |manager| cancel_migration(manager, migration_id))
}

#[cfg(test)]
mod tests {
    use super::{resolve_migration_destination, PathBuf};
    use crate::config::default_vault_dir;

    #[test]
    fn selected_migration_destination_is_not_rewritten() {
        let selected = PathBuf::from("selected-destination");
        let resolved = resolve_migration_destination(Some(selected.to_string_lossy().into_owned()))
            .expect("selected destination should resolve");
        assert_eq!(resolved, selected);
    }

    #[test]
    fn default_migration_destination_is_resolved_by_rust() {
        let resolved =
            resolve_migration_destination(None).expect("default destination should resolve");
        assert_eq!(
            resolved,
            default_vault_dir().expect("default vault directory")
        );
    }
}
