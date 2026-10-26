from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

MOSCOW_TZ = ZoneInfo("Europe/Moscow")
GAMEPIADA_START = datetime(2026, 10, 27, 0, 0, tzinfo=MOSCOW_TZ)
# The announcement gives a date range but no time, so use the start of November 2
# as an inclusive end boundary for the announced November 1 final day.
GAMEPIADA_END = datetime(2026, 11, 2, 0, 0, tzinfo=MOSCOW_TZ)

REGISTRATION_URL = "https://forms.gle/BSrp7vQqTXzJtBhq7"
DISCORD_URL = "https://discord.gg/5fRZkcjt"

DISCIPLINES = (
    "Dota 2 • CS2 • Minecraft Duo Speedrun • Clash Royale • Double Dealers • "
    "Rocket League • GeoGuessr • Fall Guys • Geometry Dash • Fortnite • Trackmania • "
    "MK11 • шахматы • Minecraft PvP • Brawl Stars"
)


def gamepiada_is_over(now: datetime | None = None) -> bool:
    current = (now or datetime.now(MOSCOW_TZ)).astimezone(MOSCOW_TZ)
    return current >= GAMEPIADA_END


def gamepiada_countdown(now: datetime | None = None) -> str:
    current = (now or datetime.now(MOSCOW_TZ)).astimezone(MOSCOW_TZ)
    if current < GAMEPIADA_START:
        seconds_left = max(0, int((GAMEPIADA_START - current).total_seconds()))
        days, remainder = divmod(seconds_left, 86_400)
        hours, remainder = divmod(remainder, 3_600)
        minutes, seconds = divmod(remainder, 60)
        return (
            "⏳ До даты старта: "
            f"<b>{days} дн. {hours:02}:{minutes:02}:{seconds:02}</b> МСК"
        )
    if current < GAMEPIADA_END:
        return "🔥 Турнирный период GAMEpiada уже начался!"
    return "🏁 Турнирный период GAMEpiada завершён."


def gamepiada_announcement(now: datetime | None = None) -> str:
    current = (now or datetime.now(MOSCOW_TZ)).astimezone(MOSCOW_TZ)
    if current >= GAMEPIADA_END:
        return (
            "<b>🏁 GAMEpiada · 27 октября — 1 ноября 2026</b>\n"
            "Турнирный период завершён. Следите за новостями и итогами в Discord."
        )

    return (
        "<b>⚡️ ОТКРЫТА РЕГИСТРАЦИЯ НА GAMEpiada 🏆</b>\n"
        "<b>17 дисциплин. Один общий рейтинг. Докажи, что ты универсал:</b>\n"
        f"{DISCIPLINES}\n\n"
        "📅 <b>27 октября — 1 ноября 2026 (предварительно)</b>\n"
        f"{gamepiada_countdown(current)}\n"
        "🏅 Очки за места в каждой дисциплине — путь к титулу MVP.\n"
        "Расписание и подробности — скоро.\n"
        "Выбирай дисциплины. Выходи на арену. Забирай GAMEpiada!"
    )
