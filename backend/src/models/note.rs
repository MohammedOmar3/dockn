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
