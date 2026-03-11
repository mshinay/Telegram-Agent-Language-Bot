# Telegram Agent Bot MVP

## Files

- `app.py`: polling bot main program
- `config.json.example`: config template
- `bot.log`: runtime JSON line log

## Start

1. Copy `config.json.example` to `config.json`
2. Fill in `bot_token`, `allowed_chat_id`, and project paths
3. Start with a builtin agent first:

```json
"agent": {
  "type": "builtin_dir_summary",
  "command": ["codex", "exec"],
  "timeout_sec": 120
}
```

4. Run:

```bash
python app.py
```

## Commands

```text
/ping
/run <project> | <prompt>
```

Examples:

```text
/run hm-dianping | 总结 src 目录结构
/run notes | 总结最近编辑的笔记主题
```

## Switch To Codex

When the basic link is stable, change config:

```json
"agent": {
  "type": "codex",
  "command": ["codex", "exec"],
  "timeout_sec": 120
}
```
