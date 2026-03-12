import { config as loadEnv } from 'dotenv';
import fs from 'fs-extra';
import path from 'node:path';

import { appConfigSchema } from './schemas/config.js';
import type { AppConfig } from './types/common.js';

interface RawConfig {
  telegram?: Partial<AppConfig['telegram']>;
  session?: Partial<AppConfig['session']>;
  agent?: Partial<AppConfig['agent']>;
  logging?: Partial<AppConfig['logging']>;
}

function getDefaultAgentCommand(): string[] {
  return process.platform === 'win32' ? ['codex.cmd', 'exec'] : ['codex', 'exec'];
}

export async function loadConfig(): Promise<AppConfig> {
  loadEnv();

  const configPath = path.resolve(process.cwd(), 'config', 'default.json');
  let fileConfig: RawConfig = {};

  if (await fs.pathExists(configPath)) {
    fileConfig = await fs.readJson(configPath);
  }

  const mergedConfig = {
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN ?? fileConfig.telegram?.botToken ?? '',
      allowedChatId: process.env.TELEGRAM_ALLOWED_CHAT_ID ?? fileConfig.telegram?.allowedChatId,
      longPollTimeoutSec: Number(process.env.TELEGRAM_LONG_POLL_TIMEOUT_SEC ?? fileConfig.telegram?.longPollTimeoutSec ?? 20),
      replyCharLimit: fileConfig.telegram?.replyCharLimit ?? 3500,
      unauthorizedMessage: fileConfig.telegram?.unauthorizedMessage ?? 'unauthorized'
    },
    session: {
      path: process.env.SESSION_PATH ?? fileConfig.session?.path ?? 'data/session.json'
    },
    agent: {
      command: fileConfig.agent?.command ?? getDefaultAgentCommand(),
      timeoutSec: Number(process.env.AGENT_TIMEOUT_SEC ?? fileConfig.agent?.timeoutSec ?? 180)
    },
    logging: {
      level: process.env.LOG_LEVEL ?? fileConfig.logging?.level ?? 'info'
    }
  };

  return appConfigSchema.parse(mergedConfig);
}
