import type { NextConfig } from "next";
import path from "node:path";

// Allow images from ligneous-frontend (set NEXT_PUBLIC_LIGNOUS_FRONTEND_URL)
const ligneousUrl = process.env.NEXT_PUBLIC_LIGNOUS_FRONTEND_URL;
const remotePatterns: Array<{ protocol: "http" | "https"; hostname: string; port?: string; pathname: string }> = [
  { protocol: "http", hostname: "localhost", port: "4000", pathname: "/**" },
];
if (ligneousUrl) {
  try {
    const u = new URL(ligneousUrl);
    const proto = u.protocol.replace(":", "") as "http" | "https";
    if (proto === "http" || proto === "https") {
      remotePatterns.push({
        protocol: proto,
        hostname: u.hostname,
        ...(u.port && { port: u.port }),
        pathname: "/**",
      });
    }
  } catch {
    // Invalid URL, skip
  }
}

// App directory as root: Turbopack can resolve `next` from here; `@ligneous/prisma` comes from
// `node_modules` (`file:../packages/...`). For dev, use `npm run dev` (webpack) — Turbopack in a
// sibling-package layout is fragile; use `npm run dev:turbopack` if you want to experiment.
const projectRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
  transpilePackages: ["@ligneous/prisma", "@ligneous/album-view", "@ligneous/album-generated-queries"],
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,
  images: { remotePatterns },
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
