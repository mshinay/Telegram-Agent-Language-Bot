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

    if (!normalized) {
      return { type: 'invalid', message: 'empty_message' };
    }

    if (session.status === 'in_lesson') {
      return { type: 'submit_answer', text: normalized };
    }

    return { type: 'invalid', message: 'unsupported_in_current_state' };
  }
}
