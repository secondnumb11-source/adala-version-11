-- =============================================================================
-- ADALA UPDATE: Enhanced Najiz Data Schema
-- New tables for detailed case data, parties, sessions, judgments, lawsuit requests
-- Enhanced powers_of_attorney with full detail fields
-- =============================================================================

-- 1. CASE DETAILS - stores detailed info scraped from Najiz case detail pages
CREATE TABLE IF NOT EXISTS public.case_details (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  case_number TEXT,
  case_classification TEXT,
  case_type_detail TEXT,
  case_date TEXT,
  subject_matter TEXT,
  plaintiff_requests TEXT,
  case_foundations TEXT,
  court_name TEXT,
  circuit_number TEXT,
  registration_date TEXT,
  deed_number TEXT,
  deed_date TEXT,
  is_draft BOOLEAN DEFAULT false,
  najiz_synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. CASE PARTIES - stores parties (plaintiffs & defendants) for each case
CREATE TABLE IF NOT EXISTS public.case_parties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  case_number TEXT,
  party_type TEXT NOT NULL DEFAULT 'plaintiff', -- 'plaintiff' or 'defendant'
  party_name TEXT,
  party_id_number TEXT,
  party_nationality TEXT,
  party_identity_type TEXT,
  party_capacity TEXT,
  party_status_in_case TEXT,
  najiz_synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. CASE SESSIONS DETAIL - stores detailed session info from Najiz
CREATE TABLE IF NOT EXISTS public.case_sessions_detail (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  case_number TEXT,
  session_status TEXT,
  court_name TEXT,
  circuit_number TEXT,
  mechanism TEXT,
  degree TEXT,
  session_date TEXT,
  session_time TEXT,
  session_details TEXT,
  najiz_synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. CASE JUDGMENTS - stores detailed judgment info from Najiz
CREATE TABLE IF NOT EXISTS public.case_judgments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  case_number TEXT,
  judgment_finality TEXT, -- 'نهائي' or 'غير قطعي'
  deed_number TEXT,
  deed_date TEXT,
  court_name TEXT,
  circuit_number TEXT,
  degree TEXT, -- 'الدرجة الأولى' or 'حكم استئناف'
  appeal_deed_date TEXT,
  appeal_circuit_number TEXT,
  judgment_details TEXT,
  judgment_document_url TEXT, -- URL for uploaded deed document
  najiz_synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. LAWSUIT REQUESTS - stores requests on cases from Najiz
CREATE TABLE IF NOT EXISTS public.lawsuit_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  case_number TEXT,
  case_date TEXT,
  court_name TEXT,
  circuit_number TEXT,
  case_status TEXT,
  case_classification TEXT,
  case_type_detail TEXT,
  applicant_type TEXT,
  applicant_name TEXT,
  request_type TEXT, -- 'طلب نقض' or 'طلب استئناف'
  judgment_number TEXT,
  submissions TEXT,
  request_reasons TEXT,
  reason_1 TEXT,
  reason_2 TEXT,
  reason_3 TEXT,
  reason_4 TEXT,
  reason_5 TEXT,
  reason_6 TEXT,
  najiz_id TEXT,
  najiz_synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Add enhanced columns to powers_of_attorney
ALTER TABLE public.powers_of_attorney ADD COLUMN IF NOT EXISTS issuer_entity TEXT;
ALTER TABLE public.powers_of_attorney ADD COLUMN IF NOT EXISTS usage_method TEXT;
ALTER TABLE public.powers_of_attorney ADD COLUMN IF NOT EXISTS issuer_capacity TEXT;
ALTER TABLE public.powers_of_attorney ADD COLUMN IF NOT EXISTS issuer_nationality TEXT;
ALTER TABLE public.powers_of_attorney ADD COLUMN IF NOT EXISTS issuer_identity_type TEXT;
ALTER TABLE public.powers_of_attorney ADD COLUMN IF NOT EXISTS issuer_status_in_agency TEXT;
ALTER TABLE public.powers_of_attorney ADD COLUMN IF NOT EXISTS agent_capacity TEXT;
ALTER TABLE public.powers_of_attorney ADD COLUMN IF NOT EXISTS agent_nationality TEXT;
ALTER TABLE public.powers_of_attorney ADD COLUMN IF NOT EXISTS agent_identity_type TEXT;
ALTER TABLE public.powers_of_attorney ADD COLUMN IF NOT EXISTS agent_status_in_agency TEXT;
ALTER TABLE public.powers_of_attorney ADD COLUMN IF NOT EXISTS agency_clauses TEXT;
ALTER TABLE public.powers_of_attorney ADD COLUMN IF NOT EXISTS agency_text TEXT;
ALTER TABLE public.powers_of_attorney ADD COLUMN IF NOT EXISTS agency_data TEXT;
ALTER TABLE public.powers_of_attorney ADD COLUMN IF NOT EXISTS issuer_data JSONB;
ALTER TABLE public.powers_of_attorney ADD COLUMN IF NOT EXISTS agent_data JSONB;

-- 7. Add enhanced columns to cases table
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS case_classification TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS subject_matter TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS plaintiff_requests TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS case_foundations TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false;

-- 8. Add session detail columns to sessions table
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS mechanism TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS degree TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS session_time TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS circuit_number TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS session_details TEXT;

-- 9. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_case_details_case_id ON public.case_details(case_id);
CREATE INDEX IF NOT EXISTS idx_case_details_case_number ON public.case_details(case_number);
CREATE INDEX IF NOT EXISTS idx_case_parties_case_id ON public.case_parties(case_id);
CREATE INDEX IF NOT EXISTS idx_case_parties_case_number ON public.case_parties(case_number);
CREATE INDEX IF NOT EXISTS idx_case_sessions_detail_case_id ON public.case_sessions_detail(case_id);
CREATE INDEX IF NOT EXISTS idx_case_sessions_detail_case_number ON public.case_sessions_detail(case_number);
CREATE INDEX IF NOT EXISTS idx_case_judgments_case_id ON public.case_judgments(case_id);
CREATE INDEX IF NOT EXISTS idx_case_judgments_case_number ON public.case_judgments(case_number);
CREATE INDEX IF NOT EXISTS idx_lawsuit_requests_case_id ON public.lawsuit_requests(case_id);
CREATE INDEX IF NOT EXISTS idx_lawsuit_requests_case_number ON public.lawsuit_requests(case_number);
CREATE INDEX IF NOT EXISTS idx_lawsuit_requests_owner ON public.lawsuit_requests(owner_id);

-- 10. RLS - Enable on all new tables
ALTER TABLE public.case_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_sessions_detail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_judgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lawsuit_requests ENABLE ROW LEVEL SECURITY;

-- 11. RLS Policies for case_details
DROP POLICY IF EXISTS "case_details_select_own" ON public.case_details;
DROP POLICY IF EXISTS "case_details_insert_own" ON public.case_details;
DROP POLICY IF EXISTS "case_details_update_own" ON public.case_details;
DROP POLICY IF EXISTS "case_details_delete_own" ON public.case_details;

CREATE POLICY "case_details_select_own" ON public.case_details
  FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "case_details_insert_own" ON public.case_details
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "case_details_update_own" ON public.case_details
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "case_details_delete_own" ON public.case_details
  FOR DELETE USING (auth.uid() = owner_id);

-- 12. RLS Policies for case_parties
DROP POLICY IF EXISTS "case_parties_select_own" ON public.case_parties;
DROP POLICY IF EXISTS "case_parties_insert_own" ON public.case_parties;
DROP POLICY IF EXISTS "case_parties_update_own" ON public.case_parties;
DROP POLICY IF EXISTS "case_parties_delete_own" ON public.case_parties;

CREATE POLICY "case_parties_select_own" ON public.case_parties
  FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "case_parties_insert_own" ON public.case_parties
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "case_parties_update_own" ON public.case_parties
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "case_parties_delete_own" ON public.case_parties
  FOR DELETE USING (auth.uid() = owner_id);

-- 13. RLS Policies for case_sessions_detail
DROP POLICY IF EXISTS "case_sessions_detail_select_own" ON public.case_sessions_detail;
DROP POLICY IF EXISTS "case_sessions_detail_insert_own" ON public.case_sessions_detail;
DROP POLICY IF EXISTS "case_sessions_detail_update_own" ON public.case_sessions_detail;
DROP POLICY IF EXISTS "case_sessions_detail_delete_own" ON public.case_sessions_detail;

CREATE POLICY "case_sessions_detail_select_own" ON public.case_sessions_detail
  FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "case_sessions_detail_insert_own" ON public.case_sessions_detail
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "case_sessions_detail_update_own" ON public.case_sessions_detail
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "case_sessions_detail_delete_own" ON public.case_sessions_detail
  FOR DELETE USING (auth.uid() = owner_id);

-- 14. RLS Policies for case_judgments
DROP POLICY IF EXISTS "case_judgments_select_own" ON public.case_judgments;
DROP POLICY IF EXISTS "case_judgments_insert_own" ON public.case_judgments;
DROP POLICY IF EXISTS "case_judgments_update_own" ON public.case_judgments;
DROP POLICY IF EXISTS "case_judgments_delete_own" ON public.case_judgments;

CREATE POLICY "case_judgments_select_own" ON public.case_judgments
  FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "case_judgments_insert_own" ON public.case_judgments
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "case_judgments_update_own" ON public.case_judgments
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "case_judgments_delete_own" ON public.case_judgments
  FOR DELETE USING (auth.uid() = owner_id);

-- 15. RLS Policies for lawsuit_requests
DROP POLICY IF EXISTS "lawsuit_requests_select_own" ON public.lawsuit_requests;
DROP POLICY IF EXISTS "lawsuit_requests_insert_own" ON public.lawsuit_requests;
DROP POLICY IF EXISTS "lawsuit_requests_update_own" ON public.lawsuit_requests;
DROP POLICY IF EXISTS "lawsuit_requests_delete_own" ON public.lawsuit_requests;

CREATE POLICY "lawsuit_requests_select_own" ON public.lawsuit_requests
  FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "lawsuit_requests_insert_own" ON public.lawsuit_requests
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "lawsuit_requests_update_own" ON public.lawsuit_requests
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "lawsuit_requests_delete_own" ON public.lawsuit_requests
  FOR DELETE USING (auth.uid() = owner_id);

-- 16. Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.case_details;
ALTER PUBLICATION supabase_realtime ADD TABLE public.case_parties;
ALTER PUBLICATION supabase_realtime ADD TABLE public.case_sessions_detail;
ALTER PUBLICATION supabase_realtime ADD TABLE public.case_judgments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lawsuit_requests;

-- 17. Updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_case_details_updated ON public.case_details;
CREATE TRIGGER trg_case_details_updated BEFORE UPDATE ON public.case_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_case_parties_updated ON public.case_parties;
CREATE TRIGGER trg_case_parties_updated BEFORE UPDATE ON public.case_parties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_case_sessions_detail_updated ON public.case_sessions_detail;
CREATE TRIGGER trg_case_sessions_detail_updated BEFORE UPDATE ON public.case_sessions_detail
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_case_judgments_updated ON public.case_judgments;
CREATE TRIGGER trg_case_judgments_updated BEFORE UPDATE ON public.case_judgments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_lawsuit_requests_updated ON public.lawsuit_requests;
CREATE TRIGGER trg_lawsuit_requests_updated BEFORE UPDATE ON public.lawsuit_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 18. Storage bucket for judgment documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'judgment-documents',
  'judgment-documents',
  false,
  52428800,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Storage RLS for judgment-documents
DROP POLICY IF EXISTS "judgment_docs_select_own" ON storage.objects;
DROP POLICY IF EXISTS "judgment_docs_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "judgment_docs_update_own" ON storage.objects;
DROP POLICY IF EXISTS "judgment_docs_delete_own" ON storage.objects;

CREATE POLICY "judgment_docs_select_own" ON storage.objects
  FOR SELECT USING (bucket_id = 'judgment-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "judgment_docs_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'judgment-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "judgment_docs_update_own" ON storage.objects
  FOR UPDATE USING (bucket_id = 'judgment-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "judgment_docs_delete_own" ON storage.objects
  FOR DELETE USING (bucket_id = 'judgment-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

