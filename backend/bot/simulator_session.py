from __future__ import annotations

import secrets
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncGenerator

from aiogram import Bot
from aiogram.client.session.base import BaseSession
from aiogram.methods import (
    AnswerCallbackQuery,
    AnswerInlineQuery,
    DeleteMessage,
    EditMessageCaption,
    EditMessageReplyMarkup,
    EditMessageText,
    GetFile,
    GetMe,
    SendChatAction,
    SendDocument,
    SendMessage,
    SendPhoto,
    SetMyCommands,
    TelegramMethod,
)
from aiogram.methods.base import TelegramType
from aiogram.types import (
    BufferedInputFile,
    Chat,
    Document,
    File,
    FSInputFile,
    InlineKeyboardMarkup,
    Message,
    PhotoSize,
    User,
)

from backend.config import DATA_DIR, GENERATED_DIR, UPLOADS_DIR


def _serialize_inline_kb(markup: Any) -> list[list[dict[str, Any]]]:
    if not isinstance(markup, InlineKeyboardMarkup):
        return []
    rows: list[list[dict[str, Any]]] = []
    for row in markup.inline_keyboard:
        out_row: list[dict[str, Any]] = []
        for btn in row:
            item: dict[str, Any] = {"text": btn.text}
            if btn.callback_data:
                item["callback_data"] = btn.callback_data
            if btn.url:
                item["url"] = btn.url
            if btn.web_app and btn.web_app.url:
                item["web_app_url"] = btn.web_app.url
            if btn.switch_inline_query_current_chat is not None:
                item["switch_inline"] = btn.switch_inline_query_current_chat
            out_row.append(item)
        if out_row:
            rows.append(out_row)
    return rows


