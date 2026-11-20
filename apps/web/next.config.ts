import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") ?? "";
const staticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true";

const nextConfig: NextConfig = {
  output: staticExport ? "export" : undefined,
  // Each mode has its own login page; server sessions and Proxy stay server-only.
  pageExtensions: staticExport
    ? ["static.tsx", "static.ts", "tsx", "ts", "jsx", "js"]
    : ["server.tsx", "server.ts", "tsx", "ts", "jsx", "js"],
  trailingSlash: true,
  basePath,
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@template/design-tokens"],
};

export default nextConfig;
