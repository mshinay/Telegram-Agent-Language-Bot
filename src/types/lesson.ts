export type LanguageMode = 'ja' | 'en';

export type QuestionType = 'translate' | 'retell';

export const LESSON_MATERIAL_COUNT = 1;
export const LESSON_QUESTION_COUNT = 3;

export interface Question {
  id: number;
  type: QuestionType;
  prompt: string;
}

export interface LessonPlan {
  topic: string;
  material: string;
  questions: Question[];
}

export interface AnswerFeedback {
  evaluation: string;
  issues: string[];
  naturalVersion: string;
  alternatives: string[];
}

export interface LessonQuestionReview {
  question: Question;
  answer: string;
  feedback: AnswerFeedback;
}

export interface MistakeRecord {
  text: string;
  source: 'summary' | 'feedback';
  questionId: number | null;
}

export interface ExpressionRecord {
  text: string;
  source: 'summary' | 'natural_version' | 'alternative';
  questionId: number | null;
}

export interface LessonSummary {
  topic: string;
  strengths: string[];
  mistakes: string[];
  naturalExpressions: string[];
  reviewPoints: string[];
  overallComment: string;
}
