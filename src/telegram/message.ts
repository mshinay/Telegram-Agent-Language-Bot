import type { Context } from 'grammy';

import {
  formatAnswerFeedbackMessage,
  formatCurrentQuestionMessage,
  formatLessonStartMessage,
  formatStatusMessage,
  formatSummaryDraftMessage
} from './formatters.js';
import type { AppReply } from '../types/presentation.js';

export function renderWorkflowReply(reply: AppReply): string {
  switch (reply.type) {
    case 'text':
      return reply.text;
    case 'lesson_start':
      return formatLessonStartMessage(reply);
    case 'current_question':
      return formatCurrentQuestionMessage(reply);
    case 'answer_feedback':
      return formatAnswerFeedbackMessage(reply);
    case 'answer_feedback_with_summary':
      return [formatAnswerFeedbackMessage(reply), formatSummaryDraftMessage(reply)].join('\n\n');
    case 'summary_draft':
      return formatSummaryDraftMessage(reply);
    case 'status':
      return formatStatusMessage(reply);
    default:
      return 'unsupported';
  }
}

export function splitReplyText(text: string, charLimit: number): string[] {
  if (text.length <= charLimit) {
    return [text];
  }

  const chunks: string[] = [];
  const paragraphs = text.split('\n\n');
  let current = '';

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= charLimit) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = '';
    }

    if (paragraph.length <= charLimit) {
      current = paragraph;
      continue;
    }

    const lines = paragraph.split('\n');
    let lineChunk = '';

    for (const line of lines) {
      const lineCandidate = lineChunk ? `${lineChunk}\n${line}` : line;
      if (lineCandidate.length <= charLimit) {
        lineChunk = lineCandidate;
        continue;
      }

      if (lineChunk) {
        chunks.push(lineChunk);
      }

      if (line.length <= charLimit) {
        lineChunk = line;
        continue;
      }

      for (let index = 0; index < line.length; index += charLimit) {
        chunks.push(line.slice(index, index + charLimit));
      }
      lineChunk = '';
    }

    if (lineChunk) {
      current = lineChunk;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

export async function sendWorkflowReply(
  ctx: Context,
  reply: AppReply,
  charLimit: number
): Promise<void> {
  const text = renderWorkflowReply(reply);
  const chunks = splitReplyText(text, charLimit);

  for (const chunk of chunks) {
    await ctx.reply(chunk);
  }
}