class SimulatorSession(BaseSession):
    """
    A genuine aiogram 3 BaseSession that intercepts Bot API calls in-memory
    and persists media to DATA_DIR, allowing the exact production Dispatcher,
    Routers, FSM, Middlewares, and Inline Mode to be driven interactively from
    the browser Telegram Simulator without external network calls.
    """

    def __init__(self) -> None:
        super().__init__()
        self._msg_seq: int = 100
        self._update_seq: int = 1
        self.bot_user = User(
            id=123456789,
            is_bot=True,
            first_name="NEXUS • Мультитул",
            username="nexus_multitool_bot",
        )
        # chat_id -> list of serialized chat message dicts
        self.chats: dict[int, list[dict[str, Any]]] = {}
        # file_id -> relative path inside DATA_DIR (e.g. "uploads/abc.png" or "generated/xyz.png")
        self.files: dict[str, dict[str, Any]] = {}
        self.last_toast: dict[int, dict[str, Any]] = {}
        self.last_inline_results: list[dict[str, Any]] = []
        self.registered_commands: list[dict[str, str]] = []
        self.api_logs: deque[dict[str, Any]] = deque(maxlen=80)

    def next_message_id(self) -> int:
        self._msg_seq += 1
        return self._msg_seq

    def next_update_id(self) -> int:
        self._update_seq += 1
        return self._update_seq

    def register_uploaded_file(self, filename: str, content: bytes, mime_type: str = "application/octet-stream") -> dict[str, Any]:
        ext = Path(filename).suffix or ".bin"
        safe_name = f"up_{int(time.time() * 1000)}_{secrets.token_hex(4)}{ext}"
        dest = UPLOADS_DIR / safe_name
        dest.write_bytes(content)
        rel_path = f"uploads/{safe_name}"
        file_id = f"simfile_{secrets.token_hex(8)}"
        info = {
            "file_id": file_id,
            "file_unique_id": f"uniq_{secrets.token_hex(5)}",
            "file_name": filename,
            "file_size": len(content),
            "mime_type": mime_type,
            "rel_path": rel_path,
            "media_url": f"/media/{rel_path}",
        }
        self.files[file_id] = info
        return info

    def _save_outgoing_input_file(self, inp: Any, default_name: str = "output.bin") -> dict[str, Any]:
        if isinstance(inp, str) and inp in self.files:
            return self.files[inp]

        if isinstance(inp, BufferedInputFile):
            raw = inp.data
            fname = inp.filename or default_name
        elif isinstance(inp, FSInputFile):
            raw = Path(inp.path).read_bytes()
            fname = inp.filename or Path(inp.path).name
        else:
            raw = b""
            fname = default_name

        ext = Path(fname).suffix or ".bin"
        safe_name = f"gen_{int(time.time() * 1000)}_{secrets.token_hex(4)}{ext}"
        dest = GENERATED_DIR / safe_name
        dest.write_bytes(raw)
        rel_path = f"generated/{safe_name}"
        file_id = f"simgen_{secrets.token_hex(8)}"
        info = {
            "file_id": file_id,
            "file_unique_id": f"uniq_{secrets.token_hex(5)}",
            "file_name": fname,
            "file_size": len(raw),
            "rel_path": rel_path,
            "media_url": f"/media/{rel_path}",
        }
        self.files[file_id] = info
        return info

    def append_user_message(
        self,
        chat_id: int,
        text: str = "",
        media_url: str | None = None,
        media_type: str | None = None,
        file_name: str | None = None,
    ) -> int:
        msg_id = self.next_message_id()
        history = self.chats.setdefault(chat_id, [])
        history.append(
            {
                "message_id": msg_id,
                "sender": "user",
                "text": text,
                "media_url": media_url,
                "media_type": media_type,
                "file_name": file_name,
                "inline_keyboard": [],
                "edited": False,
                "timestamp": time.time(),
            }
        )
        return msg_id

    def get_chat_history(self, chat_id: int) -> list[dict[str, Any]]:
        return list(self.chats.get(chat_id, []))

    def clear_chat(self, chat_id: int) -> None:
        self.chats[chat_id] = []

    def _log_api(self, method_name: str, summary: dict[str, Any]) -> None:
        self.api_logs.appendleft(
            {
                "id": secrets.token_hex(4),
                "method": method_name,
                "summary": summary,
                "timestamp": time.time(),
            }
        )

    async def make_request(
        self,
        bot: Bot,
        method: TelegramMethod[TelegramType],
        timeout: int | None = None,
    ) -> Any:
        now_dt = datetime.now(timezone.utc)
        method_name = getattr(method, "__api_method__", type(method).__name__)

        if isinstance(method, GetMe):
            self._log_api(method_name, {"username": self.bot_user.username})
            return self.bot_user

        if isinstance(method, SetMyCommands):
            self.registered_commands = [
                {"command": f"/{c.command.lstrip('/')}", "description": c.description}
                for c in method.commands
            ]
            self._log_api(method_name, {"count": len(self.registered_commands)})
            return True

        if isinstance(method, SendChatAction):
            self._log_api(method_name, {"chat_id": method.chat_id, "action": str(method.action)})
            return True

        if isinstance(method, GetFile):
            info = self.files.get(method.file_id)
            if not info:
                raise RuntimeError(f"Simulated file not found: {method.file_id}")
            self._log_api(method_name, {"file_id": method.file_id, "path": info["rel_path"]})
            return File(
                file_id=info["file_id"],
                file_unique_id=info["file_unique_id"],
                file_size=info["file_size"],
                file_path=info["rel_path"],
            )

        if isinstance(method, SendMessage):
            chat_id = int(method.chat_id)
            msg_id = self.next_message_id()
            kb = _serialize_inline_kb(method.reply_markup)
            entry = {
                "message_id": msg_id,
                "sender": "bot",
                "text": method.text or "",
                "media_url": None,
                "media_type": None,
                "file_name": None,
                "inline_keyboard": kb,
                "edited": False,
                "timestamp": time.time(),
            }
            self.chats.setdefault(chat_id, []).append(entry)
            self._log_api(
                method_name,
                {"chat_id": chat_id, "message_id": msg_id, "buttons": sum(len(r) for r in kb)},
            )
            return Message(
                message_id=msg_id,
                date=now_dt,
                chat=Chat(id=chat_id, type="private"),
                from_user=self.bot_user,
                text=method.text or "",
            )

        if isinstance(method, EditMessageText):
            chat_id = int(method.chat_id) if method.chat_id is not None else 0
            msg_id = int(method.message_id) if method.message_id is not None else 0
            kb = _serialize_inline_kb(method.reply_markup)
            history = self.chats.setdefault(chat_id, [])
            target = next((m for m in reversed(history) if m["message_id"] == msg_id), None)
            if target is not None:
                target["text"] = method.text or ""
                target["inline_keyboard"] = kb
                target["edited"] = True
            else:
                msg_id = self.next_message_id()
                history.append(
                    {
                        "message_id": msg_id,
                        "sender": "bot",
                        "text": method.text or "",
                        "media_url": None,
                        "media_type": None,
                        "file_name": None,
                        "inline_keyboard": kb,
                        "edited": True,
                        "timestamp": time.time(),
                    }
                )
            self._log_api(
                method_name,
                {"chat_id": chat_id, "message_id": msg_id, "buttons": sum(len(r) for r in kb)},
            )
            return Message(
                message_id=msg_id,
                date=now_dt,
                chat=Chat(id=chat_id, type="private"),
                from_user=self.bot_user,
                text=method.text or "",
            )

        if isinstance(method, EditMessageCaption):
            chat_id = int(method.chat_id) if method.chat_id is not None else 0
            msg_id = int(method.message_id) if method.message_id is not None else 0
            kb = _serialize_inline_kb(method.reply_markup)
            history = self.chats.setdefault(chat_id, [])
            target = next((m for m in reversed(history) if m["message_id"] == msg_id), None)
            if target is not None:
                target["text"] = method.caption or ""
                if method.reply_markup is not None:
                    target["inline_keyboard"] = kb
                target["edited"] = True
            self._log_api(method_name, {"chat_id": chat_id, "message_id": msg_id})
            return Message(
                message_id=msg_id,
                date=now_dt,
                chat=Chat(id=chat_id, type="private"),
                from_user=self.bot_user,
                caption=method.caption or "",
            )

        if isinstance(method, EditMessageReplyMarkup):
            chat_id = int(method.chat_id) if method.chat_id is not None else 0
            msg_id = int(method.message_id) if method.message_id is not None else 0
            kb = _serialize_inline_kb(method.reply_markup)
            history = self.chats.setdefault(chat_id, [])
            target = next((m for m in reversed(history) if m["message_id"] == msg_id), None)
            if target is not None:
                target["inline_keyboard"] = kb
                target["edited"] = True
            self._log_api(method_name, {"chat_id": chat_id, "message_id": msg_id})
            return Message(
                message_id=msg_id,
                date=now_dt,
                chat=Chat(id=chat_id, type="private"),
                from_user=self.bot_user,
            )

        if isinstance(method, DeleteMessage):
            chat_id = int(method.chat_id)
            msg_id = int(method.message_id)
            if chat_id in self.chats:
                self.chats[chat_id] = [m for m in self.chats[chat_id] if m["message_id"] != msg_id]
            self._log_api(method_name, {"chat_id": chat_id, "message_id": msg_id})
            return True

        if isinstance(method, SendPhoto):
            chat_id = int(method.chat_id)
            msg_id = self.next_message_id()
            saved = self._save_outgoing_input_file(method.photo, "image.png")
            kb = _serialize_inline_kb(method.reply_markup)
            self.chats.setdefault(chat_id, []).append(
                {
                    "message_id": msg_id,
                    "sender": "bot",
                    "text": method.caption or "",
                    "media_url": saved["media_url"],
                    "media_type": "photo",
                    "file_name": saved["file_name"],
                    "inline_keyboard": kb,
                    "edited": False,
                    "timestamp": time.time(),
                }
            )
            self._log_api(
                method_name,
                {"chat_id": chat_id, "message_id": msg_id, "file": saved["file_name"]},
            )
            return Message(
                message_id=msg_id,
                date=now_dt,
                chat=Chat(id=chat_id, type="private"),
                from_user=self.bot_user,
                caption=method.caption or "",
                photo=[
                    PhotoSize(
                        file_id=saved["file_id"],
                        file_unique_id=saved["file_unique_id"],
                        width=640,
                        height=640,
                        file_size=saved["file_size"],
                    )
                ],
            )

        if isinstance(method, SendDocument):
            chat_id = int(method.chat_id)
            msg_id = self.next_message_id()
            saved = self._save_outgoing_input_file(method.document, "document.bin")
            kb = _serialize_inline_kb(method.reply_markup)
            self.chats.setdefault(chat_id, []).append(
                {
                    "message_id": msg_id,
                    "sender": "bot",
                    "text": method.caption or "",
                    "media_url": saved["media_url"],
                    "media_type": "document",
                    "file_name": saved["file_name"],
                    "inline_keyboard": kb,
                    "edited": False,
                    "timestamp": time.time(),
                }
            )
            self._log_api(
                method_name,
                {"chat_id": chat_id, "message_id": msg_id, "file": saved["file_name"]},
            )
            return Message(
                message_id=msg_id,
                date=now_dt,
                chat=Chat(id=chat_id, type="private"),
                from_user=self.bot_user,
                caption=method.caption or "",
                document=Document(
                    file_id=saved["file_id"],
                    file_unique_id=saved["file_unique_id"],
                    file_name=saved["file_name"],
                    file_size=saved["file_size"],
                ),
            )

        if isinstance(method, AnswerCallbackQuery):
            if method.text:
                self.last_toast[0] = {
                    "text": method.text,
                    "show_alert": bool(method.show_alert),
                    "timestamp": time.time(),
                }
            self._log_api(method_name, {"text": method.text or "ack"})
            return True

        if isinstance(method, AnswerInlineQuery):
            parsed_results: list[dict[str, Any]] = []
            for item in method.results:
                msg_text = ""
                content = getattr(item, "input_message_content", None)
                if content is not None:
                    msg_text = getattr(content, "message_text", "")
                parsed_results.append(
                    {
                        "id": getattr(item, "id", ""),
                        "title": getattr(item, "title", ""),
                        "description": getattr(item, "description", "") or "",
                        "message_text": msg_text,
                    }
                )
            self.last_inline_results = parsed_results
            self._log_api(method_name, {"results_count": len(parsed_results)})
            return True

        self._log_api(method_name, {"unhandled_passthrough": True})
        return True

    async def stream_content(
        self,
        url: str,
        headers: dict[str, Any] | None = None,
        timeout: int = 30,
        chunk_size: int = 65536,
        raise_for_status: bool = True,
    ) -> AsyncGenerator[bytes, None]:
        # Extract relative path after /file/bot<token>/
        marker = "/file/bot"
        if marker in url:
            after = url.split(marker, 1)[1]
            rel_path = after.split("/", 1)[1] if "/" in after else after
        else:
            rel_path = url.lstrip("/")

        target = (DATA_DIR / rel_path).resolve()
        if not target.exists():
            raise FileNotFoundError(f"Simulated file stream missing: {target}")
        data = target.read_bytes()
        for offset in range(0, len(data), chunk_size):
            yield data[offset : offset + chunk_size]

    async def close(self) -> None:
        return None
