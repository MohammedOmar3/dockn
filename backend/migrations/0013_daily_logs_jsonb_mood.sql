-- Change daily_logs.content from TEXT to JSONB so TipTap JSON can be stored natively
ALTER TABLE daily_logs
    ALTER COLUMN content TYPE JSONB USING
        CASE
            WHEN content = '' OR content IS NULL THEN '{}'::jsonb
            ELSE content::jsonb
        END;

ALTER TABLE daily_logs
    ALTER COLUMN content SET DEFAULT '{}'::jsonb;

-- Add mood score (1–5 scale) for the emoji mood tracker on the Logs page
ALTER TABLE daily_logs
    ADD COLUMN IF NOT EXISTS mood_score SMALLINT
    CHECK (mood_score >= 1 AND mood_score <= 5);
