import type { LanguageMode } from '../types/lesson.js';

export interface PromptPayload {
  system: string;
  user: string;
}

export function getExplanationLanguageInstruction(language: LanguageMode): string {
  switch (language) {
    case 'ja':
      return [
        'The training target is Japanese.',
        'Write all explanations, evaluations, and coaching text in Simplified Chinese.',
        'Any example target-language output must be in Japanese.'
      ].join('\n');
    case 'en':
      return [
        'The training target is English.',
        'Write all explanations, evaluations, and coaching text in Simplified Chinese.',
        'Any example target-language output must be in English.'
      ].join('\n');
  }
}

export function buildJsonOnlySystemPrompt(language: LanguageMode): string {
  return [
    getExplanationLanguageInstruction(language),
    'Return exactly one valid JSON object.',
    'Do not wrap the JSON in markdown fences.',
    'Do not add any prefix, suffix, commentary, headings, or notes.',
    'If you are unsure, still return the best possible JSON object that satisfies the required schema.',
    'Keep every string concise, concrete, and ready for direct parsing.'
  ].join('\n');
}

export function buildTaskSystemPrompt(language: LanguageMode, taskInstruction: string): string {
  return [taskInstruction, buildJsonOnlySystemPrompt(language)].join('\n');
}
