import test from 'node:test';
import assert from 'node:assert/strict';

import { createLogger } from '../dist/logger.js';
import { lessonSummarySchema, mistakeUnitSchema, expressionUnitSchema } from '../dist/schemas/lesson.js';
import { renderMistakesMarkdown, writeMistakesEntry } from '../dist/obsidian/mistakes.js';
import { renderExpressionsMarkdown, writeExpressionsEntry } from '../dist/obsidian/expressions.js';
import { LessonWorkflow } from '../dist/workflow/lesson-workflow.js';
import { createEmptySessionState } from '../dist/session/default-session.js';
import type { AgentAdapter } from '../dist/agent/agent-adapter.js';
import type { ObsidianConfig } from '../dist/types/common.js';
import type { LessonSummary } from '../dist/types/lesson.js';
import type { ObsidianReadRequest, ObsidianReadResult, ObsidianStore, ObsidianWriteRequest, ObsidianWriteResult } from '../dist/types/obsidian.js';
import type { CompletedLessonSnapshot, SessionState, SessionStore } from '../dist/types/session.js';

const logger = createLogger('silent');

const summaryDraft: LessonSummary = {
  topic: 'Travel',
  strengths: ['表达清楚'],
  mistakes: ['冠词使用不稳定'],
  naturalExpressions: ['How have you been?'],
  mistakeUnits: [
    {
      pattern: 'article usage',
      wrong: 'I go to station.',
      correct: 'I go to the station.',
      explanation: '这里缺少定冠词，地点名词前需要补足。',
      tag: 'grammar'
    }
  ],
  expressionUnits: [
    {
      expression: 'How have you been?',
      example: 'How have you been lately?',
      meaning: '最近怎么样',
      usage: '用于询问对方近况',
      scene: 'greeting'
    }
  ],
  reviewPoints: ['复习地点名词前的冠词'],
  overallComment: '表达基本清楚，但细节还不稳定。'
};

const lessonSnapshot: CompletedLessonSnapshot = {
  lessonId: 'lesson-structured',
  language: 'ja',
  topic: 'Travel',
  material: 'A short travel dialogue.',
  reviewItems: [
    {
      question: { id: 1, type: 'translate', prompt: 'Translate hello.' },
      answer: 'Answer 1',
      feedback: {
        evaluation: 'Good',
        issues: ['Small grammar issue'],
        naturalVersion: 'A more natural answer',
        alternatives: ['Another answer']
      }
    }
  ],
  summary: summaryDraft,
  createdAt: '2026-03-15T09:00:00.000Z',
  updatedAt: '2026-03-15T10:00:00.000Z'
};

const obsidianConfig: ObsidianConfig = {
  vaultPath: 'vault',
  languageRoot: 'Language',
  journalDir: 'Journal',
  japaneseDir: 'Japanese',
  englishDir: 'English',
  mistakesDir: 'Mistakes',
  expressionsDir: 'Expressions',
  learnerProfilePath: ''
};

class MemorySessionStore implements SessionStore {
  public state: SessionState;

  public constructor(initialState: SessionState) {
    this.state = initialState;
  }

  public async load(): Promise<SessionState> {
    return this.state;
  }

  public async save(state: SessionState): Promise<void> {
    this.state = state;
  }

  public async clear(): Promise<void> {
    this.state = createEmptySessionState();
  }
}

class MemoryObsidianStore implements ObsidianStore {
  public readonly writes: ObsidianWriteRequest[] = [];
  public readonly files = new Map<string, string>();

  public resolvePath(relativePath: string): string {
    return `vault/${relativePath}`;
  }

  public async exists(relativePath: string): Promise<boolean> {
    return this.files.has(relativePath);
  }

  public async read(request: ObsidianReadRequest): Promise<ObsidianReadResult> {
    const content = this.files.get(request.relativePath) ?? null;
    return {
      relativePath: request.relativePath,
      absolutePath: this.resolvePath(request.relativePath),
      exists: content !== null,
      content
    };
  }

  public async write(request: ObsidianWriteRequest): Promise<ObsidianWriteResult> {
    this.writes.push(request);
    const existing = this.files.get(request.relativePath) ?? '';
    const nextContent = request.mode === 'append' ? `${existing}${request.content}` : request.content;
    this.files.set(request.relativePath, nextContent);
    return {
      relativePath: request.relativePath,
      absolutePath: this.resolvePath(request.relativePath)
    };
  }
}

function createAgentAdapter(): AgentAdapter {
  return {
    async generateLessonPlan() {
      throw new Error('not used');
    },
    async evaluateAnswer() {
      throw new Error('not used');
    },
    async generateSummary() {
      return summaryDraft;
    }
  };
}

test('structured lesson summary schema accepts valid learning units and rejects missing required fields', () => {
  const parsed = lessonSummarySchema.parse(summaryDraft);

  assert.equal(parsed.mistakeUnits[0]?.correct, 'I go to the station.');
  assert.equal(parsed.expressionUnits[0]?.scene, 'greeting');
  assert.equal(mistakeUnitSchema.safeParse({
    pattern: 'article usage',
    wrong: 'I go to station.',
    explanation: '缺少冠词',
    tag: 'grammar'
  }).success, false);
  assert.equal(expressionUnitSchema.safeParse({
    expression: 'How have you been?',
    example: 'How have you been lately?',
    meaning: '最近怎么样',
    usage: '用于询问近况'
  }).success, false);
});

