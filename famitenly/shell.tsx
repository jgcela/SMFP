// FAMITENLY's public website (copied from family-portal/marketing): the body of
// every one of its pages, with its own fonts and styles. The site lives at the
// root of this app ("/", /privacy, /terms, /thank-you); schools are under /s/<code>.
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./site.css";
import { Analytics } from "./components/Analytics";

export function MarketingBody({ children }: { children: React.ReactNode }) {
  return (
    <body>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {children}
      <Analytics />
    </body>
  );
}
