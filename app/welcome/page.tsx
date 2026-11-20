import type { Metadata } from "next";
import "../platform/platform.css";

// FAMITENLY's own home page (the site root, "/"). Each school's portal is at /s/<code>/.
export const metadata: Metadata = { title: "FAMITENLY", description: "Family portals for schools.", robots: { index: false, follow: false } };

export default function Welcome() {
  return (
    <body className="pf pf-solo">
      <main id="main" className="pf-card pf-card--narrow">
        <p className="pf-brand">FAMITENLY</p>
        <h1>Family portals for schools</h1>
        <p className="pf-lead">Each school has its own portal address. If you are a parent, use the link your school sent you.</p>
      </main>
    </body>
  );
}
