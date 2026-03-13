import type { ObsidianWriteMode } from '../types/obsidian.js';

export function normalizeMarkdownContent(content: string): string {
  return content.replace(/\r\n/g, '\n');
}

export function prepareMarkdownAppendBlock(existingContent: string, appendedContent: string): string {
  const normalizedExisting = normalizeMarkdownContent(existingContent);
  const normalizedAppended = normalizeMarkdownContent(appendedContent).replace(/^\n+/, '');

  if (!normalizedAppended) {
    return '';
  }

  if (!normalizedExisting) {
    return normalizedAppended.endsWith('\n') ? normalizedAppended : `${normalizedAppended}\n`;
  }

  const separator = normalizedExisting.endsWith('\n\n')
    ? ''
    : normalizedExisting.endsWith('\n')
      ? '\n'
      : '\n\n';
  const merged = `${separator}${normalizedAppended}`;

  return merged.endsWith('\n') ? merged : `${merged}\n`;
}

export function prepareMarkdownForWrite(content: string, mode: ObsidianWriteMode): string {
  const normalized = normalizeMarkdownContent(content);

  if (mode === 'overwrite') {
    return normalized;
  }

  return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
}
