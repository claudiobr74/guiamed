import type { PGlite } from "@electric-sql/pglite";
import { query, queryOne } from "@/lib/db/client";
import type {
  CidCode,
  Doctor,
  DocumentTemplate,
  FieldMapping,
  GeneratedDocument,
  HealthInsurer,
  Institution,
  InstitutionKind,
  Patient,
  PdfRepeater,
  Procedure,
  ProcedureCode,
  ProcedureKit,
  RepeaterColumn,
  RequestCid,
  RequestItem,
  RequestStatus,
  SessionUser,
  SurgicalRequest,
  TemplateVersion,
} from "@/types/domain";

export async function listPatients(db: PGlite, orgId: string, q?: string): Promise<Patient[]> {
  const like = q?.trim() ? `%${q.trim()}%` : null;
  const rows = await query<Record<string, unknown>>(
    db,
    `SELECT p.*, h.name AS health_insurer_name
     FROM patients p
     LEFT JOIN health_insurers h ON h.id = p.health_insurer_id
     WHERE p.organization_id = $1
       AND ($2::text IS NULL OR p.full_name ILIKE $2 OR p.cpf ILIKE $2)
     ORDER BY p.full_name`,
    [orgId, like],
  );
  return rows.map(mapPatient);
}

export async function getPatient(db: PGlite, orgId: string, id: string): Promise<Patient | null> {
  const row = await queryOne<Record<string, unknown>>(
    db,
    `SELECT p.*, h.name AS health_insurer_name
     FROM patients p LEFT JOIN health_insurers h ON h.id = p.health_insurer_id
     WHERE p.organization_id = $1 AND p.id = $2`,
    [orgId, id],
  );
  return row ? mapPatient(row) : null;
}

