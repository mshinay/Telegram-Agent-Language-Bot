import test from 'node:test';
import assert from 'node:assert/strict';

import { createLogger } from '../dist/logger.js';
import { LessonWorkflow } from '../dist/workflow/lesson-workflow.js';
import { createEmptySessionState } from '../dist/session/default-session.js';
import { AgentTaskError } from '../dist/types/agent.js';
import { ObsidianStoreError } from '../dist/types/obsidian.js';
import type { AgentAdapter } from '../dist/agent/agent-adapter.js';
import type { ObsidianConfig } from '../dist/types/common.js';
import type { AnswerFeedback, LessonPlan, LessonSummary } from '../dist/types/lesson.js';
import type { ObsidianReadRequest, ObsidianReadResult, ObsidianStore, ObsidianWriteRequest, ObsidianWriteResult } from '../dist/types/obsidian.js';
import type { SessionState, SessionStore } from '../dist/types/session.js';

const logger = createLogger('silent');
const expectedProfilePath = 'Language/Profile/Language Profile.md';

const lessonPlan: LessonPlan = {
  topic: 'Travel',
  material: 'A short travel dialogue.',
  questions: [
    { id: 1, type: 'translate', prompt: 'Translate hello.' },
    { id: 2, type: 'paraphrase', prompt: 'Paraphrase the material.' },
    { id: 3, type: 'free_expression', prompt: 'Share your own travel plan.' }
  ]
};

const answerFeedback: AnswerFeedback = {
  evaluation: 'Good',
  issues: ['Small grammar issue'],
  naturalVersion: 'A more natural answer',
  alternatives: ['Another answer']
};

const summaryDraft: LessonSummary = {
  topic: 'Travel',
  strengths: ['Clear meaning'],
  mistakes: ['Article usage'],
  naturalExpressions: ['How have you been?'],
  mistakeUnits: [
    {
      pattern: 'article',
      wrong: 'I go to station.',
      correct: 'I go to the station.',
      explanation: '冠词缺失。',
      tag: 'grammar'
    }
  ],
  expressionUnits: [
    {
      expression: 'How have you been?',
      example: 'How have you been lately?',
      meaning: '最近怎么样',
      usage: '用于关心近况的寒暄',
      scene: 'greeting'
    }
  ],
  reviewPoints: ['Review articles'],
  overallComment: 'Keep practicing.'
};

const obsidianConfig: ObsidianConfig = {
  vaultPath: 'vault',
  languageRoot: 'Language',
  journalDir: 'Journal',
  japaneseDir: 'Japanese',
  englishDir: 'English',
  mistakesDir: 'Mistakes.md',
  expressionsDir: 'Expressions.md',
  learnerProfilePath: ''
};

class MemorySessionStore implements SessionStore {
  public state: SessionState;
  public readonly saves: SessionState[] = [];
  public clearCount = 0;

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
    this.clearCount += 1;
    this.state = createEmptySessionState();
  }
}

class MemoryObsidianStore implements ObsidianStore {
  public readonly writes: ObsidianWriteRequest[] = [];
  public profileContent: string | null = null;
  public lastReadRelativePath: string | null = null;

  public constructor(
    private readonly failOnWrite = false,
    private readonly failOnRead = false
  ) {}

  public resolvePath(relativePath: string): string {
    return `vault/${relativePath}`;
  }

  public async exists(_relativePath: string): Promise<boolean> {
    return false;
  }

  public async read(request: ObsidianReadRequest): Promise<ObsidianReadResult> {
    this.lastReadRelativePath = request.relativePath;

    if (this.failOnRead) {
      throw new ObsidianStoreError('read failed', {
        code: 'READ_FAILED',
        relativePath: request.relativePath,
        vaultPath: 'vault'
      });
    }

    return {
      relativePath: request.relativePath,
      absolutePath: this.resolvePath(request.relativePath),
      exists: this.profileContent !== null,
      content: this.profileContent
    };
  }

