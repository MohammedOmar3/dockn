use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Activity {
    pub id: Uuid,
    pub user_id: Uuid,
    pub activity_type: String,
    pub entity_id: Option<Uuid>,
    pub entity_type: String,
    pub description: String,
    pub timestamp: DateTime<Utc>,
}
