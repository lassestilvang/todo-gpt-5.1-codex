const requiredEnv = ["DATABASE_URL"] as const;

type RequiredEnv = (typeof requiredEnv)[number];

function readEnv(name: RequiredEnv, fallback?: string) {
  if (process.env[name]) {
    return process.env[name] as string;
  }

  if (fallback) {
    return fallback;
  }

  throw new Error(`Missing required env var: ${name}`);
}

export const env = {
  databaseUrl: readEnv("DATABASE_URL", "sqlite.db"),
};
