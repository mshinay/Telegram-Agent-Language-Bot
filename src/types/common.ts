export type ISODateString = string;

export interface BotReply {
  text: string;
}

export interface TelegramConfig {
  botToken: string;
  allowedChatId: number;
  pollIntervalSec: number;
  longPollTimeoutSec: number;
  replyCharLimit: number;
  unauthorizedMessage: string;
}

export interface SessionConfig {
  path: string;
}

export interface LoggingConfig {
  level: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
}

export interface AppConfig {
  telegram: TelegramConfig;
  session: SessionConfig;
  logging: LoggingConfig;
}