export async function upsertPatient(
  db: PGlite,
  orgId: string,
  userId: string,
  data: Partial<Patient> & { fullName: string; id?: string },
): Promise<Patient> {
  if (data.cpf) {
    const dup = await queryOne<{ id: string }>(
      db,
      `SELECT id FROM patients WHERE organization_id = $1 AND cpf = $2 AND ($3::uuid IS NULL OR id <> $3)`,
      [orgId, data.cpf, data.id ?? null],
    );
    if (dup) throw new Error("Já existe um paciente com este CPF nesta organização.");
  }
  if (data.id) {
    await db.query(
      `UPDATE patients SET full_name=$3, birth_date=$4, cpf=$5, sex=$6, phone=$7, email=$8,
        insurance_card=$9, health_insurer_id=$10
       WHERE id=$1 AND organization_id=$2`,
      [
        data.id,
        orgId,
        data.fullName,
        data.birthDate ?? null,
        data.cpf ?? null,
        data.sex ?? null,
        data.phone ?? null,
        data.email ?? null,
        data.insuranceCard ?? null,
        data.healthInsurerId ?? null,
      ],
    );
    const updated = await getPatient(db, orgId, data.id);
    if (!updated) throw new Error("Paciente não encontrado.");
    return updated;
  }
  const row = await queryOne<{ id: string }>(
    db,
    `INSERT INTO patients (organization_id, full_name, birth_date, cpf, sex, phone, email, insurance_card, health_insurer_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [
      orgId,
      data.fullName,
      data.birthDate ?? null,
      data.cpf ?? null,
      data.sex ?? null,
      data.phone ?? null,
      data.email ?? null,
      data.insuranceCard ?? null,
      data.healthInsurerId ?? null,
      userId,
    ],
  );
  if (!row) throw new Error("Não foi possível salvar o paciente.");
  const created = await getPatient(db, orgId, row.id);
  if (!created) throw new Error("Paciente não encontrado após cadastro.");
  return created;
}

export async function listDoctors(db: PGlite, orgId: string, q?: string): Promise<Doctor[]> {
  const like = q?.trim() ? `%${q.trim()}%` : null;
  const rows = await query<Record<string, unknown>>(
    db,
    `SELECT * FROM doctors WHERE organization_id = $1
       AND ($2::text IS NULL OR name ILIKE $2 OR crm ILIKE $2)
     ORDER BY is_default DESC, name`,
    [orgId, like],
  );
  return rows.map(mapDoctor);
}

export async function getDoctor(db: PGlite, orgId: string, id: string): Promise<Doctor | null> {
  const row = await queryOne<Record<string, unknown>>(
    db,
    `SELECT * FROM doctors WHERE organization_id = $1 AND id = $2`,
    [orgId, id],
  );
  return row ? mapDoctor(row) : null;
}

export async function upsertDoctor(
  db: PGlite,
  orgId: string,
  data: Partial<Doctor> & { name: string; crm: string; crmState: string; id?: string },
): Promise<Doctor> {
  if (data.isDefault) {
    await db.query(`UPDATE doctors SET is_default = false WHERE organization_id = $1`, [orgId]);
  }
  if (data.id) {
    await db.query(
      `UPDATE doctors SET name=$3, crm=$4, crm_state=$5, cpf=$6, specialty=$7, rqe=$8, phone=$9,
        email=$10, signature_file=$11, is_default=$12, active=$13
       WHERE id=$1 AND organization_id=$2`,
      [
        data.id,
        orgId,
        data.name,
        data.crm,
        data.crmState,
        data.cpf ?? null,
        data.specialty ?? null,
        data.rqe ?? null,
        data.phone ?? null,
        data.email ?? null,
        data.signatureFile ?? null,
        data.isDefault ?? false,
        data.active ?? true,
      ],
    );
    const updated = await getDoctor(db, orgId, data.id);
    if (!updated) throw new Error("Médico não encontrado.");
    return updated;
  }
  const row = await queryOne<{ id: string }>(
    db,
    `INSERT INTO doctors (organization_id, name, crm, crm_state, cpf, specialty, rqe, phone, email, is_default, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [
      orgId,
      data.name,
      data.crm,
      data.crmState,
      data.cpf ?? null,
      data.specialty ?? null,
      data.rqe ?? null,
      data.phone ?? null,
      data.email ?? null,
      data.isDefault ?? false,
      data.active ?? true,
    ],
  );
  if (!row) throw new Error("Não foi possível salvar o médico.");
  const created = await getDoctor(db, orgId, row.id);
  if (!created) throw new Error("Médico não encontrado após cadastro.");
  return created;
}

export async function listInstitutions(db: PGlite, orgId: string): Promise<Institution[]> {
  const rows = await query<Record<string, unknown>>(
    db,
    `SELECT * FROM institutions WHERE organization_id = $1 ORDER BY name`,
    [orgId],
  );
  return rows.map(mapInstitution);
}

export async function upsertInstitution(
  db: PGlite,
  orgId: string,
  data: { id?: string; name: string; kind: InstitutionKind; city?: string; state?: string; cnpj?: string; phone?: string; active?: boolean },
): Promise<Institution> {
  if (data.id) {
    await db.query(
      `UPDATE institutions SET name=$3, kind=$4, city=$5, state=$6, cnpj=$7, phone=$8, active=$9
       WHERE id=$1 AND organization_id=$2`,
      [data.id, orgId, data.name, data.kind, data.city ?? null, data.state ?? null, data.cnpj ?? null, data.phone ?? null, data.active ?? true],
    );
    const row = await queryOne<Record<string, unknown>>(db, `SELECT * FROM institutions WHERE id=$1`, [data.id]);
    if (!row) throw new Error("Instituição não encontrada.");
    return mapInstitution(row);
  }
  const row = await queryOne<Record<string, unknown>>(
    db,
    `INSERT INTO institutions (organization_id, kind, name, city, state, cnpj, phone)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [orgId, data.kind, data.name, data.city ?? null, data.state ?? null, data.cnpj ?? null, data.phone ?? null],
  );
  if (!row) throw new Error("Não foi possível salvar a instituição.");
  return mapInstitution(row);
}

export async function listInsurers(db: PGlite, orgId: string): Promise<HealthInsurer[]> {
  const rows = await query<Record<string, unknown>>(
    db,
    `SELECT * FROM health_insurers WHERE organization_id = $1 ORDER BY name`,
    [orgId],
  );
  return rows.map(mapInsurer);
}

export async function upsertInsurer(
  db: PGlite,
  orgId: string,
  data: { id?: string; name: string; code?: string; active?: boolean },
): Promise<HealthInsurer> {
  if (data.id) {
    await db.query(
      `UPDATE health_insurers SET name=$3, code=$4, active=$5 WHERE id=$1 AND organization_id=$2`,
      [data.id, orgId, data.name, data.code ?? null, data.active ?? true],
    );
    const row = await queryOne<Record<string, unknown>>(db, `SELECT * FROM health_insurers WHERE id=$1`, [data.id]);
    if (!row) throw new Error("Operadora não encontrada.");
    return mapInsurer(row);
  }
  const row = await queryOne<Record<string, unknown>>(
    db,
    `INSERT INTO health_insurers (organization_id, name, code) VALUES ($1,$2,$3) RETURNING *`,
    [orgId, data.name, data.code ?? null],
  );
  if (!row) throw new Error("Não foi possível salvar a operadora.");
  return mapInsurer(row);
}

export async function searchCids(db: PGlite, q: string): Promise<CidCode[]> {
  const like = `%${q.trim()}%`;
  const rows = await query<Record<string, unknown>>(
    db,
    `SELECT * FROM cid_codes
     WHERE active = true AND (code ILIKE $1 OR description ILIKE $1)
     ORDER BY code LIMIT 20`,
    [like],
  );
  return rows.map(mapCid);
}

export async function searchProcedures(db: PGlite, orgId: string, q: string): Promise<Procedure[]> {
  const like = `%${q.trim()}%`;
  const rows = await query<Record<string, unknown>>(
    db,
    `SELECT DISTINCT p.*
     FROM procedures p
     LEFT JOIN procedure_synonyms s ON s.procedure_id = p.id
     LEFT JOIN procedure_codes c ON c.procedure_id = p.id AND c.active = true
     WHERE p.organization_id = $1 AND p.active = true
       AND (
         p.name ILIKE $2 OR p.description ILIKE $2 OR p.specialty ILIKE $2
         OR s.synonym ILIKE $2 OR c.code ILIKE $2 OR c.description ILIKE $2
       )
     ORDER BY p.name LIMIT 30`,
    [orgId, like],
  );
  const result: Procedure[] = [];
  for (const row of rows) {
    result.push(await hydrateProcedure(db, row));
  }
  return result;
}

export async function listProcedures(db: PGlite, orgId: string): Promise<Procedure[]> {
  const rows = await query<Record<string, unknown>>(
    db,
    `SELECT * FROM procedures WHERE organization_id = $1 ORDER BY name`,
    [orgId],
  );
  const result: Procedure[] = [];
  for (const row of rows) result.push(await hydrateProcedure(db, row));
  return result;
}

async function hydrateProcedure(db: PGlite, row: Record<string, unknown>): Promise<Procedure> {
  const synonyms = await query<{ synonym: string }>(
    db,
    `SELECT synonym FROM procedure_synonyms WHERE procedure_id = $1`,
    [row.id],
  );
  const codes = await query<Record<string, unknown>>(
    db,
    `SELECT * FROM procedure_codes WHERE procedure_id = $1 ORDER BY code_system, code`,
    [row.id],
  );
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    description: (row.description as string | null) ?? null,
    specialty: (row.specialty as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    active: Boolean(row.active),
    synonyms: synonyms.map((s) => s.synonym),
    codes: codes.map(mapCode),
  };
}

export async function upsertProcedure(
  db: PGlite,
  orgId: string,
  data: { id?: string; name: string; description?: string; specialty?: string; category?: string; synonyms?: string[]; active?: boolean },
): Promise<Procedure> {
  let id = data.id;
  if (id) {
    await db.query(
      `UPDATE procedures SET name=$3, description=$4, specialty=$5, category=$6, active=$7
       WHERE id=$1 AND organization_id=$2`,
      [id, orgId, data.name, data.description ?? null, data.specialty ?? null, data.category ?? null, data.active ?? true],
    );
  } else {
    const row = await queryOne<{ id: string }>(
      db,
      `INSERT INTO procedures (organization_id, name, description, specialty, category)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [orgId, data.name, data.description ?? null, data.specialty ?? null, data.category ?? null],
    );
    if (!row) throw new Error("Não foi possível salvar o procedimento.");
    id = row.id;
  }
  await db.query(`DELETE FROM procedure_synonyms WHERE procedure_id = $1`, [id]);
  for (const synonym of data.synonyms ?? []) {
    if (!synonym.trim()) continue;
    await db.query(`INSERT INTO procedure_synonyms (procedure_id, synonym) VALUES ($1,$2)`, [
      id,
      synonym.trim(),
    ]);
  }
  const created = await queryOne<Record<string, unknown>>(db, `SELECT * FROM procedures WHERE id=$1`, [id]);
  if (!created) throw new Error("Procedimento não encontrado.");
  return hydrateProcedure(db, created);
}

