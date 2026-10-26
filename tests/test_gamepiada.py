from datetime import datetime

from backend.bot.gamepiada import (
    DISCORD_URL,
    GAMEPIADA_END,
    GAMEPIADA_START,
    REGISTRATION_URL,
    MOSCOW_TZ,
    gamepiada_announcement,
    gamepiada_countdown,
    gamepiada_is_over,
)
from backend.bot.keyboards import main_menu_kb


def test_countdown_uses_moscow_date_and_ticks_to_approximate_start() -> None:
    now = datetime(2026, 10, 26, 23, 59, 30, tzinfo=MOSCOW_TZ)
    countdown = gamepiada_countdown(now)
    assert "0 дн. 00:00:30" in countdown
    assert "МСК" in countdown


def test_tournament_status_changes_at_the_announced_date_boundaries() -> None:
    before_start = datetime(2026, 10, 26, 12, tzinfo=MOSCOW_TZ)
    during_event = datetime(2026, 10, 30, 12, tzinfo=MOSCOW_TZ)
    assert "ОТКРЫТА РЕГИСТРАЦИЯ" in gamepiada_announcement(before_start)
    assert "17 дисциплин" in gamepiada_announcement(before_start)
    assert "турнирный период gamepiada уже начался" in gamepiada_countdown(during_event).lower()
    assert gamepiada_is_over(GAMEPIADA_END)
    assert "Турнирный период завершён" in gamepiada_announcement(GAMEPIADA_END)


def test_main_menu_has_live_registration_discord_and_timer_refresh_actions() -> None:
    before_start = datetime(2026, 10, 26, 12, tzinfo=MOSCOW_TZ)
    rows = main_menu_kb(now=before_start).inline_keyboard
    buttons = [button for row in rows for button in row]
    assert any(button.url == REGISTRATION_URL for button in buttons)
    assert any(button.url == DISCORD_URL for button in buttons)
    assert any(button.callback_data == "event:gamepiada:refresh" for button in buttons)


def test_main_menu_stops_offering_registration_after_event() -> None:
    rows = main_menu_kb(now=GAMEPIADA_END).inline_keyboard
    buttons = [button for row in rows for button in row]
    assert not any(button.url == REGISTRATION_URL for button in buttons)
    assert any(button.url == DISCORD_URL for button in buttons)
    assert not any(button.callback_data == "event:gamepiada:refresh" for button in buttons)


def test_start_and_end_constants_are_moscow_aware() -> None:
    assert GAMEPIADA_START.tzinfo is MOSCOW_TZ
    assert GAMEPIADA_END.tzinfo is MOSCOW_TZ
