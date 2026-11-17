import type { AbsenceReason, AbsenceStatus, AbsenceType, Child, Family, RequestKind, RequestStatus, SchoolEvent } from '@/data/types';

import { dayLabel, fromIsoDate, time } from './dates';

export const childById = (family: Family | null | undefined, id: string | null | undefined): Child | undefined =>
  id ? family?.children.find((c) => c.id === id) : undefined;

export const absenceTypeLabel: Record<AbsenceType, string> = {
  absent: 'Absent',
  late: 'Late arrival',
  early_dismissal: 'Early pickup',
};

export const absenceReasonLabel: Record<AbsenceReason, string> = {
  illness: 'Illness',
  medical_appointment: 'Medical appointment',
  family: 'Family reason',
  other: 'Other',
};

/** What a family needs to know about a notice, in plain words. */
export const absenceStatusLabel: Record<AbsenceStatus, string> = {
  draft: 'Draft',
  submitted: 'Sent',
  received: 'Received',
  pending_review: 'In review',
  approved: 'Recorded',
  rejected: 'Not accepted',
  sis_sync_pending: 'Recorded',
  sis_synced: 'Recorded',
  sync_failed: 'Recorded',
  cancelled: 'Cancelled',
};

/** A notice the family can still cancel (the office hasn't decided yet). */
export const absenceCancellable = (s: AbsenceStatus) => s === 'submitted' || s === 'received' || s === 'pending_review';

export const requestStatusLabel: Record<RequestStatus, string> = {
  new: 'Waiting for the school',
  in_progress: 'In review',
  waiting: 'Waiting for you',
  resolved: 'Answered',
  cancelled: 'Cancelled',
};

export const requestOpen = (s: RequestStatus) => s === 'new' || s === 'in_progress' || s === 'waiting';

export const requestKindLabel: Record<RequestKind, string> = {
  attendance: 'Attendance',
  question: 'Question',
  request: 'Request',
};

export function eventStart(e: SchoolEvent): Date {
  return e.start ? new Date(e.start) : fromIsoDate(e.date);
}

export function eventWhen(e: SchoolEvent): string {
  const day = dayLabel(fromIsoDate(e.date));
  if (e.allDay || !e.start) {
    return !e.endDate || e.endDate === e.date ? `${day}, all day` : `${day} to ${dayLabel(fromIsoDate(e.endDate))}`;
  }
  const start = new Date(e.start);
  if (!e.end || e.end === e.start) return `${day}, ${time(start)}`;
  return `${day}, ${time(start)} – ${time(new Date(e.end))}`;
}

export function absenceWhen(a: { dateFrom: string; dateTo: string | null; time: string | null }): string {
  const from = dayLabel(fromIsoDate(a.dateFrom));
  const range = !a.dateTo || a.dateFrom === a.dateTo ? from : `${from} to ${dayLabel(fromIsoDate(a.dateTo))}`;
  return a.time ? `${range}, ${a.time}` : range;
}

/** Who an event is for, in words: "Carmen", "Carmen and Javier" or the school's short name. */
export function eventAudience(e: SchoolEvent, family: Family | null | undefined): string {
  if (e.childIds.length === 0) return family?.school.shortName ?? '';
  const names = e.childIds.map((id) => childById(family, id)?.firstName).filter(Boolean);
  return names.join(' and ');
}

export type StatusTone = 'success' | 'warning' | 'secondary' | 'danger';

export function absenceTone(s: AbsenceStatus): StatusTone {
  if (s === 'cancelled' || s === 'draft') return 'secondary';
  if (s === 'rejected') return 'danger';
  if (s === 'approved' || s === 'sis_sync_pending' || s === 'sis_synced' || s === 'sync_failed') return 'success';
  return 'warning';
}

export function requestTone(s: RequestStatus): StatusTone {
  if (s === 'resolved') return 'success';
  if (s === 'cancelled') return 'secondary';
  return 'warning';
}
