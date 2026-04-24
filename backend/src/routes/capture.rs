use std::sync::Arc;

use axum::{
    extract::State,
    http::StatusCode,
    routing::post,
    Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::{
    error::{AppError, AppResult},
    middleware::auth::AuthUser,
    models::{note::Note, task::{Task, TaskPriority, TaskStatus}},
    services::activity_service,
    AppState,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new().route("/", post(capture))
}

#[derive(Debug, Deserialize)]
struct CaptureDto {
    text: String,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum CaptureResult {
    Task { entity: Task },
    Note { entity: Note },
}

async fn capture(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(body): Json<CaptureDto>,
) -> AppResult<(StatusCode, Json<CaptureResult>)> {
    let text = body.text.trim();
    if text.is_empty() {
        return Err(AppError::BadRequest("Text cannot be empty".to_string()));
    }

    if let Some(title) = text.strip_prefix("@task").map(|s| s.trim()) {
        // Create task
        let task = sqlx::query_as!(
            Task,
            r#"
            INSERT INTO tasks (user_id, title, status, priority)
            VALUES ($1, $2, 'todo'::task_status, 'medium'::task_priority)
            RETURNING id, user_id, title, description,
                      status AS "status: TaskStatus",
                      priority AS "priority: TaskPriority",
                      due_date, created_at, updated_at
            "#,
            auth.user_id,
            if title.is_empty() { "New Task" } else { title }
        )
        .fetch_one(&state.pool)
        .await?;

        let _ = activity_service::write_activity(
            &state.pool,
            auth.user_id,
            "task_created",
            Some(task.id),
            "task",
            &format!("Captured task: {}", task.title),
        )
        .await;

        return Ok((StatusCode::CREATED, Json(CaptureResult::Task { entity: task })));
    }

    // Default → create note in Inbox notebook
    let note_title = text
        .strip_prefix("@note")
        .map(|s| s.trim())
        .unwrap_or(text);

    let inbox_id = sqlx::query_scalar!(
        "SELECT id FROM notebooks WHERE user_id = $1 AND is_inbox = TRUE LIMIT 1",
        auth.user_id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::Internal(anyhow::anyhow!("Inbox notebook not found")))?;

    let note = sqlx::query_as!(
        Note,
        r#"
        INSERT INTO notes (user_id, notebook_id, title, content)
        VALUES ($1, $2, $3, '{}')
        RETURNING *
        "#,
        auth.user_id,
        inbox_id,
        if note_title.is_empty() { "New Note" } else { note_title }
    )
    .fetch_one(&state.pool)
    .await?;

    let _ = activity_service::write_activity(
        &state.pool,
        auth.user_id,
        "note_created",
        Some(note.id),
        "note",
        &format!("Captured note: {}", note.title),
    )
    .await;

    Ok((StatusCode::CREATED, Json(CaptureResult::Note { entity: note })))
}
