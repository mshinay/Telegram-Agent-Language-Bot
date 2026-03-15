import type { LanguageMode } from './lesson.js';

export type RouteAction =
  | { type: 'ping' }
  | { type: 'start_lesson'; language: LanguageMode }
  | { type: 'resume_interrupted_lesson' }
  | { type: 'discard_and_restart_lesson' }
  | { type: 'show_summary' }
  | { type: 'finish_lesson' }
  | { type: 'confirm_write' }
  | { type: 'rewrite_summary' }
  | { type: 'discard_summary' }
  | { type: 'submit_answer'; text: string }
  | { type: 'invalid'; message: string };
