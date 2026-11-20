import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") ?? "";
const staticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true";

const nextConfig: NextConfig = {
  output: staticExport ? "export" : undefined,
  // Keep authentication routes and Proxy out of the public static export.
  pageExtensions: staticExport
    ? ["tsx", "ts", "jsx", "js"]
    : ["server.tsx", "server.ts", "tsx", "ts", "jsx", "js"],
  trailingSlash: true,
  basePath,
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@template/design-tokens"],
};

export default nextConfig;
