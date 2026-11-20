"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert } from "@/shared/arc/alert/alert";
import { Button } from "@/shared/arc/button/button";
import { PasswordField } from "@/shared/arc/password-field/password-field";
import { hasStaticAccess, staticDestination, unlockStaticAccess } from "./static-access";

function destination() {
  return staticDestination(new URLSearchParams(window.location.search).get("next"));
}

export function StaticLoginForm() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);

  useEffect(() => {
    if (hasStaticAccess()) window.location.replace(destination());
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;

    const password = new FormData(event.currentTarget).get("password");
    if (typeof password !== "string") return;

    submitting.current = true;
    setPending(true);
    setError("");

    try {
      if (await unlockStaticAccess(password)) {
        window.location.replace(destination());
        return;
      }
      setError("密码不正确，请重试。");
    } catch {
      setError("暂时无法登录，请稍后重试。");
    }

    submitting.current = false;
    setPending(false);
    field.current?.focus();
    field.current?.select();
  }

  return (
    <form onSubmit={handleSubmit} method="post" className="grid gap-5" aria-busy={pending}>
      <PasswordField
        ref={field}
        label="密码"
        name="password"
        autoComplete="current-password"
        placeholder="输入访问密码"
        messages={{ showPassword: "显示密码", hidePassword: "隐藏密码" }}
        required
        disabled={pending}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "login-error" : undefined}
        onChange={() => { if (error) setError(""); }}
      />
      {error && <Alert id="login-error" title={error} tone="danger" />}
      <Button type="submit" size="lg" loading={pending}>
        登录
      </Button>
    </form>
  );
}
