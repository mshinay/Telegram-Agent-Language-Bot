import { randomUUID } from 'node:crypto';

import type { Logger } from '../logger.js';
import type { AgentAdapter } from '../agent/agent-adapter.js';
import type { RouteAction } from '../types/router.js';
import type { ObsidianConfig } from '../types/common.js';
import type { SessionState, SessionStore, AnswerRecord, CompletedLessonSnapshot } from '../types/session.js';
import type { LanguageMode, LessonPlan } from '../types/lesson.js';
import type { AppReply } from '../types/presentation.js';
import type { ObsidianStore } from '../types/obsidian.js';
import { createEmptySessionState } from '../session/default-session.js';
import { writeJournalEntry } from '../obsidian/journal.js';
import { writeMistakesEntry } from '../obsidian/mistakes.js';
import { writeExpressionsEntry } from '../obsidian/expressions.js';

export interface LessonWorkflowDeps {
  agentAdapter: AgentAdapter;
  sessionStore: SessionStore;
  obsidianStore: ObsidianStore;
  obsidianConfig: ObsidianConfig;
  logger: Logger;
}

export interface LessonWorkflowResult {
  reply: AppReply;
  session: SessionState;
}

function toLessonPlan(session: SessionState): LessonPlan | null {
  if (!session.topic || !session.material || session.questions.length === 0) {
    return null;
  }

  return {
    topic: session.topic,
    material: session.material,
    questions: session.questions
  };
}

function createStatusReply(title: string, lines: string[]): AppReply {
  return { type: 'status', title, lines };
}

function createSummaryDraftReply(session: SessionState): AppReply {
  if (!session.language || !session.draftSummary) {
    throw new Error('Cannot create summary draft reply without language and draft summary');
  }

  return {
    type: 'summary_draft',
    language: session.language,
    summary: session.draftSummary
  };
}

function createStartedSession(language: LanguageMode, lesson: LessonPlan): SessionState {
  const now = new Date().toISOString();

  return {
    status: 'in_lesson',
    lessonId: randomUUID(),
    language,
    pendingStartLanguage: null,
    topic: lesson.topic,
    material: lesson.material,
    questions: lesson.questions,
    currentQuestionIndex: 0,
    answers: [],
    draftSummary: null,
    createdAt: now,
    updatedAt: now
  };
}

function createAnswerRecord(questionId: number, answer: string, feedback: AnswerRecord['feedback']): AnswerRecord {
  return {
    questionId,
    answer,
    feedback,
    answeredAt: new Date().toISOString()
  };
}

function toCompletedLessonSnapshot(session: SessionState): CompletedLessonSnapshot {
  if (
    !session.lessonId ||
    !session.language ||
    !session.topic ||
    !session.material ||
    !session.draftSummary ||
    !session.createdAt ||
    !session.updatedAt
  ) {
    throw new Error('Cannot build completed lesson snapshot from incomplete session');
  }

  const reviewItems = session.answers.flatMap((answerRecord) => {
    const question = session.questions.find((item) => item.id === answerRecord.questionId);
    if (!question) {
      return [];
    }

    return [{
      question,
      answer: answerRecord.answer,
      feedback: answerRecord.feedback
    }];
  });

  return {
    lessonId: session.lessonId,
    language: session.language,
    topic: session.topic,
    material: session.material,
    reviewItems,
    summary: session.draftSummary,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  };
}

export class LessonWorkflow {
  private readonly agentAdapter: AgentAdapter;
  private readonly sessionStore: SessionStore;
  private readonly obsidianStore: ObsidianStore;
  private readonly obsidianConfig: ObsidianConfig;
  private readonly logger: Logger;

  public constructor(deps: LessonWorkflowDeps) {
    this.agentAdapter = deps.agentAdapter;
    this.sessionStore = deps.sessionStore;
    this.obsidianStore = deps.obsidianStore;
    this.obsidianConfig = deps.obsidianConfig;
    this.logger = deps.logger;
  }

  public async handle(action: RouteAction, session: SessionState): Promise<LessonWorkflowResult> {
    switch (action.type) {
      case 'ping':
        return { reply: { type: 'text', text: 'pong' }, session };
      case 'start_lesson':
        return this.handleStartLesson(action.language, session);
      case 'show_summary':
        return this.handleShowSummary(session);
      case 'finish_lesson':
        return this.handleFinishLesson(session);
      case 'confirm_write':
        return this.handleConfirmWrite(session);
      case 'rewrite_summary':
        return this.handleRewriteSummary(session);
      case 'discard_summary':
        return this.handleDiscardSummary(session);
      case 'submit_answer':
        return this.handleSubmitAnswer(action.text, session);
      case 'invalid':
        return {
          reply: createStatusReply('[Invalid Action]', ['当前输入在这个阶段不可用。', `原因：${action.message}`]),
          session
        };
      default:
        return {
          reply: createStatusReply('[Workflow]', ['unsupported']),
          session
        };
    }
  }

