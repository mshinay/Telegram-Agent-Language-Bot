import path from 'node:path';

import type { MistakeRecord } from '../types/lesson.js';
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

function buildMistakeKey(record: MistakeRecord): string {
  return `${record.source}:${record.questionId ?? 'summary'}:${record.text}`;
}

function normalizeMistakeRecord(record: MistakeRecord): MistakeRecord | null {
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

export function collectMistakeRecords(input: Pick<MistakesWriteRequest, 'lesson'>): MistakeRecord[] {
  const summaryMistakes = input.lesson.summary.mistakes.map((text) => ({
    text,
    source: 'summary' as const,
    questionId: null
  }));
  const feedbackMistakes = input.lesson.reviewItems.flatMap((item) =>
    item.feedback.issues.map((text) => ({
      text,
      source: 'feedback' as const,
      questionId: item.question.id
    }))
  );
  const normalized = [...summaryMistakes, ...feedbackMistakes]
    .map(normalizeMistakeRecord)
    .filter((record): record is MistakeRecord => record !== null);
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

function renderMistakeMetadata(record: MistakeRecord): string {
  if (record.source === 'summary') {
    return 'summary';
  }

  return `q${record.questionId ?? '?'}`;
}

export function renderMistakesMarkdown(input: Pick<MistakesWriteRequest, 'lesson' | 'writtenAt'>): {
  content: string;
  entries: MistakeRecord[];
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
    entries.map((entry) => `- [${renderMistakeMetadata(entry)}] ${entry.text}`).join('\n')
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
