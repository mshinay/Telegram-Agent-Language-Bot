import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from 'node:child_process';

import type { Logger } from '../logger.js';
import {
  ProcessExecutionError,
  type ProcessExecutionRequest,
  type ProcessExecutionResult,
  type ProcessRunner
} from '../types/agent.js';

type SpawnFactory = (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio
) => ChildProcessWithoutNullStreams;

export interface LocalProcessRunnerOptions {
  logger: Logger;
  spawnFactory?: SpawnFactory;
}

const PROCESS_FORCE_KILL_GRACE_MS = 1_000;

function getErrorCode(error: unknown): string | undefined {
  return error instanceof Error && 'code' in error ? String(error.code) : undefined;
}

export class LocalProcessRunner implements ProcessRunner {
  private readonly logger: Logger;
  private readonly spawnFactory: SpawnFactory;

  public constructor(options: LocalProcessRunnerOptions) {
    this.logger = options.logger;
    this.spawnFactory = options.spawnFactory ?? spawn;
  }

  public async run(request: ProcessExecutionRequest): Promise<ProcessExecutionResult> {
    const startedAt = Date.now();
    const args = request.args ?? [];
    const stdin = request.stdin ?? '';

    this.logger.info(
      {
        event: 'agent_process_started',
        command: request.command,
        args,
        cwd: request.cwd,
        timeoutMs: request.timeoutMs,
        stdinBytes: Buffer.byteLength(stdin),
        envKeys: Object.keys(request.env ?? {})
      },
      'Starting local agent process'
    );

    return new Promise<ProcessExecutionResult>((resolve, reject) => {
      let child: ChildProcessWithoutNullStreams;

      try {
        child = this.spawnFactory(request.command, args, {
          cwd: request.cwd,
          env: {
            ...process.env,
            ...request.env
          },
          stdio: 'pipe'
        });
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        const causeCode = getErrorCode(error);
        const executionError = new ProcessExecutionError('Failed to spawn local agent process', {
          request,
          durationMs,
          cause: error,
          ...(causeCode ? { causeCode } : {})
        });

        this.logger.error(
          {
            event: 'agent_process_spawn_failed',
            command: request.command,
            args,
            cwd: request.cwd,
            timeoutMs: request.timeoutMs,
            durationMs,
            stdinBytes: Buffer.byteLength(stdin),
            error: executionError
          },
          'Failed to spawn local agent process'
        );

        reject(executionError);
        return;
      }

      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let settled = false;
      let timeoutId: NodeJS.Timeout | undefined;
      let forceKillTimeoutId: NodeJS.Timeout | undefined;

      const clearTimersIfNeeded = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        if (forceKillTimeoutId) {
          clearTimeout(forceKillTimeoutId);
        }
      };

      const finalizeSuccess = (result: ProcessExecutionResult) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimersIfNeeded();

        const event = result.timedOut
          ? 'agent_process_timed_out'
          : result.exitCode === 0
            ? 'agent_process_completed'
            : 'agent_process_exited_nonzero';
        const message = result.timedOut
          ? 'Local agent process timed out'
          : result.exitCode === 0
            ? 'Local agent process completed'
            : 'Local agent process exited with non-zero status';

        this.logger.info(
          {
            event,
            command: request.command,
            args,
            exitCode: result.exitCode,
            signal: result.signal,
            timedOut: result.timedOut,
            ok: result.ok,
            durationMs: result.durationMs,
            stdoutBytes: Buffer.byteLength(result.stdout),
            stderrBytes: Buffer.byteLength(result.stderr)
          },
          message
        );

        resolve(result);
      };

      const finalizeError = (message: string, error: unknown) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimersIfNeeded();

        const durationMs = Date.now() - startedAt;
        const causeCode = getErrorCode(error);
        const executionError = new ProcessExecutionError(message, {
          request,
          durationMs,
          cause: error,
          ...(causeCode ? { causeCode } : {})
        });

        this.logger.error(
          {
            event: 'agent_process_failed',
            command: request.command,
            args,
            cwd: request.cwd,
            timeoutMs: request.timeoutMs,
            durationMs,
            stdoutBytes: Buffer.byteLength(stdout),
            stderrBytes: Buffer.byteLength(stderr),
            error: executionError
          },
          message
        );

        reject(executionError);
      };

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      child.stdout.on('data', (chunk: string) => {
        stdout += chunk;
      });

      child.stderr.on('data', (chunk: string) => {
        stderr += chunk;
      });

      child.on('error', (error) => {
        finalizeError('Local agent process failed during execution', error);
      });

      child.on('close', (exitCode, signal) => {
        finalizeSuccess({
          stdout,
          stderr,
          exitCode,
          timedOut,
          durationMs: Date.now() - startedAt,
          signal,
          ok: !timedOut && exitCode === 0
        });
      });

      timeoutId = setTimeout(() => {
        timedOut = true;
        this.logger.warn(
          {
            event: 'agent_process_timeout_signaled',
            command: request.command,
            args,
            timeoutMs: request.timeoutMs,
            graceMs: PROCESS_FORCE_KILL_GRACE_MS
          },
          'Local agent process exceeded timeout and will be terminated'
        );

        try {
          child.kill('SIGTERM');
        } catch (error) {
          finalizeError('Failed to terminate timed out local agent process', error);
          return;
        }

        forceKillTimeoutId = setTimeout(() => {
          try {
            const killSignalSent = child.kill('SIGKILL');

            if (!killSignalSent) {
              finalizeError(
                'Timed out local agent process could not be force-killed',
                new Error('SIGKILL signal could not be delivered to the timed out process')
              );
              return;
            }

            this.logger.warn(
              {
                event: 'agent_process_force_kill_signaled',
                command: request.command,
                args,
                timeoutMs: request.timeoutMs
              },
              'Sent force-kill signal to timed out local agent process'
            );
          } catch (error) {
            finalizeError('Failed to force-kill timed out local agent process', error);
            return;
          }
        }, PROCESS_FORCE_KILL_GRACE_MS);
      }, request.timeoutMs);

      child.stdin.on('error', (error) => {
        finalizeError('Failed to write stdin to local agent process', error);
      });

      child.stdin.end(stdin);
    });
  }
}