export async function listCodes(db: PGlite, orgId: string, system?: string): Promise<ProcedureCode[]> {
  const rows = await query<Record<string, unknown>>(
    db,
    `SELECT * FROM procedure_codes WHERE organization_id = $1
       AND ($2::text IS NULL OR code_system = $2)
     ORDER BY code_system, code`,
    [orgId, system ?? null],
  );
  return rows.map(mapCode);
}

export async function insertCodesIdempotent(
  db: PGlite,
  orgId: string,
  userId: string,
  payload: {
    codeSystem: string;
    version: string;
    sourceFilename: string;
    sourceFormat: "csv" | "xlsx" | "json";
    rows: Array<{
      codeSystem: string;
      code: string;
      description: string;
      version: string;
      validFrom: string | null;
      validUntil: string | null;
      procedureName: string | null;
      active: boolean;
    }>;
  },
): Promise<{ inserted: number; updated: number; batchId: string }> {
  const batch = await queryOne<{ id: string }>(
    db,
    `INSERT INTO code_import_batches (organization_id, code_system, source_filename, source_format, version, created_by, row_count)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [orgId, payload.codeSystem, payload.sourceFilename, payload.sourceFormat, payload.version, userId, payload.rows.length],
  );
  if (!batch) throw new Error("Não foi possível registrar a importação.");
  let inserted = 0;
  let updated = 0;
  for (const row of payload.rows) {
    let procedureId: string | null = null;
    if (row.procedureName) {
      const existing = await queryOne<{ id: string }>(
        db,
        `SELECT id FROM procedures WHERE organization_id=$1 AND lower(name)=lower($2)`,
        [orgId, row.procedureName],
      );
      if (existing) procedureId = existing.id;
    }
    const current = await queryOne<{ id: string }>(
      db,
      `SELECT id FROM procedure_codes
       WHERE organization_id=$1 AND code_system=$2 AND code=$3 AND version=$4`,
      [orgId, row.codeSystem, row.code, row.version],
    );
    if (current) {
      await db.query(
        `UPDATE procedure_codes SET description=$2, valid_from=$3, valid_until=$4, active=$5,
          procedure_id=COALESCE($6, procedure_id), import_batch_id=$7
         WHERE id=$1`,
        [current.id, row.description, row.validFrom, row.validUntil, row.active, procedureId, batch.id],
      );
      updated += 1;
    } else {
      await db.query(
        `INSERT INTO procedure_codes
          (organization_id, procedure_id, code_system, code, description, valid_from, valid_until, version, active, import_batch_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [orgId, procedureId, row.codeSystem, row.code, row.description, row.validFrom, row.validUntil, row.version, row.active, batch.id],
      );
      inserted += 1;
    }
  }
  return { inserted, updated, batchId: batch.id };
}