  public async write(request: ObsidianWriteRequest): Promise<ObsidianWriteResult> {
    if (this.failOnWrite) {
      throw new Error('write failed');
    }

    this.writes.push(request);
    return {
      relativePath: request.relativePath,
      absolutePath: this.resolvePath(request.relativePath)
    };
  }
}

function createAgentAdapter(overrides: Partial<AgentAdapter> = {}): AgentAdapter {
  return {
    async generateLessonPlan() {
      return lessonPlan;
    },
    async evaluateAnswer() {
      return answerFeedback;
    },
    async generateSummary() {
      return summaryDraft;
    },
    ...overrides
  };
}

function createWorkflow(options: {
  session: SessionState;
  agentAdapter?: AgentAdapter;
  obsidianStore?: ObsidianStore;
}) {
  const sessionStore = new MemorySessionStore(options.session);
  const workflow = new LessonWorkflow({
    agentAdapter: options.agentAdapter ?? createAgentAdapter(),
    sessionStore,
    obsidianStore: options.obsidianStore ?? new MemoryObsidianStore(),
    obsidianConfig,
    logger
  });

  return { workflow, sessionStore };
}

function createInterruptedSession(): SessionState {
  return {
    status: 'interrupted',
    lessonId: 'lesson-interrupted',
    language: 'en',
    pendingStartLanguage: null,
    topic: 'Travel',
    material: 'A short travel dialogue.',
    questions: lessonPlan.questions,
    currentQuestionIndex: 1,
    answers: [{
      questionId: 1,
      answer: 'Hello',
      feedback: answerFeedback,
      answeredAt: '2026-03-15T10:00:00.000Z'
    }],
    draftSummary: null,
    createdAt: '2026-03-15T09:00:00.000Z',
    updatedAt: '2026-03-15T10:00:00.000Z'
  };
}

function createInLessonSession(): SessionState {
  return {
    status: 'in_lesson',
    lessonId: 'lesson-active',
    language: 'ja',
    pendingStartLanguage: null,
    topic: lessonPlan.topic,
    material: lessonPlan.material,
    questions: lessonPlan.questions,
    currentQuestionIndex: 1,
    answers: [{
      questionId: 1,
      answer: 'Answer 1',
      feedback: answerFeedback,
      answeredAt: '2026-03-15T10:00:00.000Z'
    }],
    draftSummary: null,
    createdAt: '2026-03-15T09:00:00.000Z',
    updatedAt: '2026-03-15T10:00:00.000Z'
  };
}

function createAwaitingSummarySession(): SessionState {
  return {
    status: 'awaiting_summary_confirmation',
    lessonId: 'lesson-summary',
    language: 'ja',
    pendingStartLanguage: null,
    topic: lessonPlan.topic,
    material: lessonPlan.material,
    questions: lessonPlan.questions,
    currentQuestionIndex: 3,
    answers: [{
      questionId: 1,
      answer: 'Answer 1',
      feedback: answerFeedback,
      answeredAt: '2026-03-15T10:00:00.000Z'
    }],
    draftSummary: summaryDraft,
    createdAt: '2026-03-15T09:00:00.000Z',
    updatedAt: '2026-03-15T10:00:00.000Z'
  };
}

test('workflow returns recovery prompt when interrupted session starts new lesson', async () => {
  const initialSession = createInterruptedSession();
  const { workflow, sessionStore } = createWorkflow({ session: initialSession });

  const result = await workflow.handle({ type: 'start_lesson', language: 'ja' }, initialSession, { chatId: 42 });

  assert.equal(result.reply.type, 'status');
  assert.equal(result.reply.title, '[Resume Lesson]');
  assert.equal(result.session.status, 'interrupted');
  assert.equal(result.session.pendingStartLanguage, 'ja');
  assert.equal(sessionStore.saves.length, 1);
});

