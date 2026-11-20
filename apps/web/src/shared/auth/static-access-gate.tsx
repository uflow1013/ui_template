"use client";

import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { hasStaticAccess, STATIC_ACCESS_EVENT, staticLoginHref } from "./static-access";

function subscribe(onChange: () => void) {
  window.addEventListener(STATIC_ACCESS_EVENT, onChange);
  window.addEventListener("pageshow", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(STATIC_ACCESS_EVENT, onChange);
    window.removeEventListener("pageshow", onChange);
    window.removeEventListener("storage", onChange);
  };
}

function BrowserAccessGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname.replace(/\/$/, "") === "/login";
  const unlocked = useSyncExternalStore(subscribe, hasStaticAccess, () => false);

  useEffect(() => {
    // Hydration starts with the locked server snapshot; read the actual session before redirecting.
    if (isLogin || hasStaticAccess()) return;
    window.location.replace(staticLoginHref(window.location.pathname + window.location.search + window.location.hash));
  }, [isLogin, pathname, unlocked]);

  if (isLogin || unlocked) return children;

  return <main className="grid h-dvh place-items-center px-5 text-sm text-[var(--text-secondary)]">
    <p role="status">正在打开登录页面…</p>
    <noscript>请启用 JavaScript 后登录。</noscript>
  </main>;
}

export function StaticAccessGate({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_STATIC_EXPORT !== "true") return children;
  return <BrowserAccessGate>{children}</BrowserAccessGate>;
}
