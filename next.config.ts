import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
