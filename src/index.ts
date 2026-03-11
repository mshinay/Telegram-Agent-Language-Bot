import { ZodError } from 'zod';

import { createApp } from './app.js';

async function main(): Promise<void> {
  const app = await createApp();

  process.once('SIGINT', async () => {
    await app.stop();
    process.exit(0);
  });

  process.once('SIGTERM', async () => {
    await app.stop();
    process.exit(0);
  });

  await app.start();
}

main().catch((error: unknown) => {
  if (error instanceof ZodError) {
    console.error('Configuration validation failed:', JSON.stringify(error.flatten(), null, 2));
    process.exit(1);
  }

  console.error('Application failed to start:', error);
  process.exit(1);
});
