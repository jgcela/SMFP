// Data contracts for the app. They mirror the portal's app API
// (/api/app/v1, src/server/app-api in the repo root), so screens render
// exactly what the server sends.

export type School = {
  /** The school's web portal path, e.g. /s/stmary. */
  portalPath: string;
  name: string;
  shortName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  officeHours: string | null;
  websiteUrl: string | null;
  timezone: string;
  primary: string;
  accent: string;
};

export type Child = {
  /** Stable key from the student records (e.g. "manual:<id>" or "facts:<id>"). */
  id: string;
  name: string;
  firstName: string;
  grade: string | null;
  gradeId: string | null;
  canReportAbsence: boolean;
};

export type Features = {
  calendar: boolean;
  announcements: boolean;
  documents: boolean;
  absences: boolean;
  requests: boolean;
  volunteer: boolean;
  community: boolean;
  links: boolean;
  ask: boolean;
  /** The server runs the assistant in test mode: simulated answers, no real AI. */
  askTestMode?: boolean;
};

export type Family = {
  user: { name: string; email: string };
  school: School;
  children: Child[];
  /** Set when the student records could not be read; children is then empty. */
  childrenError: string | null;
  features: Features;
};

export type SchoolEvent = {
  /** `${eventId}_${date}`: one occurrence of a (possibly repeating) event. */
  id: string;
  eventId: string;
  title: string;
  /** School-local date, YYYY-MM-DD. */
  date: string;
  endDate: string | null;
  allDay: boolean;
  /** ISO date-time for timed events. */
  start: string | null;
  end: string | null;
  location: string | null;
  description: string | null;
  category: string | null;
  important: boolean;
  registrationUrl: string | null;
  calendar: { name: string; color: string | null };
  /** Children this event is for; empty means the whole school. */
  childIds: string[];
};

export type Announcement = {
  id: string;
  title: string;
  summary: string | null;
  body: string;
  important: boolean;
  pinned: boolean;
  publishedAt: string;
};

export type SchoolDocument = {
  /** The document's slug. */
  id: string;
  title: string;
  category: string;
  description: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  updatedAt: string;
};

export type RequestKind = 'attendance' | 'question' | 'request';
export type RequestStatus = 'new' | 'in_progress' | 'waiting' | 'resolved' | 'cancelled';

export type OfficeRequestSummary = {
  id: string;
  number: number;
  kind: RequestKind;
  subject: string;
  status: RequestStatus;
  noticeStatus: AbsenceStatus | null;
  student: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RequestEvent = {
  kind: 'created' | 'status' | 'assigned' | 'priority' | 'note' | 'reply' | 'escalated' | 'automation';
  body: string | null;
  toValue: string | null;
  /** 'family', 'staff' or 'system'. */
  actorKind: string;
  createdAt: string;
};

export type OfficeRequest = {
  item: { id: string; number: number; kind: RequestKind; subject: string; body: string; status: RequestStatus; createdAt: string };
  events: RequestEvent[];
  student: string | null;
  notice: {
    id: string;
    type: AbsenceType;
    dateFrom: string;
    dateTo: string | null;
    time: string | null;
    reason: AbsenceReason;
    comment: string | null;
    status: AbsenceStatus;
    reviewNote: string | null;
  } | null;
};

export type AbsenceType = 'absent' | 'late' | 'early_dismissal';
export type AbsenceReason = 'illness' | 'medical_appointment' | 'family' | 'other';
export type AbsenceStatus =
  | 'draft'
  | 'submitted'
  | 'received'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'sis_sync_pending'
  | 'sis_synced'
  | 'sync_failed'
  | 'cancelled';

export type AbsenceNotice = {
  id: string;
  requestId: string | null;
  number: number | null;
  childId: string;
  childName: string;
  type: AbsenceType;
  dateFrom: string;
  dateTo: string | null;
  time: string | null;
  reason: AbsenceReason;
  comment: string | null;
  status: AbsenceStatus;
  reviewNote: string | null;
  createdAt: string;
};

export type VolunteerOpportunity = {
  id: string;
  title: string;
  category: string | null;
  organizer: string | null;
  location: string | null;
  schedule: string | null;
  commitment: string | null;
  summary: string | null;
  body: string | null;
  actions: { label: string; url: string }[];
};

export type CommunityKind = 'favorites' | 'wishlist';
export type CommunityItem = { id: string; group: string | null; name: string; role: string | null; url: string | null; details: { label: string; value: string }[] };

export type QuickLink = { id: string; title: string; description: string | null; url: string };

// ---------- Family assistant ----------

export type AssistantCard =
  | { kind: 'source'; title: string; section: string | null; url: string | null; quote: string }
  | { kind: 'request'; id: string; number: number; subject: string; status: string }
  | { kind: 'action'; actionId: string };

export type AssistantMessage = { id: string; role: 'user' | 'assistant'; content: string; cards: AssistantCard[]; createdAt: string; /** Written by the test-mode model. */ simulated?: boolean };

export type AssistantAction = {
  id: string;
  kind: 'absence_notice' | 'office_request';
  summary: string;
  status: 'proposed' | 'confirmed' | 'dismissed' | 'failed';
  /** What was created ("R-1042") or why it failed. */
  result: string | null;
  expired: boolean;
  createdAt: string;
};

export type Conversation = {
  conversation: { id: string; title: string };
  messages: AssistantMessage[];
  actions: Record<string, AssistantAction>;
};

export type ConversationSummary = { id: string; title: string; updatedAt: string };
