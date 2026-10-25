from __future__ import annotations

import re
from aiogram import F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, InlineKeyboardButton, Message
from aiogram.utils.keyboard import InlineKeyboardBuilder

from backend.bot.handlers.helpers import esc, render_hud
from backend.bot.keyboards import webapp_button
from backend.bot.states import ToolState
from backend.database import db
from backend.tools.astrology_and_physics import (
    PHYSICS_CALCULATORS,
    ZODIAC_BY_ID,
    ZODIAC_SIGNS,
    analyze_birth_date,
    calculate_compatibility,
    get_horoscope,
    solve_physics,
)

router = Router(name="v3_bot_handlers")


# ==============================================================================
# 1. Гороскоп на сегодня / завтра / неделю
# ==============================================================================
def _horoscope_kb(active_sign: str = "aries", period: str = "today"):
    b = InlineKeyboardBuilder()
    periods = [("today", "Сегодня"), ("tomorrow", "Завтра"), ("week", "Неделя")]
    b.row(
        *[
            InlineKeyboardButton(
                text=f"• {lbl} •" if p == period else lbl,
                callback_data=f"v3:horo:{active_sign}:{p}",
            )
            for p, lbl in periods
        ]
    )
    sign_btns = [
        InlineKeyboardButton(
            text=f"{'✅ ' if s['id'] == active_sign else s['symbol'] + ' '}{s['name']}",
            callback_data=f"v3:horo:{s['id']}:{period}",
        )
        for s in ZODIAC_SIGNS
    ]
    for i in range(0, len(sign_btns), 3):
        b.row(*sign_btns[i : i + 3])
    b.row(
        InlineKeyboardButton(text="♈ По дате рождения", callback_data="tool:open:zodiac_info"),
        InlineKeyboardButton(text="💞 Совместимость", callback_data="tool:open:compat_calc"),
    )
    b.row(webapp_button("📱 Открыть раздел в приложении", tab="horoscope"))
    b.row(
        InlineKeyboardButton(text="⬅️ К разделу", callback_data="nav:cat:horoscope"),
        InlineKeyboardButton(text="🏠 Меню", callback_data="nav:home"),
    )
    return b.as_markup()


async def _render_horoscope(target: Message | CallbackQuery, sign_id: str = "aries", period: str = "today") -> None:
    res = get_horoscope(sign_id, period)
    s = res["sign"]
    sc = res["scores"]
    txt = (
        f"<b>{s['symbol']} {esc(s['name'])} — Гороскоп: {esc(res['period_label'])}</b>\n"
        f"<blockquote>Период знака: {esc(s['dates'])}  •  Стихия: {esc(s['element'])}  •  Дата: {esc(res['target_date'])}</blockquote>\n\n"
        f"<b>Общий фон:</b> {esc(res['general'])}\n\n"
        f"<b>Отношения:</b> {esc(res['love'])}\n\n"
        f"<b>Работа и дела:</b> {esc(res['career'])}\n\n"
        f"📊 Оценки: Общий <b>{sc['overall']}%</b> • Отношения <b>{sc['love']}%</b> • Дела <b>{sc['career']}%</b> • Тонус <b>{sc['energy']}%</b>\n"
        f"🔢 Число: <b>{res['lucky_number']}</b>  •  🕒 Часы: <b>{esc(res['lucky_time'])}</b>"
    )
    await render_hud(target, txt, reply_markup=_horoscope_kb(s["id"], period))


@router.message(Command("horoscope"))
async def cmd_horoscope(message: Message) -> None:
    arg = (message.text or "").partition(" ")[2].strip()
    sign_id = "aries"
    if arg:
        res = get_horoscope(arg, "today")
        sign_id = res["sign"]["id"]
    await db.record_tool_use(message.from_user.id, "daily_horoscope", "horoscope", "bot", sign_id)
    await _render_horoscope(message, sign_id, "today")


@router.callback_query(F.data == "tool:open:daily_horoscope")
async def cb_open_horoscope(call: CallbackQuery) -> None:
    await db.record_tool_use(call.from_user.id, "daily_horoscope", "horoscope", "bot", "aries")
    await _render_horoscope(call, "aries", "today")


