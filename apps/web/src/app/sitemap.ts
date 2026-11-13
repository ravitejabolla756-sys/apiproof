import type { MetadataRoute } from "next";

const publicPaths = [
  "/",
  "/about",
  "/blog",
  "/contact",
  "/cookies",
  "/docs",
  "/faq",
  "/features",
  "/how-it-works",
  "/pricing",
  "/privacy",
  "/security",
  "/terms",
  "/updates",
];

function siteOrigin(): URL {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APIPROOF_APP_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" || process.env.NODE_ENV !== "production") return url;
    } catch {
      // Fall through to the canonical public origin when configuration is invalid.
    }
  }
  return new URL("https://myowl.dev");
}

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  return publicPaths.map((path) => ({
    url: new URL(path, origin).toString(),
    changeFrequency: "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
