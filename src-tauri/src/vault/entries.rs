use crate::error::{ErrorCode, VaultError, VaultResult};
use crate::model::{
    CommonFields, CustomField, CustomFieldKind, EntryKind, EntrySummary, PasswordHistoryItem,
    VaultEntry,
};
use rusqlite::{Connection, Row};
use serde_json::{json, Value};

pub(crate) struct StoredEntry {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub favorite: bool,
    pub notes: String,
    pub payload_json: String,
    pub created_at: String,
    pub updated_at: String,
}

pub(crate) fn stored_from_row(row: &Row<'_>) -> rusqlite::Result<StoredEntry> {
    Ok(StoredEntry {
        id: row.get(0)?,
        kind: row.get(1)?,
        title: row.get(2)?,
        favorite: row.get::<_, i64>(3)? != 0,
        notes: row.get(4)?,
        payload_json: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

pub(crate) fn kind_name(kind: EntryKind) -> &'static str {
    match kind {
        EntryKind::Login => "login",
        EntryKind::Note => "note",
        EntryKind::Card => "card",
        EntryKind::Identity => "identity",
    }
}

fn parse_kind(value: &str) -> VaultResult<EntryKind> {
    match value {
        "login" => Ok(EntryKind::Login),
        "note" => Ok(EntryKind::Note),
        "card" => Ok(EntryKind::Card),
        "identity" => Ok(EntryKind::Identity),
        _ => Err(VaultError::corrupt()),
    }
}

fn field_kind_name(kind: CustomFieldKind) -> &'static str {
    match kind {
        CustomFieldKind::Text => "text",
        CustomFieldKind::Password => "password",
        CustomFieldKind::Date => "date",
    }
}

fn parse_field_kind(value: &str) -> VaultResult<CustomFieldKind> {
    match value {
        "text" => Ok(CustomFieldKind::Text),
        "password" => Ok(CustomFieldKind::Password),
        "date" => Ok(CustomFieldKind::Date),
        _ => Err(VaultError::corrupt()),
    }
}

fn text(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

pub(crate) fn payload_for(entry: &VaultEntry) -> Value {
    match entry {
        VaultEntry::Login(login) => json!({
            "username": login.username,
            "password": login.password,
            "website": login.website,
        }),
        VaultEntry::Note(note) => json!({ "body": note.body }),
        VaultEntry::Card(card) => json!({
            "cardholder": card.cardholder,
            "cardNumber": card.card_number,
            "expiry": card.expiry,
            "cvv": card.cvv,
            "bank": card.bank,
        }),
        VaultEntry::Identity(identity) => json!({
            "identityType": identity.identity_type,
            "holder": identity.holder,
            "documentNumber": identity.document_number,
            "issuedAt": identity.issued_at,
            "expiresAt": identity.expires_at,
        }),
    }
}

pub(crate) fn compose_entry(db: &Connection, stored: StoredEntry) -> VaultResult<VaultEntry> {
    let kind = parse_kind(&stored.kind)?;
    let payload: Value =
        serde_json::from_str(&stored.payload_json).map_err(|_| VaultError::corrupt())?;
    let mut statement = db.prepare(
        "SELECT id, label, kind, value FROM custom_fields WHERE entry_id = ?1 ORDER BY position",
    )?;
    let custom_fields = statement
        .query_map([&stored.id], |row| {
            Ok(CustomField {
                id: row.get(0)?,
                label: row.get(1)?,
                kind: parse_field_kind(&row.get::<_, String>(2)?).map_err(|error| {
                    rusqlite::Error::FromSqlConversionFailure(
                        2,
                        rusqlite::types::Type::Text,
                        Box::new(error),
                    )
                })?,
                value: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    let common = CommonFields {
        id: stored.id.clone(),
        title: stored.title,
        favorite: stored.favorite,
        notes: stored.notes,
        custom_fields,
        created_at: stored.created_at,
        updated_at: stored.updated_at,
    };
    match kind {
        EntryKind::Login => {
            let mut history_statement = db.prepare(
                "SELECT id, password, changed_at FROM password_history WHERE entry_id = ?1 ORDER BY changed_at DESC, rowid DESC",
            )?;
            let password_history = history_statement
                .query_map([&stored.id], |row| {
                    Ok(PasswordHistoryItem {
                        id: row.get(0)?,
                        password: row.get(1)?,
                        changed_at: row.get(2)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;
            Ok(VaultEntry::Login(crate::model::LoginEntry {
                common,
                username: text(&payload, "username"),
                password: text(&payload, "password"),
                website: text(&payload, "website"),
                password_history,
            }))
        }
        EntryKind::Note => Ok(VaultEntry::Note(crate::model::NoteEntry {
            common,
            body: text(&payload, "body"),
        })),
        EntryKind::Card => Ok(VaultEntry::Card(crate::model::CardEntry {
            common,
            cardholder: text(&payload, "cardholder"),
            card_number: text(&payload, "cardNumber"),
            expiry: text(&payload, "expiry"),
            cvv: text(&payload, "cvv"),
            bank: text(&payload, "bank"),
        })),
        EntryKind::Identity => Ok(VaultEntry::Identity(crate::model::IdentityEntry {
            common,
            identity_type: text(&payload, "identityType"),
            holder: text(&payload, "holder"),
            document_number: text(&payload, "documentNumber"),
            issued_at: text(&payload, "issuedAt"),
            expires_at: text(&payload, "expiresAt"),
        })),
    }
}

pub(crate) fn summary(entry: &VaultEntry) -> EntrySummary {
    let common = entry.common();
    let summary = match entry {
        VaultEntry::Login(login) => {
            if login.username.is_empty() {
                login.website.clone()
            } else {
                login.username.clone()
            }
        }
        VaultEntry::Note(note) => note
            .body
            .lines()
            .next()
            .unwrap_or(&common.notes)
            .to_string(),
        VaultEntry::Card(card) => format!(
            "{} · **** {}",
            card.bank,
            card.card_number
                .chars()
                .filter(|c| c.is_ascii_digit())
                .collect::<String>()
                .chars()
                .rev()
                .take(4)
                .collect::<String>()
                .chars()
                .rev()
                .collect::<String>()
        ),
        VaultEntry::Identity(identity) => {
            format!("{} · {}", identity.identity_type, identity.holder)
        }
    };
    EntrySummary {
        id: common.id.clone(),
        kind: entry.kind(),
        title: common.title.clone(),
        favorite: common.favorite,
        summary,
        search_text: search_text(entry),
        updated_at: common.updated_at.clone(),
    }
}

pub(crate) fn search_text(entry: &VaultEntry) -> String {
    let common = entry.common();
    let mut parts = vec![common.title.clone(), common.notes.clone()];
    match entry {
        VaultEntry::Login(login) => {
            parts.push(login.username.clone());
            parts.push(login.website.clone());
        }
        VaultEntry::Note(note) => parts.push(note.body.clone()),
        _ => {}
    }
    parts.join("\n").to_lowercase()
}

pub(crate) fn field_kind(field: &CustomField) -> &'static str {
    field_kind_name(field.kind)
}

pub fn validate_entry(entry: &VaultEntry) -> VaultResult<()> {
    let invalid = |message: &str| VaultError::new(ErrorCode::InvalidInput, message.to_string());
    let common = entry.common();
    if common.title.trim().is_empty() {
        return Err(invalid("请输入标题"));
    }
    if common.title.chars().count() > 120 {
        return Err(invalid("标题不能超过 120 个字符"));
    }
    if common.notes.chars().count() > 10_000 {
        return Err(invalid("备注不能超过 10000 个字符"));
    }
    let mut labels = std::collections::HashSet::new();
    for field in &common.custom_fields {
        let label = field.label.trim().to_lowercase();
        if label.is_empty() {
            return Err(invalid("请填写每个自定义字段的名称"));
        }
        if field.label.chars().count() > 40 {
            return Err(invalid("字段名称不能超过 40 个字符"));
        }
        if field.value.chars().count() > 4000 {
            return Err(invalid("字段值不能超过 4000 个字符"));
        }
        if !labels.insert(label) {
            return Err(invalid("自定义字段名称不能重复"));
        }
    }
    match entry {
        VaultEntry::Login(login) => {
            if login.username.chars().count() > 320 {
                return Err(invalid("用户名不能超过 320 个字符"));
            }
            if login.website.chars().count() > 2048 {
                return Err(invalid("网站地址不能超过 2048 个字符"));
            }
        }
        VaultEntry::Card(card) => {
            if !card.expiry.is_empty() {
                let valid = card.expiry.len() == 5
                    && &card.expiry[2..3] == "/"
                    && card.expiry[..2]
                        .parse::<u8>()
                        .map(|month| (1..=12).contains(&month))
                        .unwrap_or(false)
                    && card.expiry[3..].chars().all(|c| c.is_ascii_digit());
                if !valid {
                    return Err(invalid("有效期格式应为 MM/YY"));
                }
            }
        }
        VaultEntry::Identity(identity) => {
            if !identity.issued_at.is_empty()
                && !identity.expires_at.is_empty()
                && identity.expires_at < identity.issued_at
            {
                return Err(invalid("到期日期不能早于签发日期"));
            }
        }
        VaultEntry::Note(_) => {}
    }
    Ok(())
}
