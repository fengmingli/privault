use privault_ui_lib::crypto::Dek;
use privault_ui_lib::model::{CustomField, CustomFieldKind, EntryKind, VaultEntry};
use privault_ui_lib::storage::{
    delete_entry, get_entry, list_entries, open_database, restore_entry, search_entries,
    upsert_entry, verify_integrity,
};

fn populated(kind: EntryKind) -> VaultEntry {
    let mut entry = VaultEntry::new_empty_for_test(kind);
    entry.common_mut().title = format!("演示-{kind:?}");
    entry.common_mut().notes = "仅用于测试".into();
    match &mut entry {
        VaultEntry::Login(login) => {
            login.username = "demo@example.com".into();
            login.password = "initial-password".into();
            login.website = "https://example.com".into();
        }
        VaultEntry::Note(note) => note.body = "测试笔记正文".into(),
        VaultEntry::Card(card) => {
            card.cardholder = "演示用户".into();
            card.card_number = "0000 0000 0000 0000".into();
            card.expiry = "01/30".into();
            card.cvv = "000".into();
            card.bank = "演示银行".into();
        }
        VaultEntry::Identity(identity) => {
            identity.identity_type = "演示证件".into();
            identity.holder = "演示用户".into();
            identity.document_number = "000000".into();
            identity.issued_at = "2020-01-01".into();
            identity.expires_at = "2030-01-01".into();
        }
    }
    entry
}

#[test]
fn data_survives_reopen_without_plaintext_marker() {
    let dir = tempfile::TempDir::new().unwrap();
    let path = dir.path().join("vault.db");
    let dek = Dek::new_for_test();
    let marker = "PRIVATE-MARKER-7f3c9a";
    {
        let mut db = open_database(&path, &dek).unwrap();
        let mut entry = populated(EntryKind::Login);
        entry.common_mut().title = marker.into();
        upsert_entry(&mut db, entry).unwrap();
    }
    let bytes = std::fs::read(&path).unwrap();
    assert!(!bytes
        .windows(marker.len())
        .any(|window| window == marker.as_bytes()));
    let db = open_database(&path, &dek).unwrap();
    assert_eq!(list_entries(&db).unwrap()[0].title, marker);
    verify_integrity(&db).unwrap();
}

#[test]
fn wrong_key_cannot_open_existing_vault() {
    let dir = tempfile::TempDir::new().unwrap();
    let path = dir.path().join("vault.db");
    {
        let mut db = open_database(&path, &Dek::new_for_test()).unwrap();
        upsert_entry(&mut db, populated(EntryKind::Note)).unwrap();
    }
    assert!(open_database(&path, &Dek::new().unwrap()).is_err());
}

#[test]
fn persists_all_entry_kinds_and_custom_fields() {
    let dir = tempfile::TempDir::new().unwrap();
    let path = dir.path().join("vault.db");
    let mut db = open_database(&path, &Dek::new_for_test()).unwrap();
    for kind in [
        EntryKind::Login,
        EntryKind::Note,
        EntryKind::Card,
        EntryKind::Identity,
    ] {
        let mut entry = populated(kind);
        entry.common_mut().custom_fields = vec![CustomField {
            id: uuid::Uuid::new_v4().to_string(),
            label: "备用字段".into(),
            kind: CustomFieldKind::Text,
            value: "演示值".into(),
        }];
        upsert_entry(&mut db, entry).unwrap();
    }
    assert_eq!(list_entries(&db).unwrap().len(), 4);
    for summary in list_entries(&db).unwrap() {
        let entry = get_entry(&db, &summary.id).unwrap();
        assert_eq!(entry.common().custom_fields.len(), 1);
    }
}

#[test]
fn rejects_invalid_core_entry_fields() {
    let dir = tempfile::TempDir::new().unwrap();
    let path = dir.path().join("vault.db");
    let mut db = open_database(&path, &Dek::new_for_test()).unwrap();

    let VaultEntry::Login(mut login) = populated(EntryKind::Login) else {
        panic!("wrong kind")
    };
    login.username = " ".into();
    assert!(upsert_entry(&mut db, VaultEntry::Login(login)).is_err());

    let VaultEntry::Note(mut note) = populated(EntryKind::Note) else {
        panic!("wrong kind")
    };
    note.body = "  ".into();
    assert!(upsert_entry(&mut db, VaultEntry::Note(note)).is_err());

    let VaultEntry::Card(mut card) = populated(EntryKind::Card) else {
        panic!("wrong kind")
    };
    card.card_number = "1234 5678 9012".into();
    assert!(upsert_entry(&mut db, VaultEntry::Card(card)).is_err());

    let VaultEntry::Identity(mut identity) = populated(EntryKind::Identity) else {
        panic!("wrong kind")
    };
    identity.document_number = " ".into();
    assert!(upsert_entry(&mut db, VaultEntry::Identity(identity)).is_err());
}

