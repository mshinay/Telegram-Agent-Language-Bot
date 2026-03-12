import type { LanguageMode, LessonPlan } from '../types/lesson.js';
import type { AnswerRecord } from '../types/session.js';
import { buildTaskSystemPrompt, type PromptPayload } from './system.js';

export interface GenerateSummaryPromptInput {
  language: LanguageMode;
  lesson: LessonPlan;
  answers: AnswerRecord[];
}

function getSummaryRules(language: LanguageMode): string {
  const targetLanguage = language === 'ja' ? 'Japanese' : 'English';

  return [
    'Generate a lesson summary JSON object with this exact shape:',
    '{',
    '  "topic": string,',
    '  "strengths": string[],',
    '  "mistakes": string[],',
    '  "naturalExpressions": string[],',
    '  "reviewPoints": string[],',
    '  "overallComment": string',
    '}',
    `The learner practiced ${targetLanguage}.`,
    '"topic" must match the lesson topic.',
    '"strengths" must summarize what the learner did well in Simplified Chinese.',
    '"mistakes" must list recurring or important mistakes in Simplified Chinese.',
    `"naturalExpressions" must contain useful natural ${targetLanguage} expressions from the lesson or feedback.`,
    '"reviewPoints" must list concrete next-step review advice in Simplified Chinese.',
    '"overallComment" must be a concise Simplified Chinese wrap-up.',
    'Use only the provided lesson and answer records.',
    'Do not include extra fields.'
  ].join('\n');
}

export function buildSummaryPrompt(input: GenerateSummaryPromptInput): PromptPayload {
  return {
    system: buildTaskSystemPrompt(
      input.language,
      'You generate lesson summaries for a language training app.'
    ),
    user: [
      getSummaryRules(input.language),
      'Lesson plan:',
      JSON.stringify(input.lesson, null, 2),
      'Answer records:',
      JSON.stringify(input.answers, null, 2)
    ].join('\n\n')
  };
}
