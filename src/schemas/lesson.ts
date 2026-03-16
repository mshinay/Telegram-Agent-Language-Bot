import { z } from 'zod';
import { LESSON_QUESTION_COUNT } from '../types/lesson.js';

export const languageModeSchema = z.enum(['ja', 'en']);

export const questionTypeSchema = z.enum([
  'translate',
  'paraphrase',
  'free_expression'
]);

export const questionSchema = z.object({
  id: z.number().int().positive(),
  type: questionTypeSchema,
  prompt: z.string().min(1)
});

export const lessonPlanSchema = z.object({
  topic: z.string().min(1),
  material: z.string().min(1),
  questions: z.array(questionSchema).length(LESSON_QUESTION_COUNT)
}).superRefine((plan, ctx) => {
  const expectedIds = [1, 2, 3];
  const expectedTypes = ['translate', 'paraphrase', 'free_expression'] as const;

  plan.questions.forEach((question, index) => {
    if (question.id !== expectedIds[index]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['questions', index, 'id'],
        message: `Question id must be ${expectedIds[index]} in order`
      });
    }

    if (question.type !== expectedTypes[index]) {
      const expectedType = expectedTypes[index];
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['questions', index, 'type'],
        message: `Question type must be ${expectedType} at position ${index + 1}`
      });
    }
  });
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
