import { z } from 'zod';

import { answerFeedbackSchema, languageModeSchema, lessonSummarySchema, questionSchema } from './lesson.js';

export const lessonStatusSchema = z.enum([
  'idle',
  'in_lesson',
  'awaiting_summary_confirmation',
  'interrupted'
]);

export const answerRecordSchema = z.object({
  questionId: z.number().int().positive(),
  answer: z.string().min(1),
  feedback: answerFeedbackSchema,
  answeredAt: z.string().datetime()
});

export const sessionStateSchema = z.object({
  status: lessonStatusSchema,
  lessonId: z.string().min(1).nullable(),
  language: languageModeSchema.nullable(),
  topic: z.string().min(1).nullable(),
  material: z.string().min(1).nullable(),
  questions: z.array(questionSchema),
  currentQuestionIndex: z.number().int().nonnegative(),
  answers: z.array(answerRecordSchema),
  draftSummary: lessonSummarySchema.nullable(),
  createdAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime().nullable()
});
