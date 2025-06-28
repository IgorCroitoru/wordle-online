import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  
  // Note: Telemetry is disabled via environment variable NEXT_TELEMETRY_DISABLED=1
};

export default nextConfig;
