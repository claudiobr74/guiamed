export function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/recuperar-senha") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico)$/.test(pathname)
  );
}

/** Só protege rotas privadas. Não redireciona /login → / só porque o cookie existe. */
export function middlewareLoginRedirect(pathname: string, hasSessionCookie: boolean): "/login" | null {
  if (!hasSessionCookie && !isPublicPath(pathname)) return "/login";
  return null;
}