  private async handleStartLesson(
    language: LanguageMode,
    session: SessionState
  ): Promise<LessonWorkflowResult> {
    if (session.status === 'in_lesson') {
      return {
        reply: createStatusReply('[Lesson Status]', [
          '当前已有进行中的训练。',
          `主题：${session.topic ?? '未命名主题'}`,
          '请继续答题，或先使用 /end 结束本轮训练。'
        ]),
        session
      };
    }

    if (session.status === 'awaiting_summary_confirmation') {
      return {
        reply: createStatusReply('[Lesson Status]', [
          '当前已有待处理的 summary draft。',
          '请先使用 /summary 查看当前草稿。'
        ]),
        session
      };
    }

    this.logger.info({ event: 'lesson_start_requested', language }, 'Starting lesson generation');

    const lesson = await this.agentAdapter.generateLessonPlan({ language });
    const nextSession = createStartedSession(language, lesson);

    await this.sessionStore.save(nextSession);

    return {
      reply: {
        type: 'lesson_start',
        language,
        lesson,
        currentQuestionIndex: 0
      },
      session: nextSession
    };
  }

  private async handleShowSummary(session: SessionState): Promise<LessonWorkflowResult> {
    if (session.draftSummary && session.language) {
      return {
        reply: createSummaryDraftReply(session),
        session
      };
    }

    if (session.status === 'in_lesson') {
      return {
        reply: createStatusReply('[Summary]', ['当前训练尚未生成 summary draft。', '请继续答题，或使用 /end 提前结束本轮训练。']),
        session
      };
    }

    return {
      reply: createStatusReply('[Summary]', ['当前没有 summary 草稿。']),
      session
    };
  }

  private async handleFinishLesson(session: SessionState): Promise<LessonWorkflowResult> {
    if (session.status !== 'in_lesson' || !session.language) {
      return {
        reply: createStatusReply('[Lesson Status]', ['当前没有可结束的训练。']),
        session
      };
    }

    const lesson = toLessonPlan(session);
    if (!lesson) {
      throw new Error('Cannot generate summary for an incomplete lesson session');
    }

    this.logger.info(
      {
        event: 'lesson_finish_requested',
        lessonId: session.lessonId,
        answerCount: session.answers.length
      },
      'Finishing lesson and generating summary'
    );

    const summary = await this.agentAdapter.generateSummary({
      language: session.language,
      lesson,
      answers: session.answers
    });
    const nextSession: SessionState = {
      ...session,
      status: 'awaiting_summary_confirmation',
      draftSummary: summary,
      updatedAt: new Date().toISOString()
    };

    await this.sessionStore.save(nextSession);

    return {
      reply: createSummaryDraftReply(nextSession),
      session: nextSession
    };
  }

  private async handleSubmitAnswer(
    text: string,
    session: SessionState
  ): Promise<LessonWorkflowResult> {
    if (session.status !== 'in_lesson' || !session.language) {
      return {
        reply: createStatusReply('[Lesson Status]', ['当前不在可答题状态。']),
        session
      };
    }

    const currentQuestion = session.questions[session.currentQuestionIndex];
    if (!currentQuestion) {
      throw new Error('Current question is missing for in_lesson session');
    }

    const feedback = await this.agentAdapter.evaluateAnswer({
      language: session.language,
      question: currentQuestion,
      userAnswer: text,
      material: session.material,
      previousQuestions: session.questions.slice(0, session.currentQuestionIndex)
    });
    const answerRecord = createAnswerRecord(currentQuestion.id, text, feedback);
    const answers = [...session.answers, answerRecord];
    const answeredQuestionIndex = session.currentQuestionIndex;
    const nextQuestionIndex = answeredQuestionIndex + 1;

    if (nextQuestionIndex >= session.questions.length) {
      const lesson = toLessonPlan(session);
      if (!lesson) {
        throw new Error('Cannot generate summary after final answer without lesson data');
      }

      const summary = await this.agentAdapter.generateSummary({
        language: session.language,
        lesson,
        answers
      });
      const nextSession: SessionState = {
        ...session,
        status: 'awaiting_summary_confirmation',
        answers,
        currentQuestionIndex: session.questions.length,
        draftSummary: summary,
        updatedAt: new Date().toISOString()
      };

      await this.sessionStore.save(nextSession);

      return {
        reply: createSummaryDraftReply(nextSession),
        session: nextSession
      };
    }

    const nextQuestion = session.questions[nextQuestionIndex] ?? null;
    const nextSession: SessionState = {
      ...session,
      answers,
      currentQuestionIndex: nextQuestionIndex,
      updatedAt: new Date().toISOString()
    };

    await this.sessionStore.save(nextSession);

    return {
      reply: {
        type: 'answer_feedback',
        language: session.language,
        currentQuestionIndex: answeredQuestionIndex,
        totalQuestions: session.questions.length,
        feedback,
        nextQuestion
      },
      session: nextSession
    };
  }

