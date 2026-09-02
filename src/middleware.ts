import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/cookie";
import { middlewareLoginRedirect } from "@/lib/auth/paths";

export function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const login = middlewareLoginRedirect(request.nextUrl.pathname, hasSession);
  if (login) {
    return NextResponse.redirect(new URL(login, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
