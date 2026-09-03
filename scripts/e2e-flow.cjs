/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium, request } = require("playwright");

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function selectOptionContaining(page, text) {
  const selects = page.locator("select");
  const count = await selects.count();
  for (let index = 0; index < count; index += 1) {
    const select = selects.nth(index);
    const options = await select.locator("option").evaluateAll((nodes) =>
      nodes.map((node) => ({ value: node.value, text: node.textContent?.trim() ?? "" })),
    );
    const option = options.find((candidate) => candidate.text.includes(text));
    if (option) {
      await select.selectOption(option.value);
      return;
    }
  }
  throw new Error(`Opção não encontrada: ${text}`);
}

async function assertPdfResponse(response, label) {
  assert(response.status() === 200, `${label} retornou ${response.status()}.`);
  assert(
    (response.headers()["content-type"] || "").includes("application/pdf"),
    `${label} não retornou application/pdf.`,
  );
  assert((await response.body()).byteLength > 500, `${label} parece vazio ou inválido.`);
}

const baseUrl = process.env.E2E_BASE_URL?.trim() || "http://127.0.0.1:3000";
const email = required("E2E_USER_EMAIL");
const password = required("E2E_USER_PASSWORD");
const suffix = Date.now().toString(36);
const patientName = `Paciente E2E ${suffix}`;
const doctorName = `Dr. E2E ${suffix}`;
const duplicateDiagnosis = `Diagnóstico editado na duplicata ${suffix}.`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ baseURL: baseUrl });
const page = await context.newPage();
page.setDefaultTimeout(25_000);

