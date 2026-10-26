from __future__ import annotations

from typing import Any
from aiogram import F, Router
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, InlineKeyboardButton, Message
from aiogram.utils.keyboard import InlineKeyboardBuilder

from backend.bot.handlers.helpers import esc, progress_bar, render_hud
from backend.bot.gamepiada import gamepiada_announcement
from backend.bot.keyboards import category_kb, main_menu_kb, webapp_button
from backend.bot.tool_catalog import count_tool_entries, search_tools
from backend.database import db
from backend.tools import TOOL_CATEGORIES, TOOLS_BY_ID

router = Router(name="navigation")


def _build_welcome_text(profile: dict[str, Any]) -> str:
    rank = profile["rank"]
    name = esc(profile.get("first_name") or "Пользователь")
    return (
        f"<b>MULTI_TG_TOOL</b>\n"
        f"<blockquote>👤 {name}  •  Уровень {rank['level']} ({rank['xp']} XP)  •  Запусков: {profile.get('tools_used', 0)}</blockquote>\n\n"
        f"{gamepiada_announcement()}\n\n"
        f"В каталоге <b>{len(TOOL_CATEGORIES)} разделов и {count_tool_entries()} инструментов</b>. Откройте раздел или найдите нужное командой <code>/tools фото</code>.\n"
        f"Также можно отправить в чат фото, PDF, математический пример или величину для перевода (например: <code>75 кг в фунты</code>)."
    )


@router.message(CommandStart())
@router.message(Command("menu"))
async def cmd_start(
    message: Message,
    state: FSMContext,
    user_profile: dict[str, Any],
    user_favorites: list[str],
) -> None:
    await state.clear()
    await render_hud(
        message,
        _build_welcome_text(user_profile),
        reply_markup=main_menu_kb(len(user_favorites)),
    )


@router.callback_query(F.data == "nav:home")
async def cb_home(
    callback: CallbackQuery,
    state: FSMContext,
    user_profile: dict[str, Any],
    user_favorites: list[str],
) -> None:
    await state.clear()
    await render_hud(
        callback,
        _build_welcome_text(user_profile),
        reply_markup=main_menu_kb(len(user_favorites)),
    )


@router.callback_query(F.data == "event:gamepiada:refresh")
async def cb_refresh_gamepiada_countdown(
    callback: CallbackQuery,
    state: FSMContext,
    user_profile: dict[str, Any],
    user_favorites: list[str],
) -> None:
    await state.clear()
    await render_hud(
        callback,
        _build_welcome_text(user_profile),
        reply_markup=main_menu_kb(len(user_favorites)),
    )


TOOL_SEARCH_PAGE_SIZE = 6


def _tool_search_keyboard(results: list[dict[str, Any]], page: int, page_count: int):
    builder = InlineKeyboardBuilder()
    start = page * TOOL_SEARCH_PAGE_SIZE
    for tool in results[start : start + TOOL_SEARCH_PAGE_SIZE]:
        builder.row(
            InlineKeyboardButton(
                text=f"{tool['emoji']} {tool['title'][:34]}",
                callback_data=f"tool:open:{tool['id']}",
            ),
            webapp_button("📱 App", tab=tool["id"]),
        )

    navigation: list[InlineKeyboardButton] = []
    if page > 0:
        navigation.append(InlineKeyboardButton(text="⬅️ Назад", callback_data=f"toolsearch:page:{page - 1}"))
    if page + 1 < page_count:
        navigation.append(InlineKeyboardButton(text="Ещё ➡️", callback_data=f"toolsearch:page:{page + 1}"))
    if navigation:
        builder.row(*navigation)
    builder.row(
        InlineKeyboardButton(text="🧹 Сбросить поиск", callback_data="toolsearch:clear"),
        InlineKeyboardButton(text="🏠 Главное меню", callback_data="nav:home"),
    )
    return builder.as_markup()


