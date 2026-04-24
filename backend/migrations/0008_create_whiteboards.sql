CREATE TABLE whiteboard_folders (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE whiteboards (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id   UUID REFERENCES whiteboard_folders(id) ON DELETE SET NULL,
    title       TEXT NOT NULL DEFAULT 'Untitled Whiteboard',
    raw_data    JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_whiteboard_folders_user_id ON whiteboard_folders (user_id);
CREATE INDEX idx_whiteboards_user_id ON whiteboards (user_id);
CREATE INDEX idx_whiteboards_folder_id ON whiteboards (folder_id);
