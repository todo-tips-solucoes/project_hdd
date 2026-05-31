import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build "standalone": gera um server.js mínimo com só as deps usadas,
  // para uma imagem Docker enxuta (Story 5.1).
  output: "standalone",
};

export default nextConfig;
