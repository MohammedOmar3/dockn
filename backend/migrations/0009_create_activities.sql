CREATE TABLE activities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type   TEXT NOT NULL,
    entity_id       UUID,
    entity_type     TEXT NOT NULL,
    description     TEXT NOT NULL,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activities_user_id ON activities (user_id, timestamp DESC);
CREATE INDEX idx_activities_date ON activities (user_id, (timestamp::DATE), timestamp DESC);
