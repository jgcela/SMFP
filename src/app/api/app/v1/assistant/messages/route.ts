// Sends a question to the family assistant and returns the conversation id.
// The app then loads the conversation to show the answer, its sources and any draft.
import { familyContext, jsonBody, route } from '@/server/app-api/context';
import { sendMessage } from '@/server/services/family-assistant';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const POST = route(async (req) => {
  const c = await familyContext(req);
  const b = await jsonBody(req);
  const id = typeof b.conversationId === 'string' && b.conversationId ? b.conversationId : null;
  return sendMessage(c.tenant.id, c.viewer, id, String(b.text ?? ''));
});
