export const SESSION_COOKIE = "chengxu_session";
export const LOGIN_PATH = "/login/";
export const LOGOUT_PATH = "/api/auth/logout/";

const returnOrigin = "https://chengxu.invalid";

export function loginDestination(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.includes("\\") || [...value].some((character) => character.charCodeAt(0) < 32)) return "/";

  try {
    const destination = new URL(value, returnOrigin);
    const pathname = decodeURIComponent(destination.pathname).replace(/\/$/, "");
    if (
      destination.origin !== returnOrigin ||
      pathname.startsWith("//") ||
      pathname.includes("\\") ||
      pathname === "/login" ||
      pathname === "/api" ||
      pathname.startsWith("/api/") ||
      pathname.startsWith("/_next/")
    ) return "/";
    return destination.pathname + destination.search + destination.hash;
  } catch {
    return "/";
  }
}
