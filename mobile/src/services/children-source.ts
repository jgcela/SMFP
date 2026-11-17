// Where a family's children come from.
//
// - 'sample' (default): the invented children in src/data/sample.ts.
// - 'facts': the portal API reads them from FACTS SIS on the server
//   (server/sis/facts.ts). Off until EXPO_PUBLIC_FACTS_ENABLED=true and the
//   API exists at EXPO_PUBLIC_API_URL. FACTS keys never reach the app.

import * as sample from '@/data/sample';
import type { Child } from '@/data/types';

export type ChildrenSourceId = 'sample' | 'facts';

export interface ChildrenSource {
  readonly id: ChildrenSourceId;
  children(): Promise<Child[]>;
}

export const integrations = {
  facts: {
    enabled: process.env.EXPO_PUBLIC_FACTS_ENABLED === 'true',
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
  },
};

const sampleSource: ChildrenSource = {
  id: 'sample',
  children: async () => sample.children,
};

const factsSource: ChildrenSource = {
  id: 'facts',
  async children() {
    const base = integrations.facts.apiUrl.replace(/\/+$/, '');
    if (!base) throw new Error('FACTS is enabled but EXPO_PUBLIC_API_URL is not set.');
    const res = await fetch(`${base}/api/sis/children`, { credentials: 'include', headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`The portal could not read children from FACTS (${res.status}).`);
    const body = (await res.json()) as { children: Child[] };
    return body.children;
  },
};

export function childrenSource(): ChildrenSource {
  return integrations.facts.enabled ? factsSource : sampleSource;
}
