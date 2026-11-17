import { describe, expect, it } from 'vitest';

import { childrenSource, integrations } from '@/services/children-source';

describe('children source', () => {
  it('uses sample data while FACTS is off (the default)', async () => {
    expect(integrations.facts.enabled).toBe(false);
    const src = childrenSource();
    expect(src.id).toBe('sample');
    expect((await src.children()).map((c) => c.firstName)).toEqual(['Carmen', 'Javier']);
  });
});
