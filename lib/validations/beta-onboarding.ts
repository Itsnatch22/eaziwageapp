import { z } from "zod";

export const betaOnboardingSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name is too long"),
  email: z.string().email("Please enter a valid email address"),
  userId: z.string().uuid().optional(),
  reviewedPages: z.array(z.string()).optional(),
  honeypot: z.string().optional(),
  answers: z.object({
    q1: z.enum(["very_easy", "easy", "neutral", "difficult", "very_difficult"], {
      message: "Please answer this question",
    }),
    q2: z.enum(["very_clear", "clear", "neutral", "unclear", "very_unclear"], {
      message: "Please answer this question",
    }),
    q3: z.enum(["completely", "mostly", "somewhat", "not_really", "no"], {
      message: "Please answer this question",
    }),
    q4: z.object({
      encountered: z.boolean(),
      step: z.string().max(100, "Step is too long").optional(),
    }),
    q5: z.enum(["too_few", "just_right", "slightly_too_many", "far_too_many"], {
      message: "Please answer this question",
    }),
    q6: z.object({
      confusing: z.boolean(),
      details: z.string().max(1000, "Details are too long").optional(),
    }),
    q7: z.enum(["very_comfortable", "comfortable", "neutral", "uncomfortable", "very_uncomfortable"], {
      message: "Please answer this question",
    }),
    q8: z.enum(["excellent", "good", "fair", "poor", "very_poor"], {
      message: "Please answer this question",
    }),
    q9: z.enum(["very_easy", "easy", "neutral", "difficult", "very_difficult"], {
      message: "Please answer this question",
    }),
    q10: z.object({
      issue: z.boolean(),
      details: z.string().max(1000, "Details are too long").optional(),
    }),
    q11: z.enum(["too_slow", "slightly_slow", "about_right", "slightly_fast", "too_fast"]).optional(),
    q12: z
      .object({
        encountered: z.boolean(),
        details: z.string().max(2000, "Details are too long").optional(),
      })
      .optional(),
    q13: z
      .enum(["very_confident", "confident", "neutral", "not_very_confident", "not_at_all_confident"])
      .optional(),
    q14: z.string().max(2000, "Feedback is too long").optional(),
    q15: z.string().max(2000, "Feedback is too long").optional(),
  }),
});

export type BetaOnboardingFormData = z.infer<typeof betaOnboardingSchema>;
