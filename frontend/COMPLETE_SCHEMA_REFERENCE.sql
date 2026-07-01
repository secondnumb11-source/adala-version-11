-- =============================================================================
-- COMPLETE DATABASE SCHEMA REFERENCE
-- Generated from live Supabase database: sofurxihjwgmbosyzeib
-- Date: 2026-07-01
-- =============================================================================
-- This file documents ALL schema elements in the live database for reference.
-- Execute these in order to recreate the complete database state.
-- =============================================================================

-- =============================================================================
-- PART 1: TABLES (30 tables)
-- =============================================================================

-- 1. audit_log
-- 2. audit_logs
-- 3. cases
-- 4. client_inquiries
-- 5. client_notifications
-- 6. client_portal_credentials
-- 7. clients
-- 8. document_permissions
-- 9. documents
-- 10. employee_messages
-- 11. employee_portal_credentials
-- 12. employees
-- 13. executions
-- 14. najiz_sync_logs
-- 15. notification_preferences
-- 16. notifications
-- 17. office_settings
-- 18. portal_messages
-- 19. powers_of_attorney
-- 20. profiles
-- 21. saved_filters
-- 22. secure_secrets
-- 23. session_reminders
-- 24. sessions
-- 25. sync_tokens
-- 26. task_reminders
-- 27. tasks
-- 28. user_preferences
-- 29. user_roles
-- 30. welcome_template_audit

-- =============================================================================
-- PART 2: ENUM TYPES
-- =============================================================================

DO $idem$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'lawyer', 'employee', 'client');
EXCEPTION WHEN duplicate_object THEN NULL;
END $idem$;

