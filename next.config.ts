import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PostgreSQL 드라이버는 서버 번들에서 제외한다.
  serverExternalPackages: ["postgres"],
  poweredByHeader: false,
};

export default nextConfig;