@router.callback_query(F.data.startswith("v3:horo:"))
async def cb_switch_horoscope(call: CallbackQuery) -> None:
    _, _, sign_id, period = call.data.split(":")
    await _render_horoscope(call, sign_id, period)


# ==============================================================================
# 2. Знак зодиака и разбор по дате рождения
# ==============================================================================
@router.message(Command("zodiac"))
async def cmd_zodiac(message: Message, state: FSMContext) -> None:
    arg = (message.text or "").partition(" ")[2].strip()
    if arg:
        await _process_birth_date(message, state, arg)
        return
    await state.set_state(ToolState.birth_date_waiting)
    b = InlineKeyboardBuilder()
    b.row(webapp_button("📱 Открыть в приложении", tab="horoscope"))
    b.row(InlineKeyboardButton(text="⬅️ К разделу", callback_data="nav:cat:horoscope"), InlineKeyboardButton(text="🏠 Меню", callback_data="nav:home"))
    await render_hud(
        message,
        "<b>♈ Определение знака зодиака по дате</b>\n\n"
        "Отправьте дату рождения в формате <code>ДД.ММ.ГГГГ</code> или <code>ДД.ММ</code>\n"
        "Пример: <code>15.05.2002</code>",
        reply_markup=b.as_markup(),
    )


@router.callback_query(F.data == "tool:open:zodiac_info")
async def cb_open_zodiac_info(call: CallbackQuery, state: FSMContext) -> None:
    await state.set_state(ToolState.birth_date_waiting)
    b = InlineKeyboardBuilder()
    b.row(
        InlineKeyboardButton(text="Пример: 15.05.2002", callback_data="v3:bdate:15.05.2002"),
        InlineKeyboardButton(text="Пример: 22.11.1999", callback_data="v3:bdate:22.11.1999"),
    )
    b.row(webapp_button("📱 Открыть в приложении", tab="horoscope"))
    b.row(InlineKeyboardButton(text="⬅️ К разделу", callback_data="nav:cat:horoscope"), InlineKeyboardButton(text="🏠 Меню", callback_data="nav:home"))
    await render_hud(
        call,
        "<b>♈ Знак зодиака и разбор даты рождения</b>\n\n"
        "Отправьте дату рождения в чат в формате <code>ДД.ММ.ГГГГ</code> (например: <code>14.08.2001</code>).",
        reply_markup=b.as_markup(),
    )


@router.callback_query(F.data.startswith("v3:bdate:"))
async def cb_sample_birth_date(call: CallbackQuery, state: FSMContext) -> None:
    d_str = call.data.split(":", 2)[2]
    await _process_birth_date(call, state, d_str)


async def _process_birth_date(target: Message | CallbackQuery, state: FSMContext, raw_date: str) -> None:
    uid = target.from_user.id
    try:
        res = analyze_birth_date(raw_date)
    except ValueError as e:
        if isinstance(target, CallbackQuery):
            await target.answer(str(e), show_alert=True)
        else:
            await target.answer(f"⚠️ {esc(str(e))}")
        return
    await state.clear()
    await db.record_tool_use(uid, "zodiac_info", "horoscope", "bot", res["sign"]["name"])
    s = res["sign"]
    extra_lines = []
    if res.get("eastern_animal"):
        extra_lines.append(f"• Восточный календарь: <b>{esc(res['eastern_animal'])}</b> ({esc(res['eastern_element'])})")
    if res.get("life_path_number"):
        extra_lines.append(f"• Число даты рождения: <b>{res['life_path_number']}</b> — {esc(res['life_path_meaning'])}")
    if res.get("age") is not None:
        extra_lines.append(f"• Возраст: <b>{res['age']}</b>  •  До дня рождения: <b>{res['days_until_birthday']} дн.</b>")

    b = InlineKeyboardBuilder()
    b.row(
        InlineKeyboardButton(text=f"🔮 Гороскоп ({s['name']})", callback_data=f"v3:horo:{s['id']}:today"),
        InlineKeyboardButton(text="💞 Совместимость", callback_data="tool:open:compat_calc"),
    )
    b.row(InlineKeyboardButton(text="🔄 Проверить другую дату", callback_data="tool:open:zodiac_info"))
    b.row(InlineKeyboardButton(text="⬅️ К разделу", callback_data="nav:cat:horoscope"), InlineKeyboardButton(text="🏠 Меню", callback_data="nav:home"))

    await render_hud(
        target,
        f"<b>{s['symbol']} {esc(s['name'])} ({esc(res['formatted_date'])})</b>\n"
        f"<blockquote>Стихия: <b>{esc(s['element'])}</b>  •  Качество: {esc(s['quality'])}  •  Планета: {esc(s['ruler'])}</blockquote>\n\n"
        f"• Сильные стороны: {esc(s['strengths'])}\n"
        f"• Зоны внимания: {esc(s['weaknesses'])}\n"
        f"• Близкие знаки: {esc(', '.join(s['best_matches']))}\n"
        + ("\n" + "\n".join(extra_lines) if extra_lines else ""),
        reply_markup=b.as_markup(),
    )


