use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, post, put},
    Json, Router,
};
use chrono::NaiveDate;
use uuid::Uuid;
use validator::Validate;

use crate::{
    error::{AppError, AppResult},
    middleware::auth::AuthUser,
    models::daily_log::{CreateDailyLogDto, DailyLog, UpdateDailyLogDto},
    AppState,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(list_logs).post(create_log))
        .route("/:id", put(update_log).delete(delete_log))
        .route("/date/:date", get(get_log_by_date))
}

async fn list_logs(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> AppResult<Json<Vec<DailyLog>>> {
    let logs = sqlx::query_as!(
        DailyLog,
        "SELECT * FROM daily_logs WHERE user_id = $1 ORDER BY log_date DESC",
        auth.user_id
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(logs))
}

async fn get_log_by_date(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(date): Path<NaiveDate>,
) -> AppResult<Json<DailyLog>> {
    let log = sqlx::query_as!(
        DailyLog,
        "SELECT * FROM daily_logs WHERE user_id = $1 AND log_date = $2",
        auth.user_id,
        date
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(log))
}

async fn create_log(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(body): Json<CreateDailyLogDto>,
) -> AppResult<(StatusCode, Json<DailyLog>)> {
    body.validate()
        .map_err(|e| AppError::BadRequest(e.to_string()))?;

    let log = sqlx::query_as!(
        DailyLog,
        r#"
        INSERT INTO daily_logs (user_id, log_date, content, mood_score)
        VALUES ($1, $2, COALESCE($3, '{}'::jsonb), $4)
        RETURNING *
        "#,
        auth.user_id,
        body.log_date,
        body.content as Option<serde_json::Value>,
        body.mood_score as Option<i16>
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.code().as_deref() == Some("23505") {
                return AppError::Conflict("A log for this date already exists".to_string());
            }
        }
        AppError::Database(e)
    })?;

    Ok((StatusCode::CREATED, Json(log)))
}

async fn update_log(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateDailyLogDto>,
) -> AppResult<Json<DailyLog>> {
    let log = sqlx::query_as!(
        DailyLog,
        r#"
        UPDATE daily_logs
        SET content    = COALESCE($1, content),
            mood_score = COALESCE($2, mood_score)
        WHERE id = $3 AND user_id = $4
        RETURNING *
        "#,
        body.content as Option<serde_json::Value>,
        body.mood_score as Option<i16>,
        id,
        auth.user_id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(log))
}

async fn delete_log(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let result = sqlx::query!(
        "DELETE FROM daily_logs WHERE id = $1 AND user_id = $2",
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
