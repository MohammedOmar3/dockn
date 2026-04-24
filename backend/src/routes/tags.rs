use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, post, put},
    Json, Router,
};
use uuid::Uuid;
use validator::Validate;

use crate::{
    error::{AppError, AppResult},
    middleware::auth::AuthUser,
    models::tag::{CreateTagDto, Tag, UpdateTagDto},
    AppState,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(list_tags).post(create_tag))
        .route("/:id", put(update_tag).delete(delete_tag))
}

async fn list_tags(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> AppResult<Json<Vec<Tag>>> {
    let tags = sqlx::query_as!(
        Tag,
        "SELECT * FROM tags WHERE user_id = $1 ORDER BY name ASC",
        auth.user_id
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(tags))
}

async fn create_tag(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(body): Json<CreateTagDto>,
) -> AppResult<(StatusCode, Json<Tag>)> {
    body.validate()
        .map_err(|e| AppError::BadRequest(e.to_string()))?;

    let tag = sqlx::query_as!(
        Tag,
        r#"
        INSERT INTO tags (user_id, name, color)
        VALUES ($1, $2, $3)
        RETURNING *
        "#,
        auth.user_id,
        body.name.to_lowercase().trim(),
        body.color.unwrap_or_else(|| "#6366f1".to_string())
    )
    .fetch_one(&state.pool)
    .await?;

    Ok((StatusCode::CREATED, Json(tag)))
}

async fn update_tag(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateTagDto>,
) -> AppResult<Json<Tag>> {
    body.validate()
        .map_err(|e| AppError::BadRequest(e.to_string()))?;

    let tag = sqlx::query_as!(
        Tag,
        r#"
        UPDATE tags
        SET
            name  = COALESCE($1, name),
            color = COALESCE($2, color)
        WHERE id = $3 AND user_id = $4
        RETURNING *
        "#,
        body.name,
        body.color,
        id,
        auth.user_id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(tag))
}

async fn delete_tag(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let result = sqlx::query!(
        "DELETE FROM tags WHERE id = $1 AND user_id = $2",
        id,
        auth.user_id
    )
    .execute(&state.pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(StatusCode::NO_CONTENT)
}
