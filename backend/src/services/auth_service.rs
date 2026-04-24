use crate::error::{AppError, AppResult};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

// ── JWT Claims ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AccessTokenClaims {
    pub sub: Uuid,
    pub email: String,
    pub exp: i64,
    pub iat: i64,
}

// ── Password hashing ──────────────────────────────────────────────────────────

pub fn hash_password(password: &str) -> AppResult<String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Password hashing failed: {}", e)))
}

pub fn verify_password(password: &str, hash: &str) -> AppResult<bool> {
    let parsed = PasswordHash::new(hash)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Invalid hash: {}", e)))?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok())
}

// ── Access token (15 min) ─────────────────────────────────────────────────────

pub fn issue_access_token(user_id: Uuid, email: &str, secret: &str) -> AppResult<String> {
    let now = Utc::now();
    let exp = (now + Duration::minutes(15)).timestamp();
    let claims = AccessTokenClaims {
        sub: user_id,
        email: email.to_string(),
        exp,
        iat: now.timestamp(),
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(anyhow::anyhow!("JWT encode error: {}", e)))
}

pub fn verify_access_token(token: &str, secret: &str) -> AppResult<AccessTokenClaims> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;
    decode::<AccessTokenClaims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .map(|td| td.claims)
    .map_err(|_| AppError::Unauthorized)
}

// ── Refresh token (30 days, opaque, stored hashed) ────────────────────────────

pub fn generate_refresh_token() -> String {
    let bytes: [u8; 32] = rand::thread_rng().gen();
    hex::encode(bytes)
}

pub fn hash_refresh_token(token: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}

pub async fn store_refresh_token(
    pool: &PgPool,
    user_id: Uuid,
    token: &str,
) -> AppResult<()> {
    let token_hash = hash_refresh_token(token);
    let expires_at = Utc::now() + Duration::days(30);
    sqlx::query!(
        "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
        user_id,
        token_hash,
        expires_at
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn verify_and_rotate_refresh_token(
    pool: &PgPool,
    raw_token: &str,
) -> AppResult<(Uuid, String)> {
    let token_hash = hash_refresh_token(raw_token);
    let record = sqlx::query!(
        r#"
        SELECT id, user_id, expires_at, revoked
        FROM refresh_tokens
        WHERE token_hash = $1
        "#,
        token_hash
    )
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::Unauthorized)?;

    if record.revoked || record.expires_at < Utc::now() {
        // Revoke all tokens for this user on suspected token reuse
        sqlx::query!(
            "UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1",
            record.user_id
        )
        .execute(pool)
        .await?;
        return Err(AppError::Unauthorized);
    }

    // Revoke current token
    sqlx::query!(
        "UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1",
        record.id
    )
    .execute(pool)
    .await?;

    // Issue new refresh token
    let new_token = generate_refresh_token();
    store_refresh_token(pool, record.user_id, &new_token).await?;

    Ok((record.user_id, new_token))
}

pub async fn revoke_refresh_token(pool: &PgPool, raw_token: &str) -> AppResult<()> {
    let token_hash = hash_refresh_token(raw_token);
    sqlx::query!(
        "UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1",
        token_hash
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn revoke_all_user_tokens(pool: &PgPool, user_id: Uuid) -> AppResult<()> {
    sqlx::query!(
        "UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1",
        user_id
    )
    .execute(pool)
    .await?;
    Ok(())
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_password_hash_verify_roundtrip() {
        let password = "SuperSecret123!";
        let hash = hash_password(password).unwrap();
        assert!(verify_password(password, &hash).unwrap());
        assert!(!verify_password("WrongPassword", &hash).unwrap());
    }

    #[test]
    fn test_jwt_issue_and_verify() {
        let user_id = Uuid::new_v4();
        let secret = "test_secret_at_least_32_characters_long_for_hs256";
        let token = issue_access_token(user_id, "test@example.com", secret).unwrap();
        let claims = verify_access_token(&token, secret).unwrap();
        assert_eq!(claims.sub, user_id);
        assert_eq!(claims.email, "test@example.com");
    }

    #[test]
    fn test_refresh_token_hash_deterministic() {
        let token = "abc123";
        let h1 = hash_refresh_token(token);
        let h2 = hash_refresh_token(token);
        assert_eq!(h1, h2);
    }
}
