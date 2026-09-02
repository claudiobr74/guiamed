-- GuiaMed initial schema
-- Reproduzível no Supabase (produção) e no PGlite (desenvolvimento local).
-- Não aplica dados clínicos inventados. Códigos TUSS/IPASGO entram só via importação.

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnpj text,
  phone text,
  email text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'doctor')),
  full_name text NOT NULL,
  email text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

CREATE TABLE public.local_credentials (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.health_insurers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('hospital', 'clinic', 'operator', 'insurer')),
  name text NOT NULL,
  cnpj text,
  city text,
  state text,
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  birth_date date,
  cpf text,
  sex text CHECK (sex IN ('F', 'M', 'I') OR sex IS NULL),
  phone text,
  email text,
  insurance_card text,
  health_insurer_id uuid REFERENCES public.health_insurers(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX patients_org_cpf_unique
  ON public.patients (organization_id, cpf)
  WHERE cpf IS NOT NULL AND btrim(cpf) <> '';

CREATE TABLE public.doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  crm text NOT NULL,
  crm_state text NOT NULL,
  cpf text,
  specialty text,
  rqe text,
  phone text,
  email text,
  signature_file text,
  signature_kind text NOT NULL DEFAULT 'image' CHECK (signature_kind IN ('image', 'icp_brasil_placeholder')),
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, crm, crm_state)
);

CREATE TABLE public.procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  specialty text,
  category text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.procedure_synonyms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  synonym text NOT NULL
);

CREATE TABLE public.code_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code_system text NOT NULL,
  source_filename text,
  source_format text NOT NULL CHECK (source_format IN ('csv', 'xlsx', 'json')),
  version text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  row_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0
);

CREATE TABLE public.procedure_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  procedure_id uuid REFERENCES public.procedures(id) ON DELETE SET NULL,
  code_system text NOT NULL,
  code text NOT NULL,
  description text NOT NULL,
  valid_from date,
  valid_until date,
  version text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  import_batch_id uuid REFERENCES public.code_import_batches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code_system, code, version)
);

CREATE TABLE public.cid_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  code text NOT NULL,
  description text NOT NULL,
  version text NOT NULL DEFAULT 'CID-10',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code, version)
);

CREATE TABLE public.procedure_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  specialty text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.procedure_kit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id uuid NOT NULL REFERENCES public.procedure_kits(id) ON DELETE CASCADE,
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  default_quantity integer NOT NULL DEFAULT 1 CHECK (default_quantity > 0),
  default_code_id uuid REFERENCES public.procedure_codes(id) ON DELETE SET NULL,
  notes text,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE public.document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL,
  health_insurer_id uuid REFERENCES public.health_insurers(id) ON DELETE SET NULL,
  document_type text NOT NULL DEFAULT 'surgical_request',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pdf_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.document_templates(id) ON DELETE CASCADE,
  version integer NOT NULL,
  file_path text NOT NULL,
  file_hash text NOT NULL,
  page_count integer NOT NULL DEFAULT 0,
  page_width numeric,
  page_height numeric,
  has_acroform boolean NOT NULL DEFAULT false,
  acroform_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (template_id, version)
);

CREATE TABLE public.pdf_field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_version_id uuid NOT NULL REFERENCES public.pdf_template_versions(id) ON DELETE CASCADE,
  semantic_field text NOT NULL,
  pdf_field_name text,
  mapping_kind text NOT NULL DEFAULT 'overlay' CHECK (mapping_kind IN ('overlay', 'acroform')),
  page integer NOT NULL DEFAULT 1 CHECK (page >= 1),
  x numeric NOT NULL DEFAULT 0,
  y numeric NOT NULL DEFAULT 0,
  width numeric NOT NULL DEFAULT 100,
  height numeric NOT NULL DEFAULT 16,
  font_size numeric NOT NULL DEFAULT 10,
  alignment text NOT NULL DEFAULT 'left' CHECK (alignment IN ('left', 'center', 'right')),
  multiline boolean NOT NULL DEFAULT false,
  auto_shrink boolean NOT NULL DEFAULT true,
  max_characters integer,
  required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pdf_repeaters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_version_id uuid NOT NULL REFERENCES public.pdf_template_versions(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'procedures',
  page integer NOT NULL DEFAULT 1,
  start_x numeric NOT NULL,
  start_y numeric NOT NULL,
  row_height numeric NOT NULL,
  max_rows integer NOT NULL CHECK (max_rows > 0),
  columns jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.surgical_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE RESTRICT,
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE RESTRICT,
  institution_id uuid REFERENCES public.institutions(id) ON DELETE RESTRICT,
  health_insurer_id uuid REFERENCES public.health_insurers(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.document_templates(id) ON DELETE SET NULL,
  template_version_id uuid REFERENCES public.pdf_template_versions(id) ON DELETE RESTRICT,
  diagnosis text,
  clinical_justification text,
  clinical_notes text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'cancelled')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  duplicated_from_id uuid REFERENCES public.surgical_requests(id) ON DELETE SET NULL
);

