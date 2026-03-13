import { z } from 'zod';

export const appConfigSchema = z.object({
  telegram: z.object({
    botToken: z.string().min(1, 'telegram.botToken is required'),
    allowedChatId: z.coerce.number().int(),
    longPollTimeoutSec: z.number().int().positive(),
    replyCharLimit: z.number().int().positive(),
    unauthorizedMessage: z.string().min(1)
  }),
  session: z.object({
    path: z.string().min(1)
  }),
  agent: z.object({
    command: z.array(z.string().min(1)).min(1),
    timeoutSec: z.number().int().positive()
  }),
  obsidian: z.object({
    vaultPath: z.string().min(1),
    languageRoot: z.string().min(1),
    journalDir: z.string().min(1),
    mistakesPath: z.string().min(1),
    expressionsPath: z.string().min(1)
  }),
  logging: z.object({
    level: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  })
});
