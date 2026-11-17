import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { chmod, mkdir, open, appendFile, unlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";

const require = createRequire(import.meta.url);
const nextPackage = require.resolve("next/package.json");
const { loadEnvConfig } = createRequire(nextPackage)("@next/env");
const app = fileURLToPath(new URL("../", import.meta.url));
const [command, ...args] = process.argv.slice(2);

async function lockEnvFile() {
  const cacheDir = join(app, "node_modules", ".cache");
  await mkdir(cacheDir, { recursive: true });
  const path = join(cacheDir, "chengxu-env.lock");
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const lock = await open(path, "wx", 0o600);
      return async () => {
        await lock.close();
        await unlink(path);
      };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      await setTimeout(100);
    }
  }
  throw new Error("等待登录配置超时。请检查 node_modules/.cache/chengxu-env.lock。");
}

function readCredentials(reload = false) {
  loadEnvConfig(app, command === "dev", {
    info() {},
    error() { throw new Error("无法读取 Web 环境变量配置。"); },
  }, reload);

  const password = process.env.CHENGXU_PASSWORD;
  const secret = process.env.CHENGXU_SESSION_SECRET;
  if (password !== undefined && ([...password].length < 2 || [...password].length > 32)) {
    throw new Error("CHENGXU_PASSWORD 长度须为 2 至 32 个字符。");
  }
  if (secret !== undefined && !/^[A-Za-z0-9_-]{43,128}$/.test(secret)) {
    throw new Error("CHENGXU_SESSION_SECRET 须为至少 32 字节的 Base64URL 密钥。");
  }
  return { password, secret };
}

async function configure() {
  const existing = readCredentials();
  if (existing.password !== undefined && existing.secret !== undefined) return;

  const unlock = await lockEnvFile();
  try {
    const { password, secret } = readCredentials(true);
    const settings = [];
    if (password === undefined) settings.push(`CHENGXU_PASSWORD=${randomBytes(18).toString("base64url")}`);
    if (secret === undefined) settings.push(`CHENGXU_SESSION_SECRET=${randomBytes(32).toString("base64url")}`);
    if (!settings.length) return;

    const envFile = join(app, ".env.local");
    await appendFile(envFile, `\n${settings.join("\n")}\n`, { mode: 0o600 });
    await chmod(envFile, 0o600);
    console.log(
      password === undefined
        ? "已在 apps/web/.env.local 生成登录密码（CHENGXU_PASSWORD）。"
        : "已在 apps/web/.env.local 生成会话签名密钥。",
    );
  } finally {
    await unlock();
  }
}

try {
  if (command !== "dev" && command !== "start") throw new Error("仅支持 dev 或 start。");
  const env = { ...process.env };
  delete env.__NEXT_PROCESSED_ENV;
  await configure();
  const next = spawn(process.execPath, [join(dirname(nextPackage), "dist/bin/next"), command, ...args], {
    cwd: app,
    env,
    stdio: "inherit",
  });
  process.on("SIGINT", () => next.kill("SIGINT"));
  process.on("SIGTERM", () => next.kill("SIGTERM"));
  next.on("error", () => {
    console.error("无法启动 Next.js。");
    process.exitCode = 1;
  });
  next.on("close", (code, signal) => {
    process.exitCode = code ?? (signal === "SIGINT" ? 130 : 1);
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
