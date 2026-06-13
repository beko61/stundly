import type { MetadataRoute } from "next";

const APP_URL = process.env["NEXT_PUBLIC_APP_URL"] ?? "https://stundly.de";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/tracker",
          "/calendar",
          "/salary",
          "/vacation",
          "/reports",
          "/settings",
          "/onboarding",
          "/company/",
          "/superadmin",
          "/team",
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
