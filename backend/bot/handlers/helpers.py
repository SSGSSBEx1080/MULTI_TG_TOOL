from __future__ import annotations

import html
import re
import secrets
from collections import OrderedDict
from typing import Any

from aiogram import Bot
from aiogram.types import CallbackQuery, InlineKeyboardMarkup, Message

# Short-key media store so callback_data stays strictly < 64 bytes (Telegram Bot API limit)
_MEDIA_CACHE: OrderedDict[str, dict[str, Any]] = OrderedDict()
MAX_MEDIA_CACHE = 80
MAX_TG_TEXT_LEN = 4050


def store_media_ref(file_id: str, filename: str = "", raw_bytes: bytes | None = None) -> str:
    key = secrets.token_hex(4)
    _MEDIA_CACHE[key] = {
        "file_id": file_id,
        "filename": filename,
        "bytes": raw_bytes,
    }
    while len(_MEDIA_CACHE) > MAX_MEDIA_CACHE:
        _MEDIA_CACHE.popitem(last=False)
    return key


async def load_media_bytes(bot: Bot, key: str) -> tuple[bytes, str]:
    entry = _MEDIA_CACHE.get(key)
    if not entry:
        raise ValueError("Файл устарел в кэше сессии — отправьте его повторно")
    if entry.get("bytes") is not None:
        return entry["bytes"], entry.get("filename", "")
    file_obj = await bot.get_file(entry["file_id"])
    buf = await bot.download_file(file_obj.file_path)
    raw = buf.read()
    entry["bytes"] = raw
    return raw, entry.get("filename", "")


def progress_bar(pct: int, width: int = 8) -> str:
    clamped = max(0, min(100, pct))
    filled = int(round((clamped / 100.0) * width))
    return "▰" * filled + "▱" * (width - filled)


def esc(text: Any) -> str:
    return html.escape(str(text))


def _clamp_tg_html(text: str) -> str:
    if len(text) <= MAX_TG_TEXT_LEN:
        return text
    # Strip HTML if needed when truncating to avoid broken tags
    plain = re.sub(r"<[^>]+>", "", text)
    return html.escape(plain[: MAX_TG_TEXT_LEN - 20]) + "\n…"


async def render_hud(
    target: Message | CallbackQuery,
    text: str,
    reply_markup: InlineKeyboardMarkup | None = None,
) -> Message:
    safe_text = _clamp_tg_html(text)
    if isinstance(target, CallbackQuery):
        msg = target.message
        if isinstance(msg, Message) and msg.text is not None:
            try:
                edited = await msg.edit_text(
                    text=safe_text,
                    parse_mode="HTML",
                    reply_markup=reply_markup,
                    disable_web_page_preview=True,
                )
                try:
                    await target.answer()
                except Exception:
                    pass
                if isinstance(edited, Message):
                    return edited
                return msg
            except Exception as exc:
                if "message is not modified" in str(exc).lower():
                    try:
                        await target.answer()
                    except Exception:
                        pass
                    return msg
        try:
            await target.answer()
        except Exception:
            pass
        if isinstance(msg, Message):
            return await msg.answer(
                text=safe_text,
                parse_mode="HTML",
                reply_markup=reply_markup,
                disable_web_page_preview=True,
            )
        raise RuntimeError("CallbackQuery without accessible message")

    return await target.answer(
        text=safe_text,
        parse_mode="HTML",
        reply_markup=reply_markup,
        disable_web_page_preview=True,
    )
