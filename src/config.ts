import { config as loadEnv } from 'dotenv';
import fs from 'fs-extra';
import path from 'node:path';

import { appConfigSchema } from './schemas/config.js';
import type { AppConfig } from './types/common.js';

interface RawConfig {
  telegram?: Partial<AppConfig['telegram']>;
  session?: Partial<AppConfig['session']>;
  agent?: Partial<AppConfig['agent']>;
  obsidian?: Partial<AppConfig['obsidian']>;
  logging?: Partial<AppConfig['logging']>;
}

function getDefaultAgentCommand(): string[] {
  if (process.platform === 'win32') {
    const windowsShell = process.env.ComSpec ?? 'cmd.exe';
    return [windowsShell, '/d', '/s', '/c', 'codex.cmd', 'exec'];
  }

  return ['codex', 'exec'];
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
    obsidian: {
      vaultPath: process.env.OBSIDIAN_VAULT_PATH ?? fileConfig.obsidian?.vaultPath ?? '',
      languageRoot: process.env.OBSIDIAN_LANGUAGE_ROOT ?? fileConfig.obsidian?.languageRoot ?? 'Language',
      journalDir: process.env.OBSIDIAN_JOURNAL_DIR ?? fileConfig.obsidian?.journalDir ?? 'Journal',
      japaneseDir: process.env.OBSIDIAN_JAPANESE_DIR ?? fileConfig.obsidian?.japaneseDir ?? 'Japanese',
      englishDir: process.env.OBSIDIAN_ENGLISH_DIR ?? fileConfig.obsidian?.englishDir ?? 'English',
      mistakesDir: process.env.OBSIDIAN_MISTAKES_DIR ?? fileConfig.obsidian?.mistakesDir ?? 'Mistakes',
      expressionsDir: process.env.OBSIDIAN_EXPRESSIONS_DIR ?? fileConfig.obsidian?.expressionsDir ?? 'Expressions'
    },
    logging: {
      level: process.env.LOG_LEVEL ?? fileConfig.logging?.level ?? 'info'
    }
  };

  return appConfigSchema.parse(mergedConfig);
}