export async function listKits(db: PGlite, orgId: string): Promise<ProcedureKit[]> {
  const kits = await query<Record<string, unknown>>(
    db,
    `SELECT * FROM procedure_kits WHERE organization_id = $1 ORDER BY name`,
    [orgId],
  );
  const result: ProcedureKit[] = [];
  for (const kit of kits) {
    const items = await query<Record<string, unknown>>(
      db,
      `SELECT i.*, p.name AS procedure_name
       FROM procedure_kit_items i
       JOIN procedures p ON p.id = i.procedure_id
       WHERE i.kit_id = $1 ORDER BY i.sort_order`,
      [kit.id],
    );
    result.push({
      id: String(kit.id),
      organizationId: String(kit.organization_id),
      name: String(kit.name),
      description: (kit.description as string | null) ?? null,
      specialty: (kit.specialty as string | null) ?? null,
      active: Boolean(kit.active),
      items: items.map((item) => ({
        id: String(item.id),
        kitId: String(item.kit_id),
        procedureId: String(item.procedure_id),
        procedureName: String(item.procedure_name),
        defaultQuantity: Number(item.default_quantity),
        defaultCodeId: (item.default_code_id as string | null) ?? null,
        notes: (item.notes as string | null) ?? null,
        sortOrder: Number(item.sort_order),
      })),
    });
  }
  return result;
}

export async function upsertKit(
  db: PGlite,
  orgId: string,
  data: {
    id?: string;
    name: string;
    description?: string;
    specialty?: string;
    items: Array<{ procedureId: string; defaultQuantity: number; defaultCodeId?: string | null; notes?: string }>;
  },
): Promise<void> {
  let kitId = data.id;
  if (kitId) {
    await db.query(
      `UPDATE procedure_kits SET name=$3, description=$4, specialty=$5 WHERE id=$1 AND organization_id=$2`,
      [kitId, orgId, data.name, data.description ?? null, data.specialty ?? null],
    );
    await db.query(`DELETE FROM procedure_kit_items WHERE kit_id=$1`, [kitId]);
  } else {
    const row = await queryOne<{ id: string }>(
      db,
      `INSERT INTO procedure_kits (organization_id, name, description, specialty) VALUES ($1,$2,$3,$4) RETURNING id`,
      [orgId, data.name, data.description ?? null, data.specialty ?? null],
    );
    if (!row) throw new Error("Não foi possível salvar o kit.");
    kitId = row.id;
  }
  for (const [index, item] of data.items.entries()) {
    await db.query(
      `INSERT INTO procedure_kit_items (kit_id, procedure_id, default_quantity, default_code_id, notes, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [kitId, item.procedureId, item.defaultQuantity, item.defaultCodeId ?? null, item.notes ?? null, index],
    );
  }
}

export async function listTemplates(db: PGlite, orgId: string): Promise<DocumentTemplate[]> {
  const rows = await query<Record<string, unknown>>(
    db,
    `SELECT * FROM document_templates WHERE organization_id = $1 ORDER BY name`,
    [orgId],
  );
  const result: DocumentTemplate[] = [];
  for (const row of rows) {
    const version = await queryOne<Record<string, unknown>>(
      db,
      `SELECT * FROM pdf_template_versions WHERE template_id=$1 AND active=true ORDER BY version DESC LIMIT 1`,
      [row.id],
    );
    result.push({
      id: String(row.id),
      organizationId: String(row.organization_id),
      name: String(row.name),
      institutionId: (row.institution_id as string | null) ?? null,
      healthInsurerId: (row.health_insurer_id as string | null) ?? null,
      documentType: String(row.document_type),
      active: Boolean(row.active),
      currentVersion: version ? mapVersion(version) : null,
    });
  }
  return result;
}

export async function getTemplateVersion(db: PGlite, id: string): Promise<TemplateVersion | null> {
  const row = await queryOne<Record<string, unknown>>(
    db,
    `SELECT * FROM pdf_template_versions WHERE id=$1`,
    [id],
  );
  return row ? mapVersion(row) : null;
}

export async function createTemplateVersion(
  db: PGlite,
  orgId: string,
  userId: string,
  data: {
    templateId?: string;
    name: string;
    institutionId?: string | null;
    healthInsurerId?: string | null;
    filePath: string;
    fileHash: string;
    pageCount: number;
    pageWidth: number | null;
    pageHeight: number | null;
    hasAcroform: boolean;
    acroformFields: unknown;
  },
): Promise<{ templateId: string; versionId: string; version: number }> {
  let templateId = data.templateId;
  if (!templateId) {
    const t = await queryOne<{ id: string }>(
      db,
      `INSERT INTO document_templates (organization_id, name, institution_id, health_insurer_id)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [orgId, data.name, data.institutionId ?? null, data.healthInsurerId ?? null],
    );
    if (!t) throw new Error("Não foi possível criar o template.");
    templateId = t.id;
  } else {
    await db.query(
      `UPDATE document_templates SET name=$3, institution_id=$4, health_insurer_id=$5 WHERE id=$1 AND organization_id=$2`,
      [templateId, orgId, data.name, data.institutionId ?? null, data.healthInsurerId ?? null],
    );
  }
  const last = await queryOne<{ version: number }>(
    db,
    `SELECT version FROM pdf_template_versions WHERE template_id=$1 ORDER BY version DESC LIMIT 1`,
    [templateId],
  );
  const version = (last?.version ?? 0) + 1;
  await db.query(`UPDATE pdf_template_versions SET active=false WHERE template_id=$1`, [templateId]);
  const v = await queryOne<{ id: string }>(
    db,
    `INSERT INTO pdf_template_versions
      (template_id, version, file_path, file_hash, page_count, page_width, page_height, has_acroform, acroform_fields, active, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10) RETURNING id`,
    [
      templateId,
      version,
      data.filePath,
      data.fileHash,
      data.pageCount,
      data.pageWidth,
      data.pageHeight,
      data.hasAcroform,
      JSON.stringify(data.acroformFields),
      userId,
    ],
  );
  if (!v) throw new Error("Não foi possível versionar o PDF.");
  return { templateId, versionId: v.id, version };
}