CREATE TABLE public.surgical_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.surgical_requests(id) ON DELETE CASCADE,
  procedure_id uuid REFERENCES public.procedures(id) ON DELETE SET NULL,
  procedure_name text NOT NULL,
  tuss_code_id uuid REFERENCES public.procedure_codes(id) ON DELETE SET NULL,
  ipasgo_code_id uuid REFERENCES public.procedure_codes(id) ON DELETE SET NULL,
  tuss_code_snapshot text,
  ipasgo_code_snapshot text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  laterality text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE public.surgical_request_cids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.surgical_requests(id) ON DELETE CASCADE,
  cid_code_id uuid REFERENCES public.cid_codes(id) ON DELETE SET NULL,
  code_snapshot text NOT NULL,
  description_snapshot text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE public.generated_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.surgical_requests(id) ON DELETE CASCADE,
  template_version_id uuid NOT NULL REFERENCES public.pdf_template_versions(id) ON DELETE RESTRICT,
  file_path text NOT NULL,
  file_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_patients_org_name ON public.patients (organization_id, full_name);
CREATE INDEX idx_doctors_org_name ON public.doctors (organization_id, name);
CREATE INDEX idx_procedures_org_name ON public.procedures (organization_id, name);
CREATE INDEX idx_procedure_codes_lookup ON public.procedure_codes (organization_id, code_system, code);
CREATE INDEX idx_cid_code ON public.cid_codes (code);
CREATE INDEX idx_requests_org_status ON public.surgical_requests (organization_id, status, created_at DESC);
CREATE INDEX idx_request_items_request ON public.surgical_request_items (request_id, sort_order);
CREATE INDEX idx_audit_org_created ON public.audit_logs (organization_id, created_at DESC);

CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_patients_updated BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_doctors_updated BEFORE UPDATE ON public.doctors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_institutions_updated BEFORE UPDATE ON public.institutions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_health_insurers_updated BEFORE UPDATE ON public.health_insurers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_procedures_updated BEFORE UPDATE ON public.procedures
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_procedure_codes_updated BEFORE UPDATE ON public.procedure_codes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_kits_updated BEFORE UPDATE ON public.procedure_kits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_templates_updated BEFORE UPDATE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_mappings_updated BEFORE UPDATE ON public.pdf_field_mappings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_repeaters_updated BEFORE UPDATE ON public.pdf_repeaters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_requests_updated BEFORE UPDATE ON public.surgical_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.local_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_insurers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedure_synonyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedure_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cid_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedure_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedure_kit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_repeaters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgical_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgical_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgical_request_cids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_org_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.org_id', true), '')::uuid,
    (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.current_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT p.role FROM public.profiles p WHERE p.id = auth.uid();
$$;

CREATE POLICY org_select ON public.organizations
  FOR SELECT USING (id = public.current_org_id());
CREATE POLICY org_update ON public.organizations
  FOR UPDATE USING (id = public.current_org_id() AND public.current_role() = 'admin');

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT USING (organization_id = public.current_org_id());
CREATE POLICY profiles_write ON public.profiles
  FOR ALL USING (organization_id = public.current_org_id() AND public.current_role() = 'admin')
  WITH CHECK (organization_id = public.current_org_id() AND public.current_role() = 'admin');

CREATE POLICY creds_self ON public.local_credentials
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY insurers_all ON public.health_insurers
  FOR ALL USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY institutions_all ON public.institutions
  FOR ALL USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY patients_all ON public.patients
  FOR ALL USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY doctors_all ON public.doctors
  FOR ALL USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY procedures_all ON public.procedures
  FOR ALL USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY synonyms_all ON public.procedure_synonyms
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.procedures p
      WHERE p.id = procedure_id AND p.organization_id = public.current_org_id()
    )
  );
CREATE POLICY imports_all ON public.code_import_batches
  FOR ALL USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY codes_all ON public.procedure_codes
  FOR ALL USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY cid_select ON public.cid_codes
  FOR SELECT USING (organization_id IS NULL OR organization_id = public.current_org_id());
CREATE POLICY cid_write ON public.cid_codes
  FOR ALL USING (organization_id = public.current_org_id() AND public.current_role() = 'admin')
  WITH CHECK (organization_id = public.current_org_id() AND public.current_role() = 'admin');
CREATE POLICY kits_all ON public.procedure_kits
  FOR ALL USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY kit_items_all ON public.procedure_kit_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.procedure_kits k
      WHERE k.id = kit_id AND k.organization_id = public.current_org_id()
    )
  );
CREATE POLICY templates_all ON public.document_templates
  FOR ALL USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY versions_all ON public.pdf_template_versions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.document_templates t
      WHERE t.id = template_id AND t.organization_id = public.current_org_id()
    )
  );
CREATE POLICY mappings_all ON public.pdf_field_mappings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.pdf_template_versions v
      JOIN public.document_templates t ON t.id = v.template_id
      WHERE v.id = template_version_id AND t.organization_id = public.current_org_id()
    )
  );
CREATE POLICY repeaters_all ON public.pdf_repeaters
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.pdf_template_versions v
      JOIN public.document_templates t ON t.id = v.template_id
      WHERE v.id = template_version_id AND t.organization_id = public.current_org_id()
    )
  );
CREATE POLICY requests_all ON public.surgical_requests
  FOR ALL USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY request_items_all ON public.surgical_request_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.surgical_requests r
      WHERE r.id = request_id AND r.organization_id = public.current_org_id()
    )
  );
CREATE POLICY request_cids_all ON public.surgical_request_cids
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.surgical_requests r
      WHERE r.id = request_id AND r.organization_id = public.current_org_id()
    )
  );
CREATE POLICY documents_all ON public.generated_documents
  FOR ALL USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY audit_select ON public.audit_logs
  FOR SELECT USING (organization_id = public.current_org_id());
CREATE POLICY audit_insert ON public.audit_logs
  FOR INSERT WITH CHECK (organization_id = public.current_org_id());