async def _render_tool_search(
    target: Message | CallbackQuery,
    state: FSMContext,
    query: str = "",
    page: int = 0,
) -> None:
    query = query.strip()[:80]
    results = search_tools(query)
    page_count = max(1, (len(results) + TOOL_SEARCH_PAGE_SIZE - 1) // TOOL_SEARCH_PAGE_SIZE)
    page = max(0, min(page, page_count - 1))
    await state.update_data(tool_catalog_query=query, tool_catalog_page=page)

    if results:
        start = page * TOOL_SEARCH_PAGE_SIZE
        shown = results[start : start + TOOL_SEARCH_PAGE_SIZE]
        rows = "\n".join(
            f"{item['emoji']} <b>{esc(item['title'])}</b> · {esc(item['category_title'])}\n"
            f"<i>{esc(item['desc'][:130])}</i>"
            for item in shown
        )
        scope = f"Совпадений: <b>{len(results)}</b> из {count_tool_entries()} инструментов"
        position = f"Страница {page + 1}/{page_count}"
        body = f"{rows}\n\n{scope} · {position}"
    else:
        body = (
            f"Совпадений по запросу <code>{esc(query)}</code> не найдено.\n\n"
            "Попробуйте короче: <code>калькулятор</code>, <code>игры</code>, <code>фото</code>, <code>здоровье</code>."
        )
        page_count = 1
        page = 0
        await state.update_data(tool_catalog_page=0)

    prefix = "<b>🔎 Поиск по каталогу бота</b>\n"
    query_line = f"Запрос: <code>{esc(query)}</code>\n\n" if query else "<i>Все разделы и инструменты в одном каталоге.</i>\n\n"
    await render_hud(
        target,
        f"{prefix}{query_line}{body}\n\nНажмите на строку, чтобы открыть бот-инструмент, или «📱 App» для полноэкранной версии.",
        reply_markup=_tool_search_keyboard(results, page, page_count),
    )


@router.message(Command("tools"))
async def cmd_tool_search(message: Message, state: FSMContext) -> None:
    query = (message.text or "").partition(" ")[2].strip()
    await _render_tool_search(message, state, query)


@router.callback_query(F.data == "nav:tools")
async def cb_tool_search(callback: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    await _render_tool_search(callback, state)


@router.callback_query(F.data.startswith("toolsearch:page:"))
async def cb_tool_search_page(callback: CallbackQuery, state: FSMContext) -> None:
    data = await state.get_data()
    page = int(callback.data.rsplit(":", 1)[-1])
    await _render_tool_search(callback, state, str(data.get("tool_catalog_query", "")), page)


@router.callback_query(F.data == "toolsearch:clear")
async def cb_tool_search_clear(callback: CallbackQuery, state: FSMContext) -> None:
    await _render_tool_search(callback, state, "", 0)


@router.callback_query(F.data.startswith("nav:cat:"))
async def cb_category(
    callback: CallbackQuery,
    state: FSMContext,
    user_favorites: list[str],
) -> None:
    await state.clear()
    cat_id = callback.data.split(":")[2]
    cat = next((c for c in TOOL_CATEGORIES if c["id"] == cat_id), TOOL_CATEGORIES[0])
    tools_lines = "\n".join(
        f"• {t['emoji']} <b>{esc(t['title'])}</b> — {esc(t['desc'])}"
        for t in cat["tools"]
    )
    text = (
        f"<b>{cat['emoji']} {esc(cat['title'])}</b>\n"
        f"<blockquote>{len(cat['tools'])} инструментов · кнопка слева открывает чат-версию, справа — полноценный экран приложения</blockquote>\n\n"
        f"{tools_lines}"
    )
    await render_hud(callback, text, reply_markup=category_kb(cat_id, user_favorites))


@router.callback_query(F.data == "nav:favorites")
async def cb_favorites(
    callback: CallbackQuery,
    state: FSMContext,
    user_favorites: list[str],
) -> None:
    await state.clear()
    builder = InlineKeyboardBuilder()
    if not user_favorites:
        text = "<b>⭐ Избранное</b>\n\nСписок пуст. Откройте любой инструмент и нажмите «☆ В избранное»."
    else:
        lines = []
        for t_id in user_favorites:
            meta = TOOLS_BY_ID.get(t_id)
            if meta:
                lines.append(f"• {meta['emoji']} <b>{esc(meta['title'])}</b> ({esc(meta['category_title'])})")
                builder.row(
                    InlineKeyboardButton(
                        text=f"{meta['emoji']} {meta['title']}",
                        callback_data=f"tool:open:{t_id}",
                    )
                )
        text = "<b>⭐ Избранное</b>\n\n" + "\n".join(lines)
    builder.row(InlineKeyboardButton(text="⬅️ Главное меню", callback_data="nav:home"))
    await render_hud(callback, text, reply_markup=builder.as_markup())


@router.callback_query(F.data.startswith("fav:toggle:"))
async def cb_toggle_fav(callback: CallbackQuery) -> None:
    tool_id = callback.data.split(":")[2]
    added = await db.toggle_favorite(callback.from_user.id, tool_id)
    meta = TOOLS_BY_ID.get(tool_id, {"title": tool_id})
    status = f"Добавлено в избранное: {meta['title']}" if added else f"Удалено из избранного: {meta['title']}"
    await callback.answer(status, show_alert=False)


@router.message(Command("profile"))
@router.callback_query(F.data == "nav:profile")
async def show_profile(
    event: Message | CallbackQuery,
    user_profile: dict[str, Any],
    user_favorites: list[str],
) -> None:
    uid = event.from_user.id
    notes = await db.list_notes(uid)
    todos = await db.list_todos(uid)
    habits = await db.list_habits(uid)
    done_todos = sum(1 for t in todos if t["done"])
    rank = user_profile["rank"]
    bar = progress_bar(rank["progress_pct"], 10)

    text = (
        f"<b>👤 Профиль</b>\n"
        f"<blockquote>Имя: <b>{esc(user_profile['first_name'])}</b>\n"
        f"ID: <code>{uid}</code>\n"
        f"Уровень {rank['level']}: {rank['title']}\n"
        f"Опыт: <code>{bar}</code> {rank['xp']} / {rank['next_xp']} XP</blockquote>\n\n"
        f"• Запусков инструментов: <b>{user_profile['tools_used']}</b>\n"
        f"• Привычек на контроле: <b>{len(habits)}</b>\n"
        f"• Задач выполнено: <b>{done_todos} из {len(todos)}</b>\n"
        f"• Заметок: <b>{len(notes)}</b>\n"
        f"• В избранном: <b>{len(user_favorites)}</b>"
    )
    builder = InlineKeyboardBuilder()
    builder.row(
        InlineKeyboardButton(text="📅 Привычки", callback_data="tool:open:habit_tracker"),
        InlineKeyboardButton(text="☑️ Список дел", callback_data="tool:open:todo_board"),
    )
    builder.row(
        InlineKeyboardButton(text="📝 Заметки", callback_data="tool:open:notes_vault"),
        InlineKeyboardButton(text="🏆 Рейтинг", callback_data="tool:open:leaderboard_hub"),
    )
    builder.row(InlineKeyboardButton(text="⬅️ Главное меню", callback_data="nav:home"))
    await render_hud(event, text, reply_markup=builder.as_markup())


@router.message(Command("help"))
@router.callback_query(F.data == "nav:help")
async def show_help(event: Message | CallbackQuery) -> None:
    text = (
        "<b>📖 Список команд</b>\n\n"
        f"• <code>/start</code> — главное меню ({len(TOOL_CATEGORIES)} разделов, {count_tool_entries()} инструментов)\n"
        f"• <code>/tools</code> или <code>/tools запрос</code> — найти любой инструмент, например <code>/tools фото</code>\n"
        "• <code>/earth</code> — 3D Земля и живые веб-камеры мира\n"
        "• <code>/chess</code> — шахматная академия, дебюты и ИИ\n"
        "• <code>/spy</code> и <code>/guess</code> — игра «Шпион» и «Угадай кто?»\n"
        "• <code>/speaker</code> и <code>/binaural</code> — очистка динамика (165 Гц) и бинауральные ритмы\n"
        "• <code>/reaction</code>, <code>/aim</code>, <code>/schulte</code> — реакция, аим-тренажёр и таблицы Шульте\n"
        "• <code>/sand</code> — физическая песочница стихий, японские кроссворды и пятнашки\n"
        "• <code>/udareniya</code> и <code>/yo текст</code> — ударения ЕГЭ ФИПИ, ёфикатор и транслит\n"
        "• <code>/croco</code> и <code>/lie</code> — слова для «Крокодила» и шуточный детектор лжи\n"
        "• <code>/horoscope</code> и <code>/compat</code> — гороскоп и совместимость по датам\n"
        "• <code>/physics</code> — физические расчёты (скорость, сила, КПД, ток)\n"
        "• <code>/marvel</code>, <code>/dc</code>, <code>/zitraks</code> — чек-листы киновселенных и ZitraksMode\n"
        "• <code>/habits</code>, <code>/todo</code>, <code>/notes</code> — привычки, задачи и заметки\n"
        "• <code>/units 10 миль в км</code> и <code>/calc (1450 * 1.2) / 3</code> — конвертер и калькулятор\n"
        "• <code>/qr https://t.me</code>, <code>/pass</code>, <code>/rhyme звезда</code> — QR, пароли и рифмы\n"
        "• <code>/top</code> и <code>/author</code> — рейтинг участников и официальные ссылки\n\n"
        "Также можно написать любой запрос обычным текстом или отправить в чат фото / PDF-файл."
    )
    builder = InlineKeyboardBuilder()
    builder.row(InlineKeyboardButton(text="⬅️ Главное меню", callback_data="nav:home"))
    await render_hud(event, text, reply_markup=builder.as_markup())