try {
  // 1. Login real no Firebase de teste.
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });

  // 2. Criar médico sintético pelo CRUD real do produto.
  await page.goto("/medicos", { waitUntil: "networkidle" });
  const doctorForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Cadastrar" }) }).last();
  await doctorForm.locator('input[name="name"]').fill(doctorName);
  await doctorForm.locator('input[name="crm"]').fill(`9${suffix.replace(/\D/g, "").slice(-5).padStart(5, "0")}`);
  await doctorForm.locator('input[name="crmState"]').fill("GO");
  await doctorForm.locator('input[name="specialty"]').fill("Cirurgia E2E");
  await doctorForm.locator('input[name="rqe"]').fill("99999");
  await doctorForm.getByRole("button", { name: "Cadastrar" }).click();
  await page.getByRole("link", { name: doctorName }).waitFor();

  // 3. Criar paciente sintético e associar ao convênio de teste.
  await page.goto("/pacientes", { waitUntil: "networkidle" });
  const patientForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Cadastrar" }) }).last();
  await patientForm.locator('input[name="fullName"]').fill(patientName);
  await patientForm.locator('input[name="birthDate"]').fill("1984-05-12");
  await patientForm.locator('input[name="phone"]').fill("62999990000");
  await patientForm.locator('input[name="insuranceCard"]').fill(`E2E-${suffix}`);
  await patientForm.locator('select[name="healthInsurerId"]').selectOption({ label: "Convênio E2E" });
  await patientForm.getByRole("button", { name: "Cadastrar" }).click();
  await page.getByText(patientName, { exact: true }).waitFor();

  // 4. Criar guia e preencher paciente, instituição, template e médico.
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "+ Nova guia" }).click();
  await page.waitForURL(/\/guias\/[^/]+$/, { timeout: 30_000 });
  const originalRequestUrl = new URL(page.url());
  const originalRequestId = originalRequestUrl.pathname.split("/").filter(Boolean).at(-1);
  assert(originalRequestId, "Não foi possível obter o ID da guia criada.");

  const patientSearch = page.locator('input[placeholder="Nome ou CPF"]');
  await patientSearch.fill(patientName);
  await page.getByRole("button", { name: new RegExp(patientName) }).first().click();
  await selectOptionContaining(page, "Hospital E2E");
  await selectOptionContaining(page, doctorName);

  let templateResolved = false;
  const templateSelects = page.locator("select");
  for (let index = 0; index < await templateSelects.count(); index += 1) {
    const text = await templateSelects.nth(index).locator("option:checked").textContent().catch(() => null);
    if (text?.includes("Template E2E GuiaMed")) templateResolved = true;
  }
  assert(templateResolved, "Template E2E não foi resolvido automaticamente para instituição/convênio.");

  // 5. Diagnóstico + CID oficial.
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.locator('textarea[placeholder^="Descreva o diagnóstico"]').fill("Lombalgia em avaliação para procedimento E2E.");
  const cidSearch = page.locator('input[placeholder="Pesquisar diagnóstico ou CID..."]');
  await cidSearch.fill("M54.5");
  await page.getByRole("button", { name: /M54\.5/ }).first().click();

  // 6. Buscar procedimento real; resolver TUSS/IPASGO e alterar quantidade.
  await page.getByRole("button", { name: "Avançar" }).click();
  const procedureSearch = page.locator('input[placeholder="Buscar procedimento, TUSS ou código IPASGO..."]');
  await procedureSearch.fill("Procedimento E2E GuiaMed");
  await page.getByRole("button", { name: "Procedimento E2E GuiaMed", exact: true }).first().click();
  await page.getByText("12345678", { exact: true }).waitFor();
  await page.getByText("87654321", { exact: true }).waitFor();
  const quantity = page.locator('input[aria-label="Quantidade"]').first();
  await quantity.fill("3");
  assert((await quantity.inputValue()) === "3", "Quantidade do procedimento não foi atualizada para 3.");

  // 7. Justificativa clínica editável.
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.locator('textarea[placeholder^="Use o painel lateral"]').fill(
    "Paciente com indicação clínica documentada para o procedimento selecionado. Justificativa E2E sem dados inventados.",
  );

  // 8. Preview temporário sem finalizar ou criar histórico falso.
  await page.getByRole("button", { name: "Visualizar PDF" }).click();
  await page.waitForURL(new RegExp(`/guias/${originalRequestId}/preview$`), { timeout: 60_000 });
  await page.getByRole("heading", { name: "PDF preenchido" }).waitFor();
  const draftIframe = page.locator('iframe[title="PDF gerado"]');
  await draftIframe.waitFor();
  const draftSrc = await draftIframe.getAttribute("src");
  assert(draftSrc?.startsWith(`/api/guias/${originalRequestId}/preview`), `Preview draft usa rota inesperada: ${draftSrc}`);
  await assertPdfResponse(await page.request.get(new URL(draftSrc, page.url()).toString()), "Preview temporário autenticado");

  // 9. Voltar à mesma guia e revisar dados.
  await page.goto(`/guias/${originalRequestId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "5", exact: true }).click();
  await page.getByText(patientName, { exact: true }).first().waitFor();
  await page.getByText(/M54\.5/).first().waitFor();
  await page.getByText(/Procedimento E2E GuiaMed — qtd 3/).waitFor();

  // 10. Validação final server-side + confirmação médica + finalização.
  await page.getByRole("button", { name: "Finalizar e gerar PDF" }).click();
  await page.getByRole("heading", { name: "Revisão final da guia" }).waitFor();
  await page.getByText(/Validação server-side sem erros críticos/).waitFor({ timeout: 30_000 });
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: "Gerar PDF definitivo" }).click();
  await page.waitForURL(new RegExp(`/guias/${originalRequestId}/preview\\?doc=`), { timeout: 60_000 });

  // 11. PDF final em Storage privado e bloqueado para visitante sem sessão.
  await page.getByRole("heading", { name: "PDF preenchido" }).waitFor();
  const finalIframe = page.locator('iframe[title="PDF gerado"]');
  await finalIframe.waitFor();
  const finalSrc = await finalIframe.getAttribute("src");
  assert(finalSrc, "Preview final não possui URL do PDF.");
  assert(finalSrc.startsWith("/api/files/generated-documents/"), `PDF final não usa rota autenticada: ${finalSrc}`);
  const finalPdfUrl = new URL(finalSrc, page.url()).toString();
  await assertPdfResponse(await page.request.get(finalPdfUrl), "PDF final autenticado");

  const guest = await request.newContext();
  try {
    const unauthenticatedPdf = await guest.get(finalPdfUrl);
    assert(unauthenticatedPdf.status() === 401, `PDF sem sessão deveria retornar 401, retornou ${unauthenticatedPdf.status()}.`);
  } finally {
    await guest.dispose();
  }

  // 12. Guia finalizada precisa ser realmente somente leitura.
  await page.goto(`/guias/${originalRequestId}`, { waitUntil: "networkidle" });
  await page.getByText("Guia finalizada e bloqueada para edição.", { exact: false }).waitFor();
  assert((await page.getByRole("button", { name: "Salvar rascunho" }).count()) === 0, "Guia finalizada ainda renderiza editor mutável.");

  // 13. Duplicar e editar a nova versão independentemente do original.
  await page.getByRole("button", { name: "Duplicar para nova versão" }).click();
  await page.waitForURL(/\/guias\/[^/]+$/, { timeout: 30_000 });
  const duplicateId = new URL(page.url()).pathname.split("/").filter(Boolean).at(-1);
  assert(duplicateId && duplicateId !== originalRequestId, "Duplicação não criou um novo ID independente.");
  await page.getByRole("button", { name: "2", exact: true }).click();
  const duplicateDiagnosisField = page.locator('textarea[placeholder^="Descreva o diagnóstico"]');
  await duplicateDiagnosisField.fill(duplicateDiagnosis);
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await page.getByText("Salvo", { exact: true }).waitFor();
  assert((await duplicateDiagnosisField.inputValue()) === duplicateDiagnosis, "Diagnóstico da duplicata não permaneceu editável/salvo.");

  // 14. O original continua finalizado e imutável após a edição da duplicata.
  await page.goto(`/guias/${originalRequestId}`, { waitUntil: "networkidle" });
  await page.getByText("Guia finalizada e bloqueada para edição.", { exact: false }).waitFor();
  await page.getByText("Lombalgia em avaliação para procedimento E2E.", { exact: true }).waitFor();
  assert((await page.getByText(duplicateDiagnosis, { exact: true }).count()) === 0, "Alteração da duplicata vazou para o documento histórico original.");

  console.log(JSON.stringify({
    ok: true,
    originalRequestId,
    duplicateId,
    finalPdfUrl,
    checks: [
      "login Firebase real",
      "criação de médico sintético",
      "criação de paciente sintético",
      "paciente/convênio/instituição/template",
      "CID-10 oficial",
      "busca manual de procedimento",
      "TUSS e IPASGO resolvidos",
      "quantidade editável",
      "justificativa",
      "preview temporário",
      "validação final server-side",
      "confirmação médica",
      "finalização",
      "PDF autenticado",
      "PDF bloqueado sem sessão",
      "guia finalizada somente leitura",
      "duplicação com novo ID",
      "edição independente da duplicata",
      "imutabilidade do original",
    ],
  }, null, 2));
} catch (error) {
  await page.screenshot({ path: "e2e-failure.png", fullPage: true }).catch(() => undefined);
  console.error(error);
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
