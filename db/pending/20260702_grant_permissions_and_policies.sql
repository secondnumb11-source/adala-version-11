-- =============================================================================
-- ADALA UPDATE: Grant permissions for new tables
-- =============================================================================

-- Grant permissions for all tables in public schema
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;

-- Grant permissions for sequences
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant permissions for functions
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- =============================================================================
-- Enable RLS on new tables (if not already enabled)
-- =============================================================================

ALTER TABLE IF EXISTS public.case_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.case_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.case_sessions_detail ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.case_judgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lawsuit_requests ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Create RLS policies for case_details
-- =============================================================================

DROP POLICY IF EXISTS "Users can view their own case details" ON public.case_details;
CREATE POLICY "Users can view their own case details"
  ON public.case_details
  FOR SELECT
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can insert their own case details" ON public.case_details;
CREATE POLICY "Users can insert their own case details"
  ON public.case_details
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update their own case details" ON public.case_details;
CREATE POLICY "Users can update their own case details"
  ON public.case_details
  FOR UPDATE
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete their own case details" ON public.case_details;
CREATE POLICY "Users can delete their own case details"
  ON public.case_details
  FOR DELETE
  USING (auth.uid() = owner_id);

-- =============================================================================
-- Create RLS policies for case_parties
-- =============================================================================

DROP POLICY IF EXISTS "Users can view their own case parties" ON public.case_parties;
CREATE POLICY "Users can view their own case parties"
  ON public.case_parties
  FOR SELECT
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can insert their own case parties" ON public.case_parties;
CREATE POLICY "Users can insert their own case parties"
  ON public.case_parties
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update their own case parties" ON public.case_parties;
CREATE POLICY "Users can update their own case parties"
  ON public.case_parties
  FOR UPDATE
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete their own case parties" ON public.case_parties;
CREATE POLICY "Users can delete their own case parties"
  ON public.case_parties
  FOR DELETE
  USING (auth.uid() = owner_id);

-- =============================================================================
-- Create RLS policies for case_sessions_detail
-- =============================================================================

DROP POLICY IF EXISTS "Users can view their own case sessions" ON public.case_sessions_detail;
CREATE POLICY "Users can view their own case sessions"
  ON public.case_sessions_detail
  FOR SELECT
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can insert their own case sessions" ON public.case_sessions_detail;
CREATE POLICY "Users can insert their own case sessions"
  ON public.case_sessions_detail
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update their own case sessions" ON public.case_sessions_detail;
CREATE POLICY "Users can update their own case sessions"
  ON public.case_sessions_detail
  FOR UPDATE
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete their own case sessions" ON public.case_sessions_detail;
CREATE POLICY "Users can delete their own case sessions"
  ON public.case_sessions_detail
  FOR DELETE
  USING (auth.uid() = owner_id);

-- =============================================================================
-- Create RLS policies for case_judgments
-- =============================================================================

DROP POLICY IF EXISTS "Users can view their own case judgments" ON public.case_judgments;
CREATE POLICY "Users can view their own case judgments"
  ON public.case_judgments
  FOR SELECT
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can insert their own case judgments" ON public.case_judgments;
CREATE POLICY "Users can insert their own case judgments"
  ON public.case_judgments
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update their own case judgments" ON public.case_judgments;
CREATE POLICY "Users can update their own case judgments"
  ON public.case_judgments
  FOR UPDATE
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete their own case judgments" ON public.case_judgments;
CREATE POLICY "Users can delete their own case judgments"
  ON public.case_judgments
  FOR DELETE
  USING (auth.uid() = owner_id);

-- =============================================================================
-- Create RLS policies for lawsuit_requests
-- =============================================================================

DROP POLICY IF EXISTS "Users can view their own lawsuit requests" ON public.lawsuit_requests;
CREATE POLICY "Users can view their own lawsuit requests"
  ON public.lawsuit_requests
  FOR SELECT
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can insert their own lawsuit requests" ON public.lawsuit_requests;
CREATE POLICY "Users can insert their own lawsuit requests"
  ON public.lawsuit_requests
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update their own lawsuit requests" ON public.lawsuit_requests;
CREATE POLICY "Users can update their own lawsuit requests"
  ON public.lawsuit_requests
  FOR UPDATE
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete their own lawsuit requests" ON public.lawsuit_requests;
CREATE POLICY "Users can delete their own lawsuit requests"
  ON public.lawsuit_requests
  FOR DELETE
  USING (auth.uid() = owner_id);

