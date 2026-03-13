export type ObsidianWriteMode = 'append' | 'overwrite';

export interface ObsidianReadRequest {
  relativePath: string;
}

export interface ObsidianReadResult {
  relativePath: string;
  absolutePath: string;
  exists: boolean;
  content: string | null;
}

export interface ObsidianWriteRequest {
  relativePath: string;
  content: string;
  mode: ObsidianWriteMode;
}

export interface ObsidianWriteResult {
  relativePath: string;
  absolutePath: string;
}

export interface ObsidianStore {
  resolvePath(relativePath: string): string;
  exists(relativePath: string): Promise<boolean>;
  read(request: ObsidianReadRequest): Promise<ObsidianReadResult>;
  write(request: ObsidianWriteRequest): Promise<ObsidianWriteResult>;
}

export type ObsidianStoreErrorCode =
  | 'INVALID_RELATIVE_PATH'
  | 'PATH_OUTSIDE_VAULT'
  | 'READ_FAILED'
  | 'WRITE_FAILED';

export class ObsidianStoreError extends Error {
  public readonly code: ObsidianStoreErrorCode;
  public readonly relativePath: string;
  public readonly vaultPath: string;

  public constructor(
    message: string,
    options: {
      code: ObsidianStoreErrorCode;
      relativePath: string;
      vaultPath: string;
      cause?: unknown;
    }
  ) {
    super(message, { cause: options.cause });
    this.name = 'ObsidianStoreError';
    this.code = options.code;
    this.relativePath = options.relativePath;
    this.vaultPath = options.vaultPath;
  }
}
