import type { SessionState } from '../types/session.js';
import type { RouteAction } from '../types/router.js';

export function formatRouteReply(action: RouteAction, session: SessionState): string {
  switch (action.type) {
    case 'ping':
      return 'pong';
    case 'start_lesson':
      return action.language === 'ja'
        ? 'JA 训练流程尚未接入，本轮先返回占位消息。'
        : 'EN 训练流程尚未接入，本轮先返回占位消息。';
    case 'show_summary':
      return session.draftSummary
        ? `当前总结草稿主题：${session.draftSummary.topic}`
        : '当前没有 summary 草稿。';
    case 'finish_lesson':
      return '当前阶段尚未接入结束训练与总结流程。';
    case 'submit_answer':
      return '当前阶段未接入训练流程，已收到你的文本消息。';
    case 'invalid':
      return '当前输入在这个阶段不可用。';
    default:
      return 'unsupported';
  }
}
