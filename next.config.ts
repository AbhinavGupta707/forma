import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev badge sits on top of the bottom tab bar.
  devIndicators: false,
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
