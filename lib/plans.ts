// FAMITENLY's plans and the parts (modules) of the portal each one can turn on.
// Names, prices and features are copied as they are from the family-portal
// marketing site (backlog branch, src/server/billing/plan-defs.ts). No billing yet:
// prices are only shown in the FAMITENLY panel.

export type PlanId = "essential" | "smart" | "autonomous";
export type Plan = { id: PlanId; name: string; annual: number; implementation: number; from?: boolean; summary: string };

export const PLANS: Plan[] = [
  { id: "essential", name: "Essential", annual: 4999, implementation: 1000, summary: "One portal for families and one inbox for the office." },
  { id: "smart", name: "Smart", annual: 8999, implementation: 2000, summary: "Routine questions and forms handled without the front desk." },
  { id: "autonomous", name: "Autonomous", annual: 14999, implementation: 4000, from: true, summary: "Student-specific answers and workflows connected to your SIS." },
];
export const PLAN_IDS = PLANS.map((p) => p.id);
export const planOf = (id: string) => PLANS.find((p) => p.id === id) ?? PLANS[0];
export const price = (p: Plan) => `${p.from ? "From " : ""}$${p.annual.toLocaleString("en-US")} a year + $${p.implementation.toLocaleString("en-US")} setup`;

// Always on: the portal itself (home page, notice, calendar, documents, links,
// contact, text pages) and the staff panel to edit it.
export const CORE = ["Home page and notice", "Calendar", "Family documents", "Links", "Contact", "Pages"];

// Modules a school can turn on or off. available: built in this portal today.
// plans: the plans that may turn it on.
export type ModuleId = "families" | "requests" | "volunteer" | "staff_favorites" | "wishlists"
  | "knowledge_ai" | "forms" | "reminders" | "analytics" | "family_assistant" | "student_queries" | "advanced_workflows" | "sis_integrations";
export type Module = { id: ModuleId; name: string; lead: string; available: boolean; plans: PlanId[] };

const ALL: PlanId[] = ["essential", "smart", "autonomous"];
const SMART_UP: PlanId[] = ["smart", "autonomous"];
const AUTONOMOUS: PlanId[] = ["autonomous"];

export const MODULES: Module[] = [
  { id: "families", name: "Family sign-in", lead: "Families create an account with the school code; the school approves them. My family page.", available: true, plans: ALL },
  { id: "requests", name: "Absences & requests", lead: "Families send absence and late-arrival notices; the office answers them.", available: true, plans: ALL },
  { id: "volunteer", name: "Volunteer", lead: "Volunteer opportunities and sign-ups.", available: true, plans: ALL },
  { id: "staff_favorites", name: "Staff favorites", lead: "Staff favorite things, for families who signed in.", available: true, plans: ALL },
  { id: "wishlists", name: "Teacher wishlists", lead: "Links to the teachers' wishlists, for families who signed in.", available: true, plans: ALL },
  { id: "knowledge_ai", name: "School knowledge AI with source links", lead: "", available: false, plans: SMART_UP },
  { id: "forms", name: "Forms and permission slips", lead: "", available: false, plans: SMART_UP },
  { id: "reminders", name: "Automated reminders", lead: "", available: false, plans: SMART_UP },
  { id: "analytics", name: "Operations analytics", lead: "", available: false, plans: SMART_UP },
  { id: "family_assistant", name: "Authenticated family assistant", lead: "", available: false, plans: AUTONOMOUS },
  { id: "student_queries", name: "Authorized student-specific queries", lead: "", available: false, plans: AUTONOMOUS },
  { id: "advanced_workflows", name: "Advanced workflows", lead: "", available: false, plans: AUTONOMOUS },
  { id: "sis_integrations", name: "Supported SIS integrations, scoped per school", lead: "", available: false, plans: AUTONOMOUS },
];

/** A new school starts with the basics: family sign-in and absences & requests. */
export const DEFAULT_MODULES: ModuleId[] = ["families", "requests"];

/** The modules a plan may have on, from a wished list (unknown, unbuilt or not in the plan: dropped). */
export function allowedModules(plan: string, wanted: string[]): ModuleId[] {
  return MODULES.filter((m) => m.available && m.plans.includes(plan as PlanId) && wanted.includes(m.id)).map((m) => m.id);
}

export type SchoolStatus = "active" | "trial" | "suspended";
export const STATUS_NAME: Record<SchoolStatus, string> = { active: "Active", trial: "Trial", suspended: "Suspended" };
