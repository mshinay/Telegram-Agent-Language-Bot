import type {
  AnswerFeedback,
  LanguageMode,
  LessonQuestionReview,
  LessonSummary,
  Question
} from './lesson.js';
import type { ISODateString } from './common.js';

export type LessonStatus =
  | 'idle'
  | 'in_lesson'
  | 'awaiting_summary_confirmation'
  | 'interrupted';

export interface AnswerRecord {
  questionId: number;
  answer: string;
  feedback: AnswerFeedback;
  answeredAt: ISODateString;
}

export interface SessionState {
  status: LessonStatus;
  lessonId: string | null;
  language: LanguageMode | null;
  pendingStartLanguage: LanguageMode | null;
  topic: string | null;
  material: string | null;
  questions: Question[];
  currentQuestionIndex: number;
  answers: AnswerRecord[];
  draftSummary: LessonSummary | null;
  createdAt: ISODateString | null;
  updatedAt: ISODateString | null;
}

export interface CompletedLessonSnapshot {
  lessonId: string;
  language: LanguageMode;
  topic: string;
  material: string;
  reviewItems: LessonQuestionReview[];
  summary: LessonSummary;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface SessionStore {
  load(): Promise<SessionState>;
  save(state: SessionState): Promise<void>;
  clear(): Promise<void>;
}
