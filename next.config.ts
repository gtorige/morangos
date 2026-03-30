import type { NextConfig } from "next";
import { networkInterfaces } from "os";

// Auto-detect local IP addresses for dev origin access
function getLocalIPs(): string[] {
  const ips: string[] = [];
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

const nextConfig: NextConfig = {
  allowedDevOrigins: getLocalIPs(),
  serverExternalPackages: ["@libsql/client", "@prisma/adapter-libsql", "better-sqlite3"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
