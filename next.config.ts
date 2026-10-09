import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Pin the workspace root to this project. Without this, Next walks up and
// adopts any parent folder that has a lockfile as the "workspace root", which
// nests the standalone output (`.next/standalone/<subdir>/server.js`) and
// breaks `npm start` for anyone who clones OpenSocial inside another project.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: projectRoot,
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
