import type { AnswerFeedback, LanguageMode, LessonPlan, LessonSummary, Question } from '../types/lesson.js';
import type { AnswerRecord } from '../types/session.js';

export interface GenerateLessonPlanInput {
  language: LanguageMode;
  context?: string | null;
}

export interface EvaluateAnswerInput {
  language: LanguageMode;
  question: Question;
  userAnswer: string;
  material?: string | null;
  previousQuestions?: Question[];
}

export interface GenerateSummaryInput {
  language: LanguageMode;
  lesson: LessonPlan;
  answers: AnswerRecord[];
}

export interface AgentAdapter {
  generateLessonPlan(input: GenerateLessonPlanInput): Promise<LessonPlan>;
  evaluateAnswer(input: EvaluateAnswerInput): Promise<AnswerFeedback>;
  generateSummary(input: GenerateSummaryInput): Promise<LessonSummary>;
}
