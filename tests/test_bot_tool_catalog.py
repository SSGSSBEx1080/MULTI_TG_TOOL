from __future__ import annotations

from urllib.parse import parse_qs, urlparse

from backend.bot.keyboards import category_kb, tool_back_kb
from backend.bot.tool_catalog import count_tool_entries, list_tool_entries, search_tools
from backend.tools import TOOL_CATEGORIES


def _buttons(markup):
    return [button for row in markup.inline_keyboard for button in row]


def _app_tool_ids(markup) -> set[str]:
    ids = set()
    for button in _buttons(markup):
        if button.web_app and button.web_app.url:
            ids.update(parse_qs(urlparse(button.web_app.url).query).get("tool", []))
    return ids


def test_catalog_search_exposes_every_menu_item_by_its_exact_id() -> None:
    entries = list_tool_entries()
    assert len(entries) == count_tool_entries() == sum(len(category["tools"]) for category in TOOL_CATEGORIES)
    assert len(entries) >= 180

    for item in entries:
        matches = search_tools(item["id"])
        assert any(result["id"] == item["id"] for result in matches), item["id"]


def test_catalog_search_ranks_title_matches_and_handles_russian_yo() -> None:
    exact = search_tools("finance_calc")
    assert exact[0]["id"] == "finance_calc"
    assert search_tools("ефикатор")[0]["id"] == "russian_ege_ortho"
    assert all(
        "калькулятор" in " ".join((item["title"], item["desc"], item["category_title"], item["id"])).casefold()
        for item in search_tools("калькулятор")
    )


def test_every_category_tool_has_a_bot_action_and_direct_app_deep_link() -> None:
    for category in TOOL_CATEGORIES:
        markup = category_kb(category["id"], [])
        actions = {
            button.callback_data.removeprefix("tool:open:")
            for button in _buttons(markup)
            if button.callback_data and button.callback_data.startswith("tool:open:")
        }
        expected = {tool["id"] for tool in category["tools"]}
        assert actions == expected, category["id"]
        assert expected <= _app_tool_ids(markup), category["id"]


def test_every_item_screen_offers_the_full_mini_app_version() -> None:
    for item in list_tool_entries():
        assert item["id"] in _app_tool_ids(tool_back_kb(item["id"]))
