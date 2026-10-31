use privault_ui_lib::crypto::{
    create_meta_with_params, decode_recovery_key, encode_recovery_key, generate_recovery_key,
    replace_master_slot, replace_recovery_slot, unwrap_dek, KdfParams, KeySlotKind,
};
use privault_ui_lib::metadata::{read_meta, write_meta_atomic};

#[test]
fn master_and_recovery_unlock_the_same_dek() {
    let recovery = generate_recovery_key().unwrap();
    let (meta, expected) =
        create_meta_with_params("master-password", &recovery, KdfParams::testing()).unwrap();
    let master = unwrap_dek(&meta, "master-password", KeySlotKind::Master).unwrap();
    let recovered = unwrap_dek(&meta, &recovery, KeySlotKind::Recovery).unwrap();
    assert_eq!(master.expose(), expected.expose());
    assert_eq!(recovered.expose(), expected.expose());
}

#[test]
fn wrong_credentials_and_tampered_slots_fail() {
    let recovery = generate_recovery_key().unwrap();
    let (mut meta, _) =
        create_meta_with_params("master-password", &recovery, KdfParams::testing()).unwrap();
    assert!(unwrap_dek(&meta, "wrong-password", KeySlotKind::Master).is_err());
    meta.master.nonce = "00".repeat(24);
    assert!(unwrap_dek(&meta, "master-password", KeySlotKind::Master).is_err());
}

#[test]
fn recovery_encoding_has_a_checksum() {
    let recovery = encode_recovery_key([7_u8; 32]);
    let decoded = decode_recovery_key(&recovery).unwrap();
    assert_eq!(decoded, [7_u8; 32]);
    let mut tampered = recovery.into_bytes();
    // The final Base32 character contains padding bits, so changing it may not alter the payload.
    // Flip a meaningful character instead, which must invalidate the checksum.
    tampered[0] = if tampered[0] == b'0' { b'1' } else { b'0' };
    assert!(decode_recovery_key(std::str::from_utf8(&tampered).unwrap()).is_err());
}

#[test]
fn replacing_slots_preserves_dek_and_invalidates_old_credentials() {
    let recovery = generate_recovery_key().unwrap();
    let (mut meta, expected) =
        create_meta_with_params("master-password", &recovery, KdfParams::testing()).unwrap();
    replace_master_slot(&mut meta, "master-password", "new-master-password").unwrap();
    assert!(unwrap_dek(&meta, "master-password", KeySlotKind::Master).is_err());
    assert_eq!(
        unwrap_dek(&meta, "new-master-password", KeySlotKind::Master)
            .unwrap()
            .expose(),
        expected.expose()
    );

    let next_recovery = generate_recovery_key().unwrap();
    replace_recovery_slot(&mut meta, &recovery, &next_recovery).unwrap();
    assert!(unwrap_dek(&meta, &recovery, KeySlotKind::Recovery).is_err());
    assert_eq!(
        unwrap_dek(&meta, &next_recovery, KeySlotKind::Recovery)
            .unwrap()
            .expose(),
        expected.expose()
    );
}

#[test]
fn metadata_round_trip_does_not_persist_credentials() {
    let dir = tempfile::TempDir::new().unwrap();
    let path = dir.path().join("vault.meta");
    let recovery = generate_recovery_key().unwrap();
    let (meta, _) =
        create_meta_with_params("master-password", &recovery, KdfParams::testing()).unwrap();
    write_meta_atomic(&path, &meta).unwrap();
    let loaded = read_meta(&path).unwrap();
    assert_eq!(loaded.vault_id, meta.vault_id);
    let raw = std::fs::read_to_string(&path).unwrap();
    assert!(!raw.contains("master-password"));
    assert!(!raw.contains(&recovery));
}
