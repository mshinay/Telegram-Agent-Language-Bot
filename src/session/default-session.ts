import type { SessionState } from '../types/session.js';

export function createEmptySessionState(): SessionState {
  return {
    status: 'idle',
    lessonId: null,
    language: null,
    pendingStartLanguage: null,
    topic: null,
    material: null,
    questions: [],
    currentQuestionIndex: 0,
    answers: [],
    draftSummary: null,
    createdAt: null,
    updatedAt: null
  };
}
