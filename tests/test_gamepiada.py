from datetime import datetime

from backend.bot.gamepiada import (
    DISCORD_URL,
    GAMEPIADA_END,
    GAMEPIADA_START,
    REGISTRATION_URL,
    MOSCOW_TZ,
    gamepiada_announcement,
    gamepiada_countdown,
    gamepiada_home_banner,
    gamepiada_is_over,
)
from backend.bot.keyboards import CATEGORY_CATALOG_PAGE_SIZE, category_catalog_kb, main_menu_kb
from backend.tools import TOOL_CATEGORIES


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


def test_home_banner_is_compact_and_full_event_details_remain_available() -> None:
    before_start = datetime(2026, 10, 26, 12, tzinfo=MOSCOW_TZ)
    banner = gamepiada_home_banner(before_start)
    assert banner.startswith("<b>🏆━━━━━━━━ GAMEpiada")
    assert "17 дисциплин" in banner
    assert "До даты старта" in banner
    assert "Dota 2" not in banner
    full_details = gamepiada_announcement(before_start)
    assert "Dota 2" in full_details and "Brawl Stars" in full_details
    assert "Расписание и подробности — скоро" in full_details


def test_home_menu_is_compact_and_catalog_pagination_covers_each_category_once() -> None:
    rows = main_menu_kb().inline_keyboard
    buttons = [button for row in rows for button in row]
    assert len(rows) <= 8
    assert any(button.callback_data == "nav:catalog" for button in buttons)
    assert not any(button.callback_data and button.callback_data.startswith("nav:cat:") for button in buttons)

    pages = (len(TOOL_CATEGORIES) + CATEGORY_CATALOG_PAGE_SIZE - 1) // CATEGORY_CATALOG_PAGE_SIZE
    found_ids: list[str] = []
    for page in range(pages):
        for row in category_catalog_kb(page).inline_keyboard:
            for button in row:
                if button.callback_data and button.callback_data.startswith("nav:cat:"):
                    found_ids.append(button.callback_data.removeprefix("nav:cat:"))
    expected_ids = [category["id"] for category in TOOL_CATEGORIES]
    assert found_ids == expected_ids


def test_start_and_end_constants_are_moscow_aware() -> None:
    assert GAMEPIADA_START.tzinfo is MOSCOW_TZ
    assert GAMEPIADA_END.tzinfo is MOSCOW_TZ
