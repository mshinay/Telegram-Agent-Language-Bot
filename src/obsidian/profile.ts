import type { Logger } from '../logger.js';
import path from 'node:path';

import type { ObsidianConfig } from '../types/common.js';
import type { ObsidianStore } from '../types/obsidian.js';

export interface LearnerProfileReadResult {
  relativePath: string;
  content: string | null;
}

export function getLearnerProfileNotePath(
  config: Pick<ObsidianConfig, 'languageRoot' | 'learnerProfilePath'>
): string {
  const configuredPath = config.learnerProfilePath?.trim();

  if (configuredPath) {
    return configuredPath;
  }

  return path.posix.join(config.languageRoot, 'Profile', 'Language Profile.md');
}

export async function readLearnerProfileNote(
  store: ObsidianStore,
  config: Pick<ObsidianConfig, 'languageRoot' | 'learnerProfilePath'>,
  logger: Logger
): Promise<LearnerProfileReadResult> {
  const relativePath = getLearnerProfileNotePath(config);
  const result = await store.read({ relativePath });

  if (!result.exists || !result.content?.trim()) {
    logger.info(
      {
        event: 'learner_profile_note_missing',
        relativePath
      },
      'Learner profile note is unavailable for lesson generation'
    );

    return {
      relativePath,
      content: null
    };
  }

  return {
    relativePath,
    content: result.content.trim()
  };
}
