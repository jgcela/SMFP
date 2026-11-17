// SAMPLE DATA ONLY. Every person, student, event and message here is invented
// for the prototype. Nothing comes from a real school database. Dates are
// built relative to today so the prototype always looks current.

import { atDay, isoDate, schoolDay } from '@/lib/dates';

import type {
  AbsenceNotice,
  Announcement,
  AppNotification,
  Child,
  Family,
  OfficeRequest,
  QuickLink,
  School,
  SchoolDocument,
  SchoolEvent,
  VolunteerOpportunity,
  Wishlist,
} from './types';

const iso = (d: Date) => d.toISOString();

export const schools: School[] = [
  {
    id: 'stmary',
    name: 'St. Mary Catholic Virtue School',
    shortName: 'St. Mary',
    primary: '#16335B',
    accent: '#FCBC40',
    radius: 'soft',
    plan: 'smart',
    assistantEnabled: true,
    phone: '(303) 798-2375',
    email: 'officemanager@stmarylittleton.com',
    address: '6833 S Prince St., Littleton, CO 80120',
    officeHours: 'Monday to Friday, 7:30 AM to 4:00 PM',
    attendanceContact: 'Front office, (303) 798-2375',
  },
];

export const children: Child[] = [
  { id: 'carmen', firstName: 'Carmen', lastName: 'Rivera', grade: '3rd grade', schoolId: 'stmary', canReportAbsence: true },
  { id: 'javier', firstName: 'Javier', lastName: 'Rivera', grade: 'Kindergarten', schoolId: 'stmary', canReportAbsence: true },
];

export const family: Family = {
  greetingName: 'Ana',
  email: 'ana.rivera@example.com',
  schools,
  children,
};

const fieldTrip = schoolDay(1, 8, 45);
const earlyDismissal = schoolDay(3, 12, 0);

export const events: SchoolEvent[] = [
  {
    id: 'e-mass',
    schoolId: 'stmary',
    title: 'All-school Mass',
    start: iso(schoolDay(0, 8, 15)),
    end: iso(schoolDay(0, 9, 0)),
    allDay: false,
    location: 'Church',
    childIds: [],
    category: 'mass',
    description: 'Families are welcome to join us. Students wear their dress uniform.',
  },
  {
    id: 'e-trip',
    schoolId: 'stmary',
    title: '3rd grade field trip: Denver Museum of Nature & Science',
    start: iso(fieldTrip),
    end: iso(new Date(fieldTrip.getTime() + 6 * 3_600_000)),
    allDay: false,
    location: 'Buses leave from the north entrance',
    childIds: ['carmen'],
    category: 'trip',
    description: 'Students should arrive by 8:45 AM. Pack a sack lunch and a water bottle. We return by 2:45 PM.',
    links: [{ title: 'Permission slip (PDF)', url: 'https://example.com/permission-slip.pdf' }],
  },
  {
    id: 'e-early',
    schoolId: 'stmary',
    title: 'Early dismissal at noon',
    start: iso(earlyDismissal),
    end: iso(earlyDismissal),
    allDay: false,
    childIds: [],
    category: 'early-dismissal',
    description: 'Teacher professional development. Extended care is open until 6 PM.',
  },
  {
    id: 'e-kinder',
    schoolId: 'stmary',
    title: 'Kindergarten pajama reading day',
    start: iso(schoolDay(4)),
    end: iso(schoolDay(4)),
    allDay: true,
    childIds: ['javier'],
    category: 'event',
    description: 'Kindergarten students may wear pajamas and bring a favorite book.',
  },
  {
    id: 'e-noschool',
    schoolId: 'stmary',
    title: 'No school: Thanksgiving break',
    start: iso(schoolDay(7)),
    end: iso(schoolDay(9)),
    allDay: true,
    childIds: [],
    category: 'no-school',
    description: 'School is closed. Classes resume the following Monday.',
  },
  {
    id: 'e-bake',
    schoolId: 'stmary',
    title: 'Advent bake sale',
    start: iso(schoolDay(15, 7, 30)),
    end: iso(schoolDay(15, 9, 0)),
    allDay: false,
    location: 'Parish hall',
    childIds: [],
    category: 'event',
    description: 'Hosted by the parent association.',
    cancelled: false,
  },
  {
    id: 'e-picture',
    schoolId: 'stmary',
    title: 'Picture retake day',
    start: iso(schoolDay(5)),
    end: iso(schoolDay(5)),
    allDay: true,
    childIds: [],
    category: 'event',
    description: 'Cancelled. A new date will be announced.',
    cancelled: true,
  },
];

export const documents: SchoolDocument[] = [
  { id: 'd-lunch', schoolId: 'stmary', title: 'Lunch menu, this month', category: 'Food service', updatedAt: iso(atDay(-6)), pages: 1, excerpt: 'Hot lunch is $4.50. Pizza Friday every week. Order in FACTS by Thursday.' },
  { id: 'd-handbook', schoolId: 'stmary', title: 'Family handbook 2026–27', category: 'Policies', updatedAt: iso(atDay(-80)), pages: 42, excerpt: 'Report an absence before 8:30 AM. Students who arrive after 8:10 AM check in at the front office.' },
  { id: 'd-uniform', schoolId: 'stmary', title: 'Uniform guide', category: 'Policies', updatedAt: iso(atDay(-90)), pages: 3, excerpt: 'Dress uniform is required on Mass days.' },
  { id: 'd-supply', schoolId: 'stmary', title: '3rd grade supply list', category: 'Classroom', updatedAt: iso(atDay(-100)), pages: 1, excerpt: '24 pencils, 2 glue sticks, 1 box of tissues.' },
];

