import { ZodError, type ZodType } from 'zod';

import type { Logger } from '../logger.js';
import type { ProcessExecutionResult } from '../types/agent.js';

export class AgentExecutionFailedError extends Error {
  public readonly result: ProcessExecutionResult;

  public constructor(message: string, result: ProcessExecutionResult) {
    super(message);
    this.name = 'AgentExecutionFailedError';
    this.result = result;
  }
}

export class AgentJsonParseError extends Error {
  public readonly rawOutput: string;

  public constructor(message: string, rawOutput: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AgentJsonParseError';
    this.rawOutput = rawOutput;
  }
}

export class AgentSchemaValidationError extends Error {
  public readonly rawOutput: string;
  public readonly validationError: ZodError;

  public constructor(message: string, rawOutput: string, validationError: ZodError) {
    super(message, { cause: validationError });
    this.name = 'AgentSchemaValidationError';
    this.rawOutput = rawOutput;
    this.validationError = validationError;
  }
}

export interface ParseAgentJsonOptions<T> {
  taskName: string;
  schema: ZodType<T>;
  result: ProcessExecutionResult;
  logger: Logger;
}

interface ParsedJsonCandidate {
  jsonText: string;
  parsedJson: unknown;
}

function extractFencedJsonCandidates(rawOutput: string): string[] {
  const fencedMatches = rawOutput.match(/```(?:json)?\s*([\s\S]*?)```/gi) ?? [];

  return fencedMatches
    .map((match) => match.replace(/```(?:json)?/i, '').replace(/```$/, '').trim())
    .filter(Boolean);
}

function extractBalancedJsonObjectCandidates(rawOutput: string): string[] {
  const candidates: string[] = [];
  let inString = false;
  let escapeNext = false;
  let depth = 0;
  let startIndex = -1;

  for (let index = 0; index < rawOutput.length; index += 1) {
    const char = rawOutput[index];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      if (depth === 0) {
        startIndex = index;
      }

      depth += 1;
      continue;
    }

    if (char === '}') {
      if (depth === 0) {
        continue;
      }

      depth -= 1;

      if (depth === 0 && startIndex >= 0) {
        candidates.push(rawOutput.slice(startIndex, index + 1));
        startIndex = -1;
      }
    }
  }

  return candidates;
}

export function extractJsonCandidates(rawOutput: string): string[] {
  const trimmedOutput = rawOutput.trim();

  if (!trimmedOutput) {
    throw new AgentJsonParseError('Agent output is empty', rawOutput);
  }

  const directCandidates = [trimmedOutput];
  const candidates = [
    ...directCandidates,
    ...extractFencedJsonCandidates(rawOutput),
    ...extractBalancedJsonObjectCandidates(rawOutput)
  ];

  return [...new Set(candidates)];
}

function parseJsonCandidates(rawOutput: string): ParsedJsonCandidate[] {
  const parsedCandidates: ParsedJsonCandidate[] = [];

  for (const candidate of extractJsonCandidates(rawOutput)) {
    try {
      parsedCandidates.push({
        jsonText: candidate,
        parsedJson: JSON.parse(candidate)
      });
    } catch {
      continue;
    }
  }

  if (parsedCandidates.length === 0) {
    throw new AgentJsonParseError('Failed to extract valid JSON from agent output', rawOutput);
  }

  return parsedCandidates;
}

export function parseAgentJson<T>(options: ParseAgentJsonOptions<T>): T {
  const { taskName, schema, result, logger } = options;

  if (!result.ok) {
    logger.error(
      {
        event: 'agent_execution_failed',
        taskName,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        signal: result.signal,
        durationMs: result.durationMs,
        stderrPreview: result.stderr.slice(0, 500),
        stdoutPreview: result.stdout.slice(0, 500)
      },
      'Agent process did not complete successfully'
    );

    throw new AgentExecutionFailedError('Agent process did not complete successfully', result);
  }

  let parsedCandidates: ParsedJsonCandidate[];

  try {
    parsedCandidates = parseJsonCandidates(result.stdout);
  } catch (error) {
    logger.error(
      {
        event: 'agent_json_extract_failed',
        taskName,
        durationMs: result.durationMs,
        candidateCount: (() => {
          try {
            return extractJsonCandidates(result.stdout).length;
          } catch {
            return 0;
          }
        })(),
        stdoutPreview: result.stdout.slice(0, 500)
      },
      'Failed to extract JSON from agent output'
    );

    throw error;
  }
  let lastValidationError: ZodError | null = null;
  let lastJsonPreview = '';

  for (const candidate of parsedCandidates) {
    const parsedResult = schema.safeParse(candidate.parsedJson);

    if (parsedResult.success) {
      logger.info(
        {
          event: 'agent_output_parsed',
          taskName,
          durationMs: result.durationMs,
          candidateCount: parsedCandidates.length
        },
        'Agent output parsed successfully'
      );

      return parsedResult.data;
    }

    lastValidationError = parsedResult.error;
    lastJsonPreview = candidate.jsonText.slice(0, 500);
  }

  logger.error(
    {
      event: 'agent_schema_validation_failed',
      taskName,
      durationMs: result.durationMs,
      candidateCount: parsedCandidates.length,
      parseableCandidateCount: parsedCandidates.length,
      issues: lastValidationError?.issues ?? [],
      jsonPreview: lastJsonPreview
    },
    'Agent output failed schema validation'
  );

  throw new AgentSchemaValidationError(
    'Agent output failed schema validation',
    result.stdout,
    lastValidationError ?? new ZodError([])
  );
}
