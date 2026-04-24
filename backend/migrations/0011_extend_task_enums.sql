-- Extend task_status to include 'cancelled'
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'cancelled';

-- Extend task_priority to include 'urgent'
ALTER TYPE task_priority ADD VALUE IF NOT EXISTS 'urgent';