@router.message(ToolState.birth_date_waiting, F.text, ~F.text.startswith("/"))
async def msg_birth_date_input(message: Message, state: FSMContext) -> None:
    await _process_birth_date(message, state, message.text or "")


# ==============================================================================
# 3. Тест совместимости по датам / знакам
# ==============================================================================
@router.message(Command("compat"))
async def cmd_compat(message: Message, state: FSMContext) -> None:
    arg = (message.text or "").partition(" ")[2].strip()
    if arg:
        parts = [p for p in re.split(r"[\s,;+]+", arg) if p]
        if len(parts) >= 2:
            await _process_compat(message, state, parts[0], parts[1])
            return
    await _prompt_compat(message, state)


@router.callback_query(F.data == "tool:open:compat_calc")
async def cb_open_compat(call: CallbackQuery, state: FSMContext) -> None:
    await _prompt_compat(call, state)


async def _prompt_compat(target: Message | CallbackQuery, state: FSMContext) -> None:
    await state.set_state(ToolState.compat_waiting_dates)
    b = InlineKeyboardBuilder()
    b.row(
        InlineKeyboardButton(text="Пример: 15.05.2002 и 21.09.2003", callback_data="v3:cmp:15.05.2002:21.09.2003"),
    )
    b.row(webapp_button("📱 Открыть калькулятор совместимости", tab="horoscope"))
    b.row(InlineKeyboardButton(text="⬅️ К разделу", callback_data="nav:cat:horoscope"), InlineKeyboardButton(text="🏠 Меню", callback_data="nav:home"))
    await render_hud(
        target,
        "<b>💞 Совместимость по датам рождения или знакам</b>\n\n"
        "Отправьте две даты рождения или два знака зодиака через пробел:\n"
        "• <code>15.05.2002 21.09.2003</code>\n"
        "• <code>Овен Весы</code>",
        reply_markup=b.as_markup(),
    )


@router.callback_query(F.data.startswith("v3:cmp:"))
async def cb_sample_compat(call: CallbackQuery, state: FSMContext) -> None:
    _, _, d1, d2 = call.data.split(":")
    await _process_compat(call, state, d1, d2)


async def _process_compat(target: Message | CallbackQuery, state: FSMContext, first: str, second: str) -> None:
    res = calculate_compatibility(first, second)
    await state.clear()
    await db.record_tool_use(target.from_user.id, "compat_calc", "horoscope", "bot", f"{res['overall_pct']}%")
    s1 = res["person1"]["sign"]
    s2 = res["person2"]["sign"]
    sc = res["scores"]
    b = InlineKeyboardBuilder()
    b.row(InlineKeyboardButton(text="🔄 Проверить другую пару", callback_data="tool:open:compat_calc"))
    b.row(webapp_button("📱 Подробно в приложении", tab="horoscope"))
    b.row(InlineKeyboardButton(text="⬅️ К разделу", callback_data="nav:cat:horoscope"), InlineKeyboardButton(text="🏠 Меню", callback_data="nav:home"))

    await render_hud(
        target,
        f"<b>💞 Совместимость: {s1['symbol']} {esc(s1['name'])} + {s2['symbol']} {esc(s2['name'])} — {res['overall_pct']}%</b>\n"
        f"<blockquote>{esc(res['level'])}  •  Стихии: {esc(s1['element'])} и {esc(s2['element'])}</blockquote>\n\n"
        f"• Эмоциональный контакт: <b>{sc['emotional']}%</b>\n"
        f"• Общение и договорённости: <b>{sc['communication']}%</b>\n"
        f"• Быт и общие цели: <b>{sc['goals_and_daily']}%</b>\n"
        f"• Совпадение ритмов: <b>{sc['biorhythm_or_numbers']}%</b>\n\n"
        f"{esc(res['summary'])}",
        reply_markup=b.as_markup(),
    )


