-- Buckets privados para documentos médicos.
-- Aplicar no projeto Supabase de produção. Não tornar público.

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('pdf-templates', 'pdf-templates', false),
  ('generated-documents', 'generated-documents', false),
  ('signatures', 'signatures', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY templates_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'pdf-templates'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
  );

CREATE POLICY templates_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pdf-templates'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
    AND public.current_role() = 'admin'
  );

CREATE POLICY generated_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'generated-documents'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
  );

CREATE POLICY generated_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'generated-documents'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
  );

CREATE POLICY signatures_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'signatures'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
  );

CREATE POLICY signatures_write ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'signatures'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
  )
  WITH CHECK (
    bucket_id = 'signatures'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
  );
