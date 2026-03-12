import type { LanguageMode, Question } from '../types/lesson.js';
import { buildTaskSystemPrompt, type PromptPayload } from './system.js';

export interface EvaluateAnswerPromptInput {
  language: LanguageMode;
  question: Question;
  userAnswer: string;
  material?: string | null;
  previousQuestions?: Question[];
}

function getEvaluateAnswerRules(language: LanguageMode): string {
  const targetLanguage = language === 'ja' ? 'Japanese' : 'English';

  return [
    'Evaluate the learner answer and return a JSON object with this exact shape:',
    '{',
    '  "evaluation": string,',
    '  "issues": string[],',
    '  "naturalVersion": string,',
    '  "alternatives": string[]',
    '}',
    `The learner is practicing ${targetLanguage}.`,
    '"evaluation" must explicitly state whether the answer is incorrect, correct but unnatural, or correct and natural, then briefly explain why in Simplified Chinese.',
    '"issues" must list concrete problems in Simplified Chinese. Use an empty array when there is no issue.',
    `"naturalVersion" must be a corrected, natural ${targetLanguage} answer.`,
    `"alternatives" must be alternative natural ${targetLanguage} expressions. Use an empty array when none are needed.`,
    'If the answer is fully correct but not natural enough, say so explicitly and focus the issues on awkward wording, nuance, or collocation.',
    'If the answer is clearly wrong, say so explicitly and focus the issues on meaning, grammar, or missing information.',
    'Judge the answer against the current question first, then use the material and prior question context only as support.',
    'Do not include extra fields.'
  ].join('\n');
}

export function buildEvaluateAnswerPrompt(input: EvaluateAnswerPromptInput): PromptPayload {
  const previousQuestions = input.previousQuestions?.length
    ? JSON.stringify(input.previousQuestions, null, 2)
    : '[]';

  return {
    system: buildTaskSystemPrompt(
      input.language,
      'You evaluate learner answers for a language training app.'
    ),
    user: [
      getEvaluateAnswerRules(input.language),
      'Current question:',
      JSON.stringify(input.question, null, 2),
      'Reference material:',
      input.material?.trim() ? input.material.trim() : 'No reference material.',
      'Previous question context:',
      previousQuestions,
      'Learner answer:',
      input.userAnswer.trim() || '(empty answer)'
    ].join('\n\n')
  };
}
