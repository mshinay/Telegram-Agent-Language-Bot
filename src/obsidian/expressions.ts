import type { ExpressionRecord } from '../types/lesson.js';
import type {
  ExpressionsWriteRequest,
  ExpressionsWriteResult,
  ObsidianStore
} from '../types/obsidian.js';
import { normalizeMarkdownLine } from '../utils/markdown.js';

function buildExpressionKey(record: ExpressionRecord): string {
  return `${record.source}:${record.questionId ?? 'summary'}:${record.text}`;
}

function normalizeExpressionRecord(record: ExpressionRecord): ExpressionRecord | null {
  const text = normalizeMarkdownLine(record.text);
  if (!text) {
    return null;
  }

  return {
    text,
    source: record.source,
    questionId: record.questionId
  };
}

export function collectExpressionRecords(input: Pick<ExpressionsWriteRequest, 'lesson'>): ExpressionRecord[] {
  const summaryExpressions = input.lesson.summary.naturalExpressions.map((text) => ({
    text,
    source: 'summary' as const,
    questionId: null
  }));
  const naturalVersions = input.lesson.reviewItems.map((item) => ({
    text: item.feedback.naturalVersion,
    source: 'natural_version' as const,
    questionId: item.question.id
  }));
  const alternatives = input.lesson.reviewItems.flatMap((item) =>
    item.feedback.alternatives.map((text) => ({
      text,
      source: 'alternative' as const,
      questionId: item.question.id
    }))
  );
  const normalized = [...summaryExpressions, ...naturalVersions, ...alternatives]
    .map(normalizeExpressionRecord)
    .filter((record): record is ExpressionRecord => record !== null);
  const seen = new Set<string>();

  return normalized.filter((record) => {
    const key = buildExpressionKey(record);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function renderExpressionMetadata(record: ExpressionRecord): string {
  if (record.source === 'summary') {
    return 'summary';
  }

  if (record.source === 'natural_version') {
    return `q${record.questionId ?? '?'} natural`;
  }

  return `q${record.questionId ?? '?'} alt`;
}

export function renderExpressionsMarkdown(input: Pick<ExpressionsWriteRequest, 'lesson' | 'writtenAt'>): {
  content: string;
  entries: ExpressionRecord[];
} {
  const entries = collectExpressionRecords(input);
  if (entries.length === 0) {
    return {
      content: '',
      entries
    };
  }

  const lines = [
    `## ${input.writtenAt} ${input.lesson.language.toUpperCase()} ${input.lesson.topic}`,
    '',
    `- Lesson ID: ${input.lesson.lessonId}`,
    `- Date: ${input.writtenAt}`,
    `- Language: ${input.lesson.language}`,
    `- Topic: ${input.lesson.topic}`,
    '',
    '### Expressions',
    entries.map((entry) => `- [${renderExpressionMetadata(entry)}] ${entry.text}`).join('\n')
  ];

  return {
    content: `${lines.join('\n')}\n`,
    entries
  };
}

export async function writeExpressionsEntry(
  store: ObsidianStore,
  request: ExpressionsWriteRequest
): Promise<ExpressionsWriteResult> {
  const rendered = renderExpressionsMarkdown(request);
  if (rendered.entries.length === 0) {
    return {
      relativePath: request.expressionsPath,
      absolutePath: store.resolvePath(request.expressionsPath),
      written: false,
      content: '',
      entriesCount: 0
    };
  }

  const result = await store.write({
    relativePath: request.expressionsPath,
    content: rendered.content,
    mode: 'append'
  });

  return {
    ...result,
    written: true,
    content: rendered.content,
    entriesCount: rendered.entries.length
  };
}
