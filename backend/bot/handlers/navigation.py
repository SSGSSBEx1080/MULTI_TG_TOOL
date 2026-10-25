from __future__ import annotations

from typing import Any
from aiogram import F, Router
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, InlineKeyboardButton, Message
from aiogram.utils.keyboard import InlineKeyboardBuilder

from backend.bot.handlers.helpers import esc, progress_bar, render_hud
from backend.bot.keyboards import category_kb, main_menu_kb
from backend.database import db
from backend.tools import TOOL_CATEGORIES, TOOLS_BY_ID

router = Router(name="navigation")


def _build_welcome_text(profile: dict[str, Any]) -> str:
    rank = profile["rank"]
    name = esc(profile.get("first_name") or "Пользователь")
    return (
        f"<b>MULTI_TG_TOOL</b>\n"
        f"<blockquote>👤 {name}  •  Уровень {rank['level']} ({rank['xp']} XP)  •  Запусков: {profile.get('tools_used', 0)}</blockquote>\n\n"
        f"Выберите нужный раздел в меню ниже или откройте приложение.\n"
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
        f"<b>{cat['emoji']} {esc(cat['title'])}</b>\n\n"
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
        "• <code>/start</code> — главное меню\n"
        "• <code>/horoscope</code> — гороскоп по знакам зодиака\n"
        "• <code>/compat</code> — совместимость по двум датам рождения\n"
        "• <code>/physics</code> — физические расчёты (скорость, сила, КПД, ток)\n"
        "• <code>/marvel</code> — чек-лист фильмов и сериалов Marvel\n"
        "• <code>/dc</code> — чек-лист киновселенной DC\n"
        "• <code>/zitraks</code> — вики и древо достижений мода ZitraksMode\n"
        "• <code>/habits</code> — трекер привычек\n"
        "• <code>/todo</code> и <code>/notes</code> — список дел и заметки\n"
        "• <code>/units 10 миль в км</code> — конвертер величин\n"
        "• <code>/calc (1450 * 1.2) / 3</code> — калькулятор\n"
        "• <code>/qr https://t.me</code> — создание QR-кода\n"
        "• <code>/pass</code> — генератор паролей\n"
        "• <code>/rhyme звезда</code> — подбор рифм\n"
        "• <code>/top</code> — рейтинг участников\n"
        "• <code>/author</code> — официальные ссылки проекта\n\n"
        "Также можно отправить в чат фото или PDF-файл для обработки."
    )
    builder = InlineKeyboardBuilder()
    builder.row(InlineKeyboardButton(text="⬅️ Главное меню", callback_data="nav:home"))
    await render_hud(event, text, reply_markup=builder.as_markup())
