import type { MetadataRoute } from "next";
import { publicSiteOrigin } from "@/lib/public-site-origin.js";

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

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicSiteOrigin();
  return publicPaths.map((path) => ({
    url: new URL(path, origin).toString(),
    changeFrequency: "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
