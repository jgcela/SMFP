// Data for the St. Mary app, built from the same services the web portal uses.
// Every function takes a FamilyContext from familyContext(), so permissions,
// audiences and the school always come from the server.
import 'server-only';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { withTenant } from '../db/client';
import { attendanceNotices, audienceGrades, audiences, inboxItems } from '../db/schema';
import { addDays, toDateStr } from '../calendar/time';
import { getPublicEvent, listPublicOccurrences, type PublicOccurrence } from '../services/calendar';
import { getPublicAnnouncement, listPublicAnnouncements } from '../services/content';
import { listPublicDocuments, resolveDocumentLink } from '../services/documents';
import { familyChildren, type Child } from '../services/directory';
import { listMenuLinks } from '../services/links';
import { listPublicVolunteer } from '../services/volunteer';
import { listPublicCommunity, type CommunityKind } from '../services/community';
import { familyAssistantAvailable } from '../services/family-assistant';
import { getAssistantModel } from '../ai/assistant-model';
import { aiMode } from '../ai/provider';
import { getPrivateStorage, StorageNotConfiguredError } from '../storage/storage';
import { ApiError, requireModule, type FamilyContext } from './context';

// ---------- Family ----------

export type AppChild = { id: string; name: string; firstName: string; grade: string | null; gradeId: string | null; canReportAbsence: boolean };

function toAppChild(c: Child): AppChild {
  return { id: c.key, name: c.name, firstName: c.name.split(' ')[0] ?? c.name, grade: c.grade, gradeId: c.gradeId, canReportAbsence: c.canSubmitAttendance };
}

/** The family's children; an empty list (not an error) if the student records can't be reached. */
async function children(c: FamilyContext): Promise<{ children: AppChild[]; childrenError: string | null }> {
  try {
    return { children: (await familyChildren(c.tenant.id, c.viewer)).filter((k) => k.canView).map(toAppChild), childrenError: null };
  } catch (err) {
    return { children: [], childrenError: err instanceof Error ? err.message : 'Student records are unavailable.' };
  }
}

export async function me(c: FamilyContext) {
  const p = c.view.profile;
  const address = [p.addressLine1, p.addressLine2, [p.city, p.region].filter(Boolean).join(', '), p.postalCode].filter(Boolean).join(' ').replace(/ (\d{5})$/, ' $1');
  const kids = await children(c);
  return {
    user: { name: c.session.user.name, email: c.session.user.email },
    school: {
      /** The school's web portal, e.g. /s/stmary (for links the app opens in the browser). */
      portalPath: `/s/${c.tenant.slug}`,
      name: p.displayName,
      shortName: p.shortName ?? p.displayName,
      phone: p.phone,
      email: p.email,
      address: address || null,
      officeHours: p.officeHours,
      websiteUrl: p.websiteUrl,
      timezone: c.tenant.timezone,
      primary: c.view.theme.colors.primary,
      accent: c.view.theme.colors.accent,
    },
    ...kids,
    features: {
      calendar: c.modules.has('calendar'),
      announcements: c.modules.has('announcements'),
      documents: c.modules.has('documents'),
      absences: c.modules.has('attendance_notices'),
      requests: c.modules.has('operations_inbox'),
      volunteer: c.modules.has('volunteer'),
      community: c.modules.has('community'),
      links: c.modules.has('quick_links'),
      // On only when the school turned it on and the portal has an AI key.
      ask: (await familyAssistantAvailable(c.tenant.id, c.viewer)) && getAssistantModel() !== null,
      // Test mode (AI_MOCK): answers are simulated, the app says so.
      askTestMode: aiMode() === 'mock',
    },
  };
}

// ---------- Calendar ----------

