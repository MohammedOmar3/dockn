mod config;
mod db;
mod error;
mod middleware;
mod models;
mod routes;
mod services;

use axum::Router;
use std::sync::Arc;
use tower_http::{
    compression::CompressionLayer,
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

pub struct AppState {
    pub pool: sqlx::PgPool,
    pub config: config::Config,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load .env if present (dev only)
    let _ = dotenvy::dotenv();

    // Logging
    let config = config::Config::from_env()?;
    if config.is_production {
        tracing_subscriber::registry()
            .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
            .with(fmt::layer().json())
            .init();
    } else {
        tracing_subscriber::registry()
            .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "debug".into()))
            .with(fmt::layer().pretty())
            .init();
    }

    tracing::info!("Starting dockn backend...");

    // Database
    let pool = db::create_pool(&config.database_url).await?;
    db::run_migrations(&pool).await?;
    tracing::info!("Database migrations complete");

    let state = Arc::new(AppState { pool, config: config.clone() });

    // CORS
    let cors = CorsLayer::new()
        .allow_origin(
            config
                .frontend_url
                .parse::<axum::http::HeaderValue>()
                .expect("Invalid FRONTEND_URL"),
        )
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::PATCH,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
        ])
        .expose_headers([axum::http::header::SET_COOKIE])
        .allow_credentials(true);

    let app = Router::new()
        .merge(routes::router())
        .layer(middleware::security_headers::layer())
        .layer(cors)
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = format!("0.0.0.0:{}", config.port);
    tracing::info!("Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
