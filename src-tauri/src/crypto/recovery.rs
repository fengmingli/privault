use crate::error::{ErrorCode, VaultError, VaultResult};
use sha2::{Digest, Sha256};

pub fn generate_recovery_key() -> VaultResult<String> {
    let mut entropy = [0_u8; 32];
    getrandom::fill(&mut entropy)
        .map_err(|_| VaultError::new(ErrorCode::IoError, "无法生成安全随机数"))?;
    Ok(encode_recovery_key(entropy))
}

pub fn encode_recovery_key(entropy: [u8; 32]) -> String {
    let checksum = Sha256::digest(entropy);
    let mut payload = Vec::with_capacity(36);
    payload.extend_from_slice(&entropy);
    payload.extend_from_slice(&checksum[..4]);
    let encoded = base32::encode(base32::Alphabet::Crockford, &payload);
    encoded
        .as_bytes()
        .chunks(4)
        .map(|chunk| std::str::from_utf8(chunk).unwrap().to_string())
        .collect::<Vec<_>>()
        .join("-")
}

pub fn decode_recovery_key(value: &str) -> VaultResult<[u8; 32]> {
    let normalized = value
        .chars()
        .filter(|character| *character != '-' && !character.is_whitespace())
        .map(|character| character.to_ascii_uppercase())
        .collect::<String>();
    let payload = base32::decode(base32::Alphabet::Crockford, &normalized)
        .ok_or_else(|| VaultError::new(ErrorCode::InvalidCredentials, "恢复密钥格式不正确"))?;
    if payload.len() != 36 {
        return Err(VaultError::new(
            ErrorCode::InvalidCredentials,
            "恢复密钥格式不正确",
        ));
    }
    let mut entropy = [0_u8; 32];
    entropy.copy_from_slice(&payload[..32]);
    let checksum = Sha256::digest(entropy);
    if payload[32..] != checksum[..4] {
        return Err(VaultError::new(
            ErrorCode::InvalidCredentials,
            "恢复密钥格式不正确",
        ));
    }
    Ok(entropy)
}