@router.message(ToolState.compat_waiting_dates, F.text, ~F.text.startswith("/"))
async def msg_compat_input(message: Message, state: FSMContext) -> None:
    parts = [p for p in re.split(r"[\s,;+]+", (message.text or "").strip()) if p]
    if len(parts) < 2:
        await message.answer(
            "Укажите две даты рождения или два знака через пробел, например: <code>15.05.2002 21.09.2003</code>",
            parse_mode="HTML",
        )
        return
    await _process_compat(message, state, parts[0], parts[1])


# ==============================================================================
# 4. Трекер привычек
# ==============================================================================
async def _render_habits_bot(target: Message | CallbackQuery, state: FSMContext | None = None) -> None:
    if state:
        await state.clear()
    uid = target.from_user.id
    habits = await db.list_habits(uid)
    b = InlineKeyboardBuilder()

    if not habits:
        text = (
            "<b>📅 Трекер привычек</b>\n\n"
            "У вас пока нет добавленных привычек.\n"
            "Нажмите «➕ Добавить привычку», чтобы отслеживать выполнение по дням и серию без пропусков."
        )
    else:
        lines = []
        for h in habits:
            mark = "✅" if h["done_today"] else "⬜"
            streak_txt = f" • серия {h['streak']} дн." if h["streak"] > 0 else ""
            lines.append(
                f"{mark} {h['icon']} <b>{esc(h['title'])}</b> — {h['done_week']}/{h['target_per_week']} за 7 дн.{streak_txt}"
            )
            b.row(
                InlineKeyboardButton(
                    text=f"{mark} {h['icon']} {h['title'][:28]}",
                    callback_data=f"v3:hab_tog:{h['id']}",
                ),
                InlineKeyboardButton(
                    text="🗑",
                    callback_data=f"v3:hab_del:{h['id']}",
                ),
            )
        text = "<b>📅 Трекер привычек (отметка на сегодня)</b>\n\n" + "\n".join(lines)

    b.row(InlineKeyboardButton(text="➕ Добавить привычку", callback_data="v3:hab_add"))
    b.row(webapp_button("📱 Таблица по дням в приложении", tab="workspace"))
    b.row(
        InlineKeyboardButton(text="⬅️ Привычки и задачи", callback_data="nav:cat:workspace"),
        InlineKeyboardButton(text="🏠 Меню", callback_data="nav:home"),
    )
    await render_hud(target, text, reply_markup=b.as_markup())


@router.message(Command("habits"))
async def cmd_habits(message: Message, state: FSMContext) -> None:
    await _render_habits_bot(message, state)


@router.callback_query(F.data == "tool:open:habit_tracker")
async def cb_open_habits(call: CallbackQuery, state: FSMContext) -> None:
    await _render_habits_bot(call, state)


@router.callback_query(F.data.startswith("v3:hab_tog:"))
async def cb_toggle_habit_bot(call: CallbackQuery) -> None:
    hid = int(call.data.split(":")[2])
    try:
        res = await db.toggle_habit_date(call.from_user.id, hid)
        await call.answer("Отмечено выполнено" if res["completed"] else "Отметка снята")
    except ValueError as e:
        await call.answer(str(e), show_alert=True)
    await _render_habits_bot(call)


