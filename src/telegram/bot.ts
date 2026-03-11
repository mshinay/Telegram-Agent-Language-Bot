import { Bot } from 'grammy';
import { EnvHttpProxyAgent, fetch as undiciFetch, type Dispatcher, type RequestInit as UndiciRequestInit } from 'undici';

import type { AppConfig } from '../types/common.js';
import type { Logger } from '../logger.js';
import type { SessionStore } from '../types/session.js';
import { CommandRouter } from '../router/command-router.js';
import { formatRouteReply } from './message.js';

export interface BotDeps {
  config: AppConfig;
  logger: Logger;
  sessionStore: SessionStore;
  router: CommandRouter;
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

  bot.on('message:text', async (ctx) => {
    const chatId = ctx.chat.id;
    const text = ctx.message.text;

    if (chatId !== deps.config.telegram.allowedChatId) {
      deps.logger.warn({ event: 'unauthorized_chat', chatId }, 'Unauthorized chat attempted access');
      await ctx.reply(deps.config.telegram.unauthorizedMessage);
      return;
    }

    const session = await deps.sessionStore.load();
    const action = deps.router.route(text, session);

    deps.logger.info(
      {
        event: 'route_resolved',
        chatId,
        status: session.status,
        action: action.type
      },
      'Resolved incoming text message'
    );

    await ctx.reply(formatRouteReply(action, session));
  });

  bot.catch((error) => {
    deps.logger.error({ event: 'telegram_bot_error', error }, 'Unhandled Telegram bot error');
  });

  return bot;
}
