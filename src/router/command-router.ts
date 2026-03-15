import type { SessionState } from '../types/session.js';
import type { RouteAction } from '../types/router.js';

export class CommandRouter {
  route(text: string, session: SessionState): RouteAction {
    const normalized = text.trim();

    if (normalized === '/ping') {
      return { type: 'ping' };
    }

    if (normalized === '/ja') {
      return { type: 'start_lesson', language: 'ja' };
    }

    if (normalized === '/en') {
      return { type: 'start_lesson', language: 'en' };
    }

    if (normalized === '/summary') {
      return { type: 'show_summary' };
    }

    if (normalized === '/end') {
      return { type: 'finish_lesson' };
    }

    if (session.status === 'interrupted') {
      if (normalized === '恢复上次训练') {
        return { type: 'resume_interrupted_lesson' };
      }

      if (normalized === '放弃并开始新的训练') {
        return { type: 'discard_and_restart_lesson' };
      }
    }

    if (session.status === 'awaiting_summary_confirmation') {
      if (normalized === '确认写入') {
        return { type: 'confirm_write' };
      }

      if (normalized === '重写总结') {
        return { type: 'rewrite_summary' };
      }

      if (normalized === '不写入') {
        return { type: 'discard_summary' };
      }
    }

    if (!normalized) {
      return { type: 'invalid', message: 'empty_message' };
    }

    if (session.status === 'in_lesson') {
      return { type: 'submit_answer', text: normalized };
    }

    return { type: 'invalid', message: 'unsupported_in_current_state' };
  }
}
