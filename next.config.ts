import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false, // CLAUDE.md already covers this; stops next dev from generating AGENTS.md
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
