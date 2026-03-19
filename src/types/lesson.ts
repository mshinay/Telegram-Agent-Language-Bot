export type LanguageMode = 'ja' | 'en';

export type QuestionType = 'translate' | 'paraphrase' | 'free_expression';

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

export interface MistakeUnit {
  pattern: string;
  wrong: string;
  correct: string;
  explanation: string;
  tag: string;
}

export interface ExpressionUnit {
  expression: string;
  example: string;
  meaning: string;
  usage: string;
  scene: string;
}

export interface LessonQuestionReview {
  question: Question;
  answer: string;
  feedback: AnswerFeedback;
}

export interface LessonSummary {
  topic: string;
  strengths: string[];
  mistakes: string[];
  naturalExpressions: string[];
  mistakeUnits: MistakeUnit[];
  expressionUnits: ExpressionUnit[];
  reviewPoints: string[];
  overallComment: string;
}
