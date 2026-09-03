export function maskCpfForList(cpf: string | null | undefined): string {
  if (!cpf) return "—";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return "CPF protegido";
  return `***.***.***-${digits.slice(-2)}`;
}
