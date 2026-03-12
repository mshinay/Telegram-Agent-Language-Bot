export interface ProcessExecutionRequest {
  command: string;
  args?: string[];
  stdin?: string;
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

export interface ProcessExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  signal: NodeJS.Signals | null;
  ok: boolean;
}

export interface ProcessRunner {
  run(request: ProcessExecutionRequest): Promise<ProcessExecutionResult>;
}

export interface ProcessExecutionRequestSnapshot {
  command: string;
  timeoutMs: number;
  args?: string[];
  cwd?: string;
  stdinBytes: number;
  envKeys: string[];
}

export class ProcessExecutionError extends Error {
  public readonly request: ProcessExecutionRequestSnapshot;

  public readonly durationMs: number;
  public readonly causeCode: string | undefined;

  public constructor(
    message: string,
    options: {
      request: ProcessExecutionRequest;
      durationMs: number;
      causeCode?: string;
      cause?: unknown;
    }
  ) {
    super(message, { cause: options.cause });
    this.name = 'ProcessExecutionError';
    this.request = {
      command: options.request.command,
      timeoutMs: options.request.timeoutMs,
      stdinBytes: Buffer.byteLength(options.request.stdin ?? ''),
      envKeys: Object.keys(options.request.env ?? {}),
      ...(options.request.args ? { args: options.request.args } : {}),
      ...(options.request.cwd ? { cwd: options.request.cwd } : {})
    };
    this.durationMs = options.durationMs;
    this.causeCode = options.causeCode;
  }
}