@router.callback_query(F.data.startswith("v3:hab_del:"))
async def cb_delete_habit_bot(call: CallbackQuery) -> None:
    hid = int(call.data.split(":")[2])
    await db.delete_habit(call.from_user.id, hid)
    await call.answer("Привычка удалена")
    await _render_habits_bot(call)


@router.callback_query(F.data == "v3:hab_add")
async def cb_add_habit_prompt(call: CallbackQuery, state: FSMContext) -> None:
    await state.set_state(ToolState.habit_waiting_title)
    b = InlineKeyboardBuilder()
    b.row(InlineKeyboardButton(text="⬅️ Отмена", callback_data="tool:open:habit_tracker"))
    await render_hud(
        call,
        "<b>➕ Новая привычка</b>\n\n"
        "Отправьте название привычки сообщением (например: <code>Чтение 30 минут</code> или <code>Тренировка</code>).",
        reply_markup=b.as_markup(),
    )


@router.message(ToolState.habit_waiting_title, F.text, ~F.text.startswith("/"))
async def msg_add_habit_save(message: Message, state: FSMContext) -> None:
    title = (message.text or "").strip()
    if not title:
        await message.answer("Введите название привычки.")
        return
    await db.create_habit(message.from_user.id, title=title, icon="✅", target_per_week=7)
    await db.record_tool_use(message.from_user.id, "habit_tracker", "workspace", "bot", title[:25])
    await _render_habits_bot(message, state)


# ==============================================================================
# 5. Физические расчёты
# ==============================================================================
TOOL_TO_CALC_ID = {
    "phys_kinematics": "kinematics_uniform",
    "phys_force": "newton_force",
    "phys_power": "work_power_eff",
    "phys_electric": "ohm_electric",
    "phys_heat": "heat_boiling",
}

PHYS_BTN_TITLES = {
    "kinematics_uniform": "Путь и скорость",
    "kinematics_accel": "Разгон и ускорение",
    "free_fall": "Свободное падение",
    "newton_force": "Сила и трение",
    "work_power_eff": "Работа и КПД",
    "ohm_electric": "Закон Ома",
    "heat_boiling": "Нагрев и закипание",
    "energy_pressure": "Энергия и давление",
}

PHYS_TARGET_BTN = {
    ("kinematics_uniform", "t"): "Время (t)",
    ("kinematics_uniform", "s"): "Путь (s)",
    ("kinematics_uniform", "v"): "Скорость (v)",
    ("kinematics_accel", "t"): "Время разгона (t)",
    ("kinematics_accel", "a"): "Ускорение (a)",
    ("kinematics_accel", "s"): "Путь (s)",
    ("free_fall", "t"): "Время падения (t)",
    ("free_fall", "h"): "Высота (h)",
    ("newton_force", "F"): "Сила (F)",
    ("newton_force", "a"): "Ускорение (a)",
    ("newton_force", "m"): "Масса (m)",
    ("work_power_eff", "eta"): "КПД (η, %)",
    ("work_power_eff", "P"): "Мощность (P)",
    ("work_power_eff", "A"): "Работа (A)",
    ("work_power_eff", "t"): "Время (t)",
    ("ohm_electric", "I"): "Сила тока (I)",
    ("ohm_electric", "U"): "Напряжение (U)",
    ("ohm_electric", "R"): "Сопротивление (R)",
    ("heat_boiling", "t_heat"): "Время нагрева (t)",
    ("energy_pressure", "Ek"): "Кинетич. энергия",
    ("energy_pressure", "p_hydro"): "Давление жидкости",
}


