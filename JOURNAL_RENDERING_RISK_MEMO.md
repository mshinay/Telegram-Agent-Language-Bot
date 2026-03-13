# Journal Rendering Risk Memo

## Background

Current `renderJournalMarkdown()` in `src/obsidian/journal.ts` inserts lesson material, prompts, answers, and feedback text directly into Markdown structure.

This is acceptable for the current Journal capability card, but it leaves a known rendering risk.

## Risk

Free-form text may contain Markdown syntax such as:

- `#` headings
- `-` list items
- `>` blockquotes
- fenced code blocks like ``````
- other structural Markdown markers

If these appear in:

- lesson material
- question prompt
- user answer
- evaluation text
- natural version
- overall comment

the resulting Journal note structure may drift or break.

## Impact

- Journal section hierarchy can become unstable
- lists may be merged or split unexpectedly
- user-generated content can visually corrupt the note layout
- later parsing or review of Journal notes becomes less reliable

This is not only a presentation issue. The stored record itself can become harder to read and audit.

## Current Decision

- Accept as a known medium-risk residual issue for the Journal-writing card
- Do not expand the current card scope to solve it now
- Prioritize the next step: wiring Journal write into `confirm_write`

## Recommended Follow-up

Use a minimal hardening patch in the Journal rendering layer:

- keep true structured fields as Markdown lists
- wrap free-form text fields in a safe block format

Preferred target fields for safe wrapping:

- material
- prompt
- answer
- evaluation
- natural version
- overall comment

Possible implementation options:

- fenced code block wrapper
- consistent blockquote wrapper
- indented literal block wrapper

The preferred approach should be the smallest patch that prevents Markdown structure injection without introducing a template system.

## Status

- Reported by Planner review
- Acknowledged
- Not fixed in current card
- Should be handled as a focused follow-up after `confirm_write` is connected
