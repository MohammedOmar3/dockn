CREATE TABLE daily_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    log_date    DATE NOT NULL,
    content     TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, log_date)
);

CREATE INDEX idx_daily_logs_user_id ON daily_logs (user_id);
CREATE INDEX idx_daily_logs_date ON daily_logs (user_id, log_date DESC);
