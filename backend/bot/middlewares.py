from __future__ import annotations

from typing import Any, Awaitable, Callable
from aiogram import BaseMiddleware
from aiogram.types import CallbackQuery, InlineQuery, Message, TelegramObject

from backend.config import SIMULATOR_BOT_TOKEN
from backend.database import db


class UserContextMiddleware(BaseMiddleware):
    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        # Automatically clear stale FSM states on slash commands or top-level section/tool navigation
        state = data.get("state")
        if state is not None:
            if isinstance(event, Message) and event.text and event.text.strip().startswith("/"):
                await state.clear()
                data["raw_state"] = None
            elif isinstance(event, CallbackQuery) and event.data and event.data.startswith(("nav:", "tool:open:")):
                await state.clear()
                data["raw_state"] = None

        from_user = getattr(event, "from_user", None)
        bot = data.get("bot")
        is_live_tg = bool(bot and getattr(bot, "token", "") != SIMULATOR_BOT_TOKEN)
        if isinstance(event, (Message, CallbackQuery, InlineQuery)) and from_user is not None:
            profile = await db.ensure_user(
                user_id=from_user.id,
                username=from_user.username or "",
                first_name=from_user.first_name or "Пользователь",
                is_real=is_live_tg,
            )
            data["user_profile"] = profile
            data["user_favorites"] = await db.list_favorites(from_user.id)
        return await handler(event, data)
