use crate::crypto::Dek;
use crate::error::{ErrorCode, VaultError, VaultResult};
use crate::model::{EntryKind, EntrySummary, VaultEntry};
use crate::vault::entries::{
    compose_entry, field_kind, kind_name, payload_for, search_text, stored_from_row, summary,
    validate_entry,
};
use rusqlite::{Connection, OptionalExtension, Transaction};
use std::path::Path;
use zeroize::Zeroizing;

const SCHEMA: &str = include_str!("schema.sql");
const ENTRY_COLUMNS: &str =
    "id, kind, title, favorite, notes, payload_json, created_at, updated_at";

pub fn open_database(path: &Path, dek: &Dek) -> VaultResult<Connection> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let db = Connection::open(path)?;
    let invalid = || {
        VaultError::new(
            ErrorCode::InvalidCredentials,
            "无法解锁，请检查凭据或保险库完整性",
        )
    };
    let key = Zeroizing::new(format!("x'{}'", hex::encode(dek.expose())));
    db.execute_batch(&format!("PRAGMA key = '{}'", key.replace('\'', "''")))
        .map_err(|_| invalid())?;
    db.pragma_update(None, "foreign_keys", true)?;
    db.pragma_update(None, "secure_delete", true)?;
    db.pragma_update(None, "temp_store", 2)?;
    db.pragma_update(None, "journal_mode", "DELETE")?;
    db.pragma_update(None, "synchronous", 2)?;
    db.execute_batch(SCHEMA).map_err(|_| invalid())?;
    Ok(db)
}

pub fn verify_integrity(db: &Connection) -> VaultResult<()> {
    let result: String = db.query_row("PRAGMA integrity_check", [], |row| row.get(0))?;
    if result.to_lowercase() != "ok" {
        return Err(VaultError::corrupt());
    }
    let _: i64 = db.query_row("SELECT COUNT(*) FROM entries", [], |row| row.get(0))?;
    Ok(())
}

fn read_entry(db: &Connection, id: &str) -> VaultResult<VaultEntry> {
    let stored = db
        .query_row(
            &format!("SELECT {ENTRY_COLUMNS} FROM entries WHERE id = ?1 AND deleted_at IS NULL"),
            [id],
            stored_from_row,
        )
        .optional()?
        .ok_or_else(|| VaultError::new(ErrorCode::VaultNotFound, "条目不存在"))?;
    compose_entry(db, stored)
}

fn read_entries(db: &Connection) -> VaultResult<Vec<VaultEntry>> {
    let mut statement = db.prepare(&format!(
        "SELECT {ENTRY_COLUMNS} FROM entries WHERE deleted_at IS NULL"
    ))?;
    let stored = statement
        .query_map([], stored_from_row)?
        .collect::<Result<Vec<_>, _>>()?;
    stored
        .into_iter()
        .map(|entry| compose_entry(db, entry))
        .collect()
}

pub fn get_entry(db: &Connection, id: &str) -> VaultResult<VaultEntry> {
    read_entry(db, id)
}

fn sort_entries(entries: &mut [EntrySummary]) {
    entries.sort_by(|a, b| {
        b.favorite
            .cmp(&a.favorite)
            .then_with(|| b.updated_at.cmp(&a.updated_at))
            .then_with(|| a.title.to_lowercase().cmp(&b.title.to_lowercase()))
    });
}

pub fn list_entries(db: &Connection) -> VaultResult<Vec<EntrySummary>> {
    let mut entries = read_entries(db)?.iter().map(summary).collect::<Vec<_>>();
    sort_entries(&mut entries);
    Ok(entries)
}

pub fn search_entries(
    db: &Connection,
    kind: Option<EntryKind>,
    query: &str,
) -> VaultResult<Vec<EntrySummary>> {
    let query = query.trim().to_lowercase();
    let mut entries = read_entries(db)?
        .iter()
        .filter(|entry| kind.is_none_or(|expected| entry.kind() == expected))
        .filter(|entry| query.is_empty() || search_text(entry).contains(&query))
        .map(summary)
        .collect::<Vec<_>>();
    sort_entries(&mut entries);
    Ok(entries)
}

fn next_revision(transaction: &Transaction) -> VaultResult<i64> {
    let revision = transaction.query_row(
        "SELECT revision + 1 FROM vault_state WHERE id = 1",
        [],
        |row| row.get(0),
    )?;
    Ok(revision)
}

