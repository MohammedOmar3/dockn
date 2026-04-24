use crate::error::AppResult;
use sqlx::PgPool;
use uuid::Uuid;

pub async fn write_activity(
    pool: &PgPool,
    user_id: Uuid,
    activity_type: &str,
    entity_id: Option<Uuid>,
    entity_type: &str,
    description: &str,
) -> AppResult<()> {
    sqlx::query!(
        r#"
        INSERT INTO activities (user_id, activity_type, entity_id, entity_type, description)
        VALUES ($1, $2, $3, $4, $5)
        "#,
        user_id,
        activity_type,
        entity_id,
        entity_type,
        description
    )
    .execute(pool)
    .await?;
    Ok(())
}
