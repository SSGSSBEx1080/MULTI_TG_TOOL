from __future__ import annotations

import asyncio
import logging
from typing import Any

from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import BotCommand

from backend.bot.handlers import inline_mode, navigation, omni_router, tools_interactive, v2_bot_handlers
from backend.bot.middlewares import UserContextMiddleware
from backend.bot.simulator_session import SimulatorSession
from backend.config import BOT_TOKEN, SIMULATOR_BOT_TOKEN

logger = logging.getLogger("nexus.bot")

BOT_COMMANDS = [
    BotCommand(command="start", description="🌌 Главное меню MULTI_TG_TOOL"),
    BotCommand(command="bored", description="💡 Что делать если скучно (105+ идей)"),
    BotCommand(command="alcohol", description="🥃 Алко-калькулятор 0..40 без догона"),
    BotCommand(command="units", description="🔮 Умный конвертер («6 дюймов»)"),
    BotCommand(command="rhyme", description="🎤 Генератор русских рифм"),
    BotCommand(command="stand", description="🌟 Случайный Стенд JoJo + Мульти-Вики"),
    BotCommand(command="top", description="🏆 Топ игроков и визиты профилей"),
    BotCommand(command="altushka", description="💘 Дейтинг-чат с альтушками 18+"),
    BotCommand(command="turing", description="🤖 Игра: Человек или ИИ?"),
    BotCommand(command="author", description="🕶️ Официальные ссылки & Поддержка"),
    BotCommand(command="pass", description="🛡️ Генератор криптостойких паролей"),
    BotCommand(command="qr", description="✨ Быстрый градиентный QR-код"),
    BotCommand(command="profile", description="👤 Мой профиль и ранг XP"),
    BotCommand(command="help", description="📖 Все команды и фишки"),
]


class BotRuntimeManager:
    def __init__(self) -> None:
        self.storage = MemoryStorage()
        self.dp = self._create_dispatcher()
        self.sim_session = SimulatorSession()
        self.sim_bot = Bot(token=SIMULATOR_BOT_TOKEN, session=self.sim_session)

        self.live_bot: Bot | None = None
        self.polling_task: asyncio.Task[Any] | None = None
        self.live_status: dict[str, Any] = {
            "configured": bool(BOT_TOKEN),
            "running": False,
            "bot_username": None,
            "error": None,
        }

    def _create_dispatcher(self) -> Dispatcher:
        dp = Dispatcher(storage=self.storage)
        mw = UserContextMiddleware()
        dp.message.middleware(mw)
        dp.callback_query.middleware(mw)
        dp.inline_query.middleware(mw)

        dp.include_router(navigation.router)
        dp.include_router(tools_interactive.router)
        dp.include_router(v2_bot_handlers.router)
        dp.include_router(inline_mode.router)
        # omni_router MUST be last so FSM states & commands match first
        dp.include_router(omni_router.router)
        return dp

    async def init_simulator(self) -> None:
        await self.sim_bot.set_my_commands(BOT_COMMANDS)

    async def start_live_polling(self, token: str) -> dict[str, Any]:
        await self.stop_live_polling()
        clean_token = (token or "").strip()
        if not clean_token:
            self.live_status = {
                "configured": False,
                "running": False,
                "bot_username": None,
                "error": None,
            }
            return self.live_status

        self.live_status["configured"] = True
        try:
            bot = Bot(token=clean_token)
            me = await asyncio.wait_for(bot.get_me(), timeout=6.0)
            await asyncio.wait_for(bot.set_my_commands(BOT_COMMANDS), timeout=6.0)
            self.live_bot = bot
            self.polling_task = asyncio.create_task(
                self.dp.start_polling(bot, handle_signals=False)
            )
            self.live_status = {
                "configured": True,
                "running": True,
                "bot_username": me.username,
                "bot_id": me.id,
                "first_name": me.first_name,
                "error": None,
            }
        except Exception as exc:
            logger.warning("Live Telegram connection unavailable in current network: %s", exc)
            self.live_status = {
                "configured": True,
                "running": False,
                "bot_username": None,
                "error": f"Токен сохранён (нет прямого доступа к api.telegram.org из песочницы или токен неверен: {type(exc).__name__})",
            }
        return self.live_status

    async def stop_live_polling(self) -> None:
        if self.polling_task and not self.polling_task.done():
            self.polling_task.cancel()
            try:
                await self.polling_task
            except asyncio.CancelledError:
                pass
        self.polling_task = None
        if self.live_bot:
            await self.live_bot.session.close()
            self.live_bot = None
        self.live_status["running"] = False


bot_manager = BotRuntimeManager()
