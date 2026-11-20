const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") ?? "";
const passwordHash = process.env.NEXT_PUBLIC_PREVIEW_PASSWORD_HASH ?? "";
const sessionKey = `chengxu_preview_access:${basePath || "/"}`;
export const STATIC_ACCESS_EVENT = "chengxu-preview-access";

export function hasStaticAccess() {
  if (typeof window === "undefined" || !/^[a-f0-9]{64}$/.test(passwordHash)) return false;
  try {
    return window.sessionStorage.getItem(sessionKey) === passwordHash;
  } catch {
    return false;
  }
}

export async function unlockStaticAccess(password: string) {
  if (!/^[a-f0-9]{64}$/.test(passwordHash)) throw new Error("访问密码尚未配置，请联系管理员。");
  const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  const candidate = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
  if (candidate !== passwordHash) return false;
  try {
    window.sessionStorage.setItem(sessionKey, passwordHash);
  } catch {
    throw new Error("请允许此站点使用会话存储后重试。");
  }
  window.dispatchEvent(new Event(STATIC_ACCESS_EVENT));
  return true;
}

export function clearStaticAccess() {
  try {
    window.sessionStorage.removeItem(sessionKey);
  } catch {
    // An unavailable store already counts as a locked session.
  }
  window.dispatchEvent(new Event(STATIC_ACCESS_EVENT));
}

/** Keep return links inside this Pages site, including when it has a base path. */
export function staticDestination(value: unknown) {
  const home = `${basePath}/`;
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return home;
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return home;
  try {
    const url = new URL(value, "https://chengxu.invalid");
    const pathname = decodeURIComponent(url.pathname);
    if (url.origin !== "https://chengxu.invalid" || pathname.includes("\\") || pathname.startsWith("//")) return home;
    if (basePath && pathname !== basePath && !pathname.startsWith(`${basePath}/`)) return home;
    const route = pathname.slice(basePath.length).replace(/\/$/, "") || "/";
    if (route === "/login" || route === "/api" || route.startsWith("/api/") || route.startsWith("/_next/")) return home;
    return url.pathname + url.search + url.hash;
  } catch {
    return home;
  }
}

export function staticLoginHref(destination?: string) {
  const next = staticDestination(destination);
  const login = `${basePath}/login/`;
  return next === `${basePath}/` ? login : `${login}?next=${encodeURIComponent(next)}`;
}
