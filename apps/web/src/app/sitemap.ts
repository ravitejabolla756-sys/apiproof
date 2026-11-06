import type { MetadataRoute } from "next";

const publicPaths = ["", "features", "how-it-works", "security", "docs", "pricing", "faq", "updates", "contact", "privacy", "terms", "refunds", "status", "cookies"];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://myowl.dev";
  const lastModified = new Date("2026-11-07T00:00:00.000Z");
  return publicPaths.map((path) => ({
    url: `${baseUrl}/${path}`.replace(/\/\/$/, "/"),
    lastModified,
    changeFrequency: path === "updates" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "pricing" || path === "faq" ? 0.8 : 0.6,
  }));
}
