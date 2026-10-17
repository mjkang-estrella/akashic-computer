import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Personal workspaces and saved comparisons are account-scoped.
      disallow: ["/workspace", "/computers", "/compare/"],
    },
    sitemap: "https://akashic.computer/sitemap.xml",
  };
}
