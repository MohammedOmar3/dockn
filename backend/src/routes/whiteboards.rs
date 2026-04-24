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
    models::whiteboard::{
        CreateWhiteboardDto, UpdateWhiteboardDto, Whiteboard,
    },
    services::activity_service,
    AppState,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(list_whiteboards).post(create_whiteboard))
        .route("/:id", get(get_whiteboard).put(update_whiteboard).delete(delete_whiteboard))
}

async fn list_whiteboards(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> AppResult<Json<Vec<Whiteboard>>> {
    let whiteboards = sqlx::query_as!(
        Whiteboard,
        "SELECT * FROM whiteboards WHERE user_id = $1 ORDER BY updated_at DESC",
        auth.user_id
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(whiteboards))
}

async fn get_whiteboard(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Whiteboard>> {
    let wb = sqlx::query_as!(
        Whiteboard,
        "SELECT * FROM whiteboards WHERE id = $1 AND user_id = $2",
        id,
        auth.user_id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(wb))
}

async fn create_whiteboard(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(body): Json<CreateWhiteboardDto>,
) -> AppResult<(StatusCode, Json<Whiteboard>)> {
    body.validate()
        .map_err(|e| AppError::BadRequest(e.to_string()))?;

    // If folder_id provided, verify ownership
    if let Some(folder_id) = body.folder_id {
        let exists = sqlx::query_scalar!(
            "SELECT COUNT(*) FROM whiteboard_folders WHERE id = $1 AND user_id = $2",
            folder_id,
            auth.user_id
        )
        .fetch_one(&state.pool)
        .await?
        .unwrap_or(0);

        if exists == 0 {
            return Err(AppError::NotFound);
        }
    }

    let wb = sqlx::query_as!(
        Whiteboard,
        r#"
        INSERT INTO whiteboards (user_id, folder_id, title, raw_data)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#,
        auth.user_id,
        body.folder_id,
        body.title.unwrap_or_else(|| "Untitled Whiteboard".to_string()),
        body.raw_data.unwrap_or(serde_json::json!({}))
    )
    .fetch_one(&state.pool)
    .await?;

    let _ = activity_service::write_activity(
        &state.pool,
        auth.user_id,
        "whiteboard_created",
        Some(wb.id),
        "whiteboard",
        &format!("Created whiteboard: {}", wb.title),
    )
    .await;

    Ok((StatusCode::CREATED, Json(wb)))
}

async fn update_whiteboard(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateWhiteboardDto>,
) -> AppResult<Json<Whiteboard>> {
    body.validate()
        .map_err(|e| AppError::BadRequest(e.to_string()))?;

    let wb = sqlx::query_as!(
        Whiteboard,
        r#"
        UPDATE whiteboards
        SET
            title     = COALESCE($1, title),
            folder_id = COALESCE($2, folder_id),
            raw_data  = COALESCE($3, raw_data)
        WHERE id = $4 AND user_id = $5
        RETURNING *
        "#,
        body.title,
        body.folder_id,
        body.raw_data,
        id,
        auth.user_id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(wb))
}

async fn delete_whiteboard(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let result = sqlx::query!(
        "DELETE FROM whiteboards WHERE id = $1 AND user_id = $2",
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