export const announcements: Announcement[] = [
  {
    id: 'a-trip',
    schoolId: 'stmary',
    title: 'Field trip tomorrow: what to pack',
    body: 'Our 3rd graders visit the Denver Museum of Nature & Science tomorrow. Please send a sack lunch, a water bottle and a jacket. Students should arrive by 8:45 AM. Permission slips are due today.',
    publishedAt: iso(atDay(0, 9, 10)),
    important: true,
    attachmentIds: [],
  },
  {
    id: 'a-early',
    schoolId: 'stmary',
    title: 'Early dismissal this week',
    body: 'School ends at noon for teacher professional development. Extended care is open until 6 PM. Please let the office know if your pickup plan changes.',
    publishedAt: iso(atDay(-1, 14, 0)),
    important: false,
    attachmentIds: [],
  },
  {
    id: 'a-lunch',
    schoolId: 'stmary',
    title: 'New lunch menu',
    body: 'The lunch menu for this month is ready. Hot lunch orders close on Thursdays.',
    publishedAt: iso(atDay(-6, 10, 0)),
    important: false,
    attachmentIds: ['d-lunch'],
  },
];

export const initialAbsences: AbsenceNotice[] = [
  {
    id: 'ab-1',
    schoolId: 'stmary',
    childId: 'javier',
    type: 'absent',
    dateFrom: isoDate(atDay(-9)),
    dateTo: isoDate(atDay(-9)),
    reason: 'Fever',
    status: 'recorded',
    createdAt: iso(atDay(-9, 7, 5)),
  },
];

export const initialRequests: OfficeRequest[] = [
  {
    id: 'r-1',
    schoolId: 'stmary',
    childId: 'carmen',
    type: 'Pickup change',
    subject: 'Grandma picks up Carmen on Fridays',
    status: 'answered',
    createdAt: iso(atDay(-3, 16, 0)),
    messages: [
      { from: 'family', author: 'Ana Rivera', body: 'Starting this Friday, Carmen’s grandmother, Rosa Rivera, will pick her up. She is on our authorized list.', at: iso(atDay(-3, 16, 0)) },
      { from: 'school', author: 'Front office', body: 'Thank you. We confirmed Rosa is on the list. She will need to show a photo ID the first time.', at: iso(atDay(-2, 9, 20)) },
    ],
  },
  {
    id: 'r-2',
    schoolId: 'stmary',
    childId: 'javier',
    type: 'General question',
    subject: 'Extended care on early dismissal days',
    status: 'received',
    createdAt: iso(atDay(-1, 19, 0)),
    messages: [{ from: 'family', author: 'Ana Rivera', body: 'Is extended care open on early dismissal days, or do we need to sign up in advance?', at: iso(atDay(-1, 19, 0)) }],
  },
];

export const volunteer: VolunteerOpportunity[] = [
  { id: 'v-1', schoolId: 'stmary', title: 'Field trip chaperone', date: iso(fieldTrip), spotsLeft: 1, description: 'Help a group of five students at the museum.' },
  { id: 'v-2', schoolId: 'stmary', title: 'Advent bake sale table', date: iso(schoolDay(15, 7, 30)), spotsLeft: 4, description: 'Sell baked goods before school.' },
];

export const wishlists: Wishlist[] = [
  { id: 'w-1', schoolId: 'stmary', name: 'Mrs. Lopez', role: '3rd grade teacher', items: ['Dry-erase markers', 'Chapter books for the class library', 'Hand sanitizer'] },
  { id: 'w-2', schoolId: 'stmary', name: 'Mr. Chen', role: 'Kindergarten teacher', items: ['Washable paint', 'Construction paper', 'Tissues'] },
];

export const quickLinks: QuickLink[] = [
  { id: 'l-facts', schoolId: 'stmary', title: 'FACTS Family Portal', description: 'Grades, billing and lunch orders', url: 'https://sis.factsmgt.com/accounts/Account/Login' },
  { id: 'l-uniform', schoolId: 'stmary', title: 'Uniform store', description: 'Order uniforms online', url: 'https://example.com/uniforms' },
];

export const notifications: AppNotification[] = [
  { id: 'n-1', schoolId: 'stmary', kind: 'urgent', title: 'St. Mary: Important update', at: iso(atDay(0, 9, 10)), target: { type: 'announcement', id: 'a-trip' } },
  { id: 'n-2', schoolId: 'stmary', kind: 'request', title: 'St. Mary: The office replied to your request', at: iso(atDay(-2, 9, 20)), target: { type: 'request', id: 'r-1' } },
  { id: 'n-4', schoolId: 'stmary', kind: 'absence', title: 'St. Mary: Your absence report was updated', at: iso(atDay(-9, 10, 0)), target: { type: 'absence', id: 'ab-1' } },
];

export const initialReadIds = ['a-lunch'];