DO $idem$ BEGIN
  CREATE TYPE public.case_status AS ENUM ('open', 'in_study', 'closed_final', 'closed_non_final', 'appealed', 'archived', 'postponed', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $idem$;

DO $idem$ BEGIN
  CREATE TYPE public.case_type AS ENUM ('labor', 'commercial', 'execution', 'civil', 'personal_status', 'administrative', 'criminal', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $idem$;

DO $idem$ BEGIN
  CREATE TYPE public.session_status AS ENUM ('scheduled', 'held', 'postponed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $idem$;

DO $idem$ BEGIN
  CREATE TYPE public.document_type AS ENUM ('lawsuit', 'judgment_final', 'judgment_non_final', 'appeal_judgment', 'memorandum_reply', 'session_minutes', 'power_of_attorney', 'evidence', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $idem$;

DO $idem$ BEGIN
  CREATE TYPE public.wakalah_status AS ENUM ('active', 'expired', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $idem$;

DO $idem$ BEGIN
  CREATE TYPE public.execution_status AS ENUM ('pending', 'in_progress', 'completed', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $idem$;

DO $idem$ BEGIN
  CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'done', 'overdue');
EXCEPTION WHEN duplicate_object THEN NULL;
END $idem$;

DO $idem$ BEGIN
  CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $idem$;

DO $idem$ BEGIN
  CREATE TYPE public.notification_status AS ENUM ('draft', 'scheduled', 'sent', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $idem$;

DO $idem$ BEGIN
  CREATE TYPE public.notification_channel AS ENUM ('whatsapp', 'sms', 'email');
EXCEPTION WHEN duplicate_object THEN NULL;
END $idem$;

-- =============================================================================
-- PART 3: STORAGE BUCKETS (2 buckets)
-- =============================================================================

-- Bucket 1: documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800, -- 50 MB
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Bucket 2: case-documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'case-documents',
  'case-documents',
  false,
  52428800, -- 50 MB
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- PART 4: CRON JOBS (4 jobs)
-- =============================================================================

-- Job 1: enqueue-session-reminders (every 15 minutes)
SELECT cron.schedule(
  'enqueue-session-reminders',
  '*/15 * * * *',
  $$ SELECT public.enqueue_session_reminders(); $$
);

-- Job 2: lex_readiness_check (every 15 minutes)
SELECT cron.schedule(
  'lex_readiness_check',
  '*/15 * * * *',
  $$ SELECT net.http_get(
    url := current_setting('app.settings.base_url', true) || '/api/public/system-check',
    headers := '{"Content-Type": "application/json"}'::jsonb
  ); $$
);

-- Job 3: lex_session_reminders (every 10 minutes)
SELECT cron.schedule(
  'lex_session_reminders',
  '*/10 * * * *',
  $$ SELECT net.http_post(
    url := current_setting('app.settings.base_url', true) || '/api/public/cron/session-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ); $$
);

-- Job 4: task-reminders (every 15 minutes)
SELECT cron.schedule(
  'task-reminders',
  '*/15 * * * *',
  $$ SELECT public.enqueue_task_reminders(); $$
);

-- =============================================================================
-- PART 5: FUNCTIONS (28 functions)
-- =============================================================================

-- Public schema functions (24):
-- 1. can_access_case_doc_object
-- 2. can_access_case_doc_path
-- 3. employee_can_access_case
-- 4. employee_can_access_client
-- 5. enqueue_session_reminders
-- 6. enqueue_task_reminders
-- 7. get_cron_jobs_status
-- 8. get_employee_portal_code
-- 9. get_employees_directory
-- 10. handle_new_user
-- 11. has_doc_permission
-- 12. has_role
-- 13. is_office_member
-- 14. link_current_user_to_portal
-- 15. log_welcome_template_change
-- 16. preserve_read_at
-- 17. set_appeal_deadline
-- 18. sync_client_notification_message
-- 19. sync_document_type_columns
-- 20. system_check_inspect
-- 21. tasks_employee_update_guard
-- 22. update_updated_at_column

-- Private schema functions (4):
-- 1. private.employee_can_access_case
-- 2. private.employee_can_access_client
-- 3. private.has_doc_permission
-- 4. private.has_role

-- =============================================================================
-- PART 6: RLS POLICIES (137 policies across 30 tables)
-- =============================================================================

-- Policy counts per table:
-- audit_log: 4 policies
-- audit_logs: 2 policies
-- cases: 3 policies
-- client_inquiries: 12 policies
-- client_notifications: 5 policies
-- client_portal_credentials: 1 policy
-- clients: 4 policies
-- document_permissions: 6 policies
-- documents: 3 policies
-- employee_messages: 13 policies
-- employee_portal_credentials: 1 policy
-- employees: 2 policies
-- executions: 3 policies
-- najiz_sync_logs: 6 policies
-- notification_preferences: 4 policies
-- notifications: 1 policy
-- office_settings: 4 policies
-- portal_messages: 10 policies
-- powers_of_attorney: 4 policies
-- profiles: 3 policies
-- saved_filters: 2 policies
-- secure_secrets: 3 policies
-- session_reminders: 4 policies
-- sessions: 4 policies
-- sync_tokens: 4 policies
-- task_reminders: 3 policies
-- tasks: 4 policies
-- user_preferences: 3 policies
-- user_roles: 2 policies
-- welcome_template_audit: 4 policies

-- Storage.objects policies (for case-documents bucket):
-- case_documents_select_own
-- case_documents_insert_own
-- case_documents_update_own
-- case_documents_delete_own
-- case_documents_select_authorized
-- documents_select_own
-- documents_insert_own
-- documents_update_own
-- documents_delete_own
-- owner manages own docs
-- client reads own case docs

-- =============================================================================
-- PART 7: TRIGGERS (47 triggers)
-- =============================================================================

-- Auth triggers (1):
-- auth.users.on_auth_user_created

-- Table triggers (46):
-- cases.trg_cases_upd
-- cases.trg_cases_updated
-- client_inquiries.trg_inq_preserve_read_at
-- client_notifications.trg_client_notif_upd
-- client_notifications.trg_client_notifications_sync_message
-- client_notifications.trg_client_notifications_updated
-- client_notifications.trg_notifs_updated
-- client_portal_credentials.trg_cpc_updated
-- clients.trg_clients_upd
-- clients.trg_clients_updated
-- documents.trg_documents_appeal
-- documents.trg_documents_sync_type
-- documents.trg_documents_upd
-- documents.trg_documents_updated
-- employee_messages.trg_empmsg_preserve_read_at
-- employee_messages.trg_preserve_read_at
-- employee_portal_credentials.trg_epc_updated
-- employees.trg_employees_updated
-- executions.trg_executions_upd
-- executions.trg_executions_updated
-- notification_preferences.trg_notif_prefs_updated
-- notification_preferences.trg_notification_preferences_updated
-- notification_preferences.trg_np_updated
-- office_settings.trg_log_welcome_template
-- office_settings.trg_office_settings_updated
-- powers_of_attorney.trg_poa_upd
-- powers_of_attorney.trg_powers_updated
-- profiles.trg_profiles_updated
-- saved_filters.trg_saved_filters_updated
-- saved_filters.trg_sf_updated
-- secure_secrets.trg_secsec_updated
-- secure_secrets.trg_secure_secrets_updated
-- sessions.trg_sessions_upd
-- sessions.trg_sessions_updated
-- tasks.tasks_employee_update_guard
-- tasks.trg_tasks_upd
-- tasks.trg_tasks_updated
-- user_preferences.trg_user_preferences_updated
-- user_preferences.trg_user_prefs_updated

-- Storage triggers (3):
-- storage.buckets.enforce_bucket_name_length_trigger
-- storage.buckets.protect_buckets_delete
-- storage.objects.protect_objects_delete
-- storage.objects.update_objects_updated_at

-- =============================================================================
-- PART 8: REALTIME PUBLICATION (9 tables)
-- =============================================================================

-- Tables enabled for realtime:
-- cases
-- client_inquiries
-- client_notifications
-- documents
-- employee_messages
-- notifications
-- portal_messages
-- sessions
-- tasks

-- =============================================================================
-- END OF SCHEMA REFERENCE
-- =============================================================================