export async function listMappings(db: PGlite, versionId: string): Promise<FieldMapping[]> {
  const rows = await query<Record<string, unknown>>(
    db,
    `SELECT * FROM pdf_field_mappings WHERE template_version_id=$1 ORDER BY page, y, x`,
    [versionId],
  );
  return rows.map(mapMapping);
}

export async function saveMappings(db: PGlite, versionId: string, mappings: Omit<FieldMapping, "id" | "templateVersionId">[]): Promise<void> {
  await db.query(`DELETE FROM pdf_field_mappings WHERE template_version_id=$1`, [versionId]);
  for (const m of mappings) {
    await db.query(
      `INSERT INTO pdf_field_mappings
        (template_version_id, semantic_field, pdf_field_name, mapping_kind, page, x, y, width, height, font_size, alignment, multiline, auto_shrink, max_characters, required)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        versionId, m.semanticField, m.pdfFieldName, m.mappingKind, m.page, m.x, m.y, m.width, m.height,
        m.fontSize, m.alignment, m.multiline, m.autoShrink, m.maxCharacters, m.required,
      ],
    );
  }
}

export async function listRepeaters(db: PGlite, versionId: string): Promise<PdfRepeater[]> {
  const rows = await query<Record<string, unknown>>(
    db,
    `SELECT * FROM pdf_repeaters WHERE template_version_id=$1`,
    [versionId],
  );
  return rows.map(mapRepeater);
}

export async function saveRepeater(db: PGlite, repeater: Omit<PdfRepeater, "id"> & { id?: string }): Promise<void> {
  if (repeater.id) {
    await db.query(
      `UPDATE pdf_repeaters SET page=$2, start_x=$3, start_y=$4, row_height=$5, max_rows=$6, columns=$7 WHERE id=$1`,
      [repeater.id, repeater.page, repeater.startX, repeater.startY, repeater.rowHeight, repeater.maxRows, JSON.stringify(repeater.columns)],
    );
    return;
  }
  await db.query(
    `INSERT INTO pdf_repeaters (template_version_id, source, page, start_x, start_y, row_height, max_rows, columns)
     VALUES ($1,'procedures',$2,$3,$4,$5,$6,$7)`,
    [repeater.templateVersionId, repeater.page, repeater.startX, repeater.startY, repeater.rowHeight, repeater.maxRows, JSON.stringify(repeater.columns)],
  );
}

export async function listRequests(
  db: PGlite,
  orgId: string,
  filters: { q?: string; status?: RequestStatus; from?: string; to?: string },
): Promise<SurgicalRequest[]> {
  const like = filters.q?.trim() ? `%${filters.q.trim()}%` : null;
  const rows = await query<Record<string, unknown>>(
    db,
    `SELECT r.* FROM surgical_requests r
     LEFT JOIN patients p ON p.id = r.patient_id
     LEFT JOIN doctors d ON d.id = r.doctor_id
     LEFT JOIN institutions i ON i.id = r.institution_id
     LEFT JOIN surgical_request_items it ON it.request_id = r.id
     WHERE r.organization_id = $1
       AND ($2::text IS NULL OR r.status = $2)
       AND ($3::text IS NULL OR p.full_name ILIKE $3 OR d.name ILIKE $3 OR i.name ILIKE $3 OR it.procedure_name ILIKE $3)
       AND ($4::date IS NULL OR r.created_at::date >= $4::date)
       AND ($5::date IS NULL OR r.created_at::date <= $5::date)
     GROUP BY r.id
     ORDER BY r.updated_at DESC`,
    [orgId, filters.status ?? null, like, filters.from ?? null, filters.to ?? null],
  );
  const result: SurgicalRequest[] = [];
  for (const row of rows) result.push(await hydrateRequest(db, orgId, String(row.id)));
  return result;
}

export async function hydrateRequest(db: PGlite, orgId: string, id: string): Promise<SurgicalRequest> {
  const row = await queryOne<Record<string, unknown>>(
    db,
    `SELECT * FROM surgical_requests WHERE id=$1 AND organization_id=$2`,
    [id, orgId],
  );
  if (!row) throw new Error("Solicitação não encontrada.");
  const patient = row.patient_id
    ? await queryOne<Record<string, unknown>>(db, `SELECT p.*, h.name AS health_insurer_name FROM patients p LEFT JOIN health_insurers h ON h.id=p.health_insurer_id WHERE p.id=$1`, [row.patient_id])
    : null;
  const doctor = row.doctor_id
    ? await queryOne<Record<string, unknown>>(db, `SELECT * FROM doctors WHERE id=$1`, [row.doctor_id])
    : null;
  const institution = row.institution_id
    ? await queryOne<Record<string, unknown>>(db, `SELECT * FROM institutions WHERE id=$1`, [row.institution_id])
    : null;
  const insurer = row.health_insurer_id
    ? await queryOne<Record<string, unknown>>(db, `SELECT * FROM health_insurers WHERE id=$1`, [row.health_insurer_id])
    : null;
  const items = await query<Record<string, unknown>>(
    db,
    `SELECT * FROM surgical_request_items WHERE request_id=$1 ORDER BY sort_order`,
    [id],
  );
  const cids = await query<Record<string, unknown>>(
    db,
    `SELECT * FROM surgical_request_cids WHERE request_id=$1 ORDER BY sort_order`,
    [id],
  );
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    patientId: (row.patient_id as string | null) ?? null,
    doctorId: (row.doctor_id as string | null) ?? null,
    institutionId: (row.institution_id as string | null) ?? null,
    healthInsurerId: (row.health_insurer_id as string | null) ?? null,
    templateId: (row.template_id as string | null) ?? null,
    templateVersionId: (row.template_version_id as string | null) ?? null,
    diagnosis: (row.diagnosis as string | null) ?? null,
    clinicalJustification: (row.clinical_justification as string | null) ?? null,
    clinicalNotes: (row.clinical_notes as string | null) ?? null,
    status: row.status as RequestStatus,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    finalizedAt: row.finalized_at ? String(row.finalized_at) : null,
    duplicatedFromId: (row.duplicated_from_id as string | null) ?? null,
    patient: patient ? mapPatient(patient) : null,
    doctor: doctor ? mapDoctor(doctor) : null,
    institution: institution ? mapInstitution(institution) : null,
    healthInsurer: insurer ? mapInsurer(insurer) : null,
    items: items.map(mapItem),
    cids: cids.map(mapRequestCid),
  };
}

export async function createDraft(db: PGlite, user: SessionUser): Promise<string> {
  const defaultDoctor = await queryOne<{ id: string }>(
    db,
    `SELECT id FROM doctors WHERE organization_id=$1 AND is_default=true AND active=true LIMIT 1`,
    [user.organizationId],
  );
  const row = await queryOne<{ id: string }>(
    db,
    `INSERT INTO surgical_requests (organization_id, doctor_id, status, created_by)
     VALUES ($1,$2,'draft',$3) RETURNING id`,
    [user.organizationId, defaultDoctor?.id ?? null, user.id],
  );
  if (!row) throw new Error("Não foi possível criar o rascunho.");
  await audit(db, user, "create", "surgical_request", row.id, { status: "draft" });
  return row.id;
}

export async function saveDraft(
  db: PGlite,
  user: SessionUser,
  request: SurgicalRequest,
): Promise<void> {
  const current = await queryOne<{ status: RequestStatus }>(
    db,
    `SELECT status FROM surgical_requests WHERE id=$1 AND organization_id=$2`,
    [request.id, user.organizationId],
  );
  if (!current) throw new Error("Solicitação não encontrada.");
  if (current.status !== "draft") {
    throw new Error("Documento finalizado não pode ser alterado. Duplique para criar uma nova versão.");
  }
  await db.query(
    `UPDATE surgical_requests SET
      patient_id=$3, doctor_id=$4, institution_id=$5, health_insurer_id=$6,
      template_id=$7, template_version_id=$8, diagnosis=$9, clinical_justification=$10, clinical_notes=$11
     WHERE id=$1 AND organization_id=$2`,
    [
      request.id,
      user.organizationId,
      request.patientId,
      request.doctorId,
      request.institutionId,
      request.healthInsurerId,
      request.templateId,
      request.templateVersionId,
      request.diagnosis,
      request.clinicalJustification,
      request.clinicalNotes,
    ],
  );
  await db.query(`DELETE FROM surgical_request_items WHERE request_id=$1`, [request.id]);
  await db.query(`DELETE FROM surgical_request_cids WHERE request_id=$1`, [request.id]);
  for (const [index, item] of request.items.entries()) {
    await db.query(
      `INSERT INTO surgical_request_items
        (request_id, procedure_id, procedure_name, tuss_code_id, ipasgo_code_id, tuss_code_snapshot, ipasgo_code_snapshot, quantity, laterality, notes, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        request.id, item.procedureId, item.procedureName, item.tussCodeId, item.ipasgoCodeId,
        item.tussCodeSnapshot, item.ipasgoCodeSnapshot, item.quantity, item.laterality, item.notes, index,
      ],
    );
  }
  for (const [index, cid] of request.cids.entries()) {
    await db.query(
      `INSERT INTO surgical_request_cids (request_id, cid_code_id, code_snapshot, description_snapshot, sort_order)
       VALUES ($1,$2,$3,$4,$5)`,
      [request.id, cid.cidCodeId, cid.codeSnapshot, cid.descriptionSnapshot, index],
    );
  }
}

