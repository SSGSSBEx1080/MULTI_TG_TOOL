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
    bar = progress_bar(rank["progress_pct"], 8)
    name = esc(profile.get("first_name") or "Друг")
    return (
        f"<b>🌌 MULTI_TG_TOOL • Галактический Мультитул в Telegram</b>\n"
        f"<blockquote>👋 Привет, <b>{name}</b>!\n"
        f"🎖 <b>Ранг:</b> {rank['title']}  •  <code>{rank['xp']}/{rank['next_xp']} XP</code>\n"
        f"📊 <b>Прогресс:</b> <code>{bar}</code> ({rank['progress_pct']}%)\n"
        f"🛠 <b>Запусков:</b> {profile.get('tools_used', 0)}</blockquote>\n\n"
        f"<b>50+ инструментов и миров внутри MULTI_TG_TOOL:</b>\n"
        f"• 🎨 <b>QR, Ссылки, Фото & PDF</b> — создание и чтение QR, укоротитель/удлинитель ссылок, стеганография PNG, PDF AES-256\n"
        f"• 🎉 <b>Тусовка & Угар</b> — алко-калькулятор 0..40°, 105+ идей от скуки, био-расчёт длины члена\n"
        f"• 📚 <b>Знания & Вселенные</b> — Стенд-декс JoJo (части 3–9), Мульти-Вики, Конституции, Формулы ЕГЭ, Население\n"
        f"• 🎮 <b>Аркады & Соцсеть</b> — Тетрис, Flappy, Jump, Кликер, Топ игроков, Альтушки 18+, Bibinto, Анонимный чат\n"
        f"• ⚡ <b>Smart Omni-Drop</b> — кидай <i>фото, PDF, дюймы/фунты, пример или кривую раскладку</i> прямо в чат без команд!"
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
        f"• {t['emoji']} <b>{esc(t['title'])}</b> — <i>{esc(t['desc'])}</i>"
        for t in cat["tools"]
    )
    text = (
        f"<b>{cat['emoji']} {esc(cat['title'])}</b>\n"
        f"<blockquote>🧭 Главная › {esc(cat['title'])}</blockquote>\n\n"
        f"{tools_lines}\n\n"
        f"👇 Выберите инструмент ниже или откройте визуальную студию:"
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
        text = (
            "<b>⭐ Избранные инструменты</b>\n"
            "<blockquote>Список пока пуст. Откройте любой инструмент и нажмите «☆ В избранное» для быстрого доступа в 1 тап!</blockquote>"
        )
    else:
        lines = []
        for t_id in user_favorites:
            meta = TOOLS_BY_ID.get(t_id)
            if meta:
                lines.append(f"• {meta['emoji']} <b>{esc(meta['title'])}</b> <i>({esc(meta['category_title'])})</i>")
                builder.row(
                    InlineKeyboardButton(
                        text=f"{meta['emoji']} {meta['title']}",
                        callback_data=f"tool:open:{t_id}",
                    )
                )
        text = (
            "<b>⭐ Ваши избранные инструменты</b>\n"
            "<blockquote>Синхронизировано между Telegram-ботом и Mini App Studio</blockquote>\n\n"
            + "\n".join(lines)
        )
    builder.row(InlineKeyboardButton(text="⬅️ Главное меню", callback_data="nav:home"))
    await render_hud(callback, text, reply_markup=builder.as_markup())


@router.callback_query(F.data.startswith("fav:toggle:"))
async def cb_toggle_fav(callback: CallbackQuery) -> None:
    tool_id = callback.data.split(":")[2]
    added = await db.toggle_favorite(callback.from_user.id, tool_id)
    meta = TOOLS_BY_ID.get(tool_id, {"title": tool_id})
    status = f"★ «{meta['title']}» добавлен в избранное!" if added else f"Удалено из избранного: {meta['title']}"
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
    done_todos = sum(1 for t in todos if t["done"])
    rank = user_profile["rank"]
    bar = progress_bar(rank["progress_pct"], 10)

    text = (
        f"<b>🏆 Профиль Оператора NEXUS</b>\n"
        f"<blockquote>👤 <b>Имя:</b> {esc(user_profile['first_name'])}\n"
        f"🆔 <b>ID:</b> <code>{uid}</code>\n"
        f"🎖 <b>Уровень {rank['level']}:</b> {rank['title']}\n"
        f"⚡ <b>Опыт:</b> <code>{bar}</code> {rank['xp']} / {rank['next_xp']} XP</blockquote>\n\n"
        f"<b>📈 Личная статистика:</b>\n"
        f"• Использовано инструментов: <b>{user_profile['tools_used']}</b>\n"
        f"• В избранном: <b>{len(user_favorites)}</b>\n"
        f"• Сохранено заметок: <b>{len(notes)}</b>\n"
        f"• Задач выполнено: <b>{done_todos} из {len(todos)}</b>"
    )
    builder = InlineKeyboardBuilder()
    builder.row(
        InlineKeyboardButton(text="📝 Мои заметки", callback_data="tool:open:notes_vault"),
        InlineKeyboardButton(text="✅ Чек-листы", callback_data="tool:open:todo_board"),
    )
    builder.row(InlineKeyboardButton(text="⬅️ Главное меню", callback_data="nav:home"))
    await render_hud(event, text, reply_markup=builder.as_markup())


@router.message(Command("help"))
@router.callback_query(F.data == "nav:help")
async def show_help(event: Message | CallbackQuery) -> None:
    text = (
        "<b>📖 Быстрые команды и Секретные фишки NEXUS</b>\n"
        "<blockquote>Бот понимает как кнопки меню, так и мгновенные слэш-команды и умный сброс файлов!</blockquote>\n\n"
        "<b>⚡ Быстрые команды:</b>\n"
        "• <code>/qr https://t.me</code> — мгновенный неоновый QR-код\n"
        "• <code>/pass</code> — генератор криптостойких паролей в 1 тап\n"
        "• <code>/code print('Hi')</code> — Carbon-скриншот кода с подсветкой\n"
        "• <code>/calc (1450 * 1.2) / 3</code> — научный калькулятор\n"
        "• <code>/layout Ghbdtn vbh</code> — исправление раскладки\n"
        "• <code>/stego Тайный шифр</code> — спрятать секрет внутри PNG\n"
        "• <code>/ip 192.168.1.0/26</code> — расчёт подсети CIDR\n"
        "• <code>/dice 2d20+5</code> — бросок кубиков\n"
        "• <code>/todo</code> и <code>/notes</code> — синхронные задачи и заметки\n\n"
        "<b>🧠 Умный режим без команд (Smart Omni-Drop):</b>\n"
        "• Отправьте <b>любое фото</b> — появится панель очистки EXIF, создания ТГ-стикера 512px и стеганографии!\n"
        "• Отправьте <b>PDF файл</b> — извлечение текста, поворот и защита AES-256!\n"
        "• Напишите в любом чате <code>@nexus_multitool_bot запрос</code> для инлайн-режима!"
    )
    builder = InlineKeyboardBuilder()
    builder.row(InlineKeyboardButton(text="⬅️ Главное меню", callback_data="nav:home"))
    await render_hud(event, text, reply_markup=builder.as_markup())
