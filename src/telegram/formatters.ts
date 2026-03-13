import {
  LESSON_QUESTION_COUNT,
  type AnswerFeedback,
  type LanguageMode,
  type LessonPlan,
  type LessonSummary,
  type Question
} from '../types/lesson.js';

export interface LessonStartFormatInput {
  language: LanguageMode;
  lesson: LessonPlan;
  currentQuestionIndex: number;
}

export interface CurrentQuestionFormatInput {
  language: LanguageMode;
  question: Question;
  currentQuestionIndex: number;
  totalQuestions?: number;
}

export interface AnswerFeedbackFormatInput {
  language: LanguageMode;
  feedback: AnswerFeedback;
  currentQuestionIndex: number;
  totalQuestions?: number;
  nextQuestion?: Question | null;
}

export interface SummaryDraftFormatInput {
  language: LanguageMode;
  summary: LessonSummary;
}

export interface StatusMessageFormatInput {
  title: string;
  lines: string[];
}

function formatLessonTag(language: LanguageMode): string {
  return language === 'ja' ? '[JA Lesson]' : '[EN Lesson]';
}

function formatQuestionProgress(currentQuestionIndex: number, totalQuestions: number): string {
  return `${currentQuestionIndex + 1}/${totalQuestions}`;
}

function formatQuestionPrompt(question: Question): string {
  if (question.type === 'translate') {
    return ['请完成翻译题：', question.prompt].join('\n');
  }

  return ['请完成复述题：', question.prompt].join('\n');
}

function formatList(items: string[]): string {
  if (items.length === 0) {
    return '- 无';
  }

  return items.map((item) => `- ${item}`).join('\n');
}

export function formatLessonStartMessage(input: LessonStartFormatInput): string {
  const currentQuestion = input.lesson.questions[input.currentQuestionIndex];

  return [
    formatLessonTag(input.language),
    `主题：${input.lesson.topic}`,
    `本轮共 ${input.lesson.questions.length} 题`,
    `当前题目：${formatQuestionProgress(input.currentQuestionIndex, input.lesson.questions.length)}`,
    '',
    '材料：',
    input.lesson.material,
    '',
    currentQuestion ? formatQuestionPrompt(currentQuestion) : '当前题目暂不可用。'
  ].join('\n');
}

export function formatCurrentQuestionMessage(input: CurrentQuestionFormatInput): string {
  const totalQuestions = input.totalQuestions ?? LESSON_QUESTION_COUNT;

  return [
    formatLessonTag(input.language),
    `当前题目：${formatQuestionProgress(input.currentQuestionIndex, totalQuestions)}`,
    '',
    formatQuestionPrompt(input.question)
  ].join('\n');
}

export function formatAnswerFeedbackMessage(input: AnswerFeedbackFormatInput): string {
  const totalQuestions = input.totalQuestions ?? LESSON_QUESTION_COUNT;
  const sections = [
    formatLessonTag(input.language),
    `当前题目：${formatQuestionProgress(input.currentQuestionIndex, totalQuestions)}`,
    '',
    '1. 你的回答评估',
    input.feedback.evaluation,
    '',
    '2. 具体问题',
    formatList(input.feedback.issues),
    '',
    '3. 更自然表达',
    input.feedback.naturalVersion,
    '',
    '4. 替代表达',
    formatList(input.feedback.alternatives)
  ];

  if (input.nextQuestion) {
    sections.push('', '下一题：', formatQuestionPrompt(input.nextQuestion));
  }

  return sections.join('\n');
}

export function formatSummaryDraftMessage(input: SummaryDraftFormatInput): string {
  return [
    formatLessonTag(input.language),
    '[Summary Draft]',
    `本次主题：${input.summary.topic}`,
    '',
    '1. 做得好的地方',
    formatList(input.summary.strengths),
    '',
    '2. 主要错误',
    formatList(input.summary.mistakes),
    '',
    '3. 更自然表达精选',
    formatList(input.summary.naturalExpressions),
    '',
    '4. 建议复习点',
    formatList(input.summary.reviewPoints),
    '',
    '5. 本次总体评价',
    input.summary.overallComment,
    '',
    '可执行动作：',
    '- 确认写入',
    '- 重写总结',
    '- 不写入',
    '- /summary'
  ].join('\n');
}

export function formatStatusMessage(input: StatusMessageFormatInput): string {
  return [input.title, ...input.lines].join('\n');
}
