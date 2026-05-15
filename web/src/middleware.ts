import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ACCESS_CODE = process.env.ACCESS_CODE ?? "edutech2026";
const COOKIE = "site_access";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/gate") || pathname.startsWith("/api/gate")) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(COOKIE);
  if (cookie?.value === ACCESS_CODE) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/gate";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
