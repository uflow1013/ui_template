import type { Metadata } from "next";
import { StaticLoginForm } from "@/shared/auth/static-login-form";

export const metadata: Metadata = { title: "登录 · 澄序", robots: { index: false, follow: false } };

export default function StaticLoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center overflow-y-auto px-5 py-10">
      <section
        className="grid w-full max-w-[25rem] gap-7 rounded-[var(--radius-surface)] border border-border bg-surface px-6 py-8 sm:px-8"
        aria-labelledby="login-title"
      >
        <header className="grid justify-items-start gap-3">
          <span
            className="grid size-9 place-items-center rounded-full bg-[var(--foreground)] text-sm font-medium text-[var(--background)]"
            aria-hidden="true"
          >
            澄
          </span>
          <h1 id="login-title" className="text-[length:var(--text-2xl)] font-medium">
            登录澄序
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">输入密码访问设计系统。</p>
        </header>
        <StaticLoginForm />
      </section>
    </main>
  );
}
