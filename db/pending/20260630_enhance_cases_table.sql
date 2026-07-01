-- =============================================================
-- Migration: Enhance cases table for full case management
-- Date: 2026-06-30
-- Purpose: 
--   1. Add new columns: plaintiff_name, defendant_name, 
--      judgment_number, judgment_date, deed_number, transferred_to
--   2. Add 'postponed' and 'closed' to case_status enum
--   3. Add index on transferred_to for efficient filtering
-- =============================================================

-- 1. Add 'postponed' (مؤجلة) and 'closed' (منتهية) to case_status enum
ALTER TYPE case_status ADD VALUE IF NOT EXISTS 'postponed';
ALTER TYPE case_status ADD VALUE IF NOT EXISTS 'closed';

-- 2. Add party name columns
ALTER TABLE cases ADD COLUMN IF NOT EXISTS plaintiff_name TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS defendant_name TEXT;

-- 3. Add judgment-related columns
ALTER TABLE cases ADD COLUMN IF NOT EXISTS judgment_number TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS judgment_date TIMESTAMPTZ;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS deed_number TEXT;

-- 4. Appeal deadline (if not already added by prior migration)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS appeal_deadline TIMESTAMPTZ;

-- 5. Section transfer tracking
-- Values: null (not transferred), 'executions', 'powers_of_attorney', 'documents_archive'
ALTER TABLE cases ADD COLUMN IF NOT EXISTS transferred_to TEXT;

-- 6. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_cases_transferred_to ON cases(transferred_to) WHERE transferred_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_sessions_case_id ON sessions(case_id);

-- 7. Add comments for documentation
COMMENT ON COLUMN cases.plaintiff_name IS 'اسم المدعي';
COMMENT ON COLUMN cases.defendant_name IS 'اسم المدعى عليه';
COMMENT ON COLUMN cases.judgment_number IS 'رقم الحكم';
COMMENT ON COLUMN cases.judgment_date IS 'تاريخ الحكم';
COMMENT ON COLUMN cases.deed_number IS 'رقم صك الحكم';
COMMENT ON COLUMN cases.transferred_to IS 'القسم المنقولة إليه القضية: executions / powers_of_attorney / documents_archive';
