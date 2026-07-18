import path from "node:path";

export type AppConfig = {
  port: number;
  dataDir: string;
  databasePath: string;
  adminUsername: string;
  adminPasswordHash?: string;
  adminPassword?: string;
  sessionSecret: string;
  cookieSecure: boolean;
  isProduction: boolean;
  trustProxyHops: number;
};

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const isProduction = overrides.isProduction ?? process.env.NODE_ENV === "production";
  const configuredDataDir = overrides.dataDir ?? process.env.DATA_DIR ?? "data";
  const dataDir = path.isAbsolute(configuredDataDir)
    ? configuredDataDir
    : path.resolve(process.env.APP_ROOT ?? process.cwd(), configuredDataDir);
  const sessionSecret = overrides.sessionSecret ?? process.env.SESSION_SECRET ?? (isProduction ? "" : "development-only-session-secret-change-me");
  const adminPasswordHash = overrides.adminPasswordHash ?? process.env.ADMIN_PASSWORD_HASH;
  const adminPassword = overrides.adminPassword ?? process.env.ADMIN_PASSWORD;

  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET musi zawierać co najmniej 32 znaki.");
  }
  if (!adminPasswordHash && !adminPassword) {
    throw new Error("Ustaw ADMIN_PASSWORD_HASH albo ADMIN_PASSWORD.");
  }

  return {
    port: overrides.port ?? Number(process.env.PORT ?? 3000),
    dataDir,
    databasePath: overrides.databasePath ?? path.join(dataDir, "podchody.sqlite"),
    adminUsername: overrides.adminUsername ?? process.env.ADMIN_USERNAME ?? "admin",
    adminPasswordHash,
    adminPassword,
    sessionSecret,
    cookieSecure: overrides.cookieSecure ?? process.env.COOKIE_SECURE === "true",
    isProduction,
    trustProxyHops: overrides.trustProxyHops ?? Number(process.env.TRUST_PROXY_HOPS ?? (isProduction ? 1 : 0)),
  };
}
