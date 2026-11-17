// The St. Mary app API (/api/app/v1/*): one school, family accounts only.
//
// The web app sends the Better Auth session cookie (same origin); the native
// app sends "Authorization: Bearer <token>" (bearer plugin). Either way the
// session is checked on the server and the viewer comes from loadViewer(), so
// the school and the family's grades are never taken from the request.
import 'server-only';
import { ZodError } from 'zod';
import { auth } from '../auth/auth';
import { ValidationError } from '../errors';
import { AuthorizationError } from '../rbac/authorize';
import { getPortalView } from '../request';
import { findTenantByKey, isServable } from '../tenancy/tenants';
import { loadViewer, type Viewer } from '../viewer';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

export type FamilyViewer = Extract<Viewer, { kind: 'family' }>;

/** The single school this deployment serves (APP_TENANT_KEY, "stmary" by default). */
export async function appTenant() {
  const tenant = await findTenantByKey(process.env.APP_TENANT_KEY ?? 'stmary');
  if (!tenant || !isServable(tenant)) throw new ApiError(503, 'The portal is not available right now. Please contact the school office.', 'unavailable');
  return tenant;
}

export async function familyContext(req: Request) {
  const tenant = await appTenant();
  const session = await auth().api.getSession({ headers: req.headers });
  if (!session) throw new ApiError(401, 'Please sign in again.', 'signed_out');
  const viewer = await loadViewer(tenant.id, session.user.id);
  if (viewer.kind === 'staff') throw new ApiError(403, 'This app is for St. Mary families. Staff: use the school admin on the web.', 'staff');
  if (viewer.kind !== 'family') throw new ApiError(403, "Your account isn't linked to a St. Mary family yet. If you asked to join, the office still has to approve it.", 'not_family');
  const view = await getPortalView(tenant.id);
  const modules = new Set(view.activeModules.map((m) => m.id));
  return { tenant, viewer: viewer as FamilyViewer, session, view, modules };
}

export type FamilyContext = Awaited<ReturnType<typeof familyContext>>;

export function requireModule(c: FamilyContext, id: string) {
  if (!c.modules.has(id)) throw new ApiError(404, 'This is not available at your school.', 'module_off');
}

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/** Wraps a route: JSON out, and errors mapped to status codes with a message the app can show. */
export function route<C>(fn: (req: Request, ctx: C) => Promise<unknown>) {
  return async (req: Request, ctx: C) => {
    try {
      const body = await fn(req, ctx);
      return Response.json(body ?? { ok: true }, { headers: NO_STORE });
    } catch (err) {
      if (err instanceof ApiError) return Response.json({ error: err.message, code: err.code }, { status: err.status, headers: NO_STORE });
      if (err instanceof ValidationError) return Response.json({ error: err.message, code: 'invalid' }, { status: 422, headers: NO_STORE });
      if (err instanceof AuthorizationError) return Response.json({ error: err.message, code: 'forbidden' }, { status: 403, headers: NO_STORE });
      if (err instanceof ZodError) return Response.json({ error: err.issues[0]?.message ?? 'Check the form and try again.', code: 'invalid' }, { status: 422, headers: NO_STORE });
      console.error('app api', err);
      return Response.json({ error: 'Something went wrong. Please try again or call the office.', code: 'server' }, { status: 500, headers: NO_STORE });
    }
  };
}

export async function jsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : {};
  } catch {
    throw new ApiError(400, 'Invalid request.', 'bad_json');
  }
}
