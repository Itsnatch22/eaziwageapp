import { z } from "zod";

export const audienceSchema = z.enum(["employees", "employers"]);

export const helpFrontmatterSchema = z.object({
  title: z.string().min(5).max(90),
  description: z.string().min(20).max(180),
  audience: audienceSchema,
  category: z.string().min(2),
  countries: z.array(z.enum(["all", "KE", "UG", "TZ", "RW"])).min(1),
  errorCodes: z.array(z.string()).default([]),
  synonyms: z.array(z.string()).default([]),
  related: z.array(z.string()).default([]),
  urgent: z.boolean().default(false),
  lastVerified: z.coerce.date(),
});

export type HelpAudience = z.infer<typeof audienceSchema>;
export type HelpFrontmatter = z.infer<typeof helpFrontmatterSchema>;

export type HelpArticleSection = {
  heading: string;
  body: string;
};

export type HelpArticle = HelpFrontmatter & {
  slug: string;
  sections: HelpArticleSection[];
};
