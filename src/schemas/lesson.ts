import { z } from 'zod';

export const languageModeSchema = z.enum(['ja', 'en']);

export const questionTypeSchema = z.enum(['translate', 'retell']);

export const questionSchema = z.object({
  id: z.number().int().positive(),
  type: questionTypeSchema,
  prompt: z.string().min(1)
});

export const lessonPlanSchema = z.object({
  topic: z.string().min(1),
  material: z.string().min(1),
  questions: z.array(questionSchema)
});

export const answerFeedbackSchema = z.object({
  evaluation: z.string().min(1),
  issues: z.array(z.string()),
  naturalVersion: z.string().min(1),
  alternatives: z.array(z.string())
});

export const lessonSummarySchema = z.object({
  topic: z.string().min(1),
  strengths: z.array(z.string()),
  mistakes: z.array(z.string()),
  naturalExpressions: z.array(z.string()),
  reviewPoints: z.array(z.string()),
  overallComment: z.string().min(1)
});