pub fn upsert_entry(db: &mut Connection, mut entry: VaultEntry) -> VaultResult<VaultEntry> {
    validate_entry(&entry)?;
    let id = entry.common().id.clone();
    let original = db
        .query_row(
            "SELECT payload_json, created_at, updated_at FROM entries WHERE id = ?1",
            [&id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            },
        )
        .optional()?;
    if let Some((_, created_at, _)) = &original {
        entry.common_mut().created_at = created_at.clone();
    }
    entry.common_mut().updated_at = chrono::Utc::now().to_rfc3339();
    let payload = payload_for(&entry).to_string();
    let common = entry.common().clone();
    let original_password = match (&entry, &original) {
        (VaultEntry::Login(_), Some((payload, _, _))) => {
            let value: serde_json::Value =
                serde_json::from_str(payload).map_err(|_| VaultError::corrupt())?;
            value
                .get("password")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string)
        }
        _ => None,
    };

    let transaction = db.transaction()?;
    let revision = next_revision(&transaction)?;
    transaction.execute(
        "INSERT INTO entries (id, kind, title, favorite, notes, payload_json, created_at, updated_at, deleted_at, revision)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, NULL, ?9)
         ON CONFLICT(id) DO UPDATE SET
           kind = excluded.kind,
           title = excluded.title,
           favorite = excluded.favorite,
           notes = excluded.notes,
           payload_json = excluded.payload_json,
           created_at = excluded.created_at,
           updated_at = excluded.updated_at,
           deleted_at = NULL,
           revision = excluded.revision",
        rusqlite::params![
            common.id,
            kind_name(entry.kind()),
            common.title.trim(),
            common.favorite,
            common.notes,
            payload,
            common.created_at,
            common.updated_at,
            revision,
        ],
    )?;
    transaction.execute(
        "DELETE FROM custom_fields WHERE entry_id = ?1",
        [&common.id],
    )?;
    for (position, field) in common.custom_fields.iter().enumerate() {
        transaction.execute(
            "INSERT INTO custom_fields (entry_id, id, label, kind, value, position) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![common.id, field.id, field.label, field_kind(field), field.value, position as i64],
        )?;
    }
    if let (VaultEntry::Login(login), Some(old_password)) = (&entry, original_password) {
        if old_password != login.password {
            let changed_at = original
                .as_ref()
                .map(|(_, _, updated_at)| updated_at)
                .unwrap_or(&common.updated_at);
            transaction.execute(
                "INSERT INTO password_history (entry_id, id, password, changed_at) VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![common.id, uuid::Uuid::new_v4().to_string(), old_password, changed_at],
            )?;
        }
    }
    transaction.execute(
        "UPDATE vault_state SET revision = ?1 WHERE id = 1",
        [revision],
    )?;
    transaction.commit()?;
    read_entry(db, &id)
}

pub fn delete_entry(db: &mut Connection, id: &str) -> VaultResult<()> {
    let transaction = db.transaction()?;
    let revision = next_revision(&transaction)?;
    let changed = transaction.execute(
        "UPDATE entries SET deleted_at = ?2, revision = ?3 WHERE id = ?1 AND deleted_at IS NULL",
        rusqlite::params![id, chrono::Utc::now().to_rfc3339(), revision],
    )?;
    if changed == 0 {
        return Err(VaultError::new(ErrorCode::VaultNotFound, "条目不存在"));
    }
    transaction.execute(
        "UPDATE vault_state SET revision = ?1 WHERE id = 1",
        [revision],
    )?;
    transaction.commit()?;
    Ok(())
}

pub fn restore_entry(db: &mut Connection, id: &str) -> VaultResult<()> {
    let transaction = db.transaction()?;
    let revision = next_revision(&transaction)?;
    let changed = transaction.execute(
        "UPDATE entries SET deleted_at = NULL, revision = ?2 WHERE id = ?1 AND deleted_at IS NOT NULL",
        rusqlite::params![id, revision],
    )?;
    if changed == 0 {
        return Err(VaultError::new(ErrorCode::VaultNotFound, "条目不存在"));
    }
    transaction.execute(
        "UPDATE vault_state SET revision = ?1 WHERE id = 1",
        [revision],
    )?;
    transaction.commit()?;
    Ok(())
}
