use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

use crate::{
    error::{AppError, AppResult},
    middleware::auth::AuthUser,
    models::note::{CreateNoteDto, Note, UpdateNoteDto},
    services::activity_service,
    AppState,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(list_notes).post(create_note))
        .route("/:id", get(get_note).put(update_note).delete(delete_note))
        .route("/:id/tags/:tag_id", post(add_tag).delete(remove_tag))
}

#[derive(Debug, Deserialize)]
struct ListNotesQuery {
    notebook_id: Option<Uuid>,
}

async fn list_notes(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Query(q): Query<ListNotesQuery>,
) -> AppResult<Json<Vec<Note>>> {
    let notes = if let Some(nb_id) = q.notebook_id {
        // Verify notebook belongs to user
        let nb_exists = sqlx::query_scalar!(
            "SELECT COUNT(*) FROM notebooks WHERE id = $1 AND user_id = $2",
            nb_id,
            auth.user_id
        )
        .fetch_one(&state.pool)
        .await?
        .unwrap_or(0);

        if nb_exists == 0 {
            return Err(AppError::NotFound);
        }

        sqlx::query_as!(
            Note,
            "SELECT * FROM notes WHERE user_id = $1 AND notebook_id = $2 ORDER BY display_order ASC, updated_at DESC",
            auth.user_id,
            nb_id
        )
        .fetch_all(&state.pool)
        .await?
    } else {
        sqlx::query_as!(
            Note,
            "SELECT * FROM notes WHERE user_id = $1 ORDER BY updated_at DESC",
            auth.user_id
        )
        .fetch_all(&state.pool)
        .await?
    };

    Ok(Json(notes))
}

async fn get_note(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Note>> {
    let note = sqlx::query_as!(
        Note,
        "SELECT * FROM notes WHERE id = $1 AND user_id = $2",
        id,
        auth.user_id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(note))
}

async fn create_note(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(body): Json<CreateNoteDto>,
) -> AppResult<(StatusCode, Json<Note>)> {
    body.validate()
        .map_err(|e| AppError::BadRequest(e.to_string()))?;

    // Verify notebook belongs to user
    let nb_exists = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM notebooks WHERE id = $1 AND user_id = $2",
        body.notebook_id,
        auth.user_id
    )
    .fetch_one(&state.pool)
    .await?
    .unwrap_or(0);

    if nb_exists == 0 {
        return Err(AppError::NotFound);
    }

    let max_order = sqlx::query_scalar!(
        "SELECT COALESCE(MAX(display_order), -1) FROM notes WHERE notebook_id = $1",
        body.notebook_id
    )
    .fetch_one(&state.pool)
    .await?
    .unwrap_or(-1);

    let note = sqlx::query_as!(
        Note,
        r#"
        INSERT INTO notes (user_id, notebook_id, title, content, display_order)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        "#,
        auth.user_id,
        body.notebook_id,
        body.title.unwrap_or_else(|| "Untitled".to_string()),
        body.content.unwrap_or(serde_json::json!({})),
        max_order + 1
    )
    .fetch_one(&state.pool)
    .await?;

    let _ = activity_service::write_activity(
        &state.pool,
        auth.user_id,
        "note_created",
        Some(note.id),
        "note",
        &format!("Created note: {}", note.title),
    )
    .await;

    Ok((StatusCode::CREATED, Json(note)))
}

async fn update_note(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateNoteDto>,
) -> AppResult<Json<Note>> {
    body.validate()
        .map_err(|e| AppError::BadRequest(e.to_string()))?;

    // If moving to a different notebook, verify that notebook belongs to the user
    if let Some(nb_id) = body.notebook_id {
        let nb_exists = sqlx::query_scalar!(
            "SELECT COUNT(*) FROM notebooks WHERE id = $1 AND user_id = $2",
            nb_id,
            auth.user_id
        )
        .fetch_one(&state.pool)
        .await?
        .unwrap_or(0);

        if nb_exists == 0 {
            return Err(AppError::NotFound);
        }
    }

    let note = sqlx::query_as!(
        Note,
        r#"
        UPDATE notes
        SET
            title         = COALESCE($1, title),
            content       = COALESCE($2, content),
            notebook_id   = COALESCE($3, notebook_id),
            display_order = COALESCE($4, display_order)
        WHERE id = $5 AND user_id = $6
        RETURNING *
        "#,
        body.title,
        body.content,
        body.notebook_id,
        body.display_order,
        id,
        auth.user_id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    let _ = activity_service::write_activity(
        &state.pool,
        auth.user_id,
        "note_updated",
        Some(note.id),
        "note",
        &format!("Updated note: {}", note.title),
    )
    .await;

    Ok(Json(note))
}

async fn delete_note(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let result = sqlx::query!(
        "DELETE FROM notes WHERE id = $1 AND user_id = $2",
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

async fn add_tag(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path((note_id, tag_id)): Path<(Uuid, Uuid)>,
) -> AppResult<StatusCode> {
    let note_exists = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM notes WHERE id = $1 AND user_id = $2",
        note_id,
        auth.user_id
    )
    .fetch_one(&state.pool)
    .await?
    .unwrap_or(0);

    if note_exists == 0 {
        return Err(AppError::NotFound);
    }

    let tag_exists = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM tags WHERE id = $1 AND user_id = $2",
        tag_id,
        auth.user_id
    )
    .fetch_one(&state.pool)
    .await?
    .unwrap_or(0);

    if tag_exists == 0 {
        return Err(AppError::NotFound);
    }

    sqlx::query!(
        "INSERT INTO note_tags (note_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        note_id,
        tag_id
    )
    .execute(&state.pool)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

async fn remove_tag(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path((note_id, tag_id)): Path<(Uuid, Uuid)>,
) -> AppResult<StatusCode> {
    let result = sqlx::query!(
        r#"
        DELETE FROM note_tags
        WHERE note_id = $1 AND tag_id = $2
          AND EXISTS (SELECT 1 FROM notes WHERE id = $1 AND user_id = $3)
        "#,
        note_id,
        tag_id,
        auth.user_id
    )
    .execute(&state.pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(StatusCode::NO_CONTENT)
}