test('mistakes writer renders structured units and keeps append mode for legacy note coexistence', async () => {
  const store = new MemoryObsidianStore();
  store.files.set('Language/Japanese/Mistakes.md', `# Legacy Mistakes\n- old bullet\n`);

  const rendered = renderMistakesMarkdown({
    lesson: lessonSnapshot,
    writtenAt: '2026-03-18T10:00:00.000Z'
  });
  const result = await writeMistakesEntry(store, {
    lesson: lessonSnapshot,
    writtenAt: '2026-03-18T10:00:00.000Z',
    pathConfig: {
      languageRoot: 'Language',
      japaneseDir: 'Japanese',
      englishDir: 'English',
      mistakesDir: 'Mistakes'
    }
  });

  assert.match(rendered.content, /#### Mistake 1/);
  assert.match(rendered.content, /- Wrong: I go to station\./);
  assert.match(rendered.content, /- Correct: I go to the station\./);
  assert.equal(result.relativePath, 'Language/Japanese/Mistakes.md');
  assert.equal(store.writes[0]?.mode, 'append');
  assert.match(store.files.get('Language/Japanese/Mistakes.md') ?? '', /# Legacy Mistakes/);
  assert.match(store.files.get('Language/Japanese/Mistakes.md') ?? '', /#### Mistake 1/);
});

test('expressions writer renders structured units and keeps append mode for legacy note coexistence', async () => {
  const store = new MemoryObsidianStore();
  store.files.set('Language/Japanese/Expressions.md', `# Legacy Expressions\n- old bullet\n`);

  const rendered = renderExpressionsMarkdown({
    lesson: lessonSnapshot,
    writtenAt: '2026-03-18T10:00:00.000Z'
  });
  const result = await writeExpressionsEntry(store, {
    lesson: lessonSnapshot,
    writtenAt: '2026-03-18T10:00:00.000Z',
    pathConfig: {
      languageRoot: 'Language',
      japaneseDir: 'Japanese',
      englishDir: 'English',
      expressionsDir: 'Expressions'
    }
  });

  assert.match(rendered.content, /#### Expression 1/);
  assert.match(rendered.content, /- Expression: How have you been\?/);
  assert.match(rendered.content, /- Meaning: 最近怎么样/);
  assert.equal(result.relativePath, 'Language/Japanese/Expressions.md');
  assert.equal(store.writes[0]?.mode, 'append');
  assert.match(store.files.get('Language/Japanese/Expressions.md') ?? '', /# Legacy Expressions/);
  assert.match(store.files.get('Language/Japanese/Expressions.md') ?? '', /#### Expression 1/);
});

test('workflow confirm_write persists structured mistake and expression units to obsidian notes', async () => {
  const session: SessionState = {
    status: 'awaiting_summary_confirmation',
    lessonId: 'lesson-summary',
    language: 'ja',
    pendingStartLanguage: null,
    topic: 'Travel',
    material: 'A short travel dialogue.',
    questions: [
      { id: 1, type: 'translate', prompt: 'Translate hello.' },
      { id: 2, type: 'paraphrase', prompt: 'Paraphrase the material.' },
      { id: 3, type: 'free_expression', prompt: 'Share your own travel plan.' }
    ],
    currentQuestionIndex: 3,
    answers: [
      {
        questionId: 1,
        answer: 'Answer 1',
        feedback: {
          evaluation: 'Good',
          issues: ['Small grammar issue'],
          naturalVersion: 'A more natural answer',
          alternatives: ['Another answer']
        },
        answeredAt: '2026-03-15T10:00:00.000Z'
      }
    ],
    draftSummary: summaryDraft,
    createdAt: '2026-03-15T09:00:00.000Z',
    updatedAt: '2026-03-15T10:00:00.000Z'
  };
  const obsidianStore = new MemoryObsidianStore();
  const workflow = new LessonWorkflow({
    agentAdapter: createAgentAdapter(),
    sessionStore: new MemorySessionStore(session),
    obsidianStore,
    obsidianConfig,
    logger
  });

  const result = await workflow.handle({ type: 'confirm_write' }, session);
  const mistakesWrite = obsidianStore.writes.find((entry) => entry.relativePath.endsWith('Mistakes.md'));
  const expressionsWrite = obsidianStore.writes.find((entry) => entry.relativePath.endsWith('Expressions.md'));

  assert.equal(result.reply.type, 'status');
  assert.ok(mistakesWrite);
  assert.ok(expressionsWrite);
  assert.match(mistakesWrite?.content ?? '', /- Wrong: I go to station\./);
  assert.match(mistakesWrite?.content ?? '', /- Explanation: 这里缺少定冠词，地点名词前需要补足。/);
  assert.match(expressionsWrite?.content ?? '', /- Example: How have you been lately\?/);
  assert.match(expressionsWrite?.content ?? '', /- Scene: greeting/);
});