export async function finalizeRequest(db: PGlite, user: SessionUser, requestId: string): Promise<void> {
  const current = await queryOne<{ status: RequestStatus }>(
    db,
    `SELECT status FROM surgical_requests WHERE id=$1 AND organization_id=$2`,
    [requestId, user.organizationId],
  );
  if (!current) throw new Error("Solicitação não encontrada.");
  if (current.status !== "draft") throw new Error("Somente rascunhos podem ser finalizados.");
  await db.query(
    `UPDATE surgical_requests SET status='finalized', finalized_at=now() WHERE id=$1 AND organization_id=$2`,
    [requestId, user.organizationId],
  );
  await audit(db, user, "finalize", "surgical_request", requestId, {});
}

export async function cancelRequest(db: PGlite, user: SessionUser, requestId: string): Promise<void> {
  await db.query(
    `UPDATE surgical_requests SET status='cancelled' WHERE id=$1 AND organization_id=$2 AND status='draft'`,
    [requestId, user.organizationId],
  );
  await audit(db, user, "cancel", "surgical_request", requestId, {});
}

export async function duplicateRequest(db: PGlite, user: SessionUser, requestId: string): Promise<string> {
  const source = await hydrateRequest(db, user.organizationId, requestId);
  const id = await createDraft(db, user);
  source.id = id;
  source.status = "draft";
  source.duplicatedFromId = requestId;
  source.finalizedAt = null;
  await saveDraft(db, user, source);
  await db.query(
    `UPDATE surgical_requests SET duplicated_from_id=$3, status='draft', finalized_at=NULL WHERE id=$1 AND organization_id=$2`,
    [id, user.organizationId, requestId],
  );
  await audit(db, user, "duplicate", "surgical_request", id, { from: requestId });
  return id;
}

