import type { ObsidianWriteMode } from '../types/obsidian.js';

export function normalizeMarkdownContent(content: string): string {
  return content.replace(/\r\n/g, '\n');
}

export function prepareMarkdownForWrite(content: string, mode: ObsidianWriteMode): string {
  const normalized = normalizeMarkdownContent(content);

  if (mode === 'overwrite') {
    return normalized;
  }

  return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
}
