use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct WhiteboardFolder {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Whiteboard {
    pub id: Uuid,
    pub user_id: Uuid,
    pub folder_id: Option<Uuid>,
    pub title: String,
    pub raw_data: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateFolderDto {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateFolderDto {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateWhiteboardDto {
    #[validate(length(min = 1, max = 200))]
    pub title: Option<String>,
    pub folder_id: Option<Uuid>,
    pub raw_data: Option<Value>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateWhiteboardDto {
    #[validate(length(min = 1, max = 200))]
    pub title: Option<String>,
    pub folder_id: Option<Uuid>,
    pub raw_data: Option<Value>,
}
