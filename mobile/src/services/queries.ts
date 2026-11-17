// TanStack Query hooks: one per screen need. Caching, retries and refresh
// live here so screens only render.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CommunityKind } from '@/data/types';
import { useAppState } from '@/state/app-state';

import { api, type AbsenceInput, type RequestInput } from './api';

export const keys = {
  me: ['me'] as const,
  events: (range?: { from: string; to: string }) => (range ? (['events', range.from, range.to] as const) : (['events'] as const)),
  event: (id: string) => ['event', id] as const,
  announcements: ['announcements'] as const,
  announcement: (id: string) => ['announcements', id] as const,
  documents: ['documents'] as const,
  requests: ['requests'] as const,
  request: (id: string) => ['requests', id] as const,
  absences: ['absences'] as const,
  volunteer: ['volunteer'] as const,
  community: (kind: CommunityKind) => ['community', kind] as const,
  links: ['links'] as const,
  conversations: ['conversations'] as const,
  conversation: (id: string) => ['conversations', id] as const,
};

/** The signed-in family: school, children and which features the school turned on. */
export function useFamily() {
  const { family } = useAppState();
  return useQuery({ queryKey: keys.me, queryFn: api.me, initialData: family ?? undefined, staleTime: 5 * 60_000 });
}

export const useEvents = (range?: { from: string; to: string }) => {
  const { family } = useAppState();
  return useQuery({ queryKey: keys.events(range), queryFn: () => api.events(range), enabled: !!family?.features.calendar });
};
export const useEvent = (id: string) => useQuery({ queryKey: keys.event(id), queryFn: () => api.event(id) });

export const useAnnouncements = () => {
  const { family } = useAppState();
  return useQuery({ queryKey: keys.announcements, queryFn: api.announcements, enabled: !!family?.features.announcements });
};
export const useAnnouncement = (id: string) => useQuery({ queryKey: keys.announcement(id), queryFn: () => api.announcement(id) });

export const useDocuments = () => useQuery({ queryKey: keys.documents, queryFn: api.documents });

export const useRequests = () => {
  const { family } = useAppState();
  return useQuery({ queryKey: keys.requests, queryFn: api.requests, enabled: !!family?.features.requests });
};
export const useRequest = (id: string) => useQuery({ queryKey: keys.request(id), queryFn: () => api.request(id) });

export const useAbsences = () => {
  const { family } = useAppState();
  return useQuery({ queryKey: keys.absences, queryFn: api.absences, enabled: !!family?.features.absences });
};
/** One notice, read from the family's list (there is no separate endpoint). */
export function useAbsence(id: string) {
  const q = useAbsences();
  const found = q.data?.find((a) => a.id === id);
  return { ...q, data: q.data ? found : undefined, notFound: !!q.data && !found };
}

export const useVolunteer = () => useQuery({ queryKey: keys.volunteer, queryFn: api.volunteer });
export const useCommunity = (kind: CommunityKind) => useQuery({ queryKey: keys.community(kind), queryFn: () => api.community(kind) });
export const useLinks = () => useQuery({ queryKey: keys.links, queryFn: api.links });

export const useConversations = () => useQuery({ queryKey: keys.conversations, queryFn: api.conversations });
export const useConversation = (id: string | null) =>
  useQuery({ queryKey: keys.conversation(id ?? 'none'), queryFn: () => api.conversation(id!), enabled: !!id });

// ---------- Writes ----------

export function useSubmitAbsence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: AbsenceInput & { idempotencyKey: string }) => api.submitAbsence(v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.absences });
      void qc.invalidateQueries({ queryKey: keys.requests });
    },
  });
}

export function useCancelAbsence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.cancelAbsence,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.absences });
      void qc.invalidateQueries({ queryKey: keys.requests });
    },
  });
}

export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (v: RequestInput) => api.createRequest(v), onSuccess: () => qc.invalidateQueries({ queryKey: keys.requests }) });
}

export function useReplyToRequest(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: string) => api.replyToRequest(id, body), onSuccess: () => qc.invalidateQueries({ queryKey: keys.requests }) });
}

export function useCancelRequest(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.cancelRequest(id), onSuccess: () => qc.invalidateQueries({ queryKey: keys.requests }) });
}

export function useAsk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { conversationId: string | null; text: string }) => {
      const r = await api.ask(v.conversationId, v.text);
      return api.conversation(r.conversationId);
    },
    onSuccess: (convo) => {
      qc.setQueryData(keys.conversation(convo.conversation.id), convo);
      void qc.invalidateQueries({ queryKey: keys.conversations, exact: true });
    },
  });
}

export function useDecideAction(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { actionId: string; decision: 'confirm' | 'dismiss' }) => api.decideAction(v.actionId, v.decision),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.conversation(conversationId) });
      void qc.invalidateQueries({ queryKey: keys.absences });
      void qc.invalidateQueries({ queryKey: keys.requests });
    },
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.deleteConversation, onSuccess: () => qc.invalidateQueries({ queryKey: keys.conversations }) });
}