async def _render_physics_menu(target: Message | CallbackQuery, calc_id: str = "kinematics_uniform", target_var: str = "") -> None:
    calc = next((c for c in PHYSICS_CALCULATORS if c["id"] == calc_id), PHYSICS_CALCULATORS[0])
    targets = calc["targets"]
    active_target = next((t for t in targets if t["var"] == target_var), targets[0])
    target_var = active_target["var"]

    b = InlineKeyboardBuilder()
    mod_btns = [
        InlineKeyboardButton(
            text=f"{'✅ ' if c['id'] == calc['id'] else c['emoji'] + ' '}{PHYS_BTN_TITLES.get(c['id'], c['title'])}",
            callback_data=f"v3:phys:{c['id']}:{c['targets'][0]['var']}",
        )
        for c in PHYSICS_CALCULATORS
    ]
    for i in range(0, len(mod_btns), 2):
        b.row(*mod_btns[i : i + 2])

    if len(targets) > 1:
        var_btns = [
            InlineKeyboardButton(
                text=(
                    f"🎯 {PHYS_TARGET_BTN.get((calc['id'], t['var']), t['label'])}"
                    if t["var"] == target_var
                    else PHYS_TARGET_BTN.get((calc["id"], t["var"]), t["label"])
                ),
                callback_data=f"v3:phys:{calc['id']}:{t['var']}",
            )
            for t in targets
        ]
        for i in range(0, len(var_btns), 2):
            b.row(*var_btns[i : i + 2])

    b.row(InlineKeyboardButton(text="⌨️ Ввести параметры и рассчитать", callback_data=f"v3:phys_in:{calc['id']}:{target_var}"))
    b.row(webapp_button("📱 Открыть калькулятор в приложении", tab="physics"))
    b.row(InlineKeyboardButton(text="⬅️ К разделу", callback_data="nav:cat:physics"), InlineKeyboardButton(text="🏠 Меню", callback_data="nav:home"))

    req_lines = "\n".join(f"• <code>{f['name']}</code> — {esc(f['label'])}" for f in active_target["fields"])

    await render_hud(
        target,
        f"<b>{calc['emoji']} {esc(calc['title'])}</b>\n"
        f"<blockquote>Формула: <code>{esc(calc['formula_display'])}</code></blockquote>\n\n"
        f"🎯 Задача: <b>{esc(active_target['label'])}</b>\n\n"
        f"<b>Исходные параметры:</b>\n{req_lines}",
        reply_markup=b.as_markup(),
    )


@router.message(Command("physics"))
async def cmd_physics(message: Message, state: FSMContext) -> None:
    await state.clear()
    await _render_physics_menu(message, "kinematics_uniform")


