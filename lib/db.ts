import postgres from "postgres";

// One small connection pool per server instance.
// PORTAL_DATABASE_URL is the Neon "portal" database (set in Vercel).
let client: ReturnType<typeof postgres> | null = null;

export function db() {
  if (!client) {
    const url = process.env.PORTAL_DATABASE_URL;
    if (!url) throw new Error("PORTAL_DATABASE_URL is not set");
    client = postgres(url, { max: 1, idle_timeout: 20, prepare: false });
  }
  return client;
}
