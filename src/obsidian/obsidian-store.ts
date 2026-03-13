import fs from 'fs-extra';
import path from 'node:path';

import type { Logger } from '../logger.js';
import {
  ObsidianStoreError,
  type ObsidianReadRequest,
  type ObsidianReadResult,
  type ObsidianStore,
  type ObsidianWriteRequest,
  type ObsidianWriteResult
} from '../types/obsidian.js';
import {
  normalizeMarkdownContent,
  prepareMarkdownAppendBlock,
  prepareMarkdownForWrite
} from '../utils/markdown.js';

export interface FileObsidianStoreOptions {
  vaultPath: string;
  logger: Logger;
}

function isPathInsideRoot(rootPath: string, targetPath: string): boolean {
  const relative = path.relative(rootPath, targetPath);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function findNearestExistingPath(absolutePath: string, stopPath: string): Promise<string> {
  let currentPath = absolutePath;
  const resolvedStopPath = path.resolve(stopPath);

  while (true) {
    if (await fs.pathExists(currentPath)) {
      return currentPath;
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      return resolvedStopPath;
    }

    if (path.resolve(parentPath) === resolvedStopPath) {
      return resolvedStopPath;
    }

    currentPath = parentPath;
  }
}

export class FileObsidianStore implements ObsidianStore {
  private readonly vaultPath: string;
  private readonly vaultRealPathPromise: Promise<string>;
  private readonly logger: Logger;

  public constructor(options: FileObsidianStoreOptions) {
    this.vaultPath = path.resolve(options.vaultPath);
    this.vaultRealPathPromise = fs.realpath(this.vaultPath).catch(() => this.vaultPath);
    this.logger = options.logger;
  }

  public resolvePath(relativePath: string): string {
    const normalizedRelativePath = relativePath.trim();

    if (!normalizedRelativePath) {
      throw new ObsidianStoreError('Obsidian relative path must not be empty', {
        code: 'INVALID_RELATIVE_PATH',
        relativePath,
        vaultPath: this.vaultPath
      });
    }

    const absolutePath = path.resolve(this.vaultPath, normalizedRelativePath);
    const isVaultRoot = absolutePath === this.vaultPath;

    if (!isVaultRoot && !isPathInsideRoot(this.vaultPath, absolutePath)) {
      throw new ObsidianStoreError('Obsidian path must stay inside the vault root', {
        code: 'PATH_OUTSIDE_VAULT',
        relativePath,
        vaultPath: this.vaultPath
      });
    }

    return absolutePath;
  }

  public async exists(relativePath: string): Promise<boolean> {
    const absolutePath = this.resolvePath(relativePath);
    return fs.pathExists(absolutePath);
  }

  public async read(request: ObsidianReadRequest): Promise<ObsidianReadResult> {
    const absolutePath = this.resolvePath(request.relativePath);
    await this.assertPathWithinVault(request.relativePath, absolutePath);
    const exists = await fs.pathExists(absolutePath);

    if (!exists) {
      return {
        relativePath: request.relativePath,
        absolutePath,
        exists: false,
        content: null
      };
    }

    try {
      const rawContent = await fs.readFile(absolutePath, 'utf8');
      return {
        relativePath: request.relativePath,
        absolutePath,
        exists: true,
        content: normalizeMarkdownContent(rawContent)
      };
    } catch (error) {
      this.logger.error(
        {
          event: 'obsidian_read_failed',
          vaultPath: this.vaultPath,
          relativePath: request.relativePath,
          absolutePath,
          error
        },
        'Failed to read Obsidian note'
      );

      throw new ObsidianStoreError('Failed to read Obsidian note', {
        code: 'READ_FAILED',
        relativePath: request.relativePath,
        vaultPath: this.vaultPath,
        cause: error
      });
    }
  }

  public async write(request: ObsidianWriteRequest): Promise<ObsidianWriteResult> {
    const absolutePath = this.resolvePath(request.relativePath);
    await this.assertPathWithinVault(request.relativePath, absolutePath);

    try {
      await fs.ensureDir(path.dirname(absolutePath));

      if (request.mode === 'append') {
        let content = prepareMarkdownForWrite(request.content, request.mode);
        const exists = await fs.pathExists(absolutePath);

        if (exists) {
          const currentContent = await fs.readFile(absolutePath, 'utf8');
          content = prepareMarkdownAppendBlock(currentContent, content);
        }

        if (content) {
          await fs.appendFile(absolutePath, content, 'utf8');
        }
      } else {
        const content = prepareMarkdownForWrite(request.content, request.mode);
        await fs.writeFile(absolutePath, content, 'utf8');
      }

      return {
        relativePath: request.relativePath,
        absolutePath
      };
    } catch (error) {
      this.logger.error(
        {
          event: 'obsidian_write_failed',
          vaultPath: this.vaultPath,
          relativePath: request.relativePath,
          absolutePath,
          mode: request.mode,
          error
        },
        'Failed to write Obsidian note'
      );

      throw new ObsidianStoreError('Failed to write Obsidian note', {
        code: 'WRITE_FAILED',
        relativePath: request.relativePath,
        vaultPath: this.vaultPath,
        cause: error
      });
    }
  }

  private async assertPathWithinVault(relativePath: string, absolutePath: string): Promise<void> {
    const vaultRealPath = await this.vaultRealPathPromise;
    const nearestExistingPath = await findNearestExistingPath(absolutePath, this.vaultPath);
    const nearestExistingRealPath = await fs.realpath(nearestExistingPath).catch(() => nearestExistingPath);

    if (nearestExistingRealPath !== vaultRealPath && !isPathInsideRoot(vaultRealPath, nearestExistingRealPath)) {
      throw new ObsidianStoreError('Obsidian path resolves outside the vault root', {
        code: 'PATH_OUTSIDE_VAULT',
        relativePath,
        vaultPath: this.vaultPath
      });
    }
  }
}
