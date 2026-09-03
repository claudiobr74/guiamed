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

const baseUrl = process.env.E2E_BASE_URL?.trim() || "http://127.0.0.1:3000";
const email = required("E2E_USER_EMAIL");
const password = required("E2E_USER_PASSWORD");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ baseURL: baseUrl });
const page = await context.newPage();
page.setDefaultTimeout(20_000);

try {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
  await page.getByRole("button", { name: "+ Nova guia" }).click();
  await page.waitForURL(/\/guias\/[^/]+$/, { timeout: 30_000 });

  const patientSearch = page.locator('input[placeholder="Nome ou CPF"]');
  await patientSearch.fill("Paciente E2E GuiaMed");
  await page.getByRole("button", { name: /Paciente E2E GuiaMed/ }).first().click();
  await selectOptionContaining(page, "Hospital E2E");
  await selectOptionContaining(page, "Dr. E2E GuiaMed");

  const templateSelects = page.locator("select");
  let templateResolved = false;
  for (let index = 0; index < await templateSelects.count(); index += 1) {
    const text = await templateSelects.nth(index).locator("option:checked").textContent().catch(() => null);
    if (text?.includes("Template E2E GuiaMed")) templateResolved = true;
  }
  assert(templateResolved, "Template E2E não foi resolvido automaticamente para instituição/convênio.");

  await page.getByRole("button", { name: "Avançar" }).click();
  await page.locator('textarea[placeholder^="Descreva o diagnóstico"]').fill("Lombalgia em avaliação para procedimento E2E.");
  const cidSearch = page.locator('input[placeholder="Pesquisar diagnóstico ou CID..."]');
  await cidSearch.fill("M54.5");
  await page.getByRole("button", { name: /M54\.5/ }).first().click();
  await page.getByRole("button", { name: "Avançar" }).click();

  await page.getByRole("button", { name: "+ Usar kit cirúrgico" }).click();
  await page.getByRole("button", { name: /Kit E2E GuiaMed/ }).first().click();
  await page.getByRole("button", { name: "Usar kit selecionado" }).click();
  await page.getByText("Procedimento E2E GuiaMed", { exact: true }).first().waitFor();

  const quantity = page.locator('input[aria-label="Quantidade"]').first();
  await quantity.fill("3");
  assert((await quantity.inputValue()) === "3", "Quantidade do procedimento não foi atualizada para 3.");
  await page.getByRole("button", { name: "Avançar" }).click();

  await page.locator('textarea[placeholder^="Use o painel lateral"]').fill(
    "Paciente com indicação clínica documentada para o procedimento selecionado. Justificativa E2E sem dados inventados.",
  );
  await page.getByRole("button", { name: "Avançar" }).click();

  await page.getByText("Paciente E2E GuiaMed", { exact: true }).first().waitFor();
  await page.getByText(/M54\.5/).first().waitFor();
  await page.getByText(/Procedimento E2E GuiaMed — qtd 3/).waitFor();

  await page.getByRole("button", { name: "Finalizar e gerar PDF" }).click();
  await page.getByRole("heading", { name: "Gerar guia?" }).waitFor();
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: "Gerar PDF" }).click();
  await page.waitForURL(/\/guias\/[^/]+\/preview\?doc=/, { timeout: 60_000 });

  await page.getByRole("heading", { name: "PDF preenchido" }).waitFor();
  const iframe = page.locator('iframe[title="PDF gerado"]');
  await iframe.waitFor();
  const src = await iframe.getAttribute("src");
  assert(src, "Preview final não possui URL do PDF.");
  assert(src.startsWith("/api/files/generated-documents/"), `PDF final não usa rota autenticada: ${src}`);

  const pdfUrl = new URL(src, page.url()).toString();
  const authenticatedPdf = await page.request.get(pdfUrl);
  assert(authenticatedPdf.status() === 200, `PDF autenticado retornou ${authenticatedPdf.status()}.`);
  assert(
    (authenticatedPdf.headers()["content-type"] || "").includes("application/pdf"),
    "Rota autenticada não retornou application/pdf.",
  );
  assert((await authenticatedPdf.body()).byteLength > 500, "PDF final parece vazio ou inválido.");

  const guest = await request.newContext();
  try {
    const unauthenticatedPdf = await guest.get(pdfUrl);
    assert(unauthenticatedPdf.status() === 401, `PDF sem sessão deveria retornar 401, retornou ${unauthenticatedPdf.status()}.`);
  } finally {
    await guest.dispose();
  }

  console.log(JSON.stringify({
    ok: true,
    finalUrl: page.url(),
    pdfUrl,
    checks: [
      "login Firebase real",
      "paciente/convênio/instituição",
      "CID-10 oficial",
      "kit e quantidade",
      "justificativa",
      "confirmação médica",
      "finalização",
      "PDF autenticado",
      "PDF bloqueado sem sessão",
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
