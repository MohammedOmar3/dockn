use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Notebook {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub color: String,
    pub display_order: i32,
    pub is_inbox: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateNotebookDto {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    #[validate(length(min = 4, max = 9))]
    pub color: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateNotebookDto {
    #[validate(length(min = 1, max = 100))]
    pub name: Option<String>,
    #[validate(length(min = 4, max = 9))]
    pub color: Option<String>,
    pub display_order: Option<i32>,
}
