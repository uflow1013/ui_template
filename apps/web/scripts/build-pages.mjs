import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const password = process.env.PAGES_PASSWORD;
if (!password) throw new Error("请设置 PAGES_PASSWORD（GitHub Actions 中使用同名 repository secret）。");
const passwordHash = createHash("sha256").update(password).digest("hex");
const env = {
  ...process.env,
  NEXT_PUBLIC_STATIC_EXPORT: "true",
  NEXT_PUBLIC_PREVIEW_PASSWORD_HASH: passwordHash,
};
delete env.PAGES_PASSWORD;
const result = spawnSync(process.execPath, [require.resolve("next/dist/bin/next"), "build"], {
  cwd: fileURLToPath(new URL("../", import.meta.url)),
  env,
  stdio: "inherit",
});

if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
