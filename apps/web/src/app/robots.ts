import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://myowl.dev";
  return {
    rules: [{ userAgent: "*", allow: ["/", "/features", "/how-it-works", "/security", "/docs", "/pricing", "/faq", "/updates", "/contact", "/privacy", "/terms", "/refunds", "/status", "/cookies"], disallow: ["/dashboard", "/api/"] }],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
