import fs from 'fs-extra';
import path from 'node:path';

import { sessionStateSchema } from '../schemas/session.js';
import type { SessionState, SessionStore } from '../types/session.js';
import type { Logger } from '../logger.js';
import { createEmptySessionState } from './default-session.js';

export class FileSessionStore implements SessionStore {
  constructor(
    private readonly filePath: string,
    private readonly logger: Logger
  ) {}

  async load(): Promise<SessionState> {
    const exists = await fs.pathExists(this.filePath);
    if (!exists) {
      return createEmptySessionState();
    }

    try {
      const raw = await fs.readJson(this.filePath);
      return sessionStateSchema.parse(raw);
    } catch (error) {
      const emptyState = createEmptySessionState();

      this.logger.error(
        { event: 'session_load_failed', sessionPath: this.filePath, error },
        'Failed to load session file, recovering with empty session'
      );

      await this.recoverCorruptSessionFile(emptyState);
      return emptyState;
    }
  }

  async save(state: SessionState): Promise<void> {
    const parsed = sessionStateSchema.parse(state);
    await fs.ensureDir(path.dirname(this.filePath));
    await fs.writeJson(this.filePath, parsed, { spaces: 2 });
  }

  async clear(): Promise<void> {
    await this.save(createEmptySessionState());
  }

  private async recoverCorruptSessionFile(emptyState: SessionState): Promise<void> {
    const corruptPath = `${this.filePath}.corrupt-${Date.now()}`;

    try {
      await fs.ensureDir(path.dirname(this.filePath));
      await fs.move(this.filePath, corruptPath, { overwrite: true });
      this.logger.warn(
        { event: 'session_file_backed_up', sessionPath: this.filePath, corruptPath },
        'Backed up corrupt session file'
      );
    } catch (backupError) {
      this.logger.error(
        { event: 'session_backup_failed', sessionPath: this.filePath, backupError },
        'Failed to back up corrupt session file before reset'
      );
    }

    await this.save(emptyState);
  }
}
