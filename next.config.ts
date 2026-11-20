import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // proxy.ts decides about trailing slashes: a school's home page is /s/<code>/.
  skipTrailingSlashRedirect: true,
  // A school's logo is sent with the "New school" form (FAMITENLY panel, step 10).
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  async rewrites() {
    // The other pages link back to the home page by its original file name.
    return [{ source: "/portal_202627.html", destination: "/" }];
  },
  async headers() {
    // Same rule as the original site's .htaccess: keep every page and file
    // (including PDFs and images) out of search results.
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
    ];
  },
};

export default nextConfig;
