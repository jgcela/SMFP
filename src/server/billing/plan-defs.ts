// Plan names, prices and features (copied from the family-portal marketing site config).
// Used by src/server/billing/catalog.ts.

export type Availability = 'live' | 'pilot' | 'planned';

/**
 * What is actually available today. The site prints these labels next to
 * features and in the demos, so update them in the PR that ships a feature.
 * Defaults reflect the product repository as of November 2026.
 */
const featureDefs = {
  familyPortal: { label: 'Branded family portal', status: 'live' },
  adminDashboard: { label: 'School admin dashboard', status: 'live' },
  calendarImports: { label: 'Calendar imports (ICS and CSV)', status: 'live' },
  documents: { label: 'Documents and handbooks with stable links', status: 'live' },
  rolesPermissions: { label: 'Roles and permissions', status: 'live' },
  absenceNotices: { label: 'Absence and late-arrival notices', status: 'planned' },
  familyReceipts: { label: 'Family receipts', status: 'planned' },
  officeInbox: { label: 'Office inbox', status: 'planned' },
  knowledgeAI: { label: 'School knowledge AI with source links', status: 'planned' },
  forms: { label: 'Forms and permission slips', status: 'planned' },
  reminders: { label: 'Automated reminders', status: 'planned' },
  analytics: { label: 'Operations analytics', status: 'planned' },
  familyAssistant: { label: 'Authenticated family assistant', status: 'planned' },
  studentQueries: { label: 'Authorized student-specific queries', status: 'planned' },
  advancedWorkflows: { label: 'Advanced workflows', status: 'planned' },
  sisIntegrations: { label: 'Supported SIS integrations, scoped per school', status: 'planned' },
} as const;

export type FeatureId = keyof typeof featureDefs;
export const features: Record<FeatureId, { label: string; status: Availability }> = featureDefs;

export const availabilityLabel: Record<Availability, string> = {
  live: 'Live',
  pilot: 'In pilot',
  planned: 'Planned',
};

export type Plan = {
  id: 'essential' | 'smart' | 'autonomous';
  name: string;
  annual: number;
  implementation: number;
  /** "From" pricing for scoped plans. */
  from?: boolean;
  summary: string;
  includesPrevious?: string;
  features: FeatureId[];
  featured?: string;
  /** Why this plan is recommended, shown under the prices of the featured plan. */
  featuredReason?: string;
  cta: string;
  note?: string;
};

export const currency = 'USD';

export const plans: Plan[] = [
  {
    id: 'essential',
    name: 'Essential',
    annual: 4999,
    implementation: 1000,
    summary: 'One portal for families and one inbox for the office.',
    features: [
      'familyPortal',
      'adminDashboard',
      'calendarImports',
      'documents',
      'rolesPermissions',
      'absenceNotices',
      'familyReceipts',
      'officeInbox',
    ],
    cta: 'Book a Demo',
  },
  {
    id: 'smart',
    name: 'Smart',
    annual: 8999,
    implementation: 2000,
    summary: 'Routine questions and forms handled without the front desk.',
    includesPrevious: 'Everything in Essential, plus',
    features: ['knowledgeAI', 'forms', 'reminders', 'analytics'],
    featured: 'Recommended',
    featuredReason: 'Recommended for schools automating routine office work',
    cta: 'Book a Demo',
  },
  {
    id: 'autonomous',
    name: 'Autonomous',
    annual: 14999,
    implementation: 4000,
    from: true,
    summary: 'Student-specific answers and workflows connected to your SIS.',
    includesPrevious: 'Everything in Smart, plus',
    features: ['familyAssistant', 'studentQueries', 'advancedWorkflows', 'sisIntegrations'],
    cta: 'Discuss Your Integration',
    note:
      'SIS integrations are scoped per school, subject to provider capabilities and school authorization. Any SIS vendor or API fees are quoted separately.',
  },
];
