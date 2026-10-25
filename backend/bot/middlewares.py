from __future__ import annotations

from typing import Any, Awaitable, Callable
from aiogram import BaseMiddleware
from aiogram.types import CallbackQuery, InlineQuery, Message, TelegramObject

from backend.database import db


class UserContextMiddleware(BaseMiddleware):
    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        from_user = getattr(event, "from_user", None)
        if isinstance(event, (Message, CallbackQuery, InlineQuery)) and from_user is not None:
            profile = await db.ensure_user(
                user_id=from_user.id,
                username=from_user.username or "",
                first_name=from_user.first_name or "Пользователь",
            )
            data["user_profile"] = profile
            data["user_favorites"] = await db.list_favorites(from_user.id)
        return await handler(event, data)
