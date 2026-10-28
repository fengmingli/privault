use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    Locked,
    InvalidCredentials,
    VaultNotFound,
    VaultAlreadyExists,
    VaultCorrupt,
    PathUnsupported,
    PathConflict,
    PathUnavailable,
    InsufficientSpace,
    MigrationInProgress,
    MigrationNotFound,
    InvalidInput,
    IoError,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, thiserror::Error)]
#[error("{message}")]
pub struct VaultError {
    pub code: ErrorCode,
    pub message: String,
}

impl VaultError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn io() -> Self {
        Self::new(ErrorCode::IoError, "本地文件操作失败")
    }

    pub fn corrupt() -> Self {
        Self::new(ErrorCode::VaultCorrupt, "保险库数据不完整或已损坏")
    }
}

impl From<std::io::Error> for VaultError {
    fn from(_: std::io::Error) -> Self {
        Self::io()
    }
}

impl From<rusqlite::Error> for VaultError {
    fn from(_: rusqlite::Error) -> Self {
        Self::new(ErrorCode::IoError, "本地数据库操作失败")
    }
}

impl From<serde_json::Error> for VaultError {
    fn from(_: serde_json::Error) -> Self {
        Self::corrupt()
    }
}

pub type VaultResult<T> = Result<T, VaultError>;
