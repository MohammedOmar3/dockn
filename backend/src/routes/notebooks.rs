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
    models::notebook::{CreateNotebookDto, Notebook, UpdateNotebookDto},
    AppState,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(list_notebooks).post(create_notebook))
        .route("/:id", get(get_notebook).put(update_notebook).delete(delete_notebook))
}

async fn list_notebooks(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> AppResult<Json<Vec<Notebook>>> {
    let notebooks = sqlx::query_as!(
        Notebook,
        "SELECT * FROM notebooks WHERE user_id = $1 ORDER BY display_order ASC, created_at ASC",
        auth.user_id
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(notebooks))
}

async fn get_notebook(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Notebook>> {
    let notebook = sqlx::query_as!(
        Notebook,
        "SELECT * FROM notebooks WHERE id = $1 AND user_id = $2",
        id,
        auth.user_id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(notebook))
}

async fn create_notebook(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(body): Json<CreateNotebookDto>,
) -> AppResult<(StatusCode, Json<Notebook>)> {
    body.validate()
        .map_err(|e| AppError::BadRequest(e.to_string()))?;

    let max_order = sqlx::query_scalar!(
        "SELECT COALESCE(MAX(display_order), -1) FROM notebooks WHERE user_id = $1",
        auth.user_id
    )
    .fetch_one(&state.pool)
    .await?
    .unwrap_or(-1);

    let notebook = sqlx::query_as!(
        Notebook,
        r#"
        INSERT INTO notebooks (user_id, name, color, display_order, is_inbox)
        VALUES ($1, $2, $3, $4, FALSE)
        RETURNING *
        "#,
        auth.user_id,
        body.name.trim(),
        body.color.unwrap_or_else(|| "#6366f1".to_string()),
        max_order + 1
    )
    .fetch_one(&state.pool)
    .await?;

    Ok((StatusCode::CREATED, Json(notebook)))
}

async fn update_notebook(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateNotebookDto>,
) -> AppResult<Json<Notebook>> {
    body.validate()
        .map_err(|e| AppError::BadRequest(e.to_string()))?;

    // Prevent renaming inbox
    let is_inbox = sqlx::query_scalar!(
        "SELECT is_inbox FROM notebooks WHERE id = $1 AND user_id = $2",
        id,
        auth.user_id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    if is_inbox && body.name.is_some() {
        return Err(AppError::BadRequest("Cannot rename the Inbox notebook".to_string()));
    }

    let notebook = sqlx::query_as!(
        Notebook,
        r#"
        UPDATE notebooks
        SET
            name          = COALESCE($1, name),
            color         = COALESCE($2, color),
            display_order = COALESCE($3, display_order)
        WHERE id = $4 AND user_id = $5
        RETURNING *
        "#,
        body.name,
        body.color,
        body.display_order,
        id,
        auth.user_id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(notebook))
}

async fn delete_notebook(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let notebook = sqlx::query!(
        "SELECT is_inbox FROM notebooks WHERE id = $1 AND user_id = $2",
        id,
        auth.user_id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    if notebook.is_inbox {
        return Err(AppError::BadRequest("Cannot delete the Inbox notebook".to_string()));
    }

    // CASCADE handles notes deletion
    sqlx::query!(
        "DELETE FROM notebooks WHERE id = $1 AND user_id = $2",
        id,
        auth.user_id
    )
    .execute(&state.pool)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}
