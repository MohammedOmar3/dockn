use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub refresh_token_secret: String,
    pub frontend_url: String,
    pub port: u16,
    pub is_production: bool,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Config {
            database_url: required_env("DATABASE_URL")?,
            jwt_secret: required_env("JWT_SECRET")?,
            refresh_token_secret: required_env("REFRESH_TOKEN_SECRET")?,
            frontend_url: env::var("FRONTEND_URL")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
            port: env::var("PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()?,
            is_production: env::var("RAILWAY_ENVIRONMENT").is_ok()
                || env::var("IS_PRODUCTION")
                    .map(|v| v == "true")
                    .unwrap_or(false),
        })
    }
}

fn required_env(key: &str) -> anyhow::Result<String> {
    env::var(key).map_err(|_| anyhow::anyhow!("Missing required environment variable: {}", key))
}
