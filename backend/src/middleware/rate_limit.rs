// Rate limiting is applied per-route using governor.
// This module re-exports helpers used in route setup.
// Full per-route rate limiting is added via axum-governor or
// tower middleware layers on the sensitive subrouters.

/// Auth route rate limit: 10 req/min per IP
pub const AUTH_RATE_PER_MINUTE: u32 = 10;

/// General API rate limit: 120 req/min per IP
pub const API_RATE_PER_MINUTE: u32 = 120;
