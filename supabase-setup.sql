-- ================================================
-- DAGUPAN ID SYSTEM — SUPABASE SETUP SCRIPT
-- Run this in your Supabase SQL Editor
-- ================================================

-- 1. EMPLOYEES TABLE
CREATE TABLE IF NOT EXISTS public.employees (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id     text UNIQUE,
  last_name       text NOT NULL,
  first_name      text NOT NULL,
  middle_name     text,
  middle_initial  text,
  position        text,
  department      text,
  photo_url       text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 2. INDEX for fast search
CREATE INDEX IF NOT EXISTS employees_last_name_idx ON public.employees (last_name);
CREATE INDEX IF NOT EXISTS employees_first_name_idx ON public.employees (first_name);
CREATE INDEX IF NOT EXISTS employees_department_idx ON public.employees (department);

-- 3. AUTO-UPDATE updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS employees_updated_at ON public.employees;
CREATE TRIGGER employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access
CREATE POLICY "Authenticated users can read employees"
  ON public.employees FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert employees"
  ON public.employees FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update employees"
  ON public.employees FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete employees"
  ON public.employees FOR DELETE
  TO authenticated USING (true);

-- ================================================
-- STORAGE SETUP
-- Run these commands in Supabase Dashboard > Storage
-- (or via the API)
-- ================================================

-- Create a public bucket called 'employee-photos'
-- Settings: Public bucket = ON (so photo URLs work in ID cards)
--
-- In Supabase Dashboard:
-- 1. Go to Storage
-- 2. Create new bucket: employee-photos
-- 3. Set to PUBLIC
-- 4. Add storage policy: Allow authenticated uploads

-- Storage policy for uploads (run in SQL editor):
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-photos', 'employee-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'employee-photos');

CREATE POLICY "Public read for employee photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'employee-photos');

CREATE POLICY "Authenticated users can update photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'employee-photos');

CREATE POLICY "Authenticated users can delete photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'employee-photos');