export async function saveGeneratedDocument(
  db: PGlite,
  user: SessionUser,
  data: { requestId: string; templateVersionId: string; filePath: string; fileHash: string },
): Promise<GeneratedDocument> {
  const row = await queryOne<Record<string, unknown>>(
    db,
    `INSERT INTO generated_documents (organization_id, request_id, template_version_id, file_path, file_hash, created_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [user.organizationId, data.requestId, data.templateVersionId, data.filePath, data.fileHash, user.id],
  );
  if (!row) throw new Error("Não foi possível armazenar o documento gerado.");
  await audit(db, user, "generate_pdf", "generated_document", String(row.id), { requestId: data.requestId });
  return {
    id: String(row.id),
    requestId: String(row.request_id),
    templateVersionId: String(row.template_version_id),
    filePath: String(row.file_path),
    fileHash: String(row.file_hash),
    createdAt: String(row.created_at),
    createdBy: (row.created_by as string | null) ?? null,
  };
}

export async function listGenerated(db: PGlite, requestId: string): Promise<GeneratedDocument[]> {
  const rows = await query<Record<string, unknown>>(
    db,
    `SELECT * FROM generated_documents WHERE request_id=$1 ORDER BY created_at DESC`,
    [requestId],
  );
  return rows.map((row) => ({
    id: String(row.id),
    requestId: String(row.request_id),
    templateVersionId: String(row.template_version_id),
    filePath: String(row.file_path),
    fileHash: String(row.file_hash),
    createdAt: String(row.created_at),
    createdBy: (row.created_by as string | null) ?? null,
  }));
}

export async function dashboardStats(db: PGlite, orgId: string) {
  const today = await queryOne<{ n: number }>(
    db,
    `SELECT count(*)::int AS n FROM surgical_requests WHERE organization_id=$1 AND created_at::date = current_date`,
    [orgId],
  );
  const month = await queryOne<{ n: number }>(
    db,
    `SELECT count(*)::int AS n FROM surgical_requests WHERE organization_id=$1 AND date_trunc('month', created_at) = date_trunc('month', now())`,
    [orgId],
  );
  const drafts = await queryOne<{ n: number }>(
    db,
    `SELECT count(*)::int AS n FROM surgical_requests WHERE organization_id=$1 AND status='draft'`,
    [orgId],
  );
  const generated = await queryOne<{ n: number }>(
    db,
    `SELECT count(*)::int AS n FROM surgical_requests WHERE organization_id=$1 AND status='finalized'`,
    [orgId],
  );
  return {
    today: today?.n ?? 0,
    month: month?.n ?? 0,
    drafts: drafts?.n ?? 0,
    generated: generated?.n ?? 0,
  };
}

export async function audit(
  db: PGlite,
  user: SessionUser,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, string | number | boolean | null>,
): Promise<void> {
  await db.query(
    `INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, metadata)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [user.organizationId, user.id, action, entityType, entityId, JSON.stringify(metadata)],
  );
}

