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
    models::whiteboard::{CreateFolderDto, UpdateFolderDto, WhiteboardFolder},
    AppState,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(list_folders).post(create_folder))
        .route("/:id", get(get_folder).put(update_folder).delete(delete_folder))
}

async fn list_folders(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> AppResult<Json<Vec<WhiteboardFolder>>> {
    let folders = sqlx::query_as!(
        WhiteboardFolder,
        "SELECT * FROM whiteboard_folders WHERE user_id = $1 ORDER BY name ASC",
        auth.user_id
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(folders))
}

async fn get_folder(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<WhiteboardFolder>> {
    let folder = sqlx::query_as!(
        WhiteboardFolder,
        "SELECT * FROM whiteboard_folders WHERE id = $1 AND user_id = $2",
        id,
        auth.user_id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(folder))
}

async fn create_folder(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(body): Json<CreateFolderDto>,
) -> AppResult<(StatusCode, Json<WhiteboardFolder>)> {
    body.validate()
        .map_err(|e| AppError::BadRequest(e.to_string()))?;

    let folder = sqlx::query_as!(
        WhiteboardFolder,
        r#"
        INSERT INTO whiteboard_folders (user_id, name)
        VALUES ($1, $2)
        RETURNING *
        "#,
        auth.user_id,
        body.name.trim()
    )
    .fetch_one(&state.pool)
    .await?;

    Ok((StatusCode::CREATED, Json(folder)))
}

async fn update_folder(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateFolderDto>,
) -> AppResult<Json<WhiteboardFolder>> {
    body.validate()
        .map_err(|e| AppError::BadRequest(e.to_string()))?;

    let folder = sqlx::query_as!(
        WhiteboardFolder,
        r#"
        UPDATE whiteboard_folders SET name = $1
        WHERE id = $2 AND user_id = $3
        RETURNING *
        "#,
        body.name.trim(),
        id,
        auth.user_id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(folder))
}

async fn delete_folder(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    // Verify folder belongs to user
    let exists = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM whiteboard_folders WHERE id = $1 AND user_id = $2",
        id,
        auth.user_id
    )
    .fetch_one(&state.pool)
    .await?
    .unwrap_or(0);

    if exists == 0 {
        return Err(AppError::NotFound);
    }

    // Move whiteboards to Unfiled (folder_id = NULL)
    sqlx::query!(
        "UPDATE whiteboards SET folder_id = NULL WHERE folder_id = $1 AND user_id = $2",
        id,
        auth.user_id
    )
    .execute(&state.pool)
    .await?;

    sqlx::query!(
        "DELETE FROM whiteboard_folders WHERE id = $1 AND user_id = $2",
        id,
        auth.user_id
    )
    .execute(&state.pool)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}
