import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/*/account", "/*/checkout", "/*/cart", "/*/search", "/*/garage", "/*/login", "/*/register", "/*/forgot-password", "/*/reset-password", "/*/track-order", "/uploads/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
