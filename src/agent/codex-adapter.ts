import type { Logger } from '../logger.js';
import { answerFeedbackSchema, lessonPlanSchema, lessonSummarySchema } from '../schemas/lesson.js';
import { type ProcessRunner } from '../types/agent.js';
import {
  buildEvaluateAnswerPrompt,
  type EvaluateAnswerPromptInput
} from '../prompts/evaluate-answer.js';
import { buildLessonPlanPrompt, type GenerateLessonPlanPromptInput } from '../prompts/lesson-plan.js';
import { buildSummaryPrompt, type GenerateSummaryPromptInput } from '../prompts/summary.js';
import type {
  AgentAdapter,
  EvaluateAnswerInput,
  GenerateLessonPlanInput,
  GenerateSummaryInput
} from './agent-adapter.js';
import { parseAgentJson } from './parser.js';

export interface CodexAdapterOptions {
  logger: Logger;
  processRunner: ProcessRunner;
  command: string[];
  timeoutMs: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

function formatPrompt(input: { system: string; user: string }): string {
  return [
    'System instructions:',
    input.system,
    '',
    'User request:',
    input.user
  ].join('\n');
}

export class CodexAdapter implements AgentAdapter {
  private readonly logger: Logger;
  private readonly processRunner: ProcessRunner;
  private readonly command: string[];
  private readonly timeoutMs: number;
  private readonly cwd: string | undefined;
  private readonly env: NodeJS.ProcessEnv | undefined;

  public constructor(options: CodexAdapterOptions) {
    if (options.command.length === 0) {
      throw new Error('CodexAdapter command must not be empty');
    }

    this.logger = options.logger;
    this.processRunner = options.processRunner;
    this.command = options.command;
    this.timeoutMs = options.timeoutMs;
    this.cwd = options.cwd;
    this.env = options.env;
  }

  public async generateLessonPlan(input: GenerateLessonPlanInput) {
    const prompt = buildLessonPlanPrompt(input satisfies GenerateLessonPlanPromptInput);
    const result = await this.runCodexTask('generateLessonPlan', prompt);

    return parseAgentJson({
      taskName: 'generateLessonPlan',
      schema: lessonPlanSchema,
      result,
      logger: this.logger
    });
  }

  public async evaluateAnswer(input: EvaluateAnswerInput) {
    const prompt = buildEvaluateAnswerPrompt(input satisfies EvaluateAnswerPromptInput);
    const result = await this.runCodexTask('evaluateAnswer', prompt);

    return parseAgentJson({
      taskName: 'evaluateAnswer',
      schema: answerFeedbackSchema,
      result,
      logger: this.logger
    });
  }

  public async generateSummary(input: GenerateSummaryInput) {
    const prompt = buildSummaryPrompt(input satisfies GenerateSummaryPromptInput);
    const result = await this.runCodexTask('generateSummary', prompt);

    return parseAgentJson({
      taskName: 'generateSummary',
      schema: lessonSummarySchema,
      result,
      logger: this.logger
    });
  }

  private async runCodexTask(taskName: string, prompt: { system: string; user: string }) {
    const command = this.command[0]!;
    const baseArgs = this.command.slice(1);
    const stdin = formatPrompt(prompt);
    const args = [...baseArgs, '--color', 'never', '-'];

    this.logger.info(
      {
        event: 'agent_request_started',
        backend: 'codex',
        taskName,
        command,
        args,
        timeoutMs: this.timeoutMs,
        stdinBytes: Buffer.byteLength(stdin)
      },
      'Starting Codex agent request'
    );

    const result = await this.processRunner.run({
      command,
      args,
      stdin,
      timeoutMs: this.timeoutMs,
      ...(this.cwd ? { cwd: this.cwd } : {}),
      ...(this.env ? { env: this.env } : {})
    });

    this.logger.info(
      {
        event: 'agent_request_completed',
        backend: 'codex',
        taskName,
        ok: result.ok,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        durationMs: result.durationMs,
        stdoutBytes: Buffer.byteLength(result.stdout),
        stderrBytes: Buffer.byteLength(result.stderr)
      },
      'Completed Codex agent request'
    );

    return result;
  }
}
