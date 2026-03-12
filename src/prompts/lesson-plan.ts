import type { LanguageMode } from '../types/lesson.js';
import { LESSON_MATERIAL_COUNT, LESSON_QUESTION_COUNT } from '../types/lesson.js';
import { buildTaskSystemPrompt, type PromptPayload } from './system.js';

export interface GenerateLessonPlanPromptInput {
  language: LanguageMode;
  context?: string | null;
}

function getLessonPlanRules(language: LanguageMode): string {
  const targetLanguage = language === 'ja' ? 'Japanese' : 'English';

  return [
    'Generate a lesson plan JSON object with this exact shape:',
    '{',
    '  "topic": string,',
    '  "material": string,',
    '  "questions": [',
    '    { "id": 1, "type": "translate" | "retell", "prompt": string },',
    '    { "id": 2, "type": "translate" | "retell", "prompt": string },',
    '    { "id": 3, "type": "translate" | "retell", "prompt": string }',
    '  ]',
    '}',
    `The material count is fixed to ${LESSON_MATERIAL_COUNT}.`,
    `The question count is fixed to ${LESSON_QUESTION_COUNT}.`,
    `Set "topic" to a short training topic name in Simplified Chinese.`,
    `Set "material" to one short ${targetLanguage} passage for practice.`,
    'Set question ids to exactly 1, 2, 3 in order.',
    'Use only "translate" or "retell" as question types.',
    'Questions must directly rely on the same material passage.',
    'At least one question must be "translate" and at least one question must be "retell".',
    'Each question prompt must be written in Simplified Chinese and must be actionable for the learner.',
    'Do not include extra fields.'
  ].join('\n');
}

export function buildLessonPlanPrompt(input: GenerateLessonPlanPromptInput): PromptPayload {
  const userSections = [
    getLessonPlanRules(input.language),
    'Lesson generation context:',
    input.context?.trim() ? input.context.trim() : 'No extra context.'
  ];

  return {
    system: buildTaskSystemPrompt(
      input.language,
      'You generate lesson plans for a language training app.'
    ),
    user: userSections.join('\n\n')
  };
}