-- =============================================================================
-- Create indexes for performance (if not already exist)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_case_details_case_id ON public.case_details(case_id);
CREATE INDEX IF NOT EXISTS idx_case_details_case_number ON public.case_details(case_number);
CREATE INDEX IF NOT EXISTS idx_case_details_owner_id ON public.case_details(owner_id);

CREATE INDEX IF NOT EXISTS idx_case_parties_case_id ON public.case_parties(case_id);
CREATE INDEX IF NOT EXISTS idx_case_parties_case_number ON public.case_parties(case_number);
CREATE INDEX IF NOT EXISTS idx_case_parties_owner_id ON public.case_parties(owner_id);

CREATE INDEX IF NOT EXISTS idx_case_sessions_detail_case_id ON public.case_sessions_detail(case_id);
CREATE INDEX IF NOT EXISTS idx_case_sessions_detail_case_number ON public.case_sessions_detail(case_number);
CREATE INDEX IF NOT EXISTS idx_case_sessions_detail_owner_id ON public.case_sessions_detail(owner_id);

CREATE INDEX IF NOT EXISTS idx_case_judgments_case_id ON public.case_judgments(case_id);
CREATE INDEX IF NOT EXISTS idx_case_judgments_case_number ON public.case_judgments(case_number);
CREATE INDEX IF NOT EXISTS idx_case_judgments_owner_id ON public.case_judgments(owner_id);

CREATE INDEX IF NOT EXISTS idx_lawsuit_requests_case_id ON public.lawsuit_requests(case_id);
CREATE INDEX IF NOT EXISTS idx_lawsuit_requests_case_number ON public.lawsuit_requests(case_number);
CREATE INDEX IF NOT EXISTS idx_lawsuit_requests_owner_id ON public.lawsuit_requests(owner_id);

-- =============================================================================
-- Add updated_at triggers (if not already exist)
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for case_details
DROP TRIGGER IF EXISTS update_case_details_updated_at ON public.case_details;
CREATE TRIGGER update_case_details_updated_at
  BEFORE UPDATE ON public.case_details
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Triggers for case_parties
DROP TRIGGER IF EXISTS update_case_parties_updated_at ON public.case_parties;
CREATE TRIGGER update_case_parties_updated_at
  BEFORE UPDATE ON public.case_parties
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Triggers for case_sessions_detail
DROP TRIGGER IF EXISTS update_case_sessions_detail_updated_at ON public.case_sessions_detail;
CREATE TRIGGER update_case_sessions_detail_updated_at
  BEFORE UPDATE ON public.case_sessions_detail
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Triggers for case_judgments
DROP TRIGGER IF EXISTS update_case_judgments_updated_at ON public.case_judgments;
CREATE TRIGGER update_case_judgments_updated_at
  BEFORE UPDATE ON public.case_judgments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Triggers for lawsuit_requests
DROP TRIGGER IF EXISTS update_lawsuit_requests_updated_at ON public.lawsuit_requests;
CREATE TRIGGER update_lawsuit_requests_updated_at
  BEFORE UPDATE ON public.lawsuit_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Enable realtime for new tables
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS public.case_details;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS public.case_parties;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS public.case_sessions_detail;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS public.case_judgments;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS public.lawsuit_requests;

-- =============================================================================
-- Create storage bucket for judgment documents (if not exists)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('judgment-documents', 'judgment-documents', false, 52428800, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for judgment-documents
DROP POLICY IF EXISTS "Users can view their own judgment documents" ON storage.objects;
CREATE POLICY "Users can view their own judgment documents"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'judgment-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can upload their own judgment documents" ON storage.objects;
CREATE POLICY "Users can upload their own judgment documents"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'judgment-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own judgment documents" ON storage.objects;
CREATE POLICY "Users can delete their own judgment documents"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'judgment-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =============================================================================
-- Done!
-- =============================================================================

SELECT 'All permissions and policies have been granted successfully!' AS result;
