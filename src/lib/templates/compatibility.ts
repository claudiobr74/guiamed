import type { DocumentTemplate } from "@/types/domain";

export function isTemplateCompatible(
  template: DocumentTemplate,
  selection: { institutionId: string | null; healthInsurerId: string | null },
): boolean {
  if (!template.active || !template.currentVersion?.active) return false;
  if (template.institutionId && template.institutionId !== selection.institutionId) return false;
  if (template.healthInsurerId && template.healthInsurerId !== selection.healthInsurerId) return false;
  return true;
}

export function resolveTemplateSelection(input: {
  templates: DocumentTemplate[];
  institutionId: string | null;
  healthInsurerId: string | null;
  selectedTemplateId: string | null;
}): { templates: DocumentTemplate[]; templateId: string | null; templateVersionId: string | null; invalidated: boolean } {
  const templates = input.templates.filter((template) => isTemplateCompatible(template, input));
  const selected = templates.find((template) => template.id === input.selectedTemplateId) ?? null;
  if (selected) return { templates, templateId: selected.id, templateVersionId: selected.currentVersion?.id ?? null, invalidated: false };
  if (templates.length === 1) return { templates, templateId: templates[0].id, templateVersionId: templates[0].currentVersion?.id ?? null, invalidated: input.selectedTemplateId !== null };
  return { templates, templateId: null, templateVersionId: null, invalidated: input.selectedTemplateId !== null };
}
