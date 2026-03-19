import test from 'node:test';
import assert from 'node:assert/strict';

import { renderWorkflowReply } from '../dist/telegram/message.js';
import type { AppReply } from '../dist/types/presentation.js';
import type { AnswerFeedback, LessonSummary } from '../dist/types/lesson.js';

const feedback: AnswerFeedback = {
  evaluation: 'Good',
  issues: ['Grammar issue'],
  naturalVersion: 'A more natural answer',
  alternatives: ['Another answer']
};

const summary: LessonSummary = {
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

test('formatter renders final-answer feedback before summary draft', () => {
  const reply: AppReply = {
    type: 'answer_feedback_with_summary',
    language: 'ja',
    currentQuestionIndex: 2,
    totalQuestions: 3,
    feedback,
    summary
  };

  const rendered = renderWorkflowReply(reply);
  const feedbackIndex = rendered.indexOf('1. 你的回答评估');
  const summaryIndex = rendered.indexOf('[Summary Draft]');

  assert.notEqual(feedbackIndex, -1);
  assert.notEqual(summaryIndex, -1);
  assert.ok(feedbackIndex < summaryIndex);
});

test('formatter renders summary command output without feedback content', () => {
  const reply: AppReply = {
    type: 'summary_draft',
    language: 'ja',
    summary
  };

  const rendered = renderWorkflowReply(reply);

  assert.match(rendered, /\[Summary Draft\]/);
  assert.doesNotMatch(rendered, /1\. 你的回答评估/);
});
