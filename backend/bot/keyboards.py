from __future__ import annotations

from datetime import datetime
from typing import Any
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from aiogram.utils.keyboard import InlineKeyboardBuilder

from backend.bot.gamepiada import DISCORD_URL, REGISTRATION_URL, gamepiada_is_over
from backend.config import DEFAULT_PUBLIC_WEBAPP_URL, WEBAPP_URL
from backend.tools import TOOL_CATEGORIES, TOOLS_BY_ID


def _webapp_button(text: str = "📱 Открыть приложение", tab: str = "") -> InlineKeyboardButton:
    raw_base = WEBAPP_URL.strip().rstrip("/")
    base = raw_base if raw_base.startswith("https://") else DEFAULT_PUBLIC_WEBAPP_URL
    url = f"{base}/?tma=1" + (f"&tool={tab}" if tab else "")
    return InlineKeyboardButton(text=text, web_app=WebAppInfo(url=url))


def webapp_button(text: str = "📱 Открыть приложение", tab: str = "") -> InlineKeyboardButton:
    return _webapp_button(text=text, tab=tab)


def main_menu_kb(favorites_count: int = 0, now: datetime | None = None) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.row(_webapp_button("📱 Открыть приложение MULTI_TG_TOOL"))
    if not gamepiada_is_over(now):
        builder.row(
            InlineKeyboardButton(text="📝 Заявка GAMEpiada", url=REGISTRATION_URL),
            InlineKeyboardButton(text="💬 Discord", url=DISCORD_URL),
        )
        builder.row(InlineKeyboardButton(text="⏱ Обновить таймер GAMEpiada", callback_data="event:gamepiada:refresh"))
    else:
        builder.row(InlineKeyboardButton(text="💬 Discord GAMEpiada · итоги", url=DISCORD_URL))

    cat_buttons = [
        InlineKeyboardButton(
            text=f"{cat['emoji']} {cat['title']}",
            callback_data=f"nav:cat:{cat['id']}",
        )
        for cat in TOOL_CATEGORIES
    ]
    for i in range(0, len(cat_buttons), 2):
        builder.row(*cat_buttons[i : i + 2])

    fav_label = f"⭐ Избранное ({favorites_count})" if favorites_count else "⭐ Избранное"
    builder.row(
        InlineKeyboardButton(text=fav_label, callback_data="nav:favorites"),
        InlineKeyboardButton(text="👤 Профиль", callback_data="nav:profile"),
    )
    builder.row(
        InlineKeyboardButton(text="🔍 Инлайн-поиск", switch_inline_query_current_chat="256 * 16"),
        InlineKeyboardButton(text="📖 Команды", callback_data="nav:help"),
    )
    return builder.as_markup()


def category_kb(category_id: str, user_favorites: list[str]) -> InlineKeyboardMarkup:
    cat = next((c for c in TOOL_CATEGORIES if c["id"] == category_id), TOOL_CATEGORIES[0])
    builder = InlineKeyboardBuilder()
    for tool in cat["tools"]:
        star = "★ " if tool["id"] in user_favorites else ""
        builder.row(
            InlineKeyboardButton(
                text=f"{tool['emoji']} {star}{tool['title']}",
                callback_data=f"tool:open:{tool['id']}",
            )
        )
    builder.row(_webapp_button(f"📱 Открыть «{cat['title']}» в приложении", tab=category_id))
    builder.row(InlineKeyboardButton(text="⬅️ Главное меню", callback_data="nav:home"))
    return builder.as_markup()


def tool_back_kb(
    tool_id: str,
    is_fav: bool = False,
    extra_rows: list[list[InlineKeyboardButton]] | None = None,
) -> InlineKeyboardMarkup:
    meta = TOOLS_BY_ID.get(tool_id, {"category_id": "qr"})
    cat_id = meta["category_id"]
    builder = InlineKeyboardBuilder()
    if extra_rows:
        for row in extra_rows:
            builder.row(*row)
    fav_text = "★ В избранном" if is_fav else "☆ В избранное"
    builder.row(
        InlineKeyboardButton(text=fav_text, callback_data=f"fav:toggle:{tool_id}"),
        InlineKeyboardButton(text="🔄 Обновить", callback_data=f"tool:open:{tool_id}"),
    )
    builder.row(
        InlineKeyboardButton(text="⬅️ К разделу", callback_data=f"nav:cat:{cat_id}"),
        InlineKeyboardButton(text="🏠 Меню", callback_data="nav:home"),
    )
    return builder.as_markup()


