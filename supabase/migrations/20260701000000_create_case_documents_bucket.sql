-- Create case-documents storage bucket
-- This bucket stores case-specific documents with user-level access control
-- Path structure: <user_id>/<case_id>/<filename>

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

-- Enable RLS on storage.objects for case-documents bucket
-- (Policies are already defined in earlier migrations)