/** For each child, the audiences that include the child's grade (plus whole-school audiences). */
async function childAudiences(c: FamilyContext, kids: AppChild[]) {
  const gradeIds = [...new Set(kids.map((k) => k.gradeId).filter((g): g is string => !!g))];
  const rows = gradeIds.length
    ? await withTenant(c.tenant.id, (tx) => tx.select({ audienceId: audienceGrades.audienceId, gradeId: audienceGrades.gradeId }).from(audienceGrades).where(inArray(audienceGrades.gradeId, gradeIds)))
    : [];
  const school = await withTenant(c.tenant.id, (tx) => tx.select({ id: audiences.id }).from(audiences).where(eq(audiences.kind, 'school')));
  const schoolIds = new Set(school.map((s) => s.id));
  return kids.map((k) => ({ childId: k.id, audienceIds: new Set([...schoolIds, ...rows.filter((r) => r.gradeId === k.gradeId).map((r) => r.audienceId)]) }));
}

function toAppEvent(o: PublicOccurrence, childMap: { childId: string; audienceIds: Set<string> }[]) {
  const whole = o.audienceIds.length === 0;
  return {
    id: `${o.eventId}_${o.date}`,
    eventId: o.eventId,
    title: o.title,
    date: o.date,
    endDate: o.endDate,
    allDay: o.allDay,
    start: o.start?.toISOString() ?? null,
    end: o.end?.toISOString() ?? null,
    location: o.location,
    description: o.description,
    category: o.category,
    important: o.isImportant,
    registrationUrl: o.registrationUrl,
    calendar: { name: o.calendar.name, color: o.calendar.color },
    /** Children this event is for; empty means the whole school. */
    childIds: whole ? [] : childMap.filter((m) => o.audienceIds.some((a) => m.audienceIds.has(a))).map((m) => m.childId),
  };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function events(c: FamilyContext, from?: string | null, to?: string | null) {
  requireModule(c, 'calendar');
  const today = toDateStr(new Date(), c.tenant.timezone);
  const f = from && DATE.test(from) ? from : addDays(today, -31);
  const t = to && DATE.test(to) ? to : addDays(today, 120);
  const kids = (await children(c)).children;
  const [occ, map] = await Promise.all([listPublicOccurrences(c.tenant.id, c.viewer, { from: f, to: t }, { audienceIds: [...c.viewer.audienceIds] }), childAudiences(c, kids)]);
  return { today, events: occ.map((o) => toAppEvent(o, map)) };
}

export async function event(c: FamilyContext, id: string) {
  requireModule(c, 'calendar');
  const [eventId, date] = id.split('_');
  const row = await getPublicEvent(c.tenant.id, eventId ?? '', c.viewer);
  if (!row) throw new ApiError(404, 'This event is no longer available.', 'not_found');
  const day = date && DATE.test(date) ? date : row.e.startDate ?? toDateStr(row.e.startsAt ?? new Date(), c.tenant.timezone);
  const occ = (await listPublicOccurrences(c.tenant.id, c.viewer, { from: day, to: day })).find((o) => o.eventId === row.e.id);
  if (!occ) throw new ApiError(404, 'This event is no longer available.', 'not_found');
  const map = await childAudiences(c, (await children(c)).children);
  return toAppEvent(occ, map);
}

// ---------- Announcements ----------

type AnnouncementRow = NonNullable<Awaited<ReturnType<typeof getPublicAnnouncement>>>;
const toAppAnnouncement = (a: AnnouncementRow) => ({
  id: a.id,
  title: a.title,
  summary: a.summary,
  body: a.body,
  important: a.isUrgent,
  pinned: a.isPinned,
  publishedAt: (a.publishAt ?? a.publishedAt ?? a.createdAt).toISOString(),
});

export async function announcements(c: FamilyContext) {
  requireModule(c, 'announcements');
  const rows = await listPublicAnnouncements(c.tenant.id, c.viewer, { audienceIds: [...c.viewer.audienceIds], limit: 100 });
  return rows.map(toAppAnnouncement);
}

export async function announcement(c: FamilyContext, id: string) {
  requireModule(c, 'announcements');
  const a = await getPublicAnnouncement(c.tenant.id, id, c.viewer);
  if (!a) throw new ApiError(404, 'This announcement is no longer available.', 'not_found');
  return toAppAnnouncement(a);
}

// ---------- Documents ----------

export async function documents(c: FamilyContext) {
  requireModule(c, 'documents');
  const rows = await listPublicDocuments(c.tenant.id, c.viewer);
  return rows.map((d) => ({
    id: d.slug,
    title: d.title,
    category: d.category ?? 'Other',
    description: d.description,
    fileName: d.fileName,
    contentType: d.contentType,
    sizeBytes: d.sizeBytes,
    updatedAt: d.updatedAt.toISOString(),
  }));
}

const INLINE = /^(application\/pdf|image\/(png|jpeg|gif|webp)|text\/plain)/;

/** A short-lived link to the file, after the same access check as /d/<slug>. */
export async function documentUrl(c: FamilyContext, slug: string, requestUrl: string) {
  requireModule(c, 'documents');
  const file = await resolveDocumentLink(c.tenant.id, slug, null, { viewer: c.viewer, moduleActive: true });
  if (!file) throw new ApiError(404, 'This document is no longer available.', 'not_found');
  try {
    const url = await getPrivateStorage().signedGetUrl(file.storageKey, { fileName: file.fileName, contentType: file.contentType, inline: INLINE.test(file.contentType), expiresIn: 300 });
    return { url: new URL(url, requestUrl).toString(), fileName: file.fileName };
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) throw new ApiError(503, 'Documents are not available yet. Please contact the office.', 'storage');
    throw err;
  }
}

