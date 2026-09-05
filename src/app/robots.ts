import type { MetadataRoute } from "next";
import { SITE_HOST } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `https://${SITE_HOST}/sitemap.xml`,
  };
}
