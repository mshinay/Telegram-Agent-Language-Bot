import type { AnswerFeedback, LanguageMode, LessonPlan, LessonSummary, Question } from './lesson.js';

export type AppReply =
  | { type: 'text'; text: string }
  | { type: 'lesson_start'; language: LanguageMode; lesson: LessonPlan; currentQuestionIndex: number }
  | { type: 'current_question'; language: LanguageMode; question: Question; currentQuestionIndex: number; totalQuestions: number }
  | {
      type: 'answer_feedback';
      language: LanguageMode;
      currentQuestionIndex: number;
      totalQuestions: number;
      feedback: AnswerFeedback;
      nextQuestion?: Question | null;
    }
  | {
      type: 'answer_feedback_with_summary';
      language: LanguageMode;
      currentQuestionIndex: number;
      totalQuestions: number;
      feedback: AnswerFeedback;
      summary: LessonSummary;
    }
  | { type: 'summary_draft'; language: LanguageMode; summary: LessonSummary }
  | { type: 'status'; title: string; lines: string[] };
