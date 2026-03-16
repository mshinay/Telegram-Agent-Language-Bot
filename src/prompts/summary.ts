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
    'The lesson has three fixed question types: translation, paraphrase, and free expression.',
    '"topic" must exactly match the lesson topic.',
    '"strengths" must summarize the most important things the learner did well in Simplified Chinese.',
    'When relevant, strengths may mention translation accuracy, paraphrasing ability, self-expression ability, grammar stability, clarity, or naturalness.',
    'Do not fill "strengths" with vague praise. Prefer specific, evidence-based strengths that reflect actual performance in the answer records.',
    '"mistakes" must summarize recurring or important error patterns in Simplified Chinese, not just list isolated one-off details.',
    'When relevant, mistakes may mention meaning errors, omissions, weak paraphrasing, over-copying source wording, weak self-expression, grammar problems, awkward wording, or unnatural phrasing.',
    'Focus on the patterns that matter most for future improvement.',
    `"naturalExpressions" must contain useful and reusable natural ${targetLanguage} expressions from the material or corrected answers.`,
    'Only include high-value expressions worth reviewing later.',
    'Do not include overly generic expressions unless they are especially useful in this lesson context.',
    '"reviewPoints" must list concrete next-step review advice in Simplified Chinese.',
    'Each review point should be specific enough to guide the next practice session.',
    'When useful, review points may separately address translation accuracy, paraphrasing skill, and free-expression skill.',
    `"overallComment" must be a concise Simplified Chinese wrap-up of the learner's overall output ability.`,
    'It should reflect grammar stability, clarity, naturalness, and the difference between paraphrasing performance and self-expression performance when relevant.',
    'Use only the provided lesson and answer records.',
    'Do not include extra fields.'
  ].join('\n');
}

export function buildSummaryPrompt(input: GenerateSummaryPromptInput): PromptPayload {
  return {
    system: buildTaskSystemPrompt(
      input.language,
      'You generate structured lesson summaries for a language output training app.'
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
