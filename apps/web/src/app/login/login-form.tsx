"use client";

import { useActionState, useEffect, useRef } from "react";
import { Alert } from "@/shared/arc/alert/alert";
import { Button } from "@/shared/arc/button/button";
import { PasswordField } from "@/shared/arc/password-field/password-field";
import { login } from "./actions";

export function LoginForm({ destination }: { destination: string }) {
  const [state, action, pending] = useActionState(login, {});
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (state.error && !pending) field.current?.focus();
  }, [state, pending]);

  return (
    <form action={action} className="grid gap-5" aria-busy={pending}>
      <input type="hidden" name="next" value={destination} />
      <PasswordField
        ref={field}
        label="密码"
        name="password"
        autoComplete="current-password"
        autoFocus={Boolean(state.error)}
        description="支持 2 至 32 个字符"
        messages={{ showPassword: "显示密码", hidePassword: "隐藏密码" }}
        required
        disabled={pending}
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "login-error" : undefined}
      />
      {state.error && <Alert id="login-error" title={state.error} tone="danger" />}
      <Button type="submit" size="lg" disabled={pending} loading={pending}>
        登录
      </Button>
    </form>
  );
}
