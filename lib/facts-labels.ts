// Labels shared by the server and the staff panel (no server-only code here).
export type ParentStatus = "pending_email" | "invited" | "active" | "expired";
export const PARENT_STATUS_LABEL: Record<ParentStatus, string> = {
  pending_email: "Needs email", invited: "Invited", active: "Active", expired: "Invitation expired",
};
export type ParentRow = {
  parentId: string; email: string | null; status: ParentStatus; accountEmail: string | null;
  invitedAt: string | null; expiresAt: string | null; studentsGranted: number; conflicts: number;
};
