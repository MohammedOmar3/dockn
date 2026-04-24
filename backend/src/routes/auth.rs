use std::sync::Arc;

use axum::{
    extract::State,
    http::{header, StatusCode},
    response::IntoResponse,
    routing::{delete, get, post, put},
    Json, Router,
};
use axum_extra::extract::CookieJar;
use axum_extra::extract::cookie::{Cookie, SameSite};
use serde::{Deserialize, Serialize};
use time::Duration;
use validator::Validate;

use crate::{
    error::{AppError, AppResult},
    middleware::auth::AuthUser,
    models::user::{User, UserResponse},
    services::auth_service,
    AppState,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/logout", post(logout))
        .route("/refresh", post(refresh))
        .route("/me", get(me))
        .route("/profile", put(update_profile))
        .route("/password", put(change_password))
        .route("/account", delete(delete_account))
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Validate)]
struct RegisterDto {
    #[validate(length(min = 1, max = 100))]
    first_name: String,
    #[validate(length(min = 1, max = 100))]
    last_name: String,
    #[validate(email)]
    email: String,
    #[validate(length(min = 8, max = 128))]
    password: String,
}

#[derive(Debug, Deserialize)]
struct LoginDto {
    email: String,
    password: String,
}

#[derive(Debug, Deserialize, Validate)]
struct UpdateProfileDto {
    #[validate(length(min = 1, max = 100))]
    first_name: Option<String>,
    #[validate(length(min = 1, max = 100))]
    last_name: Option<String>,
    #[validate(email)]
    email: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ChangePasswordDto {
    current_password: String,
    #[serde(rename = "new_password")]
    new_password: String,
}

#[derive(Debug, Deserialize)]
struct DeleteAccountDto {
    password: String,
}

#[derive(Serialize)]
struct AuthResponse {
    user: UserResponse,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn make_access_cookie(token: &str, secure: bool) -> Cookie<'static> {
    Cookie::build(("access_token", token.to_owned()))
        .path("/")
        .http_only(true)
        .secure(secure)
        .same_site(SameSite::Lax)
        .max_age(Duration::minutes(15))
        .build()
}

fn make_refresh_cookie(token: &str, secure: bool) -> Cookie<'static> {
    Cookie::build(("refresh_token", token.to_owned()))
        .path("/api/auth")
        .http_only(true)
        .secure(secure)
        .same_site(SameSite::Lax)
        .max_age(Duration::days(30))
        .build()
}

fn clear_cookie(name: &str) -> Cookie<'static> {
    Cookie::build((name.to_owned(), ""))
        .path("/")
        .http_only(true)
        .max_age(Duration::seconds(0))
        .build()
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async fn register(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    Json(body): Json<RegisterDto>,
) -> AppResult<impl IntoResponse> {
    body.validate()
        .map_err(|e| AppError::BadRequest(e.to_string()))?;

    // Check if email already exists
    let existing = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM users WHERE email = $1",
        body.email.to_lowercase()
    )
    .fetch_one(&state.pool)
    .await?;

    if existing.unwrap_or(0) > 0 {
        return Err(AppError::Conflict("Email already registered".to_string()));
    }

    let password_hash = auth_service::hash_password(&body.password)?;

    let user = sqlx::query_as!(
        User,
        r#"
        INSERT INTO users (first_name, last_name, email, password_hash)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#,
        body.first_name.trim(),
        body.last_name.trim(),
        body.email.to_lowercase().trim(),
        password_hash
    )
    .fetch_one(&state.pool)
    .await?;

    // Create Inbox notebook for the new user
    sqlx::query!(
        r#"
        INSERT INTO notebooks (user_id, name, color, display_order, is_inbox)
        VALUES ($1, 'Inbox', '#6366f1', 0, TRUE)
        "#,
        user.id
    )
    .execute(&state.pool)
    .await?;

    let access_token =
        auth_service::issue_access_token(user.id, &user.email, &state.config.jwt_secret)?;
    let refresh_token = auth_service::generate_refresh_token();
    auth_service::store_refresh_token(&state.pool, user.id, &refresh_token).await?;

    let secure = state.config.is_production;
    let jar = jar
        .add(make_access_cookie(&access_token, secure))
        .add(make_refresh_cookie(&refresh_token, secure));

    Ok((StatusCode::CREATED, jar, Json(AuthResponse { user: user.into() })))
}

