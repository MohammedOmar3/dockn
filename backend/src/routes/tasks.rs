use std::collections::HashMap;
use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::Serialize;
use uuid::Uuid;
use validator::Validate;

use crate::{
    error::{AppError, AppResult},
    middleware::auth::AuthUser,
    models::tag::Tag,
    models::task::{CreateTaskDto, Task, TaskPriority, TaskStatus, UpdateTaskDto},
    services::activity_service,
    AppState,
};

/// Task response including its associated tags.
#[derive(Debug, Serialize)]
pub struct TaskWithTags {
    #[serde(flatten)]
    pub task: Task,
    pub tags: Vec<Tag>,
}

/// Load all tags for a single task.
async fn load_tags(pool: &sqlx::PgPool, task_id: Uuid) -> Result<Vec<Tag>, sqlx::Error> {
    sqlx::query_as!(
        Tag,
        r#"
        SELECT t.id, t.user_id, t.name, t.color, t.created_at
        FROM tags t
        JOIN task_tags tt ON tt.tag_id = t.id
        WHERE tt.task_id = $1
        ORDER BY t.name
        "#,
        task_id
    )
    .fetch_all(pool)
    .await
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(list_tasks).post(create_task))
        .route("/:id", get(get_task).put(update_task).delete(delete_task))
        .route("/:id/tags/:tag_id", post(add_tag).delete(remove_tag))
}

async fn list_tasks(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> AppResult<Json<Vec<TaskWithTags>>> {
    let tasks = sqlx::query_as!(
        Task,
        r#"
        SELECT id, user_id, title, description,
               status AS "status: TaskStatus",
               priority AS "priority: TaskPriority",
               due_date, created_at, updated_at
        FROM tasks
        WHERE user_id = $1
        ORDER BY
            CASE priority
                WHEN 'urgent' THEN 0
                WHEN 'high'   THEN 1
                WHEN 'medium' THEN 2
                ELSE               3
            END,
            due_date ASC NULLS LAST,
            created_at DESC
        "#,
        auth.user_id
    )
    .fetch_all(&state.pool)
    .await?;

    if tasks.is_empty() {
        return Ok(Json(vec![]));
    }

    let task_ids: Vec<Uuid> = tasks.iter().map(|t| t.id).collect();

    let tag_rows = sqlx::query!(
        r#"
        SELECT tt.task_id,
               t.id AS tag_id, t.user_id AS tag_user_id,
               t.name, t.color, t.created_at AS tag_created_at
        FROM task_tags tt
        JOIN tags t ON t.id = tt.tag_id
        WHERE tt.task_id = ANY($1)
        ORDER BY t.name
        "#,
        &task_ids as &[Uuid]
    )
    .fetch_all(&state.pool)
    .await?;

    let mut tag_map: HashMap<Uuid, Vec<Tag>> = HashMap::new();
    for row in tag_rows {
        tag_map.entry(row.task_id).or_default().push(Tag {
            id: row.tag_id,
            user_id: row.tag_user_id,
            name: row.name,
            color: row.color,
            created_at: row.tag_created_at,
        });
    }

    let result = tasks
        .into_iter()
        .map(|t| {
            let tags = tag_map.remove(&t.id).unwrap_or_default();
            TaskWithTags { task: t, tags }
        })
        .collect();

    Ok(Json(result))
}

async fn get_task(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<TaskWithTags>> {
    let task = sqlx::query_as!(
        Task,
        r#"
        SELECT id, user_id, title, description,
               status AS "status: TaskStatus",
               priority AS "priority: TaskPriority",
               due_date, created_at, updated_at
        FROM tasks
        WHERE id = $1 AND user_id = $2
        "#,
        id,
        auth.user_id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    let tags = load_tags(&state.pool, task.id).await?;
    Ok(Json(TaskWithTags { task, tags }))
}

async fn create_task(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(body): Json<CreateTaskDto>,
) -> AppResult<(StatusCode, Json<TaskWithTags>)> {
    body.validate()
        .map_err(|e| AppError::BadRequest(e.to_string()))?;

    let description = body
        .description
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned);

    let task = sqlx::query_as!(
        Task,
        r#"
        INSERT INTO tasks (user_id, title, description, status, priority, due_date)
        VALUES ($1, $2, $3,
            COALESCE($4, 'todo'::task_status),
            COALESCE($5, 'medium'::task_priority),
            $6)
        RETURNING id, user_id, title, description,
                  status AS "status: TaskStatus",
                  priority AS "priority: TaskPriority",
                  due_date, created_at, updated_at
        "#,
        auth.user_id,
        body.title.trim(),
        description,
        body.status as Option<TaskStatus>,
        body.priority as Option<TaskPriority>,
        body.due_date
    )
    .fetch_one(&state.pool)
    .await?;

    let _ = activity_service::write_activity(
        &state.pool,
        auth.user_id,
        "task_created",
        Some(task.id),
        "task",
        &format!("Created task: {}", task.title),
    )
    .await;

    Ok((StatusCode::CREATED, Json(TaskWithTags { task, tags: vec![] })))
}

async fn update_task(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateTaskDto>,
) -> AppResult<Json<TaskWithTags>> {
    body.validate()
        .map_err(|e| AppError::BadRequest(e.to_string()))?;

    let due_date = if body.clear_due_date == Some(true) {
        None
    } else {
        body.due_date
    };

    let task = sqlx::query_as!(
        Task,
        r#"
        UPDATE tasks
        SET
            title       = COALESCE($1, title),
            description = COALESCE($2, description),
            status      = COALESCE($3, status),
            priority    = COALESCE($4, priority),
            due_date    = CASE WHEN $5 = TRUE THEN NULL
                               WHEN $6 IS NOT NULL THEN $6
                               ELSE due_date END
        WHERE id = $7 AND user_id = $8
        RETURNING id, user_id, title, description,
                  status AS "status: TaskStatus",
                  priority AS "priority: TaskPriority",
                  due_date, created_at, updated_at
        "#,
        body.title,
        body.description,
        body.status as Option<TaskStatus>,
        body.priority as Option<TaskPriority>,
        body.clear_due_date,
        due_date,
        id,
        auth.user_id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    let _ = activity_service::write_activity(
        &state.pool,
        auth.user_id,
        "task_updated",
        Some(task.id),
        "task",
        &format!("Updated task: {}", task.title),
    )
    .await;

    let tags = load_tags(&state.pool, task.id).await?;
    Ok(Json(TaskWithTags { task, tags }))
}

async fn delete_task(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let result = sqlx::query!(
        "DELETE FROM tasks WHERE id = $1 AND user_id = $2",
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
    Path((task_id, tag_id)): Path<(Uuid, Uuid)>,
) -> AppResult<StatusCode> {
    // Verify task belongs to user
    let exists = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM tasks WHERE id = $1 AND user_id = $2",
        task_id,
        auth.user_id
    )
    .fetch_one(&state.pool)
    .await?
    .unwrap_or(0);

    if exists == 0 {
        return Err(AppError::NotFound);
    }

    // Verify tag belongs to user
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
        "INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        task_id,
        tag_id
    )
    .execute(&state.pool)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

async fn remove_tag(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path((task_id, tag_id)): Path<(Uuid, Uuid)>,
) -> AppResult<StatusCode> {
    let result = sqlx::query!(
        r#"
        DELETE FROM task_tags
        WHERE task_id = $1 AND tag_id = $2
          AND EXISTS (SELECT 1 FROM tasks WHERE id = $1 AND user_id = $3)
        "#,
        task_id,
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
