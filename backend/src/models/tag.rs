use chrono::DateTime;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Tag {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub color: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateTagDto {
    #[validate(length(min = 1, max = 50))]
    pub name: String,
    #[validate(length(min = 4, max = 9))]
    pub color: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateTagDto {
    #[validate(length(min = 1, max = 50))]
    pub name: Option<String>,
    #[validate(length(min = 4, max = 9))]
    pub color: Option<String>,
}