async fn login(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    Json(body): Json<LoginDto>,
) -> AppResult<impl IntoResponse> {
    let user = sqlx::query_as!(
        User,
        "SELECT * FROM users WHERE email = $1 AND is_active = TRUE",
        body.email.to_lowercase().trim()
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::Unauthorized)?;

    let valid = auth_service::verify_password(&body.password, &user.password_hash)?;
    if !valid {
        return Err(AppError::Unauthorized);
    }

    let access_token =
        auth_service::issue_access_token(user.id, &user.email, &state.config.jwt_secret)?;
    let refresh_token = auth_service::generate_refresh_token();
    auth_service::store_refresh_token(&state.pool, user.id, &refresh_token).await?;

    let secure = state.config.is_production;
    let jar = jar
        .add(make_access_cookie(&access_token, secure))
        .add(make_refresh_cookie(&refresh_token, secure));

    Ok((jar, Json(AuthResponse { user: user.into() })))
}

async fn logout(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
) -> AppResult<impl IntoResponse> {
    if let Some(rt) = jar.get("refresh_token") {
        let _ = auth_service::revoke_refresh_token(&state.pool, rt.value()).await;
    }

    let jar = jar
        .add(clear_cookie("access_token"))
        .add(clear_cookie("refresh_token"));

    Ok((StatusCode::NO_CONTENT, jar))
}

async fn refresh(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
) -> AppResult<impl IntoResponse> {
    let raw_token = jar
        .get("refresh_token")
        .map(|c| c.value().to_owned())
        .ok_or(AppError::Unauthorized)?;

    let (user_id, new_refresh_token) =
        auth_service::verify_and_rotate_refresh_token(&state.pool, &raw_token).await?;

    let user = sqlx::query_as!(
        User,
        "SELECT * FROM users WHERE id = $1 AND is_active = TRUE",
        user_id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::Unauthorized)?;

    let access_token =
        auth_service::issue_access_token(user.id, &user.email, &state.config.jwt_secret)?;

    let secure = state.config.is_production;
    let jar = jar
        .add(make_access_cookie(&access_token, secure))
        .add(make_refresh_cookie(&new_refresh_token, secure));

    Ok((jar, Json(AuthResponse { user: user.into() })))
}

async fn me(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> AppResult<Json<UserResponse>> {
    let user = sqlx::query_as!(
        User,
        "SELECT * FROM users WHERE id = $1 AND is_active = TRUE",
        auth.user_id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::Unauthorized)?;

    Ok(Json(user.into()))
}

async fn update_profile(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(body): Json<UpdateProfileDto>,
) -> AppResult<Json<UserResponse>> {
    body.validate()
        .map_err(|e| AppError::BadRequest(e.to_string()))?;

    let user = sqlx::query_as!(
        User,
        r#"
        UPDATE users
        SET
            first_name = COALESCE($1, first_name),
            last_name  = COALESCE($2, last_name),
            email      = COALESCE($3, email)
        WHERE id = $4 AND is_active = TRUE
        RETURNING *
        "#,
        body.first_name,
        body.last_name,
        body.email.map(|e| e.to_lowercase()),
        auth.user_id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(user.into()))
}

async fn change_password(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(body): Json<ChangePasswordDto>,
) -> AppResult<StatusCode> {
    if body.new_password.len() < 8 {
        return Err(AppError::BadRequest(
            "New password must be at least 8 characters".to_string(),
        ));
    }

    let user = sqlx::query_as!(
        User,
        "SELECT * FROM users WHERE id = $1 AND is_active = TRUE",
        auth.user_id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::Unauthorized)?;

    if !auth_service::verify_password(&body.current_password, &user.password_hash)? {
        return Err(AppError::BadRequest("Current password is incorrect".to_string()));
    }

    let new_hash = auth_service::hash_password(&body.new_password)?;
    sqlx::query!(
        "UPDATE users SET password_hash = $1 WHERE id = $2",
        new_hash,
        auth.user_id
    )
    .execute(&state.pool)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

async fn delete_account(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    jar: CookieJar,
    Json(body): Json<DeleteAccountDto>,
) -> AppResult<impl IntoResponse> {
    let user = sqlx::query_as!(
        User,
        "SELECT * FROM users WHERE id = $1 AND is_active = TRUE",
        auth.user_id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::Unauthorized)?;

    if !auth_service::verify_password(&body.password, &user.password_hash)? {
        return Err(AppError::BadRequest("Password is incorrect".to_string()));
    }

    // Soft delete + revoke all tokens
    sqlx::query!(
        "UPDATE users SET is_active = FALSE WHERE id = $1",
        auth.user_id
    )
    .execute(&state.pool)
    .await?;

    auth_service::revoke_all_user_tokens(&state.pool, auth.user_id).await?;

    let jar = jar
        .add(clear_cookie("access_token"))
        .add(clear_cookie("refresh_token"));

    Ok((StatusCode::NO_CONTENT, jar))
}
