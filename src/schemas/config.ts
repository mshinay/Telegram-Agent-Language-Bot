import { z } from 'zod';

export const appConfigSchema = z.object({
  telegram: z.object({
    botToken: z.string().min(1, 'telegram.botToken is required'),
    allowedChatId: z.coerce.number().int(),
    pollIntervalSec: z.number().int().positive(),
    longPollTimeoutSec: z.number().int().positive(),
    replyCharLimit: z.number().int().positive(),
    unauthorizedMessage: z.string().min(1)
  }),
  session: z.object({
    path: z.string().min(1)
  }),
  logging: z.object({
    level: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  })
});
