import { type NextRequest, NextResponse } from "next/server";
import { LOGIN_PATH, LOGOUT_PATH, SESSION_COOKIE } from "@/shared/auth/paths";
import { hasSession } from "@/shared/auth/session";

export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const pathname = url.pathname.replace(/\/$/, "") || "/";
  const isPublic = pathname === LOGIN_PATH.slice(0, -1) || pathname === LOGOUT_PATH.slice(0, -1);
  if (isPublic || hasSession(request.cookies.get(SESSION_COOKIE)?.value)) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  const responseHeaders = { "Cache-Control": "private, no-store" };
  const isRead = request.method === "GET" || request.method === "HEAD";
  const isApi = pathname === "/api" || pathname.startsWith("/api/");
  if (!isRead || isApi) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401, headers: responseHeaders });
  }

  const login = url.clone();
  login.pathname = LOGIN_PATH;
  login.search = "";
  const destination = url.clone();
  destination.searchParams.delete("_rsc");
  if (pathname !== "/" || destination.search) {
    login.searchParams.set("next", destination.pathname + destination.search);
  }
  return NextResponse.redirect(login, { headers: responseHeaders });
}

export const config = {
  matcher: ["/((?!_next/static(?:/|$)|_next/image(?:/|$)|_next/(?:webpack-hmr|hmr)(?:/|$)|favicon\\.ico$).*)"],
};