// ---------- Absences ----------

/** The family's absence, late-arrival and early-pickup notices, newest first. */
export async function absences(c: FamilyContext) {
  requireModule(c, 'attendance_notices');
  const rows = await withTenant(c.tenant.id, (tx) =>
    tx
      .select({ n: attendanceNotices, number: inboxItems.number })
      .from(attendanceNotices)
      .leftJoin(inboxItems, eq(inboxItems.id, attendanceNotices.inboxItemId))
      .where(and(eq(attendanceNotices.userId, c.viewer.userId)))
      .orderBy(desc(attendanceNotices.createdAt))
      .limit(100),
  );
  return rows.map(({ n, number }) => ({
    id: n.id,
    requestId: n.inboxItemId,
    number,
    childId: n.studentKey,
    childName: n.studentName,
    type: n.type,
    dateFrom: n.dateFrom,
    dateTo: n.dateTo,
    time: n.time,
    reason: n.reason,
    comment: n.comment,
    status: n.status,
    reviewNote: n.reviewNote,
    createdAt: n.createdAt.toISOString(),
  }));
}

// ---------- Volunteer, community, links ----------

export async function volunteer(c: FamilyContext) {
  requireModule(c, 'volunteer');
  const rows = await listPublicVolunteer(c.tenant.id, c.viewer, { limit: 100 });
  return rows.map((v) => ({
    id: v.id,
    title: v.title,
    category: v.category,
    organizer: v.organizer,
    location: v.location,
    schedule: v.schedule,
    commitment: v.commitment,
    summary: v.summary,
    body: v.body,
    actions: v.actions,
  }));
}

export async function community(c: FamilyContext, kind: CommunityKind) {
  requireModule(c, 'community');
  const rows = await listPublicCommunity(c.tenant.id, kind, c.viewer);
  return rows.map((r) => ({ id: r.id, group: r.groupName, name: r.name, role: r.role, url: r.url, details: r.details }));
}

export async function links(c: FamilyContext, origin: string) {
  requireModule(c, 'quick_links');
  const [header, quick] = await Promise.all([listMenuLinks(c.tenant.id, 'header', c.viewer), listMenuLinks(c.tenant.id, 'quick', c.viewer)]);
  const seen = new Set<string>();
  const base = `${origin}/s/${c.tenant.slug}`;
  return [...header, ...quick]
    .filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)))
    .map((l) => ({ id: l.id, title: l.label, description: null, url: l.kind === 'url' ? l.target : `${base}${l.target}` }));
}
