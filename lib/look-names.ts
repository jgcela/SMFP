// Names shared by proxy.ts and lib/look.ts (no server-only imports here).
export const LOOKS = ["editorial", "bento", "brutal", "night", "swiss", "bands", "varsity", "spotlight", "aurora"] as const;
// Looks that also load the motion layer (public/looks/kit.js + the vendored Motion library).
export const MOTION_LOOKS: readonly string[] = ["spotlight", "aurora"];
export type Look = (typeof LOOKS)[number];
export const LOOK_COOKIE = "portal_look";
export const looksEnabled = () => process.env.VERCEL_ENV !== "production";
