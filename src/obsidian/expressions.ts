import path from 'node:path';

import type { ExpressionUnit } from '../types/lesson.js';
import type {
  ExpressionsPathConfig,
  ExpressionsWriteRequest,
  ExpressionsWriteResult,
  ObsidianStore
} from '../types/obsidian.js';
import { normalizeMarkdownLine } from '../utils/markdown.js';

function getLanguageDirectory(
  language: ExpressionsWriteRequest['lesson']['language'],
  pathConfig: Pick<ExpressionsPathConfig, 'japaneseDir' | 'englishDir'>
): string {
  return language === 'ja' ? pathConfig.japaneseDir : pathConfig.englishDir;
}

export function buildExpressionsNotePath(
  input: Pick<ExpressionsWriteRequest, 'lesson' | 'pathConfig'>
): string {
  return path.posix.join(
    input.pathConfig.languageRoot,
    getLanguageDirectory(input.lesson.language, input.pathConfig),
    `${input.pathConfig.expressionsDir}.md`
  );
}

function buildExpressionKey(record: ExpressionUnit): string {
  return [record.expression, record.example, record.meaning, record.usage, record.scene].join(':');
}

function normalizeExpressionUnit(record: ExpressionUnit): ExpressionUnit | null {
  const expression = normalizeMarkdownLine(record.expression);
  const example = normalizeMarkdownLine(record.example);
  const meaning = normalizeMarkdownLine(record.meaning);
  const usage = normalizeMarkdownLine(record.usage);
  const scene = normalizeMarkdownLine(record.scene);

  if (!expression || !example || !meaning || !usage || !scene) {
    return null;
  }

  return {
    expression,
    example,
    meaning,
    usage,
    scene
  };
}

export function collectExpressionRecords(input: Pick<ExpressionsWriteRequest, 'lesson'>): ExpressionUnit[] {
  const normalized = input.lesson.summary.expressionUnits
    .map(normalizeExpressionUnit)
    .filter((record): record is ExpressionUnit => record !== null);
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

function renderExpressionUnit(entry: ExpressionUnit, index: number): string {
  return [
    `#### Expression ${index + 1}`,
    `- Expression: ${entry.expression}`,
    `- Example: ${entry.example}`,
    `- Meaning: ${entry.meaning}`,
    `- Usage: ${entry.usage}`,
    `- Scene: ${entry.scene}`
  ].join('\n');
}

export function renderExpressionsMarkdown(input: Pick<ExpressionsWriteRequest, 'lesson' | 'writtenAt'>): {
  content: string;
  entries: ExpressionUnit[];
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
    entries.map(renderExpressionUnit).join('\n\n')
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
  const relativePath = buildExpressionsNotePath(request);
  const rendered = renderExpressionsMarkdown(request);
  if (rendered.entries.length === 0) {
    return {
      relativePath,
      absolutePath: store.resolvePath(relativePath),
      written: false,
      content: '',
      entriesCount: 0
    };
  }

  const result = await store.write({
    relativePath,
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
