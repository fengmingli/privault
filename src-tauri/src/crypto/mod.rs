mod argon;
mod recovery;

pub use argon::KdfParams;
pub use recovery::{decode_recovery_key, encode_recovery_key, generate_recovery_key};

use crate::error::{ErrorCode, VaultError, VaultResult};
use argon::derive_key;
use chacha20poly1305::{
    aead::{Aead, Payload},
    KeyInit, XChaCha20Poly1305, XNonce,
};
use serde::{Deserialize, Serialize};
use zeroize::Zeroizing;

#[derive(Debug)]
pub struct Dek(Zeroizing<[u8; 32]>);

impl Dek {
    pub fn new() -> VaultResult<Self> {
        let mut bytes = [0_u8; 32];
        getrandom::fill(&mut bytes)
            .map_err(|_| VaultError::new(ErrorCode::IoError, "无法生成安全随机数"))?;
        Ok(Self(Zeroizing::new(bytes)))
    }

    #[cfg(test)]
    pub fn new_for_test() -> Self {
        Self(Zeroizing::new([7_u8; 32]))
    }

    pub fn expose(&self) -> &[u8; 32] {
        &self.0
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum KeySlotKind {
    Master,
    Recovery,
}

impl KeySlotKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::Master => "master",
            Self::Recovery => "recovery",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeySlot {
    pub kind: KeySlotKind,
    pub kdf: KdfParams,
    pub salt: String,
    pub nonce: String,
    pub wrapped_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultMeta {
    pub format_version: u32,
    pub vault_id: String,
    pub master: KeySlot,
    pub recovery: KeySlot,
}

fn aad(vault_id: &str, kind: KeySlotKind, kdf: KdfParams) -> Vec<u8> {
    format!(
        "privault:v1:{vault_id}:{}:{}:{}:{}",
        kind.as_str(),
        kdf.m_cost,
        kdf.t_cost,
        kdf.p_cost
    )
    .into_bytes()
}

fn credential_bytes(credential: &str, kind: KeySlotKind) -> VaultResult<Zeroizing<Vec<u8>>> {
    match kind {
        KeySlotKind::Master => Ok(Zeroizing::new(credential.as_bytes().to_vec())),
        KeySlotKind::Recovery => Ok(Zeroizing::new(decode_recovery_key(credential)?.to_vec())),
    }
}

fn create_slot(
    dek: &Dek,
    credential: &str,
    kind: KeySlotKind,
    vault_id: &str,
    kdf: KdfParams,
) -> VaultResult<KeySlot> {
    let mut salt = [0_u8; 16];
    let mut nonce = [0_u8; 24];
    getrandom::fill(&mut salt)
        .map_err(|_| VaultError::new(ErrorCode::IoError, "无法生成安全随机数"))?;
    getrandom::fill(&mut nonce)
        .map_err(|_| VaultError::new(ErrorCode::IoError, "无法生成安全随机数"))?;
    let credential = credential_bytes(credential, kind)?;
    let kek = derive_key(&credential, &salt, kdf)?;
    let cipher = XChaCha20Poly1305::new_from_slice(kek.as_slice())
        .map_err(|_| VaultError::new(ErrorCode::IoError, "无法初始化密钥封装"))?;
    let nonce = XNonce::try_from(nonce.as_slice())
        .map_err(|_| VaultError::new(ErrorCode::IoError, "无法初始化密钥封装"))?;
    let wrapped_key = cipher
        .encrypt(
            &nonce,
            Payload {
                msg: dek.expose(),
                aad: &aad(vault_id, kind, kdf),
            },
        )
        .map_err(|_| VaultError::new(ErrorCode::IoError, "无法封装保险库密钥"))?;
    Ok(KeySlot {
        kind,
        kdf,
        salt: hex::encode(salt),
        nonce: hex::encode(nonce),
        wrapped_key: hex::encode(wrapped_key),
    })
}

pub fn create_meta(master: &str, recovery: &str) -> VaultResult<(VaultMeta, Dek)> {
    create_meta_with_params(master, recovery, KdfParams::calibrated())
}

pub fn create_meta_with_params(
    master: &str,
    recovery: &str,
    kdf: KdfParams,
) -> VaultResult<(VaultMeta, Dek)> {
    let dek = Dek::new()?;
    let vault_id = uuid::Uuid::new_v4().to_string();
    let master_slot = create_slot(&dek, master, KeySlotKind::Master, &vault_id, kdf)?;
    let recovery_slot = create_slot(&dek, recovery, KeySlotKind::Recovery, &vault_id, kdf)?;
    Ok((
        VaultMeta {
            format_version: 1,
            vault_id,
            master: master_slot,
            recovery: recovery_slot,
        },
        dek,
    ))
}

pub fn unwrap_dek(meta: &VaultMeta, credential: &str, kind: KeySlotKind) -> VaultResult<Dek> {
    let slot = match kind {
        KeySlotKind::Master => &meta.master,
        KeySlotKind::Recovery => &meta.recovery,
    };
    let invalid = || {
        VaultError::new(
            ErrorCode::InvalidCredentials,
            "无法解锁，请检查凭据或保险库完整性",
        )
    };
    let mut salt = [0_u8; 16];
    let mut nonce = [0_u8; 24];
    hex::decode_to_slice(&slot.salt, &mut salt).map_err(|_| invalid())?;
    hex::decode_to_slice(&slot.nonce, &mut nonce).map_err(|_| invalid())?;
    let wrapped = hex::decode(&slot.wrapped_key).map_err(|_| invalid())?;
    let credential = credential_bytes(credential, kind).map_err(|_| invalid())?;
    let kek = derive_key(&credential, &salt, slot.kdf).map_err(|_| invalid())?;
    let cipher = XChaCha20Poly1305::new_from_slice(kek.as_slice()).map_err(|_| invalid())?;
    let nonce = XNonce::try_from(nonce.as_slice()).map_err(|_| invalid())?;
    let plaintext = cipher
        .decrypt(
            &nonce,
            Payload {
                msg: &wrapped,
                aad: &aad(&meta.vault_id, kind, slot.kdf),
            },
        )
        .map_err(|_| invalid())?;
    if plaintext.len() != 32 {
        return Err(invalid());
    }
    let mut bytes = [0_u8; 32];
    bytes.copy_from_slice(&plaintext);
    Ok(Dek(Zeroizing::new(bytes)))
}

pub fn replace_master_slot(meta: &mut VaultMeta, current: &str, new: &str) -> VaultResult<()> {
    let dek = unwrap_dek(meta, current, KeySlotKind::Master)?;
    meta.master = create_slot(
        &dek,
        new,
        KeySlotKind::Master,
        &meta.vault_id,
        KdfParams::calibrated(),
    )?;
    Ok(())
}

pub fn replace_recovery_slot(meta: &mut VaultMeta, current: &str, new: &str) -> VaultResult<()> {
    let dek = unwrap_dek(meta, current, KeySlotKind::Recovery)?;
    meta.recovery = create_slot(
        &dek,
        new,
        KeySlotKind::Recovery,
        &meta.vault_id,
        KdfParams::calibrated(),
    )?;
    Ok(())
}
