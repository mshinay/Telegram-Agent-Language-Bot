import path from 'node:path';

import type { MistakeUnit } from '../types/lesson.js';
import type {
  MistakesPathConfig,
  MistakesWriteRequest,
  MistakesWriteResult,
  ObsidianStore
} from '../types/obsidian.js';
import { normalizeMarkdownLine } from '../utils/markdown.js';

function getLanguageDirectory(
  language: MistakesWriteRequest['lesson']['language'],
  pathConfig: Pick<MistakesPathConfig, 'japaneseDir' | 'englishDir'>
): string {
  return language === 'ja' ? pathConfig.japaneseDir : pathConfig.englishDir;
}

export function buildMistakesNotePath(
  input: Pick<MistakesWriteRequest, 'lesson' | 'pathConfig'>
): string {
  return path.posix.join(
    input.pathConfig.languageRoot,
    getLanguageDirectory(input.lesson.language, input.pathConfig),
    `${input.pathConfig.mistakesDir}.md`
  );
}

function buildMistakeKey(record: MistakeUnit): string {
  return [record.pattern, record.wrong, record.correct, record.explanation, record.tag].join(':');
}

function normalizeMistakeUnit(record: MistakeUnit): MistakeUnit | null {
  const pattern = normalizeMarkdownLine(record.pattern);
  const wrong = normalizeMarkdownLine(record.wrong);
  const correct = normalizeMarkdownLine(record.correct);
  const explanation = normalizeMarkdownLine(record.explanation);
  const tag = normalizeMarkdownLine(record.tag);

  if (!pattern || !wrong || !correct || !explanation || !tag) {
    return null;
  }

  return {
    pattern,
    wrong,
    correct,
    explanation,
    tag
  };
}

export function collectMistakeRecords(input: Pick<MistakesWriteRequest, 'lesson'>): MistakeUnit[] {
  const normalized = input.lesson.summary.mistakeUnits
    .map(normalizeMistakeUnit)
    .filter((record): record is MistakeUnit => record !== null);
  const seen = new Set<string>();

  return normalized.filter((record) => {
    const key = buildMistakeKey(record);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function renderMistakeUnit(entry: MistakeUnit, index: number): string {
  return [
    `#### Mistake ${index + 1}`,
    `- Pattern: ${entry.pattern}`,
    `- Wrong: ${entry.wrong}`,
    `- Correct: ${entry.correct}`,
    `- Explanation: ${entry.explanation}`,
    `- Tag: ${entry.tag}`
  ].join('\n');
}

export function renderMistakesMarkdown(input: Pick<MistakesWriteRequest, 'lesson' | 'writtenAt'>): {
  content: string;
  entries: MistakeUnit[];
} {
  const entries = collectMistakeRecords(input);
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
    '### Mistakes',
    entries.map(renderMistakeUnit).join('\n\n')
  ];

  return {
    content: `${lines.join('\n')}\n`,
    entries
  };
}

export async function writeMistakesEntry(
  store: ObsidianStore,
  request: MistakesWriteRequest
): Promise<MistakesWriteResult> {
  const relativePath = buildMistakesNotePath(request);
  const rendered = renderMistakesMarkdown(request);
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
