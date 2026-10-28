use crate::error::{ErrorCode, VaultError, VaultResult};
use argon2::{Algorithm, Argon2, Params, Version};
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use zeroize::Zeroizing;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KdfParams {
    pub m_cost: u32,
    pub t_cost: u32,
    pub p_cost: u32,
}

impl KdfParams {
    pub const fn testing() -> Self {
        Self {
            m_cost: 1024,
            t_cost: 1,
            p_cost: 1,
        }
    }

    pub fn calibrated() -> Self {
        let baseline = Self {
            m_cost: 32_768,
            t_cost: 3,
            p_cost: 1,
        };
        let salt = [17_u8; 16];
        let started = Instant::now();
        let _ = derive_key(b"privault-calibration", &salt, baseline);
        let elapsed = started.elapsed();
        let target = Duration::from_millis(500).as_secs_f64();
        let scale = (target / elapsed.as_secs_f64().max(0.001)).sqrt();
        let m_cost = ((baseline.m_cost as f64 * scale) as u32).clamp(16_384, 262_144);
        Self { m_cost, ..baseline }
    }
}

pub fn derive_key(
    credential: &[u8],
    salt: &[u8; 16],
    params: KdfParams,
) -> VaultResult<Zeroizing<[u8; 32]>> {
    let argon_params = Params::new(params.m_cost, params.t_cost, params.p_cost, Some(32))
        .map_err(|_| VaultError::new(ErrorCode::VaultCorrupt, "密钥派生参数无效"))?;
    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, argon_params);
    let mut key = Zeroizing::new([0_u8; 32]);
    argon
        .hash_password_into(credential, salt, key.as_mut())
        .map_err(|_| {
            VaultError::new(
                ErrorCode::InvalidCredentials,
                "无法解锁，请检查凭据或保险库完整性",
            )
        })?;
    Ok(key)
}