test('workflow resumes interrupted lesson back to in_lesson', async () => {
  const initialSession = createInterruptedSession();
  const { workflow, sessionStore } = createWorkflow({ session: initialSession });

  const result = await workflow.handle({ type: 'resume_interrupted_lesson' }, initialSession);

  assert.equal(result.reply.type, 'current_question');
  assert.equal(result.session.status, 'in_lesson');
  assert.equal(result.session.pendingStartLanguage, null);
  assert.equal(sessionStore.saves.length, 1);
});

test('workflow discards interrupted lesson and starts a new lesson', async () => {
  const initialSession = {
    ...createInterruptedSession(),
    pendingStartLanguage: 'ja' as const
  };
  const { workflow, sessionStore } = createWorkflow({ session: initialSession });

  const result = await workflow.handle({ type: 'discard_and_restart_lesson' }, initialSession);

  assert.equal(result.reply.type, 'lesson_start');
  assert.equal(result.session.status, 'in_lesson');
  assert.equal(result.session.language, 'ja');
  assert.notEqual(result.session.lessonId, initialSession.lessonId);
  assert.equal(result.session.pendingStartLanguage, null);
  assert.equal(sessionStore.saves.length, 1);
});

test('workflow passes learner profile content into lesson generation when available', async () => {
  let receivedContext: string | null | undefined;
  const obsidianStore = new MemoryObsidianStore();
  obsidianStore.profileContent = '# Learner Profile\nFocus on travel speaking.';
  const agentAdapter = createAgentAdapter({
    async generateLessonPlan(input) {
      receivedContext = input.context;
      return lessonPlan;
    }
  });
  const initialSession = createEmptySessionState();
  const { workflow } = createWorkflow({ session: initialSession, agentAdapter, obsidianStore });

  const result = await workflow.handle({ type: 'start_lesson', language: 'ja' }, initialSession);

  assert.equal(result.reply.type, 'lesson_start');
  assert.equal(receivedContext, '# Learner Profile\nFocus on travel speaking.');
  assert.equal(obsidianStore.lastReadRelativePath, expectedProfilePath);
});

test('workflow starts lesson without context when learner profile is unavailable', async () => {
  let receivedContext: string | null | undefined = 'unset';
  const obsidianStore = new MemoryObsidianStore();
  const agentAdapter = createAgentAdapter({
    async generateLessonPlan(input) {
      receivedContext = input.context;
      return lessonPlan;
    }
  });
  const initialSession = createEmptySessionState();
  const { workflow } = createWorkflow({ session: initialSession, agentAdapter, obsidianStore });

  const result = await workflow.handle({ type: 'start_lesson', language: 'ja' }, initialSession);

  assert.equal(result.reply.type, 'lesson_start');
  assert.equal(receivedContext, undefined);
  assert.equal(obsidianStore.lastReadRelativePath, expectedProfilePath);
});

test('workflow starts lesson when learner profile read fails', async () => {
  let receivedContext: string | null | undefined = 'unset';
  const obsidianStore = new MemoryObsidianStore(false, true);
  const agentAdapter = createAgentAdapter({
    async generateLessonPlan(input) {
      receivedContext = input.context;
      return lessonPlan;
    }
  });
  const initialSession = createEmptySessionState();
  const { workflow } = createWorkflow({ session: initialSession, agentAdapter, obsidianStore });

  const result = await workflow.handle({ type: 'start_lesson', language: 'ja' }, initialSession);

  assert.equal(result.reply.type, 'lesson_start');
  assert.equal(receivedContext, undefined);
  assert.equal(obsidianStore.lastReadRelativePath, expectedProfilePath);
});

test('workflow keeps in_lesson state when finish summary generation fails', async () => {
  const initialSession = createInLessonSession();
  const failingAgent = createAgentAdapter({
    async generateSummary() {
      throw new AgentTaskError('summary failed', {
        taskName: 'generateSummary',
        code: 'PROCESS_FAILED'
      });
    }
  });
  const { workflow, sessionStore } = createWorkflow({ session: initialSession, agentAdapter: failingAgent });

  const result = await workflow.handle({ type: 'finish_lesson' }, initialSession);

  assert.equal(result.reply.type, 'status');
  assert.equal(result.reply.title, '[Summary Failed]');
  assert.equal(result.session.status, 'in_lesson');
  assert.equal(sessionStore.saves.length, 0);
});

