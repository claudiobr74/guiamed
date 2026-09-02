export function toUserFacingAuthError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/SESSION_SECRET/.test(message)) {
    return "A sessão do servidor não está configurada. Defina SESSION_SECRET nas variáveis da Vercel.";
  }
  if (/NEXT_PUBLIC_FIREBASE_API_KEY/.test(message)) {
    return "A chave Web do Firebase não está configurada (NEXT_PUBLIC_FIREBASE_API_KEY).";
  }
  if (/FIREBASE_SERVICE_ACCOUNT não é um JSON/.test(message)) {
    return message;
  }
  if (/NOT_FOUND|5 NOT_FOUND|database \(default\) does not exist|does not exist for project/i.test(message)) {
    return "O Firestore do projeto guiamed-918ee não está disponível. Crie o banco (default) no console do Firebase.";
  }
  if (/E-mail ou senha inválidos|Já existe um usuário|Informe o e-mail/.test(message)) {
    return message;
  }
  if (/credential|invalid_grant|DECODER|Could not load the default credentials|FIREBASE/i.test(message)) {
    return "Credencial Admin do Firebase inválida. Confira FIREBASE_SERVICE_ACCOUNT na Vercel (JSON inteiro da conta de serviço).";
  }
  return "Não foi possível entrar. Tente de novo.";
}
