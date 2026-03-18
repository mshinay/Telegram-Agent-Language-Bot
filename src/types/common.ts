export type ISODateString = string;

export interface BotReply {
  text: string;
}

export interface TelegramConfig {
  botToken: string;
  allowedChatId: number;
  longPollTimeoutSec: number;
  replyCharLimit: number;
  unauthorizedMessage: string;
}

export interface SessionConfig {
  path: string;
}

export interface AgentConfig {
  command: string[];
  timeoutSec: number;
}

export interface ObsidianConfig {
  vaultPath: string;
  languageRoot: string;
  journalDir: string;
  japaneseDir: string;
  englishDir: string;
  mistakesDir: string;
  expressionsDir: string;
  learnerProfilePath: string;
}

export interface LoggingConfig {
  level: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
}

export interface AppConfig {
  telegram: TelegramConfig;
  session: SessionConfig;
  agent: AgentConfig;
  obsidian: ObsidianConfig;
  logging: LoggingConfig;
}
