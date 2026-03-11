import type { LanguageMode } from './lesson.js';

export type RouteAction =
  | { type: 'ping' }
  | { type: 'start_lesson'; language: LanguageMode }
  | { type: 'show_summary' }
  | { type: 'finish_lesson' }
  | { type: 'submit_answer'; text: string }
  | { type: 'invalid'; message: string };
