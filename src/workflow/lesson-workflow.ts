import type { RouteAction } from '../types/router.js';
import type { SessionState } from '../types/session.js';
import type { LessonPlan } from '../types/lesson.js';
import type { AppReply } from '../types/presentation.js';

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

export class LessonWorkflow {
  handle(action: RouteAction, session: SessionState): AppReply {
    switch (action.type) {
      case 'ping':
        return { type: 'text', text: 'pong' };
      case 'start_lesson': {
        const lesson = toLessonPlan(session);
        if (session.status === 'in_lesson' && session.language === action.language && lesson) {
          return {
            type: 'lesson_start',
            language: action.language,
            lesson,
            currentQuestionIndex: session.currentQuestionIndex
          };
        }

        return {
          type: 'status',
          title: '[Lesson Status]',
          lines: [
            `${action.language.toUpperCase()} 训练主流程尚未接入。`,
            '当前已完成消息格式化层，后续 workflow 接上后会直接复用这套输出。'
          ]
        };
      }
      case 'show_summary':
        if (session.draftSummary && session.language) {
          return {
            type: 'summary_draft',
            language: session.language,
            summary: session.draftSummary
          };
        }

        return {
          type: 'status',
          title: '[Summary]',
          lines: ['当前没有 summary 草稿。']
        };
      case 'finish_lesson':
        if (session.draftSummary && session.language) {
          return {
            type: 'summary_draft',
            language: session.language,
            summary: session.draftSummary
          };
        }

        return {
          type: 'status',
          title: '[Lesson Status]',
          lines:
            session.status === 'in_lesson'
              ? ['本轮训练结束后的总结草稿暂不可用。']
              : ['当前没有可结束的训练。']
        };
      case 'submit_answer':
        return {
          type: 'status',
          title: '[Lesson Status]',
          lines: [
            '已收到你的回答。',
            '答题评估 workflow 尚未接入，后续会在这里返回单题反馈和下一题。'
          ]
        };
      case 'invalid':
        return {
          type: 'status',
          title: '[Invalid Action]',
          lines: [`当前输入在这个阶段不可用。`, `原因：${action.message}`]
        };
      default:
        return {
          type: 'status',
          title: '[Workflow]',
          lines: ['unsupported']
        };
    }
  }
}
