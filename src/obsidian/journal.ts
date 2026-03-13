import path from 'node:path';

import type { LanguageMode, LessonQuestionReview } from '../types/lesson.js';
import type {
  JournalPathConfig,
  JournalWriteRequest,
  JournalWriteResult,
  ObsidianStore
} from '../types/obsidian.js';

function getLanguageLabel(language: LanguageMode): string {
  return language === 'ja' ? 'Japanese' : 'English';
}

function getQuestionTypeLabel(type: LessonQuestionReview['question']['type']): string {
  return type === 'translate' ? 'Translate' : 'Retell';
}

function formatMarkdownList(items: string[]): string {
  if (items.length === 0) {
    return '- None';
  }

  return items.map((item) => `- ${item}`).join('\n');
}

function getDateParts(isoDate: string): { year: string; day: string } {
  const day = isoDate.slice(0, 10);
  return {
    year: day.slice(0, 4),
    day
  };
}

export function buildJournalNotePath(input: Pick<JournalWriteRequest, 'writtenAt' | 'lesson' | 'pathConfig'>): string {
  const { year, day } = getDateParts(input.writtenAt);
  return path.posix.join(
    input.pathConfig.languageRoot,
    input.pathConfig.journalDir,
    year,
    `${day}-${input.lesson.language}.md`
  );
}

export function renderJournalMarkdown(input: Pick<JournalWriteRequest, 'writtenAt' | 'lesson'>): string {
  const sections = [
    `## ${input.writtenAt} ${getLanguageLabel(input.lesson.language)} Lesson`,
    '',
    `- Lesson ID: ${input.lesson.lessonId}`,
    `- Date: ${input.writtenAt}`,
    `- Language: ${input.lesson.language}`,
    `- Topic: ${input.lesson.topic}`,
    '',
    '### Material',
    input.lesson.material
  ];

  for (const [index, item] of input.lesson.reviewItems.entries()) {
    sections.push(
      '',
      `### Question ${index + 1} (${getQuestionTypeLabel(item.question.type)})`,
      `**Prompt**\n${item.question.prompt}`,
      '',
      `**Answer**\n${item.answer}`,
      '',
      `**Evaluation**\n${item.feedback.evaluation}`,
      '',
      '**Issues**',
      formatMarkdownList(item.feedback.issues),
      '',
      `**Natural Version**\n${item.feedback.naturalVersion}`,
      '',
      '**Alternatives**',
      formatMarkdownList(item.feedback.alternatives)
    );
  }

  sections.push(
    '',
    '### Summary',
    `**Topic**\n${input.lesson.summary.topic}`,
    '',
    '**Strengths**',
    formatMarkdownList(input.lesson.summary.strengths),
    '',
    '**Mistakes**',
    formatMarkdownList(input.lesson.summary.mistakes),
    '',
    '**Natural Expressions**',
    formatMarkdownList(input.lesson.summary.naturalExpressions),
    '',
    '**Review Points**',
    formatMarkdownList(input.lesson.summary.reviewPoints),
    '',
    `**Overall Comment**\n${input.lesson.summary.overallComment}`
  );

  return `${sections.join('\n')}\n`;
}

export async function writeJournalEntry(
  store: ObsidianStore,
  request: JournalWriteRequest
): Promise<JournalWriteResult> {
  const relativePath = buildJournalNotePath(request);
  const content = renderJournalMarkdown(request);
  const result = await store.write({
    relativePath,
    content,
    mode: 'append'
  });

  return {
    ...result,
    content
  };
}
