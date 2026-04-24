use crate::{error::AppError, services::auth_service};
use axum::{
    async_trait,
    extract::FromRequestParts,
    http::request::Parts,
    RequestPartsExt,
};
use axum_extra::extract::CookieJar;
use uuid::Uuid;

/// Authenticated user extracted from JWT cookie
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: Uuid,
    pub email: String,
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let jar = parts
            .extract::<CookieJar>()
            .await
            .map_err(|_| AppError::Unauthorized)?;

        let token = jar
            .get("access_token")
            .map(|c| c.value().to_owned())
            .ok_or(AppError::Unauthorized)?;

        // JWT secret must be accessible — we pull it from the state extension
        // For simplicity, read from env (already validated at startup)
        let secret = std::env::var("JWT_SECRET").map_err(|_| AppError::Unauthorized)?;

        let claims = auth_service::verify_access_token(&token, &secret)
            .map_err(|_| AppError::Unauthorized)?;

        Ok(AuthUser {
            user_id: claims.sub,
            email: claims.email,
        })
    }
}
