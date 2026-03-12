import type { Bot } from 'grammy';

import { loadConfig } from './config.js';
import { CodexAdapter } from './agent/codex-adapter.js';
import { LocalProcessRunner } from './agent/process-runner.js';
import { createLogger } from './logger.js';
import { CommandRouter } from './router/command-router.js';
import { FileSessionStore } from './session/file-session-store.js';
import { createBot } from './telegram/bot.js';
import { LessonWorkflow } from './workflow/lesson-workflow.js';

export interface App {
  bot: Bot;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export async function createApp(): Promise<App> {
  const config = await loadConfig();
  const logger = createLogger(config.logging.level);
  const processRunner = new LocalProcessRunner({ logger });
  const agentAdapter = new CodexAdapter({
    logger,
    processRunner,
    command: config.agent.command,
    timeoutMs: config.agent.timeoutSec * 1000,
    cwd: process.cwd()
  });
  const sessionStore = new FileSessionStore(config.session.path, logger);
  const router = new CommandRouter();
  const workflow = new LessonWorkflow({
    agentAdapter,
    sessionStore,
    logger
  });
  const bot = createBot({
    config,
    logger,
    sessionStore,
    router,
    workflow
  });

  return {
    bot,
    async start() {
      logger.info(
        {
          event: 'app_starting',
          allowedChatId: config.telegram.allowedChatId,
          sessionPath: config.session.path,
          longPollTimeoutSec: config.telegram.longPollTimeoutSec
        },
        'Starting Telegram bot'
      );
      await bot.start({
        allowed_updates: ['message'],
        timeout: config.telegram.longPollTimeoutSec,
        onStart: (botInfo) => {
          logger.info(
            {
              event: 'bot_started',
              botId: botInfo.id,
              username: botInfo.username
            },
            'Telegram bot started'
          );
        }
      });
    },
    async stop() {
      logger.info({ event: 'app_stopping' }, 'Stopping Telegram bot');
      await bot.stop();
    }
  };
}
