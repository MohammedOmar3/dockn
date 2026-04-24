use std::sync::Arc;

use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};
use chrono::NaiveDate;

use crate::{
    error::AppResult,
    middleware::auth::AuthUser,
    models::activity::Activity,
    AppState,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new().route("/:date", get(get_activity_by_date))
}

async fn get_activity_by_date(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(date): Path<NaiveDate>,
) -> AppResult<Json<Vec<Activity>>> {
    let activities = sqlx::query_as!(
        Activity,
        r#"
        SELECT * FROM activities
        WHERE user_id = $1 AND timestamp::DATE = $2
        ORDER BY timestamp DESC
        "#,
        auth.user_id,
        date
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(activities))
}
