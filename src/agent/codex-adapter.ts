import type { Logger } from '../logger.js';
import { answerFeedbackSchema, lessonPlanSchema, lessonSummarySchema } from '../schemas/lesson.js';
import { AgentTaskError, ProcessExecutionError, type AgentTaskName, type ProcessRunner } from '../types/agent.js';
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
import {
  AgentExecutionFailedError,
  AgentJsonParseError,
  AgentSchemaValidationError,
  parseAgentJson
} from './parser.js';

export interface CodexAdapterOptions {
  logger: Logger;
  processRunner: ProcessRunner;
  command: string[];
  timeoutMs: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

interface AgentRequestContext {
  stage: 'lesson_plan' | 'answer_evaluation' | 'summary_generation';
  language: string;
  questionId?: number;
  questionType?: string;
  previousQuestionCount?: number;
  answerCount?: number;
  questionCount?: number;
  topic?: string;
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
    return this.executeTask('generateLessonPlan', async () => {
      const prompt = buildLessonPlanPrompt(input satisfies GenerateLessonPlanPromptInput);
      const result = await this.runCodexTask('generateLessonPlan', prompt, {
        stage: 'lesson_plan',
        language: input.language
      });

      return parseAgentJson({
        taskName: 'generateLessonPlan',
        schema: lessonPlanSchema,
        result,
        logger: this.logger
      });
    });
  }

  public async evaluateAnswer(input: EvaluateAnswerInput) {
    return this.executeTask('evaluateAnswer', async () => {
      const prompt = buildEvaluateAnswerPrompt(input satisfies EvaluateAnswerPromptInput);
      const result = await this.runCodexTask('evaluateAnswer', prompt, {
        stage: 'answer_evaluation',
        language: input.language,
        questionId: input.question.id,
        questionType: input.question.type,
        previousQuestionCount: input.previousQuestions?.length ?? 0
      });

      return parseAgentJson({
        taskName: 'evaluateAnswer',
        schema: answerFeedbackSchema,
        result,
        logger: this.logger
      });
    });
  }

  public async generateSummary(input: GenerateSummaryInput) {
    return this.executeTask('generateSummary', async () => {
      const prompt = buildSummaryPrompt(input satisfies GenerateSummaryPromptInput);
      const result = await this.runCodexTask('generateSummary', prompt, {
        stage: 'summary_generation',
        language: input.language,
        answerCount: input.answers.length,
        questionCount: input.lesson.questions.length,
        topic: input.lesson.topic
      });

      return parseAgentJson({
        taskName: 'generateSummary',
        schema: lessonSummarySchema,
        result,
        logger: this.logger
      });
    });
  }

  private async executeTask<T>(taskName: AgentTaskName, task: () => Promise<T>): Promise<T> {
    try {
      return await task();
    } catch (error) {
      throw this.toAgentTaskError(taskName, error);
    }
  }

  private async runCodexTask(
    taskName: string,
    prompt: { system: string; user: string },
    context: AgentRequestContext
  ) {
    const command = this.command[0]!;
    const baseArgs = this.command.slice(1);
    const stdin = formatPrompt(prompt);
    const args = [...baseArgs, '--color', 'never', '-'];

    this.logger.info(
      {
        event: 'agent_request_started',
        backend: 'codex',
        taskName,
        ...context,
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
        ...context,
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

  private toAgentTaskError(taskName: AgentTaskName, error: unknown): AgentTaskError {
    if (error instanceof AgentTaskError) {
      return error;
    }

    if (error instanceof AgentExecutionFailedError) {
      return new AgentTaskError('Agent process did not complete successfully', {
        taskName,
        code: 'PROCESS_FAILED',
        cause: error
      });
    }

    if (error instanceof AgentJsonParseError) {
      return new AgentTaskError('Agent output could not be parsed as valid JSON', {
        taskName,
        code: 'OUTPUT_PARSE_FAILED',
        cause: error
      });
    }

    if (error instanceof AgentSchemaValidationError) {
      return new AgentTaskError('Agent output failed schema validation', {
        taskName,
        code: 'SCHEMA_VALIDATION_FAILED',
        cause: error
      });
    }

    if (error instanceof ProcessExecutionError) {
      return new AgentTaskError('Agent runner failed before process completion', {
        taskName,
        code: 'RUNNER_FAILED',
        cause: error
      });
    }

    return new AgentTaskError('Unexpected agent task failure', {
      taskName,
      code: 'UNKNOWN',
      cause: error
    });
  }
}
