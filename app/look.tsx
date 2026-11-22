// The design proposal switcher for the React pages (lib/look.ts). The stylesheet itself is added by app/layout.tsx.
import { currentLook, looksEnabled, switcherHtml } from "../lib/look";

export async function LookSwitcher() {
  if (!looksEnabled()) return null;
  return <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: switcherHtml(await currentLook()) }} />;
}
