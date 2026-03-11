export type LanguageMode = 'ja' | 'en';

export type QuestionType = 'translate' | 'retell';

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

export interface LessonSummary {
  topic: string;
  strengths: string[];
  mistakes: string[];
  naturalExpressions: string[];
  reviewPoints: string[];
  overallComment: string;
}
