use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EntryKind {
    Login,
    Note,
    Card,
    Identity,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CustomFieldKind {
    Text,
    Password,
    Date,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomField {
    pub id: String,
    pub label: String,
    pub kind: CustomFieldKind,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasswordHistoryItem {
    pub id: String,
    pub password: String,
    pub changed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommonFields {
    pub id: String,
    pub title: String,
    pub favorite: bool,
    pub notes: String,
    pub custom_fields: Vec<CustomField>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginEntry {
    #[serde(flatten)]
    pub common: CommonFields,
    pub username: String,
    pub password: String,
    pub website: String,
    pub password_history: Vec<PasswordHistoryItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteEntry {
    #[serde(flatten)]
    pub common: CommonFields,
    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CardEntry {
    #[serde(flatten)]
    pub common: CommonFields,
    pub cardholder: String,
    pub card_number: String,
    pub expiry: String,
    pub cvv: String,
    pub bank: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentityEntry {
    #[serde(flatten)]
    pub common: CommonFields,
    pub identity_type: String,
    pub holder: String,
    pub document_number: String,
    pub issued_at: String,
    pub expires_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum VaultEntry {
    Login(LoginEntry),
    Note(NoteEntry),
    Card(CardEntry),
    Identity(IdentityEntry),
}

impl VaultEntry {
    pub fn kind(&self) -> EntryKind {
        match self {
            Self::Login(_) => EntryKind::Login,
            Self::Note(_) => EntryKind::Note,
            Self::Card(_) => EntryKind::Card,
            Self::Identity(_) => EntryKind::Identity,
        }
    }

    pub fn common(&self) -> &CommonFields {
        match self {
            Self::Login(entry) => &entry.common,
            Self::Note(entry) => &entry.common,
            Self::Card(entry) => &entry.common,
            Self::Identity(entry) => &entry.common,
        }
    }

    pub fn common_mut(&mut self) -> &mut CommonFields {
        match self {
            Self::Login(entry) => &mut entry.common,
            Self::Note(entry) => &mut entry.common,
            Self::Card(entry) => &mut entry.common,
            Self::Identity(entry) => &mut entry.common,
        }
    }

    pub fn new_empty_for_test(kind: EntryKind) -> Self {
        let common = CommonFields {
            id: uuid::Uuid::new_v4().to_string(),
            title: String::new(),
            favorite: false,
            notes: String::new(),
            custom_fields: Vec::new(),
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        };
        match kind {
            EntryKind::Login => Self::Login(LoginEntry {
                common,
                username: String::new(),
                password: String::new(),
                website: String::new(),
                password_history: Vec::new(),
            }),
            EntryKind::Note => Self::Note(NoteEntry {
                common,
                body: String::new(),
            }),
            EntryKind::Card => Self::Card(CardEntry {
                common,
                cardholder: String::new(),
                card_number: String::new(),
                expiry: String::new(),
                cvv: String::new(),
                bank: String::new(),
            }),
            EntryKind::Identity => Self::Identity(IdentityEntry {
                common,
                identity_type: String::new(),
                holder: String::new(),
                document_number: String::new(),
                issued_at: String::new(),
                expires_at: String::new(),
            }),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntrySummary {
    pub id: String,
    pub kind: EntryKind,
    pub title: String,
    pub favorite: bool,
    pub summary: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VaultStatusKind {
    Empty,
    Locked,
    Unlocked,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageLocation {
    pub path: String,
    pub is_default: bool,
    pub volume_kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultStatus {
    pub state: VaultStatusKind,
    pub location: StorageLocation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub version: u32,
    pub storage_path: String,
}

pub type MigrationId = String;
