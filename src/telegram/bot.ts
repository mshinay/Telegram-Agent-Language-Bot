import { Bot } from 'grammy';
import { EnvHttpProxyAgent, fetch as undiciFetch, type Dispatcher, type RequestInit as UndiciRequestInit } from 'undici';

import type { AppConfig } from '../types/common.js';
import type { Logger } from '../logger.js';
import type { SessionStore } from '../types/session.js';
import { CommandRouter } from '../router/command-router.js';
import { sendWorkflowReply } from './message.js';
import type { LessonWorkflow } from '../workflow/lesson-workflow.js';

export interface BotDeps {
  config: AppConfig;
  logger: Logger;
  sessionStore: SessionStore;
  router: CommandRouter;
  workflow: LessonWorkflow;
}

class ChatTaskQueue {
  private readonly pending = new Map<number, Promise<void>>();

  public async run(chatId: number, task: () => Promise<void>): Promise<void> {
    const previous = this.pending.get(chatId) ?? Promise.resolve();
    const current = previous
      .catch(() => undefined)
      .then(task)
      .finally(() => {
        if (this.pending.get(chatId) === current) {
          this.pending.delete(chatId);
        }
      });

    this.pending.set(chatId, current);
    await current;
  }
}

interface AbortSignalLike {
  aborted: boolean;
  addEventListener(type: 'abort', listener: () => void, options?: { once?: boolean }): void;
}

function createAbortSignal(signal?: AbortSignalLike): AbortSignal | undefined {
  if (!signal) {
    return undefined;
  }

  const controller = new AbortController();
  if (signal.aborted) {
    controller.abort();
    return controller.signal;
  }

  signal.addEventListener('abort', () => controller.abort(), { once: true });
  return controller.signal;
}

function createTelegramFetch() {
  const hasProxy = Boolean(process.env.HTTPS_PROXY || process.env.HTTP_PROXY);
  const dispatcher: Dispatcher | undefined = hasProxy ? new EnvHttpProxyAgent() : undefined;

  return async (
    input: string | URL | Request,
    init?: RequestInit & Record<string, unknown>
  ) => {
    const { agent: _agent, compress: _compress, signal, ...rest } = init ?? {};
    const requestInit: UndiciRequestInit = {
      ...(rest as UndiciRequestInit)
    };
    const abortSignal = createAbortSignal(signal as AbortSignalLike | undefined);

    if (abortSignal) {
      requestInit.signal = abortSignal;
    }

    if (dispatcher) {
      requestInit.dispatcher = dispatcher;
    }

    return undiciFetch(input as string | URL, requestInit);
  };
}

export function createBot(deps: BotDeps): Bot {
  const bot = new Bot(deps.config.telegram.botToken, {
    client: {
      fetch: createTelegramFetch()
    }
  });
  const chatTaskQueue = new ChatTaskQueue();

  bot.on('message:text', async (ctx) => {
    const chatId = ctx.chat.id;
    const text = ctx.message.text;

    if (chatId !== deps.config.telegram.allowedChatId) {
      deps.logger.warn({ event: 'unauthorized_chat', chatId }, 'Unauthorized chat attempted access');
      await ctx.reply(deps.config.telegram.unauthorizedMessage);
      return;
    }

    await chatTaskQueue.run(chatId, async () => {
      const session = await deps.sessionStore.load();
      const action = deps.router.route(text, session);

      deps.logger.info(
        {
          event: 'workflow_action_received',
          chatId,
          textLength: text.length,
          status: session.status,
          lessonId: session.lessonId,
          action: action.type
        },
        'Received workflow action from Telegram chat'
      );

      try {
        const result = await deps.workflow.handle(action, session, { chatId });
        deps.logger.info(
          {
            event: 'telegram_reply_sent',
            chatId,
            action: action.type,
            status: result.session.status,
            previousStatus: session.status,
            lessonId: result.session.lessonId ?? session.lessonId,
            replyType: result.reply.type
          },
          'Completed workflow action for Telegram chat'
        );
        await sendWorkflowReply(ctx, result.reply, deps.config.telegram.replyCharLimit);
      } catch (error) {
        deps.logger.error(
          {
            event: 'workflow_handle_failed',
            chatId,
            action: action.type,
            status: session.status,
            lessonId: session.lessonId,
            error
          },
          'Failed to handle lesson workflow action'
        );
        await ctx.reply('当前发生未预期错误，请稍后重试。');
      }
    });
  });

  bot.catch((error) => {
    deps.logger.error({ event: 'telegram_bot_error', error }, 'Unhandled Telegram bot error');
  });

  return bot;
}
