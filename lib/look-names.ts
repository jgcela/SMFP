// Names shared by proxy.ts and lib/look.ts (no server-only imports here).
export const LOOKS = ["editorial", "bento", "brutal", "night", "swiss", "bands", "varsity"] as const;
export type Look = (typeof LOOKS)[number];
export const LOOK_COOKIE = "portal_look";
export const looksEnabled = () => process.env.VERCEL_ENV !== "production";
