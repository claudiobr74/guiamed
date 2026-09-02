export interface JustificationFacts {
  diagnosis?: string;
  cids?: Array<{ code: string; description: string }>;
  procedures?: Array<{ name: string; quantity: number }>;
  ageYears?: number | null;
  sex?: string | null;
  symptoms?: string;
  evolutionTime?: string;
  clinicalFindings?: string;
  exams?: string;
  previousTreatments?: string;
  functionalLimitation?: string;
  extraNotes?: string;
  indicationReason?: string;
  tone?: "improve" | "summarize" | "objective" | "regenerate";
}

const MISSING = "não informado";

export function buildJustificationDraft(facts: JustificationFacts): string {
  const lines: string[] = [];
  const diagnosis = facts.diagnosis?.trim();
  if (diagnosis) {
    lines.push(`Paciente com ${diagnosis}.`);
  }

  if (facts.cids && facts.cids.length > 0) {
    lines.push(
      `CID(s) selecionado(s): ${facts.cids.map((c) => `${c.code} — ${c.description}`).join("; ")}.`,
    );
  }

  const demo: string[] = [];
  if (typeof facts.ageYears === "number") demo.push(`${facts.ageYears} anos`);
  if (facts.sex) demo.push(`sexo ${facts.sex}`);
  if (demo.length > 0) lines.push(`Dados demográficos informados: ${demo.join(", ")}.`);

  const symptoms = facts.symptoms?.trim();
  if (symptoms) lines.push(`Sintomas informados: ${symptoms}.`);

  const evolution = facts.evolutionTime?.trim();
  if (evolution) lines.push(`Tempo de evolução informado: ${evolution}.`);

  const findings = facts.clinicalFindings?.trim();
  if (findings) lines.push(`Achados clínicos: ${findings}.`);

  const exams = facts.exams?.trim();
  if (exams) lines.push(`Exames: ${exams}.`);

  const prev = facts.previousTreatments?.trim();
  if (prev) lines.push(`Tratamentos prévios: ${prev}.`);

  const limitation = facts.functionalLimitation?.trim();
  if (limitation) lines.push(`Limitação funcional informada: ${limitation}.`);

  const extra = facts.extraNotes?.trim();
  if (extra) lines.push(`Outras informações informadas: ${extra}.`);

  const reason = facts.indicationReason?.trim();
  if (reason) lines.push(`Motivo da indicação: ${reason}.`);

  if (facts.procedures && facts.procedures.length > 0) {
    lines.push(
      `Procedimentos solicitados: ${facts.procedures
        .map((p) => `${p.name} (quantidade ${p.quantity})`)
        .join("; ")}.`,
    );
  }

  if (lines.length === 0) {
    return `Não há fatos suficientes para redigir a justificativa. Informe ao menos o diagnóstico, CID ou procedimentos. Campos não fornecidos permanecem como ${MISSING} e não devem ser preenchidos por inferência.`;
  }

  if (facts.tone === "summarize" && lines.length > 2) {
    lines.splice(Math.min(3, lines.length), lines.length - 3);
  } else if (facts.tone === "objective") {
    lines.push("Redigido em tom objetivo, apenas com os fatos listados.");
  }

  lines.push(
    "A justificativa restringe-se aos fatos acima. Nenhuma informação não fornecida foi incluída.",
  );
  return lines.join("\n\n");
}

export function justificationUsesOnlyFacts(text: string): boolean {
  const forbiddenGuesses = ["provavelmente", "possivelmente", "sugere-se que o paciente tenha"];
  return !forbiddenGuesses.some((g) => text.toLowerCase().includes(g));
}
