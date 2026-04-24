use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DailyLog {
    pub id: Uuid,
    pub user_id: Uuid,
    pub log_date: NaiveDate,
    pub content: Value,
    pub mood_score: Option<i16>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateDailyLogDto {
    pub log_date: NaiveDate,
    pub content: Option<Value>,
    pub mood_score: Option<i16>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateDailyLogDto {
    pub content: Option<Value>,
    pub mood_score: Option<i16>,
}
