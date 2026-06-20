import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Walrus Sites serves static files; trailingSlash makes /app/trust map to /app/trust/index.html
  trailingSlash: true,
  // Sui RPC clients sometimes lazy-load wasm; keep image opt off for static export
  images: { unoptimized: true },
};

export default nextConfig;
