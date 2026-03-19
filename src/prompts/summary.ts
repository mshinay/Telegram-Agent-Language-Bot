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
    '  "mistakeUnits": [{ "pattern": string, "wrong": string, "correct": string, "explanation": string, "tag": string }],',
    '  "expressionUnits": [{ "expression": string, "example": string, "meaning": string, "usage": string, "scene": string }],',
    '  "reviewPoints": string[],',
    '  "overallComment": string',
    '}',

    `The learner practiced ${targetLanguage}.`,
    'The lesson has three fixed question types: translation, paraphrase, and free expression.',

    'General principles:',
    '- Use only the provided lesson and answer records.',
    '- Prefer cross-question patterns over isolated details.',
    '- Focus on the most important 1–3 insights, not completeness.',
    '- Avoid repetition across fields; each field has a distinct role.',
    '- Prefer empty arrays over low-value or generic content.',
    '- Do not create entries just to fill the schema.',

    'Field rules:',

    '"topic": must exactly match the lesson topic.',

    '"strengths":',
    '- Summarize the most important strengths shown in this session.',
    '- Focus on patterns (e.g., stable grammar, accurate translation, effective paraphrasing).',
    '- Do not repeat overallComment or give vague praise.',

    '"mistakes":',
    '- Summarize key error patterns only (not individual sentences).',
    '- Focus on issues that impact future improvement.',
    '- Do not include corrections or examples here.',

    `"naturalExpressions":`,
    `- List high-value reusable ${targetLanguage} expressions from material or corrected answers.`,
    '- Keep it concise; only include expressions worth reviewing later.',

    '"mistakeUnits":',
    '- Include only the most valuable 1–3 structured mistakes for review.',
    '- "pattern": short error label.',
    '- "wrong": should come from the learner answer when possible (light normalization allowed).',
    '- "correct": corrected form.',
    '- "explanation": short Simplified Chinese explanation.',
    '- "tag": short category (grammar / wording / meaning / paraphrase).',
    '- Use empty array if no high-value items.',

    '"expressionUnits":',
    '- Include only 1–3 expressions worth long-term reuse.',
    `- "expression" and "example" in ${targetLanguage}.`,
    '- "meaning", "usage", "scene" in Simplified Chinese.',
    '- Use empty array if no high-value items.',

    '"reviewPoints":',
    '- Provide concrete next-step training advice.',
    '- Focus on what to practice next (not repeating mistakes).',
    '- Keep each point actionable and specific.',

    '"overallComment":',
    '- Concise overall evaluation in Simplified Chinese.',
    '- Reflect grammar stability, clarity, and naturalness.',
    '- If relevant, compare paraphrasing vs free expression ability.',

    'Output rules:',
    '- Return exactly one valid JSON object.',
    '- No markdown, no extra text, no comments.'
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