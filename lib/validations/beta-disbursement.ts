import { z } from 'zod';

const yesNoFollowUp = (field: string, maxLength: number) =>
  z.object({
    value: z.boolean(),
    details: z.string().max(maxLength, `${field} details are too long`).optional(),
  });

export const betaDisbursementSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
  email: z.string().email('Please enter a valid email address'),
  userId: z.string().uuid().optional(),
  reviewedPages: z.array(z.string().max(100)).max(20).optional(),
  honeypot: z.string().optional(),
  answers: z.object({
    q1: z.enum(['very_easy', 'easy', 'neutral', 'difficult', 'very_difficult'], {
      message: 'Please answer this question',
    }),
    q2: z.enum(['very_clear', 'clear', 'neutral', 'unclear', 'very_unclear'], {
      message: 'Please answer this question',
    }),
    q3: z.enum(['completely', 'mostly', 'somewhat', 'not_really', 'no'], {
      message: 'Please answer this question',
    }),
    q4: z.enum(['very_confident', 'confident', 'neutral', 'not_confident', 'not_at_all_confident'], {
      message: 'Please answer this question',
    }),
    q5: z.enum(['very_clear', 'clear', 'neutral', 'unclear', 'very_unclear'], {
      message: 'Please answer this question',
    }),
    q6: z.enum(['very_clear', 'clear', 'neutral', 'unclear', 'very_unclear'], {
      message: 'Please answer this question',
    }),
    q7: z.enum(['very_fast', 'fast', 'about_right', 'slow', 'very_slow'], {
      message: 'Please answer this question',
    }),
    q8: yesNoFollowUp('Issue', 1000),
    q9: z.enum(['very_comfortable', 'comfortable', 'neutral', 'uncomfortable', 'very_uncomfortable'], {
      message: 'Please answer this question',
    }),
    q10: z.enum(['excellent', 'good', 'fair', 'poor', 'very_poor'], {
      message: 'Please answer this question',
    }),
    q11: z.string().max(2000, 'Feedback is too long').optional(),
    q12: z.string().max(2000, 'Feedback is too long').optional(),
  }),
});

export type BetaDisbursementFormData = z.infer<typeof betaDisbursementSchema>;
export type BetaDisbursementAnswers = BetaDisbursementFormData['answers'];
