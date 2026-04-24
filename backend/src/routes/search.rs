use std::sync::Arc;

use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    middleware::auth::AuthUser,
    AppState,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new().route("/", get(search))
}

#[derive(Debug, Deserialize)]
struct SearchQuery {
    q: String,
    #[serde(rename = "type", default = "default_type")]
    entity_type: SearchType,
}

#[derive(Debug, Deserialize, Default, PartialEq)]
#[serde(rename_all = "snake_case")]
enum SearchType {
    #[default]
    All,
    Tasks,
    Notes,
    Logs,
}

fn default_type() -> SearchType {
    SearchType::All
}

#[derive(Debug, Serialize)]
struct SearchResult {
    tasks: Vec<TaskResult>,
    notes: Vec<NoteResult>,
    logs: Vec<LogResult>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct TaskResult {
    id: Uuid,
    title: String,
    #[sqlx(rename = "status")]
    status: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct NoteResult {
    id: Uuid,
    title: String,
    notebook_id: Uuid,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct LogResult {
    id: Uuid,
    log_date: chrono::NaiveDate,
    content_snippet: String,
}

async fn search(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Query(params): Query<SearchQuery>,
) -> AppResult<Json<SearchResult>> {
    if params.q.trim().is_empty() {
        return Err(AppError::BadRequest("Query cannot be empty".to_string()));
    }

    let pattern = format!("%{}%", params.q.trim());

    let tasks = if params.entity_type == SearchType::All
        || params.entity_type == SearchType::Tasks
    {
        sqlx::query_as!(
            TaskResult,
            r#"
            SELECT id, title, status::TEXT AS "status!"
            FROM tasks
            WHERE user_id = $1 AND title ILIKE $2
            ORDER BY updated_at DESC
            LIMIT 20
            "#,
            auth.user_id,
            pattern
        )
        .fetch_all(&state.pool)
        .await?
    } else {
        vec![]
    };

    let notes = if params.entity_type == SearchType::All
        || params.entity_type == SearchType::Notes
    {
        sqlx::query_as!(
            NoteResult,
            r#"
            SELECT id, title, notebook_id
            FROM notes
            WHERE user_id = $1 AND title ILIKE $2
            ORDER BY updated_at DESC
            LIMIT 20
            "#,
            auth.user_id,
            pattern
        )
        .fetch_all(&state.pool)
        .await?
    } else {
        vec![]
    };

    let logs = if params.entity_type == SearchType::All
        || params.entity_type == SearchType::Logs
    {
        sqlx::query_as!(
            LogResult,
            r#"
            SELECT id, log_date,
                   LEFT(content, 150) AS "content_snippet!"
            FROM daily_logs
            WHERE user_id = $1 AND content ILIKE $2
            ORDER BY log_date DESC
            LIMIT 10
            "#,
            auth.user_id,
            pattern
        )
        .fetch_all(&state.pool)
        .await?
    } else {
        vec![]
    };

    Ok(Json(SearchResult { tasks, notes, logs }))
}
