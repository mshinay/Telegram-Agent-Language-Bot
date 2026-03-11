import json
import logging
import subprocess
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


DEFAULT_CONFIG_PATH = "config.json"
DEFAULT_LOG_PATH = "bot.log"


@dataclass
class AgentResult:
    ok: bool
    status: str
    exit_code: int
    output: str
    error: str
    timed_out: bool = False


class TelegramAgentBot:
    def __init__(self, config_path: str) -> None:
        self.base_dir = Path(config_path).resolve().parent
        self.config = self._load_config(config_path)
        self.bot_token = self.config["bot_token"]
        self.allowed_chat_id = int(self.config["allowed_chat_id"])
        self.projects = self.config["projects"]
        self.agent = self.config["agent"]
        self.telegram = self.config.get("telegram", {})
        self.poll_interval_sec = float(self.telegram.get("poll_interval_sec", 1))
        self.long_poll_timeout_sec = int(self.telegram.get("long_poll_timeout_sec", 20))
        self.reply_char_limit = int(self.telegram.get("reply_char_limit", 3000))
        self.log_path = str((self.base_dir / self.config.get("log_path", DEFAULT_LOG_PATH)).resolve())
        self.offset = 0
        self.task_lock = threading.Lock()
        self.api_base = f"https://api.telegram.org/bot{self.bot_token}"
        self._setup_logging()

    def _load_config(self, config_path: str) -> Dict[str, Any]:
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _setup_logging(self) -> None:
        logging.basicConfig(
            filename=self.log_path,
            level=logging.INFO,
            format="%(message)s",
            encoding="utf-8",
        )

    def run_forever(self) -> None:
        print("Bot started. Press Ctrl+C to stop.")
        while True:
            try:
                updates = self._get_updates()
                for update in updates:
                    self.offset = update["update_id"] + 1
                    self._handle_update(update)
            except KeyboardInterrupt:
                print("Bot stopped.")
                return
            except Exception as exc:  # noqa: BLE001
                self._log_event(
                    {
                        "ts": self._now_iso(),
                        "status": "poll_error",
                        "error": str(exc),
                    }
                )
                time.sleep(self.poll_interval_sec)

    def _get_updates(self) -> Any:
        params = {
            "timeout": self.long_poll_timeout_sec,
            "offset": self.offset,
        }
        return self._api_call("getUpdates", params).get("result", [])

    def _handle_update(self, update: Dict[str, Any]) -> None:
        message = update.get("message") or update.get("edited_message")
        if not message:
            return

        text = (message.get("text") or "").strip()
        if not text:
            return

        chat_id = int(message["chat"]["id"])
        t0 = time.time()
        dispatch_start = time.time()

        if chat_id != self.allowed_chat_id:
            self._send_message(chat_id, "unauthorized")
            self._log_event(
                {
                    "ts": self._now_iso(),
                    "chat_id": chat_id,
                    "cmd": text,
                    "status": "unauthorized",
                }
            )
            return

        cmd = self._normalize_command(text)
        if cmd.startswith("/ping"):
            self._handle_ping(chat_id, message, text, t0, dispatch_start)
            return

        if cmd.startswith("/run"):
            self._handle_run(chat_id, text, t0, dispatch_start)
            return

        self._send_message(chat_id, "只支持 /ping 和 /run <project> | <prompt>")

    def _handle_ping(
        self,
        chat_id: int,
        message: Dict[str, Any],
        raw_cmd: str,
        t0: float,
        dispatch_start: float,
    ) -> None:
        t1 = dispatch_start
        msg_ts = message.get("date")
        recv_delay_ms = int(max(0, (t0 - float(msg_ts))) * 1000) if msg_ts else -1
        now_text = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        body = "\n".join(
            [
                "pong",
                f"recv_delay_ms={recv_delay_ms}",
                "reply_delay_ms=calculating",
                f"now={now_text}",
            ]
        )
        send_start = time.time()
        sent_message = self._send_message(chat_id, body)
        t4 = time.time()
        reply_delay_ms = int((t4 - send_start) * 1000)
        total_ms = int((t4 - t0) * 1000)
        final_body = "\n".join(
            [
                "pong",
                f"recv_delay_ms={recv_delay_ms}",
                f"reply_delay_ms={reply_delay_ms}",
                f"now={now_text}",
            ]
        )
        self._edit_message(chat_id, int(sent_message["message_id"]), final_body)
        self._log_event(
            {
                "ts": self._now_iso(),
                "chat_id": chat_id,
                "cmd": raw_cmd,
                "status": "ping",
                "dispatch_ms": int((t1 - t0) * 1000),
                "reply_ms": reply_delay_ms,
                "total_ms": total_ms,
                "recv_delay_ms": recv_delay_ms,
            }
        )

    def _handle_run(self, chat_id: int, raw_cmd: str, t0: float, dispatch_start: float) -> None:
        t1 = dispatch_start
        parsed = self._parse_run_command(raw_cmd)
        if not parsed:
            self._send_message(chat_id, "格式错误。用法：/run <project> | <prompt>")
            self._log_event(
                {
                    "ts": self._now_iso(),
                    "chat_id": chat_id,
                    "cmd": raw_cmd,
                    "status": "bad_format",
                }
            )
            return

        project_name, prompt = parsed
        project_path = self.projects.get(project_name)
        if not project_path:
            available = ", ".join(sorted(self.projects.keys()))
            self._send_message(chat_id, f"未知项目。可用项目：{available}")
            self._log_event(
                {
                    "ts": self._now_iso(),
                    "chat_id": chat_id,
                    "cmd": raw_cmd,
                    "project": project_name,
                    "status": "unknown_project",
                }
            )
            return

        project_dir = Path(project_path).resolve()
        if not project_dir.exists() or not project_dir.is_dir():
            self._send_message(chat_id, f"项目路径不存在：{project_dir}")
            self._log_event(
                {
                    "ts": self._now_iso(),
                    "chat_id": chat_id,
                    "cmd": raw_cmd,
                    "project": project_name,
                    "status": "missing_project_path",
                }
            )
            return

        if not self.task_lock.acquire(blocking=False):
            self._send_message(chat_id, "已有任务在运行，请稍后。")
            self._log_event(
                {
                    "ts": self._now_iso(),
                    "chat_id": chat_id,
                    "cmd": raw_cmd,
                    "project": project_name,
                    "status": "busy",
                }
            )
            return

        exit_code = -1
        try:
            t2 = time.time()
            result = self._run_agent(project_name, project_dir, prompt)
            t3 = time.time()
            reply = self._format_run_reply(project_name, t0, t1, t2, t3, result)
            self._send_message(chat_id, reply)
            t4 = time.time()

            exit_code = result.exit_code
            self._log_event(
                {
                    "ts": self._now_iso(),
                    "chat_id": chat_id,
                    "cmd": raw_cmd,
                    "project": project_name,
                    "status": result.status,
                    "dispatch_ms": int((t1 - t0) * 1000),
                    "spawn_ms": int((t2 - t1) * 1000),
                    "agent_ms": int((t3 - t2) * 1000),
                    "reply_ms": int((t4 - t3) * 1000),
                    "total_ms": int((t4 - t0) * 1000),
                    "exit_code": exit_code,
                    "timed_out": result.timed_out,
                }
            )
        finally:
            self.task_lock.release()

    def _run_agent(self, project_name: str, project_dir: Path, prompt: str) -> AgentResult:
        agent_type = self.agent.get("type", "codex")
        timeout_sec = int(self.agent.get("timeout_sec", 120))

        if agent_type == "builtin_dir_summary":
            return self._run_builtin_dir_summary(project_name, project_dir, prompt)

        if agent_type == "builtin_echo":
            return AgentResult(
                ok=True,
                status="success",
                exit_code=0,
                output=f"project={project_name}\nprompt={prompt}",
                error="",
            )

        if agent_type == "codex":
            command_prefix = self.agent.get("command", ["codex", "exec"])
            cmd = list(command_prefix) + ["-C", str(project_dir), prompt]
            return self._run_subprocess(cmd, timeout_sec, project_dir)

        return AgentResult(
            ok=False,
            status="unsupported_agent",
            exit_code=2,
            output="",
            error=f"unsupported agent type: {agent_type}",
        )

    def _run_builtin_dir_summary(self, project_name: str, project_dir: Path, prompt: str) -> AgentResult:
        try:
            entries = sorted(project_dir.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
            preview = []
            file_count = 0
            dir_count = 0
            for entry in entries[:30]:
                if entry.is_dir():
                    dir_count += 1
                    preview.append(f"[D] {entry.name}")
                else:
                    file_count += 1
                    preview.append(f"[F] {entry.name}")
            total_entries = len(entries)
            output = "\n".join(
                [
                    f"builtin summary for {project_name}",
                    f"prompt={prompt}",
                    f"path={project_dir}",
                    f"entries={total_entries}",
                    f"dirs_preview={dir_count}",
                    f"files_preview={file_count}",
                    "",
                    "preview:",
                    *preview,
                ]
            )
            return AgentResult(
                ok=True,
                status="success",
                exit_code=0,
                output=output,
                error="",
            )
        except Exception as exc:  # noqa: BLE001
            return AgentResult(
                ok=False,
                status="failed",
                exit_code=1,
                output="",
                error=str(exc),
            )

    def _run_subprocess(self, cmd: Any, timeout_sec: int, cwd: Path) -> AgentResult:
        try:
            completed = subprocess.run(
                cmd,
                cwd=str(cwd),
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout_sec,
                check=False,
            )
            ok = completed.returncode == 0
            return AgentResult(
                ok=ok,
                status="success" if ok else "failed",
                exit_code=completed.returncode,
                output=completed.stdout.strip(),
                error=completed.stderr.strip(),
            )
        except subprocess.TimeoutExpired as exc:
            output = (exc.stdout or "").strip() if exc.stdout else ""
            error = (exc.stderr or "").strip() if exc.stderr else ""
            return AgentResult(
                ok=False,
                status="timeout",
                exit_code=124,
                output=output,
                error=error,
                timed_out=True,
            )
        except FileNotFoundError as exc:
            return AgentResult(
                ok=False,
                status="failed",
                exit_code=127,
                output="",
                error=str(exc),
            )
        except Exception as exc:  # noqa: BLE001
            return AgentResult(
                ok=False,
                status="failed",
                exit_code=1,
                output="",
                error=str(exc),
            )

    def _format_run_reply(
        self,
        project_name: str,
        t0: float,
        t1: float,
        t2: float,
        t3: float,
        result: AgentResult,
    ) -> str:
        title = "任务完成" if result.ok else "任务失败"
        if result.timed_out:
            title = "任务超时"

        dispatch_ms = int((t1 - t0) * 1000)
        spawn_ms = int((t2 - t1) * 1000)
        agent_ms = int((t3 - t2) * 1000)
        overhead_ms = dispatch_ms + spawn_ms
        content = result.output or result.error or "(empty)"
        content = self._truncate_text(content, self.reply_char_limit)

        lines = [
            title,
            f"project: {project_name}",
            f"dispatch_ms: {dispatch_ms}",
            f"spawn_ms: {spawn_ms}",
            f"agent_ms: {agent_ms}",
            f"telegram_overhead_ms: {overhead_ms}",
            f"exit_code: {result.exit_code}",
            "",
            "summary:",
            content,
        ]
        return "\n".join(lines)

    def _parse_run_command(self, text: str) -> Optional[Tuple[str, str]]:
        normalized = self._normalize_command(text)
        payload = normalized[len("/run") :].strip()
        if "|" not in payload:
            return None
        project_name, prompt = payload.split("|", 1)
        project_name = project_name.strip()
        prompt = prompt.strip()
        if not project_name or not prompt:
            return None
        return project_name, prompt

    def _normalize_command(self, text: str) -> str:
        if not text.startswith("/"):
            return text
        first, *rest = text.split(" ", 1)
        if "@" in first:
            first = first.split("@", 1)[0]
        if rest:
            return f"{first} {rest[0]}"
        return first

    def _truncate_text(self, text: str, limit: int) -> str:
        if len(text) <= limit:
            return text
        suffix = "\n\n[output truncated]"
        return text[: max(0, limit - len(suffix))] + suffix

    def _send_message(self, chat_id: int, text: str) -> Dict[str, Any]:
        params = {
            "chat_id": chat_id,
            "text": text,
        }
        return self._api_call("sendMessage", params)["result"]

    def _edit_message(self, chat_id: int, message_id: int, text: str) -> None:
        params = {
            "chat_id": chat_id,
            "message_id": message_id,
            "text": text,
        }
        self._api_call("editMessageText", params)

    def _api_call(self, method: str, params: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.api_base}/{method}"
        data = urlencode(params).encode("utf-8")
        req = Request(url, data=data, method="POST")
        try:
            with urlopen(req, timeout=self.long_poll_timeout_sec + 10) as resp:
                payload = resp.read().decode("utf-8")
                result = json.loads(payload)
        except HTTPError as exc:
            raise RuntimeError(f"telegram http error: {exc.code}") from exc
        except URLError as exc:
            raise RuntimeError(f"telegram network error: {exc.reason}") from exc
        if not result.get("ok"):
            raise RuntimeError(f"telegram api error: {result}")
        return result

    def _log_event(self, event: Dict[str, Any]) -> None:
        logging.info(json.dumps(event, ensure_ascii=False))

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def main() -> None:
    bot = TelegramAgentBot(DEFAULT_CONFIG_PATH)
    bot.run_forever()


if __name__ == "__main__":
    main()
