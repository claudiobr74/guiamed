import Link from "next/link";
import { Eye, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button, EmptyState, Field, Input, Select } from "@/components/ui";
import { requirePageUser } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { listPatientPage } from "@/lib/db/patient-page";
import { listInsurers } from "@/lib/db/repos";
import { maskCpfForList } from "@/lib/personal-data";
import { savePatientAction, searchPatientsAction } from "@/app/actions";

function formatBirthDate(value: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; q?: string }>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const cursor = params.cursor;
  const q = params.q?.trim() ?? "";
  const searchTooShort = q.length > 0 && q.length < 2;

  const insurers = await withOrganizationContext(user.organizationId, user.id, (db) =>
    listInsurers(db, user.organizationId),
  );

  const patientPage = searchTooShort
    ? { items: [], nextCursor: null }
    : q
      ? { items: await searchPatientsAction(q), nextCursor: null }
      : await withOrganizationContext(user.organizationId, user.id, (db) =>
          listPatientPage(db, user.organizationId, { cursor, limit: 50 }),
        );

  const patients = patientPage.items;
  const hasSearch = q.length > 0;

  return (
    <AppShell user={user} title="Pacientes">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <form className="relative w-full max-w-[400px]" action="/pacientes">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" size={16} />
          <input
            aria-label="Buscar pacientes"
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome, CPF ou carteirinha..."
            className="h-[41px] w-full rounded-lg border border-[#e2e8f0] bg-white pl-9 pr-3 text-[13px] text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#1e5fa6]"
          />
        </form>

        <details className="group relative shrink-0">
          <summary className="inline-flex cursor-pointer list-none items-center justify-center rounded-lg bg-[#1e5fa6] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#184e89] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e5fa6] focus-visible:ring-offset-2">
            + Novo paciente
          </summary>
          <div className="mt-3 w-full rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-xl sm:absolute sm:right-0 sm:z-20 sm:w-[420px]">
            <div className="mb-4">
              <h2 className="text-[15px] font-bold text-[#0f172a]">Novo paciente</h2>
              <p className="mt-1 text-[12px] text-[#64748b]">Cadastre apenas os dados necessários para a solicitação.</p>
            </div>
            <form
              action={async (formData) => {
                "use server";
                await savePatientAction({
                  fullName: String(formData.get("fullName")),
                  birthDate: String(formData.get("birthDate") || "") || null,
                  cpf: String(formData.get("cpf") || "") || null,
                  sex: (String(formData.get("sex") || "") || null) as "F" | "M" | "I" | null,
                  phone: String(formData.get("phone") || "") || null,
                  email: String(formData.get("email") || "") || null,
                  insuranceCard: String(formData.get("insuranceCard") || "") || null,
                  healthInsurerId: String(formData.get("healthInsurerId") || "") || null,
                });
              }}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              <div className="sm:col-span-2"><Field label="Nome completo"><Input name="fullName" required /></Field></div>
              <Field label="Nascimento"><Input name="birthDate" type="date" /></Field>
              <Field label="Sexo">
                <Select name="sex" defaultValue="">
                  <option value="">Não informado</option>
                  <option value="F">Feminino</option>
                  <option value="M">Masculino</option>
                  <option value="I">Indeterminado / outro registro</option>
                </Select>
              </Field>
              <Field label="CPF"><Input name="cpf" inputMode="numeric" /></Field>
              <Field label="Telefone"><Input name="phone" inputMode="tel" /></Field>
              <div className="sm:col-span-2"><Field label="E-mail"><Input name="email" type="email" /></Field></div>
              <Field label="Carteirinha"><Input name="insuranceCard" /></Field>
              <Field label="Convênio">
                <Select name="healthInsurerId" defaultValue="">
                  <option value="">Nenhum</option>
                  {insurers.filter((insurer) => insurer.active).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </Select>
              </Field>
              <div className="sm:col-span-2 flex justify-end pt-1"><Button type="submit">Cadastrar paciente</Button></div>
            </form>
          </div>
        </details>
      </div>

      {searchTooShort ? (
        <p role="status" className="mb-4 rounded-lg bg-[#eff6ff] px-3 py-2 text-[12px] text-[#1e5fa6]">
          Digite pelo menos 2 caracteres para pesquisar pacientes.
        </p>
      ) : null}

      {patients.length === 0 && !cursor ? (
        <EmptyState
          title={hasSearch ? "Nenhum paciente encontrado" : "Nenhum paciente cadastrado"}
          description={
            hasSearch
              ? "Nenhum paciente corresponde à busca atual. Confira o nome, CPF ou carteirinha."
              : "Cadastre seus pacientes para agilizar o preenchimento de novas guias de procedimento cirúrgico."
          }
          icon="empty-user"
          action={hasSearch ? <Link href="/pacientes" className="text-[12px] font-semibold text-[#1e5fa6]">Limpar busca</Link> : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3">
            <p className="text-[12px] text-[#64748b]">
              {hasSearch ? `Até ${patients.length} resultados da busca.` : "Exibindo até 50 pacientes por página."} O CPF permanece mascarado nesta listagem.
            </p>
            {(cursor || hasSearch) ? <Link href="/pacientes" className="shrink-0 text-[12px] font-semibold text-[#1e5fa6] hover:underline">Limpar / início</Link> : null}
          </div>
          {patients.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[#64748b]">Não há mais pacientes nesta paginação.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-[12px]">
                <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#475569]">
                  <tr>
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">CPF</th>
                    <th className="px-4 py-3">Nascimento</th>
                    <th className="px-4 py-3">Convênio</th>
                    <th className="px-4 py-3">Carteirinha</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((patient) => (
                    <tr key={patient.id} className="border-t border-[#e2e8f0]">
                      <td className="px-4 py-3 font-semibold text-[#0f172a]">{patient.fullName}</td>
                      <td className="px-4 py-3 text-[#475569]">{maskCpfForList(patient.cpf)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[#475569]">{formatBirthDate(patient.birthDate)}</td>
                      <td className="px-4 py-3 text-[#475569]">{patient.healthInsurerName ?? "—"}</td>
                      <td className="px-4 py-3 text-[#475569]">{patient.insuranceCard ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/pacientes/${patient.id}`}
                          className="inline-flex size-8 items-center justify-center rounded-md text-[#475569] hover:bg-[#eff6ff] hover:text-[#1e5fa6]"
                          aria-label={`Abrir cadastro de ${patient.fullName}`}
                          title="Abrir cadastro"
                        >
                          <Eye size={16} aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!hasSearch && patientPage.nextCursor ? (
            <div className="flex justify-end border-t border-[#e2e8f0] p-4">
              <Link
                href={`/pacientes?cursor=${encodeURIComponent(patientPage.nextCursor)}`}
                className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-[12px] font-semibold text-[#1e5fa6] hover:bg-[#eff6ff]"
              >
                Próximos 50
              </Link>
            </div>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}