def pass_forge_kb(length: int = 20, mode: str = "chars", is_fav: bool = False) -> InlineKeyboardMarkup:
    lengths = [12, 16, 24, 32]
    len_row = [
        InlineKeyboardButton(
            text=f"• {ln} •" if (mode == "chars" and ln == length) else str(ln),
            callback_data=f"sec:pass:{ln}:chars",
        )
        for ln in lengths
    ]
    mode_row = [
        InlineKeyboardButton(
            text="✅ Символы" if mode == "chars" else "Символы",
            callback_data=f"sec:pass:{length}:chars",
        ),
        InlineKeyboardButton(
            text="✅ Пассфраза" if mode == "passphrase" else "Пассфраза",
            callback_data=f"sec:pass:{length}:passphrase",
        ),
    ]
    regen_row = [
        InlineKeyboardButton(
            text="🔄 Сгенерировать заново",
            callback_data=f"sec:pass:{length}:{mode}",
        )
    ]
    return tool_back_kb("pass_forge", is_fav=is_fav, extra_rows=[len_row, mode_row, regen_row])


def qr_theme_kb(current_theme: str = "cyber", current_shape: str = "rounded") -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    themes = [
        ("cyber", "Синий"),
        ("telegram", "Голубой"),
        ("emerald", "Зелёный"),
        ("sunset", "Оранжевый"),
        ("royal", "Фиолетовый"),
        ("classic", "Чёрно-белый"),
    ]
    btns = [
        InlineKeyboardButton(
            text=f"✅ {label}" if k == current_theme else label,
            callback_data=f"qr:cfg:{k}:{current_shape}",
        )
        for k, label in themes
    ]
    for i in range(0, len(btns), 3):
        builder.row(*btns[i : i + 3])

    shapes = [("rounded", "Скруглённый"), ("dots", "Точки"), ("gapped", "Квадраты")]
    builder.row(
        *[
            InlineKeyboardButton(
                text=f"• {lbl} •" if s == current_shape else lbl,
                callback_data=f"qr:cfg:{current_theme}:{s}",
            )
            for s, lbl in shapes
        ]
    )
    builder.row(
        InlineKeyboardButton(text="⬅️ К разделу", callback_data="nav:cat:qr"),
        InlineKeyboardButton(text="🏠 Меню", callback_data="nav:home"),
    )
    return builder.as_markup()


def photo_context_kb(file_key: str) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.row(
        InlineKeyboardButton(text="🔍 Сканировать QR-код", callback_data=f"imgact:qr_decode:{file_key}"),
    )
    builder.row(
        InlineKeyboardButton(text="🧹 Очистить EXIF", callback_data=f"imgact:exif:{file_key}"),
        InlineKeyboardButton(text="🖼 Стикер 512px", callback_data=f"imgact:sticker:{file_key}"),
    )
    builder.row(
        InlineKeyboardButton(text="🔒 Записать текст в PNG", callback_data=f"imgact:stego_hide:{file_key}"),
        InlineKeyboardButton(text="🔓 Прочитать текст из PNG", callback_data=f"imgact:stego_read:{file_key}"),
    )
    builder.row(
        InlineKeyboardButton(text="🎨 Контрастный фильтр", callback_data=f"imgact:cyberpunk:{file_key}"),
        InlineKeyboardButton(text="📄 Сохранить в PDF", callback_data=f"imgact:topdf:{file_key}"),
    )
    builder.row(InlineKeyboardButton(text="🏠 Главное меню", callback_data="nav:home"))
    return builder.as_markup()


def pdf_context_kb(file_key: str) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.row(
        InlineKeyboardButton(text="🔎 Извлечь текст", callback_data=f"pdfact:inspect:{file_key}"),
    )
    builder.row(
        InlineKeyboardButton(text="🔐 Установить пароль", callback_data=f"pdfact:encrypt:{file_key}"),
        InlineKeyboardButton(text="🔄 Повернуть 90°", callback_data=f"pdfact:rotate:{file_key}"),
    )
    builder.row(InlineKeyboardButton(text="🏠 Главное меню", callback_data="nav:home"))
    return builder.as_markup()


def todos_kb(todos: list[dict[str, Any]]) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    for item in todos[:12]:
        mark = "✅" if item["done"] else "⬜"
        prio = "❗ " if item.get("priority") == "high" and not item["done"] else ""
        label = f"{mark} {prio}{item['text'][:38]}"
        builder.row(
            InlineKeyboardButton(text=label, callback_data=f"ws:todo_toggle:{item['id']}")
        )
    builder.row(
        InlineKeyboardButton(text="➕ Добавить задачу", callback_data="ws:todo_add"),
        InlineKeyboardButton(text="🗑 Очистить выполненные", callback_data="ws:todo_clear"),
    )
    builder.row(
        InlineKeyboardButton(text="⬅️ Привычки и задачи", callback_data="nav:cat:workspace"),
        InlineKeyboardButton(text="🏠 Меню", callback_data="nav:home"),
    )
    return builder.as_markup()
