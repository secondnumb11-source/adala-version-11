-- =============================================================
-- Migration: Add case enhancement columns
-- Date: 2026-06-30
-- Purpose: Add plaintiff/defendant names, judgment fields, deed number,
--          appeal deadline, and transferred_to for section transfer
-- =============================================================

-- Add party name columns
ALTER TABLE cases ADD COLUMN IF NOT EXISTS plaintiff_name TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS defendant_name TEXT;

-- Add judgment-related columns
ALTER TABLE cases ADD COLUMN IF NOT EXISTS judgment_number TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS judgment_date TIMESTAMPTZ;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS deed_number TEXT;

-- Appeal deadline (if not already added by prior migration)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS appeal_deadline TIMESTAMPTZ;

-- Section transfer tracking
-- Values: null (not transferred), 'executions', 'powers_of_attorney', 'documents_archive'
ALTER TABLE cases ADD COLUMN IF NOT EXISTS transferred_to TEXT;

-- Add check constraint for transferred_to
ALTER TABLE cases ADD CONSTRAINT cases_transferred_to_check
  CHECK (transferred_to IS NULL OR transferred_to IN ('executions', 'powers_of_attorney', 'documents_archive'));

-- Add comment
COMMENT ON COLUMN cases.transferred_to IS 'Tracks which section a case has been transferred to: executions, powers_of_attorney, or documents_archive';
COMMENT ON COLUMN cases.plaintiff_name IS 'اسم المدعي';
COMMENT ON COLUMN cases.defendant_name IS 'اسم المدعى عليه';
COMMENT ON COLUMN cases.judgment_number IS 'رقم الحكم/الصك';
COMMENT ON COLUMN cases.judgment_date IS 'تاريخ الحكم';
COMMENT ON COLUMN cases.deed_number IS 'رقم صك الحكم';

-- Ensure sessions have case_number reference for display
-- The case_id FK already provides the link; this comment documents the requirement
COMMENT ON COLUMN sessions.case_id IS 'FK to cases.id — links session to case for case_number display';
