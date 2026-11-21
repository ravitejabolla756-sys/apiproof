import type { MetadataRoute } from "next";
import { publicSiteOrigin } from "@/lib/public-site-origin.js";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/about", "/blog", "/contact", "/cookies", "/docs", "/faq", "/features", "/how-it-works", "/pricing", "/privacy", "/security", "/terms", "/updates"],
      disallow: ["/api/", "/dashboard/", "/forgot-password", "/invite/", "/login", "/reset-password"],
    },
    sitemap: new URL("/sitemap.xml", publicSiteOrigin()).toString(),
  };
}
