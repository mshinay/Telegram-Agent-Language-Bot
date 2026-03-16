import test from 'node:test';
import assert from 'node:assert/strict';

import { createLogger } from '../dist/logger.js';
import { normalizeStartupSession } from '../dist/app.js';
import { createEmptySessionState } from '../dist/session/default-session.js';
import type { SessionState, SessionStore } from '../dist/types/session.js';

class MemorySessionStore implements SessionStore {
  public state: SessionState;
  public readonly saves: SessionState[] = [];

  public constructor(initialState: SessionState) {
    this.state = initialState;
  }

  public async load(): Promise<SessionState> {
    return this.state;
  }

  public async save(state: SessionState): Promise<void> {
    this.state = state;
    this.saves.push(state);
  }

  public async clear(): Promise<void> {
    this.state = createEmptySessionState();
  }
}

test('normalizeStartupSession rewrites in_lesson session to interrupted', async () => {
  const sessionStore = new MemorySessionStore({
    status: 'in_lesson',
    lessonId: 'lesson-1',
    language: 'ja',
    pendingStartLanguage: 'en',
    topic: 'Travel',
    material: 'A short travel dialogue.',
    questions: [
      { id: 1, type: 'translate', prompt: 'Translate hello.' },
      { id: 2, type: 'paraphrase', prompt: 'Paraphrase the material.' },
      { id: 3, type: 'free_expression', prompt: 'Share your own travel plan.' }
    ],
    currentQuestionIndex: 1,
    answers: [],
    draftSummary: null,
    createdAt: '2026-03-15T09:00:00.000Z',
    updatedAt: '2026-03-15T10:00:00.000Z'
  });

  await normalizeStartupSession(sessionStore, createLogger('silent'));

  assert.equal(sessionStore.saves.length, 1);
  assert.equal(sessionStore.state.status, 'interrupted');
  assert.equal(sessionStore.state.pendingStartLanguage, null);
  assert.equal(sessionStore.state.lessonId, 'lesson-1');
});

