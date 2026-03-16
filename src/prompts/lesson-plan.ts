import type { LanguageMode } from '../types/lesson.js';
import { LESSON_MATERIAL_COUNT, LESSON_QUESTION_COUNT } from '../types/lesson.js';
import { buildTaskSystemPrompt, type PromptPayload } from './system.js';

export interface GenerateLessonPlanPromptInput {
  language: LanguageMode;
  context?: string | null;
}

function getLevelInstruction(language: LanguageMode): string {
  if (language === 'ja') {
    return [
      'Target learner level: around JLPT N2 overall, but output ability may be weaker than reading ability.',
      'Use practical Japanese suitable for upper-intermediate learners.',
      'Avoid extremely rare words, highly literary expressions, or niche professional vocabulary.'
    ].join('\n');
  }

  return [
    'Target learner level: around CEFR B1-B2 overall, with stronger reading than output.',
    'Use practical English suitable for upper-intermediate learners.',
    'Avoid extremely rare words, highly academic wording, or niche professional vocabulary.'
  ].join('\n');
}

function getLessonPlanRules(language: LanguageMode): string {
  const targetLanguage = language === 'ja' ? 'Japanese' : 'English';

  return [
    'Generate a lesson plan JSON object with this exact shape:',
    '{',
    '  "topic": string,',
    '  "material": string,',
    '  "questions": [',
    '    { "id": 1, "type": "translate", "prompt": string },',
    '    { "id": 2, "type": "paraphrase", "prompt": string },',
    '    { "id": 3, "type": "free_expression", "prompt": string }',
    '  ]',
    '}',
    `The material count is fixed to ${LESSON_MATERIAL_COUNT}.`,
    `The question count is fixed to ${LESSON_QUESTION_COUNT}.`,
    getLevelInstruction(language),
    `Set "topic" to a short training topic name in Simplified Chinese.`,
    `Set "material" to one short ${targetLanguage} passage for practice.`,
    'The material should be 3 to 6 sentences long.',
    'The material should describe one realistic daily, study, communication, or work-related situation.',
    'Set question ids to exactly 1, 2, 3 in order.',
    'Question 1 must be "translate".',
    'Question 2 must be "paraphrase".',
    'Question 3 must be "free_expression".',
    'Question 1 should require translation based directly on the material.',
    'Question 2 should require the learner to restate the material in the target language using different wording or sentence structure, not just copy the original.',
    'Question 3 should require the learner to express their own related idea, experience, plan, or opinion in the target language.',
    'All three questions must stay closely related to the same material topic.',
    'Each question prompt must be written in Simplified Chinese and must be specific and actionable.',
    'For the free-expression question, clearly state a minimum output requirement such as sentence count or key points.',
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
      'You generate structured lesson plans for a language output training app.'
    ),
    user: userSections.join('\n\n')
  };
}
