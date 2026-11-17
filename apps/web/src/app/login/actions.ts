"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkAttempt } from "@/shared/auth/attempts";
import { loginDestination, SESSION_COOKIE } from "@/shared/auth/paths";
import {
  createSession,
  getCredentials,
  matchesPassword,
  sessionCookieOptions,
  sessionMaxAge,
  validPasswordLength,
} from "@/shared/auth/session";

export type LoginState = { error?: string };

export async function login(_previous: LoginState, data: FormData): Promise<LoginState> {
  const credentials = getCredentials();
  if (!credentials) return { error: "登录尚未配置，请联系管理员。" };

  const password = data.get("password");
  if (typeof password !== "string" || !validPasswordLength(password)) {
    return { error: "请输入 2 至 32 个字符。" };
  }

  const request = await headers();
  const client = request.get("x-forwarded-for")?.split(",", 1)[0].trim().slice(0, 120) || "unknown";
  const result = checkAttempt(client, () => matchesPassword(password, credentials.password));
  if (result === "limited") return { error: "尝试次数过多，请稍后再试。" };
  if (result === "rejected") return { error: "密码不正确，请重试。" };

  const store = await cookies();
  store.set(SESSION_COOKIE, createSession(credentials.signingKey), {
    ...sessionCookieOptions(request),
    maxAge: sessionMaxAge,
  });
  redirect(loginDestination(data.get("next")));
}