#[test]
fn rejects_expired_cards_and_invalid_identity_dates() {
    let dir = tempfile::TempDir::new().unwrap();
    let path = dir.path().join("vault.db");
    let mut db = open_database(&path, &Dek::new_for_test()).unwrap();

    let VaultEntry::Card(mut card) = populated(EntryKind::Card) else {
        panic!("wrong kind")
    };
    card.expiry = "01/20".into();
    assert!(upsert_entry(&mut db, VaultEntry::Card(card)).is_err());

    let VaultEntry::Identity(mut identity) = populated(EntryKind::Identity) else {
        panic!("wrong kind")
    };
    identity.issued_at = "2026-02-30".into();
    assert!(upsert_entry(&mut db, VaultEntry::Identity(identity)).is_err());
}

#[test]
fn accepts_valid_core_entries() {
    let dir = tempfile::TempDir::new().unwrap();
    let path = dir.path().join("vault.db");
    let mut db = open_database(&path, &Dek::new_for_test()).unwrap();
    upsert_entry(&mut db, populated(EntryKind::Card)).unwrap();
    assert_eq!(list_entries(&db).unwrap().len(), 1);
}

#[test]
fn login_password_history_only_records_actual_changes() {
    let dir = tempfile::TempDir::new().unwrap();
    let path = dir.path().join("vault.db");
    let mut db = open_database(&path, &Dek::new_for_test()).unwrap();
    let original = populated(EntryKind::Login);
    let id = original.common().id.clone();
    upsert_entry(&mut db, original.clone()).unwrap();

    let mut unchanged = original.clone();
    unchanged.common_mut().title = "标题已更新".into();
    upsert_entry(&mut db, unchanged).unwrap();
    let VaultEntry::Login(login) = get_entry(&db, &id).unwrap() else {
        panic!("wrong kind")
    };
    assert_eq!(login.password_history.len(), 0);

    let mut changed = login;
    changed.password = "next-password".into();
    upsert_entry(&mut db, VaultEntry::Login(changed)).unwrap();
    let VaultEntry::Login(login) = get_entry(&db, &id).unwrap() else {
        panic!("wrong kind")
    };
    assert_eq!(login.password_history.len(), 1);
    assert_eq!(login.password_history[0].password, "initial-password");
}

#[test]
fn soft_delete_and_restore_preserve_the_entry() {
    let dir = tempfile::TempDir::new().unwrap();
    let path = dir.path().join("vault.db");
    let mut db = open_database(&path, &Dek::new_for_test()).unwrap();
    let entry = populated(EntryKind::Note);
    let id = entry.common().id.clone();
    upsert_entry(&mut db, entry).unwrap();
    delete_entry(&mut db, &id).unwrap();
    assert!(list_entries(&db).unwrap().is_empty());
    restore_entry(&mut db, &id).unwrap();
    assert_eq!(list_entries(&db).unwrap().len(), 1);
}

#[test]
fn search_and_validation_use_rust_rules() {
    let dir = tempfile::TempDir::new().unwrap();
    let path = dir.path().join("vault.db");
    let mut db = open_database(&path, &Dek::new_for_test()).unwrap();
    let mut login = populated(EntryKind::Login);
    login.common_mut().title = "GitHub 演示".into();
    login.common_mut().favorite = true;
    login.common_mut().custom_fields = vec![
        CustomField {
            id: "a".into(),
            label: "重复".into(),
            kind: CustomFieldKind::Text,
            value: "1".into(),
        },
        CustomField {
            id: "b".into(),
            label: "重复".into(),
            kind: CustomFieldKind::Text,
            value: "2".into(),
        },
    ];
    assert!(upsert_entry(&mut db, login.clone()).is_err());
    login.common_mut().custom_fields.clear();
    upsert_entry(&mut db, login).unwrap();
    upsert_entry(&mut db, populated(EntryKind::Note)).unwrap();
    assert_eq!(
        search_entries(&db, Some(EntryKind::Login), "GITHUB")
            .unwrap()
            .len(),
        1
    );
    assert_eq!(search_entries(&db, None, "测试笔记正文").unwrap().len(), 1);
}

#[test]
fn database_does_not_use_wal() {
    let dir = tempfile::TempDir::new().unwrap();
    let path = dir.path().join("vault.db");
    let db = open_database(&path, &Dek::new_for_test()).unwrap();
    let mode: String = db
        .query_row("PRAGMA journal_mode", [], |row| row.get(0))
        .unwrap();
    assert_ne!(mode.to_lowercase(), "wal");
}
