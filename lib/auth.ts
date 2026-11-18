// Sign-in for school staff (Better Auth, email + password).
// Users live in our own "portal" database (tables auth_*). Authentication only
// says WHO the person is; what they may edit comes from school_staff (see
// lib/staff.ts). There is no public sign-up: accounts are created by us and
// the person chooses their password through a one-time link.
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";

const ts = { createdAt: "created_at", updatedAt: "updated_at" };

function createAuth() {
  const url = process.env.PORTAL_DATABASE_URL;
  if (!url) throw new Error("PORTAL_DATABASE_URL is not set");
  return betterAuth({
    appName: "School Portal",
    secret: process.env.BETTER_AUTH_SECRET,
    // Any host of this deployment (vercel.app aliases, later the school's domain).
    baseURL: process.env.BETTER_AUTH_URL ?? {
      allowedHosts: ["localhost:*", "127.0.0.1:*", "*.vercel.app", ...(process.env.AUTH_HOSTS ?? "").split(",").filter(Boolean)],
      protocol: process.env.NODE_ENV === "production" ? "https" : "http",
    },
    database: new Pool({ connectionString: url, max: 1, idleTimeoutMillis: 20_000 }),
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 10, maxPasswordLength: 128 },
    user: { modelName: "auth_user", fields: { emailVerified: "email_verified", ...ts } },
    session: {
      modelName: "auth_session",
      fields: { expiresAt: "expires_at", ipAddress: "ip_address", userAgent: "user_agent", userId: "user_id", ...ts },
      expiresIn: 60 * 60 * 12, // signed out after 12 hours
      updateAge: 60 * 60,
    },
    account: {
      modelName: "auth_account",
      fields: {
        accountId: "account_id", providerId: "provider_id", userId: "user_id",
        accessToken: "access_token", refreshToken: "refresh_token", idToken: "id_token",
        accessTokenExpiresAt: "access_token_expires_at", refreshTokenExpiresAt: "refresh_token_expires_at", ...ts,
      },
    },
    verification: { modelName: "auth_verification", fields: { expiresAt: "expires_at", ...ts } },
    advanced: { cookiePrefix: "portal", useSecureCookies: process.env.NODE_ENV === "production" },
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;
const g = globalThis as unknown as { __portalAuth?: Auth };

export function auth(): Auth {
  if (!g.__portalAuth) g.__portalAuth = createAuth();
  return g.__portalAuth;
}
