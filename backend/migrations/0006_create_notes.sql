CREATE TABLE notes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notebook_id   UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
    title         TEXT NOT NULL DEFAULT 'Untitled',
    content       JSONB NOT NULL DEFAULT '{}',
    display_order INT NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notes_user_id ON notes (user_id);
CREATE INDEX idx_notes_notebook_id ON notes (notebook_id, display_order);
