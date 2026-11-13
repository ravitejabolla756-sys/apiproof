import type { MetadataRoute } from "next";

function configuredSiteOrigin(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.protocol !== "https:" && process.env.NODE_ENV === "production") return null;
    return new URL(`${url.protocol}//${url.host}`);
  } catch {
    return null;
  }
}

function siteOrigin(): URL {
  for (const candidate of [process.env.NEXT_PUBLIC_APP_URL, process.env.APIPROOF_APP_URL]) {
    const configured = candidate?.trim();
    if (configured) {
      const origin = configuredSiteOrigin(configured);
      if (origin) return origin;
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
