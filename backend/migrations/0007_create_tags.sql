CREATE TABLE tags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT '#6366f1',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, name)
);

CREATE TABLE note_tags (
    note_id     UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id      UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);

CREATE TABLE task_tags (
    task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    tag_id      UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, tag_id)
);

CREATE INDEX idx_tags_user_id ON tags (user_id);
CREATE INDEX idx_note_tags_note_id ON note_tags (note_id);
CREATE INDEX idx_note_tags_tag_id ON note_tags (tag_id);
CREATE INDEX idx_task_tags_task_id ON task_tags (task_id);
CREATE INDEX idx_task_tags_tag_id ON task_tags (tag_id);