@router.callback_query(F.data.in_(set(TOOL_TO_CALC_ID.keys()) | {f"tool:open:{k}" for k in TOOL_TO_CALC_ID}))
async def cb_open_physics_tool(call: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    t_id = call.data.split(":")[-1]
    calc_id = TOOL_TO_CALC_ID.get(t_id, "kinematics_uniform")
    await _render_physics_menu(call, calc_id)


@router.callback_query(F.data.startswith("v3:phys:"))
async def cb_switch_physics(call: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    _, _, calc_id, target_var = call.data.split(":")
    await _render_physics_menu(call, calc_id, target_var)


@router.callback_query(F.data.startswith("v3:phys_in:"))
async def cb_prompt_physics_input(call: CallbackQuery, state: FSMContext) -> None:
    _, _, calc_id, target_var = call.data.split(":")
    calc = next((c for c in PHYSICS_CALCULATORS if c["id"] == calc_id), PHYSICS_CALCULATORS[0])
    active_target = next((t for t in calc["targets"] if t["var"] == target_var), calc["targets"][0])
    fields = active_target["fields"]
    await state.set_state(ToolState.physics_waiting_params)
    await state.update_data(calc_id=calc_id, target_var=active_target["var"])

    sample_pairs = " ".join(f"{f['name']}={f['default']}" for f in fields)
    sample_nums = " ".join(str(f["default"]) for f in fields)
    order_names = ", ".join(f["name"] for f in fields)

    b = InlineKeyboardBuilder()
    b.row(InlineKeyboardButton(text=f"Пример: {sample_pairs}", callback_data="v3:phys_demo"))
    b.row(InlineKeyboardButton(text="⬅️ Назад", callback_data=f"v3:phys:{calc_id}:{active_target['var']}"))

    await render_hud(
        call,
        f"<b>⌨️ {esc(active_target['label'])}</b>\n\n"
        f"Отправьте значения ({esc(order_names)}) через пробел:\n"
        f"• <code>{esc(sample_pairs)}</code>\n"
        f"или числа по порядку: <code>{esc(sample_nums)}</code>",
        reply_markup=b.as_markup(),
    )


@router.callback_query(F.data == "v3:phys_demo")
async def cb_physics_demo(call: CallbackQuery, state: FSMContext) -> None:
    data = await state.get_data()
    calc_id = data.get("calc_id", "kinematics_uniform")
    target_var = data.get("target_var", "t")
    calc = next((c for c in PHYSICS_CALCULATORS if c["id"] == calc_id), PHYSICS_CALCULATORS[0])
    active_target = next((t for t in calc["targets"] if t["var"] == target_var), calc["targets"][0])
    params = {f["name"]: float(f["default"]) for f in active_target["fields"]}
    await _execute_physics_bot(call, state, calc_id, active_target["var"], params)


@router.message(ToolState.physics_waiting_params, F.text, ~F.text.startswith("/"))
async def msg_physics_solve(message: Message, state: FSMContext) -> None:
    data = await state.get_data()
    calc_id = data.get("calc_id", "kinematics_uniform")
    target_var = data.get("target_var", "t")
    calc = next((c for c in PHYSICS_CALCULATORS if c["id"] == calc_id), PHYSICS_CALCULATORS[0])
    active_target = next((t for t in calc["targets"] if t["var"] == target_var), calc["targets"][0])
    fields = active_target["fields"]

    raw = (message.text or "").strip().replace(",", ".")
    params: dict[str, float] = {}

    kv_matches = re.findall(r"([A-Za-z_0-9]+)\s*=\s*([-+]?\d*\.?\d+)", raw)
    if kv_matches:
        for k, val in kv_matches:
            params[k] = float(val)
        for f in fields:
            if f["name"] not in params:
                params[f["name"]] = float(f["default"])
    else:
        nums = [float(x) for x in re.findall(r"[-+]?\d*\.?\d+", raw)]
        if len(nums) < len(fields):
            need = ", ".join(f"{f['name']} ({f['label']})" for f in fields)
            await message.answer(f"Укажите значения параметров: {esc(need)}")
            return
        for idx, f in enumerate(fields):
            params[f["name"]] = nums[idx]

    await _execute_physics_bot(message, state, calc_id, active_target["var"], params)


async def _execute_physics_bot(
    target: Message | CallbackQuery,
    state: FSMContext,
    calc_id: str,
    target_var: str,
    params: dict[str, float],
) -> None:
    try:
        res = solve_physics(calc_id, target_var, params)
    except ValueError as e:
        if isinstance(target, CallbackQuery):
            await target.answer(str(e), show_alert=True)
        else:
            await target.answer(f"⚠️ {esc(str(e))}")
        return

    await state.clear()
    await db.record_tool_use(target.from_user.id, calc_id, "physics", "bot", f"{target_var}={res['si_value']}")
    steps_txt = "\n".join(f"• {esc(st)}" for st in res["steps_list"])
    extra_txt = "\n".join(f"• {esc(ex['label'])}: <b>{esc(ex['value'])}</b>" for ex in res["extra"])

    b = InlineKeyboardBuilder()
    b.row(
        InlineKeyboardButton(text="🔄 Другие числа", callback_data=f"v3:phys_in:{calc_id}:{target_var}"),
        InlineKeyboardButton(text="⚛️ Другая формула", callback_data=f"v3:phys:{calc_id}:{target_var}"),
    )
    b.row(webapp_button("📱 Открыть в приложении", tab="physics"))
    b.row(InlineKeyboardButton(text="⬅️ К разделу", callback_data="nav:cat:physics"), InlineKeyboardButton(text="🏠 Меню", callback_data="nav:home"))

    await render_hud(
        target,
        f"<b>✅ {esc(res['target_label'])}</b>\n"
        f"<blockquote><b>{esc(res['formatted'])}</b>  (СИ: <code>{esc(res['si_value'])}</code>)</blockquote>\n\n"
        f"<b>Расчёт ({esc(res['formula'])}):</b>\n{steps_txt}"
        + (f"\n\n<b>Дополнительно:</b>\n{extra_txt}" if extra_txt else ""),
        reply_markup=b.as_markup(),
    )