test('workflow keeps existing draft when rewrite summary fails', async () => {
  const initialSession = createAwaitingSummarySession();
  const failingAgent = createAgentAdapter({
    async generateSummary() {
      throw new AgentTaskError('rewrite failed', {
        taskName: 'generateSummary',
        code: 'PROCESS_FAILED'
      });
    }
  });
  const { workflow, sessionStore } = createWorkflow({ session: initialSession, agentAdapter: failingAgent });

  const result = await workflow.handle({ type: 'rewrite_summary' }, initialSession);

  assert.equal(result.reply.type, 'status');
  assert.equal(result.reply.title, '[Rewrite Failed]');
  assert.equal(result.session.status, 'awaiting_summary_confirmation');
  assert.deepEqual(result.session.draftSummary, initialSession.draftSummary);
  assert.equal(sessionStore.saves.length, 0);
});

test('workflow keeps awaiting_summary_confirmation when confirm write fails', async () => {
  const initialSession = createAwaitingSummarySession();
  const { workflow, sessionStore } = createWorkflow({
    session: initialSession,
    obsidianStore: new MemoryObsidianStore(true)
  });

  const result = await workflow.handle({ type: 'confirm_write' }, initialSession);

  assert.equal(result.reply.type, 'status');
  assert.equal(result.reply.title, '[Write Failed]');
  assert.equal(result.session.status, 'awaiting_summary_confirmation');
  assert.deepEqual(result.session.draftSummary, initialSession.draftSummary);
  assert.equal(sessionStore.clearCount, 0);
  assert.equal(sessionStore.saves.length, 0);
});

test('workflow returns feedback and summary together after final answer', async () => {
  const initialSession: SessionState = {
    ...createInLessonSession(),
    currentQuestionIndex: 2,
    answers: [
      {
        questionId: 1,
        answer: 'Answer 1',
        feedback: answerFeedback,
        answeredAt: '2026-03-15T10:00:00.000Z'
      },
      {
        questionId: 2,
        answer: 'Answer 2',
        feedback: answerFeedback,
        answeredAt: '2026-03-15T10:05:00.000Z'
      }
    ]
  };
  const { workflow, sessionStore } = createWorkflow({ session: initialSession });

  const result = await workflow.handle({ type: 'submit_answer', text: 'Answer 3' }, initialSession);

  assert.equal(result.reply.type, 'answer_feedback_with_summary');
  assert.equal(result.reply.currentQuestionIndex, 2);
  assert.deepEqual(result.reply.feedback, answerFeedback);
  assert.deepEqual(result.reply.summary, summaryDraft);
  assert.equal(result.session.status, 'awaiting_summary_confirmation');
  assert.equal(result.session.currentQuestionIndex, 3);
  assert.deepEqual(result.session.draftSummary, summaryDraft);
  assert.equal(result.session.answers.length, 3);
  assert.equal(sessionStore.saves.length, 1);
});

test('workflow returns feedback only for non-final answer submissions', async () => {
  const initialSession = createInLessonSession();
  const { workflow, sessionStore } = createWorkflow({ session: initialSession });

  const result = await workflow.handle({ type: 'submit_answer', text: 'Answer 2 revised' }, initialSession);

  assert.equal(result.reply.type, 'answer_feedback');
  assert.equal(result.reply.currentQuestionIndex, 1);
  assert.equal(result.session.status, 'in_lesson');
  assert.equal(result.session.currentQuestionIndex, 2);
  assert.equal(result.session.draftSummary, null);
  assert.equal(result.session.answers.length, 2);
  assert.equal(sessionStore.saves.length, 1);
});

