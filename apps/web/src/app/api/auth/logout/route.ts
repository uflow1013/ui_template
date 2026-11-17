import { type NextRequest, NextResponse } from "next/server";
import { LOGIN_PATH, SESSION_COOKIE } from "@/shared/auth/paths";
import { requestHost, sessionCookieOptions } from "@/shared/auth/session";

function isSameOrigin(request: NextRequest) {
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site" || site === "same-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return ["http:", "https:"].includes(url.protocol) && url.host === requestHost(request.headers);
  } catch {
    return false;
  }
}

export function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "拒绝跨站请求。" }, { status: 403 });
  }

  const response = new NextResponse(null, {
    status: 303,
    headers: {
      "Cache-Control": "private, no-store",
      Location: request.nextUrl.basePath + LOGIN_PATH,
    },
  });
  response.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(request.headers),
    maxAge: 0,
  });
  return response;
}