  private async handleConfirmWrite(session: SessionState): Promise<LessonWorkflowResult> {
    if (session.status !== 'awaiting_summary_confirmation' || !session.draftSummary || !session.language) {
      return {
        reply: createStatusReply('[Summary]', ['当前没有可确认写入的 summary draft。']),
        session
      };
    }

    const snapshot = toCompletedLessonSnapshot(session);
    const writtenAt = new Date().toISOString();

    try {
      const journalResult = await writeJournalEntry(this.obsidianStore, {
        lesson: snapshot,
        writtenAt,
        pathConfig: {
          languageRoot: this.obsidianConfig.languageRoot,
          journalDir: this.obsidianConfig.journalDir
        }
      });
      const mistakesResult = await writeMistakesEntry(this.obsidianStore, {
        lesson: snapshot,
        writtenAt,
        pathConfig: {
          languageRoot: this.obsidianConfig.languageRoot,
          japaneseDir: this.obsidianConfig.japaneseDir,
          englishDir: this.obsidianConfig.englishDir,
          mistakesDir: this.obsidianConfig.mistakesDir
        }
      });
      const expressionsResult = await writeExpressionsEntry(this.obsidianStore, {
        lesson: snapshot,
        writtenAt,
        pathConfig: {
          languageRoot: this.obsidianConfig.languageRoot,
          japaneseDir: this.obsidianConfig.japaneseDir,
          englishDir: this.obsidianConfig.englishDir,
          expressionsDir: this.obsidianConfig.expressionsDir
        }
      });

      this.logger.info(
        {
          event: 'summary_confirmed',
          lessonId: snapshot.lessonId,
          journalPath: journalResult.relativePath,
          mistakesPath: mistakesResult.relativePath,
          mistakesWritten: mistakesResult.written,
          expressionsPath: expressionsResult.relativePath,
          expressionsWritten: expressionsResult.written
        },
        'Confirmed lesson summary and wrote Obsidian notes'
      );

      await this.sessionStore.clear();
      const nextSession = createEmptySessionState();

      return {
        reply: createStatusReply('[Write Success]', [
          '本轮训练已写入 Obsidian，session 已清理。',
          `Journal：${journalResult.relativePath}`,
          mistakesResult.written
            ? `Mistakes：已追加 ${mistakesResult.entriesCount} 条到 ${mistakesResult.relativePath}`
            : `Mistakes：本轮无可追加条目，未写入 ${mistakesResult.relativePath}`,
          expressionsResult.written
            ? `Expressions：已追加 ${expressionsResult.entriesCount} 条到 ${expressionsResult.relativePath}`
            : `Expressions：本轮无可追加条目，未写入 ${expressionsResult.relativePath}`,
          '现在可以重新开始 /ja 或 /en。'
        ]),
        session: nextSession
      };
    } catch (error) {
      this.logger.error(
        {
          event: 'summary_confirm_write_failed',
          lessonId: session.lessonId,
          error
        },
        'Failed to confirm lesson summary write'
      );

      return {
        reply: createStatusReply('[Write Failed]', [
          '写入 Obsidian 失败，当前 summary draft 已保留。',
          '你可以稍后再次发送“确认写入”，或发送“重写总结”/“不写入”。'
        ]),
        session
      };
    }
  }

  private async handleRewriteSummary(session: SessionState): Promise<LessonWorkflowResult> {
    if (session.status !== 'awaiting_summary_confirmation' || !session.language) {
      return {
        reply: createStatusReply('[Summary]', ['当前没有可重写的 summary draft。']),
        session
      };
    }

    const lesson = toLessonPlan(session);
    if (!lesson) {
      throw new Error('Cannot rewrite summary without lesson data');
    }

    const summary = await this.agentAdapter.generateSummary({
      language: session.language,
      lesson,
      answers: session.answers
    });
    const nextSession: SessionState = {
      ...session,
      draftSummary: summary,
      updatedAt: new Date().toISOString()
    };

    await this.sessionStore.save(nextSession);

    return {
      reply: createSummaryDraftReply(nextSession),
      session: nextSession
    };
  }

  private async handleDiscardSummary(session: SessionState): Promise<LessonWorkflowResult> {
    if (session.status !== 'awaiting_summary_confirmation') {
      return {
        reply: createStatusReply('[Summary]', ['当前没有可放弃的 summary draft。']),
        session
      };
    }

    await this.sessionStore.clear();
    const nextSession = createEmptySessionState();

    return {
      reply: createStatusReply('[Summary Discarded]', [
        '已放弃本轮 summary draft，session 已清理。',
        '现在可以重新开始 /ja 或 /en。'
      ]),
      session: nextSession
    };
  }
}
