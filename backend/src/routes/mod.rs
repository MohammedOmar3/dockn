pub mod auth;
pub mod health;
pub mod tasks;
pub mod daily_logs;
pub mod notebooks;
pub mod notes;
pub mod tags;
pub mod whiteboards;
pub mod whiteboard_folders;
pub mod capture;
pub mod activity;
pub mod search;

use std::sync::Arc;
use axum::Router;
use crate::AppState;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .nest("/health", health::router())
        .nest("/api/auth", auth::router())
        .nest("/api/tasks", tasks::router())
        .nest("/api/daily-logs", daily_logs::router())
        .nest("/api/notebooks", notebooks::router())
        .nest("/api/notes", notes::router())
        .nest("/api/tags", tags::router())
        .nest("/api/whiteboards", whiteboards::router())
        .nest("/api/whiteboard-folders", whiteboard_folders::router())
        .nest("/api/capture", capture::router())
        .nest("/api/activity", activity::router())
        .nest("/api/search", search::router())
}
