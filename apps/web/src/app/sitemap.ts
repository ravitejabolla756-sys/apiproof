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

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  return publicPaths.map((path) => ({
    url: new URL(path, origin).toString(),
    changeFrequency: "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