function mapPatient(row: Record<string, unknown>): Patient {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    fullName: String(row.full_name),
    birthDate: row.birth_date ? String(row.birth_date).slice(0, 10) : null,
    cpf: (row.cpf as string | null) ?? null,
    sex: (row.sex as Patient["sex"]) ?? null,
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    insuranceCard: (row.insurance_card as string | null) ?? null,
    healthInsurerId: (row.health_insurer_id as string | null) ?? null,
    healthInsurerName: (row.health_insurer_name as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapDoctor(row: Record<string, unknown>): Doctor {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    crm: String(row.crm),
    crmState: String(row.crm_state),
    cpf: (row.cpf as string | null) ?? null,
    specialty: (row.specialty as string | null) ?? null,
    rqe: (row.rqe as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    signatureFile: (row.signature_file as string | null) ?? null,
    signatureKind: (row.signature_kind as Doctor["signatureKind"]) ?? "image",
    isDefault: Boolean(row.is_default),
    active: Boolean(row.active),
  };
}

function mapInstitution(row: Record<string, unknown>): Institution {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    kind: row.kind as InstitutionKind,
    name: String(row.name),
    cnpj: (row.cnpj as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    state: (row.state as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    active: Boolean(row.active),
  };
}

function mapInsurer(row: Record<string, unknown>): HealthInsurer {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    code: (row.code as string | null) ?? null,
    active: Boolean(row.active),
  };
}

function mapCid(row: Record<string, unknown>): CidCode {
  return {
    id: String(row.id),
    code: String(row.code),
    description: String(row.description),
    version: String(row.version),
    active: Boolean(row.active),
  };
}

function mapCode(row: Record<string, unknown>): ProcedureCode {
  return {
    id: String(row.id),
    procedureId: (row.procedure_id as string | null) ?? null,
    codeSystem: String(row.code_system),
    code: String(row.code),
    description: String(row.description),
    validFrom: row.valid_from ? String(row.valid_from).slice(0, 10) : null,
    validUntil: row.valid_until ? String(row.valid_until).slice(0, 10) : null,
    version: String(row.version),
    active: Boolean(row.active),
    metadata: (row.metadata as ProcedureCode["metadata"]) ?? {},
  };
}

function mapVersion(row: Record<string, unknown>): TemplateVersion {
  const fields = row.acroform_fields;
  return {
    id: String(row.id),
    templateId: String(row.template_id),
    version: Number(row.version),
    filePath: String(row.file_path),
    fileHash: String(row.file_hash),
    pageCount: Number(row.page_count),
    pageWidth: row.page_width === null ? null : Number(row.page_width),
    pageHeight: row.page_height === null ? null : Number(row.page_height),
    hasAcroform: Boolean(row.has_acroform),
    acroformFields: Array.isArray(fields) ? (fields as TemplateVersion["acroformFields"]) : [],
    active: Boolean(row.active),
    createdAt: String(row.created_at),
    createdBy: (row.created_by as string | null) ?? null,
  };
}

function mapMapping(row: Record<string, unknown>): FieldMapping {
  return {
    id: String(row.id),
    templateVersionId: String(row.template_version_id),
    semanticField: String(row.semantic_field),
    pdfFieldName: (row.pdf_field_name as string | null) ?? null,
    mappingKind: row.mapping_kind as FieldMapping["mappingKind"],
    page: Number(row.page),
    x: Number(row.x),
    y: Number(row.y),
    width: Number(row.width),
    height: Number(row.height),
    fontSize: Number(row.font_size),
    alignment: row.alignment as FieldMapping["alignment"],
    multiline: Boolean(row.multiline),
    autoShrink: Boolean(row.auto_shrink),
    maxCharacters: row.max_characters === null ? null : Number(row.max_characters),
    required: Boolean(row.required),
  };
}

function mapRepeater(row: Record<string, unknown>): PdfRepeater {
  return {
    id: String(row.id),
    templateVersionId: String(row.template_version_id),
    source: "procedures",
    page: Number(row.page),
    startX: Number(row.start_x),
    startY: Number(row.start_y),
    rowHeight: Number(row.row_height),
    maxRows: Number(row.max_rows),
    columns: (row.columns as RepeaterColumn[]) ?? [],
  };
}

function mapItem(row: Record<string, unknown>): RequestItem {
  return {
    id: String(row.id),
    requestId: String(row.request_id),
    procedureId: (row.procedure_id as string | null) ?? null,
    procedureName: String(row.procedure_name),
    tussCodeId: (row.tuss_code_id as string | null) ?? null,
    ipasgoCodeId: (row.ipasgo_code_id as string | null) ?? null,
    tussCodeSnapshot: (row.tuss_code_snapshot as string | null) ?? null,
    ipasgoCodeSnapshot: (row.ipasgo_code_snapshot as string | null) ?? null,
    quantity: Number(row.quantity),
    laterality: (row.laterality as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    sortOrder: Number(row.sort_order),
  };
}

function mapRequestCid(row: Record<string, unknown>): RequestCid {
  return {
    id: String(row.id),
    requestId: String(row.request_id),
    cidCodeId: (row.cid_code_id as string | null) ?? null,
    codeSnapshot: String(row.code_snapshot),
    descriptionSnapshot: String(row.description_snapshot),
    sortOrder: Number(row.sort_order),
  };
}
