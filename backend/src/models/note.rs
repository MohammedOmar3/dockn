use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Note {
    pub id: Uuid,
    pub user_id: Uuid,
    pub notebook_id: Uuid,
    pub title: String,
    pub content: Value,
    pub display_order: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateNoteDto {
    pub notebook_id: Uuid,
    #[validate(length(min = 0, max = 500))]
    pub title: Option<String>,
    pub content: Option<Value>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateNoteDto {
    #[validate(length(min = 0, max = 500))]
    pub title: Option<String>,
    pub content: Option<Value>,
    pub notebook_id: Option<Uuid>,
    pub display_order: Option<i32>,
}

/// A valid empty ProseMirror/TipTap document — `{}` is NOT valid (it has no
/// `type: "doc"`), and TipTap silently discards invalid content on load,
/// which previously made every new note render as a blank, unrecoverable editor.
pub fn empty_note_content() -> Value {
    serde_json::json!({
        "type": "doc",
        "content": [{ "type": "paragraph" }]
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_note_content_is_a_valid_prosemirror_doc() {
        let content = empty_note_content();
        assert_eq!(content["type"], "doc");
        let children = content["content"].as_array().expect("content must be an array");
        assert!(!children.is_empty(), "an empty array content is not a valid ProseMirror doc");
        assert_eq!(children[0]["type"], "paragraph");
    }
}
