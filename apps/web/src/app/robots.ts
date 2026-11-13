import type { MetadataRoute } from "next";

function siteOrigin(): URL {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APIPROOF_APP_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" || process.env.NODE_ENV !== "production") return url;
    } catch {
      // Use the canonical public origin when configuration is invalid.
    }
  }
  return new URL("https://myowl.dev");
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/about", "/blog", "/contact", "/cookies", "/docs", "/faq", "/features", "/how-it-works", "/pricing", "/privacy", "/security", "/terms", "/updates"],
      disallow: ["/api/", "/dashboard/", "/forgot-password", "/invite/", "/login", "/reset-password"],
    },
    sitemap: new URL("/sitemap.xml", siteOrigin()).toString(),
  };
}
