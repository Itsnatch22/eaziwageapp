import { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.eaziwage.com";

export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();

    return [
        { url: siteUrl, lastModified: now, changeFrequency: "weekly", priority: 1.0 },

        { url: `${siteUrl}/register`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
        { url: `${siteUrl}/contact`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
        { url: `${siteUrl}/status`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    ]
}