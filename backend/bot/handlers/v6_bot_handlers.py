from __future__ import annotations

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, InlineKeyboardButton, Message
from aiogram.utils.keyboard import InlineKeyboardBuilder

from backend.bot.handlers.helpers import esc, render_hud
from backend.bot.keyboards import webapp_button
from backend.bot.states import ToolState
from backend.database import db
from backend.tools import TOOLS_BY_ID
from backend.tools.adult_and_jojo_db import (
    ADULT_ACTRESSES_DB,
    HENTAI_TAGS_DICT,
    awaken_personal_stand,
    search_jojo_stands_all,
)
from backend.tools.ai_web_assistant import ask_ai_with_internet, run_cbt_thought_record
from backend.tools.mega_expansion_v6_hubs import (
    CAR_MODELS_CATALOG,
    GAMING_WIKIS_DB,
    LOOKSMAXXING_ATLAS,
    OUTFIT_STYLES_DB,
    calculate_route_plan,
    evaluate_pc_build,
)
from backend.tools.mega_expansion_v6_science_lore import (
    CULT_LORE_DB,
    SOLAR_SYSTEM_BODIES,
    compute_irrational_digits,
    get_earth_stats_and_correlation,
    get_upcoming_eclipses_and_comets,
    library_of_babel_search,
)
from backend.tools.party_and_fun import calculate_breast_size_index

router = Router(name="v6_bot_handlers")


def _ai_kb(use_web: bool = True, tab: str = "ai_assistant"):
    b = InlineKeyboardBuilder()
    b.row(
        InlineKeyboardButton(
            text=f"🌐 Интернет-поиск: {'ВКЛ' if use_web else 'ВЫКЛ'}",
            callback_data=f"v6:ai:toggle_web:{0 if use_web else 1}",
        ),
        InlineKeyboardButton(text="🧹 Очистить диалог", callback_data="v6:ai:clear"),
    )
    b.row(webapp_button("📱 Открыть ИИ-Ассистент в Mini App", tab=tab))
    b.row(
        InlineKeyboardButton(text="🛋️ КПТ-Психотерапевт", callback_data="tool:open:ai_psychotherapist"),
        InlineKeyboardButton(text="🏠 Меню", callback_data="nav:home"),
    )
    return b.as_markup()


@router.message(Command("ai"))
async def cmd_ai_chat(message: Message, state: FSMContext) -> None:
    arg = (message.text or "").partition(" ")[2].strip()
    await state.set_state(ToolState.ai_web_chat_waiting)
    data = await state.get_data()
    use_web = bool(data.get("ai_use_web", True))
    if arg:
        await _answer_ai_message(message, state, arg)
        return
    await db.record_tool_use(message.from_user.id, "ai_web_chat", "ai_assistant", "bot", "open")
    await render_hud(
        message,
        "<b>🌐 ИИ-Ассистент с выходом в Интернет</b>\n"
        "<blockquote>Режим активного диалога включён • Дата: 25.10.2026</blockquote>\n\n"
        "Напишите любой вопрос, задачу по коду, формулу или тему для поиска в сети — я найду актуальные данные и отвечу прямо здесь.",
        reply_markup=_ai_kb(use_web),
    )


@router.callback_query(F.data == "tool:open:ai_web_chat")
async def cb_open_ai_chat(call: CallbackQuery, state: FSMContext) -> None:
    await state.set_state(ToolState.ai_web_chat_waiting)
    data = await state.get_data()
    use_web = bool(data.get("ai_use_web", True))
    await db.record_tool_use(call.from_user.id, "ai_web_chat", "ai_assistant", "bot", "open")
    await render_hud(
        call,
        "<b>🌐 ИИ-Ассистент с выходом в Интернет</b>\n"
        "<blockquote>Режим диалога включён • Отправьте сообщение в чат</blockquote>\n\n"
        "Задайте любой вопрос: ИИ выполнит поиск по свежим веб-источникам и энциклопедиям и даст развёрнутый ответ со ссылками.",
        reply_markup=_ai_kb(use_web),
    )


@router.callback_query(F.data.startswith("v6:ai:toggle_web:"))
async def cb_toggle_ai_web(call: CallbackQuery, state: FSMContext) -> None:
    flag = call.data.split(":")[-1] == "1"
    await state.update_data(ai_use_web=flag)
    await state.set_state(ToolState.ai_web_chat_waiting)
    await render_hud(
        call,
        f"<b>🌐 ИИ-Ассистент с выходом в Интернет</b>\n"
        f"<blockquote>Живой поиск в сети: <b>{'ВКЛЮЧЁН' if flag else 'ВЫКЛЮЧЕН'}</b></blockquote>\n\n"
        "Отправьте ваш вопрос следующим сообщением.",
        reply_markup=_ai_kb(flag),
    )


@router.callback_query(F.data == "v6:ai:clear")
async def cb_clear_ai_history(call: CallbackQuery, state: FSMContext) -> None:
    data = await state.get_data()
    use_web = bool(data.get("ai_use_web", True))
    await state.update_data(ai_history=[])
    await state.set_state(ToolState.ai_web_chat_waiting)
    await render_hud(
        call,
        "<b>🧹 История диалога очищена</b>\n\nОтправьте новый вопрос ИИ-ассистенту.",
        reply_markup=_ai_kb(use_web),
    )


async def _answer_ai_message(message: Message, state: FSMContext, prompt: str) -> None:
    data = await state.get_data()
    use_web = bool(data.get("ai_use_web", True))
    history = list(data.get("ai_history") or [])
    res = await ask_ai_with_internet(prompt, history=history, use_web=use_web, mode="general")
    history.append({"role": "user", "content": prompt[:1000]})
    history.append({"role": "assistant", "content": res["answer"][:1400]})
    await state.update_data(ai_history=history[-8:])
    await db.record_tool_use(message.from_user.id, "ai_web_chat", "ai_assistant", "bot", prompt[:32], xp_gain=8)

    src_lines = ""
    if res.get("sources"):
        links = [f"• <a href=\"{esc(s['url'])}\">{esc(s['title'][:55])}</a>" for s in res["sources"][:3] if s.get("url")]
        if links:
            src_lines = "\n\n<b>🌐 Источники:</b>\n" + "\n".join(links)

    ans_trimmed = esc(res["answer"][:3100])
    await render_hud(
        message,
        f"<b>🤖 Ответ ИИ</b>  <i>({esc(res['model'])})</i>\n\n{ans_trimmed}{src_lines}",
        reply_markup=_ai_kb(use_web),
    )


@router.message(ToolState.ai_web_chat_waiting, F.text)
async def msg_ai_chat_turn(message: Message, state: FSMContext) -> None:
    txt = (message.text or "").strip()
    if txt.startswith("/"):
        return
    await _answer_ai_message(message, state, txt)


# --- CBT Psychotherapist in Bot ---

@router.callback_query(F.data == "tool:open:ai_psychotherapist")
async def cb_open_cbt(call: CallbackQuery, state: FSMContext) -> None:
    await state.set_state(ToolState.ai_cbt_waiting)
    await db.record_tool_use(call.from_user.id, "ai_psychotherapist", "ai_assistant", "bot", "open")
    b = InlineKeyboardBuilder()
    b.row(webapp_button("📱 Открыть Дневник СМЭР в приложении", tab="ai_assistant"))
    b.row(InlineKeyboardButton(text="🌐 Обычный ИИ-чат", callback_data="tool:open:ai_web_chat"), InlineKeyboardButton(text="🏠 Меню", callback_data="nav:home"))
    await render_hud(
        call,
        "<b>🛋️ КПТ-Психотерапевт и разбор автоматических мыслей</b>\n\n"
        "Опишите ситуацию и мысль, которая вызывает тревогу, усталость или самокритику — мы разберём возможные когнитивные искажения и сформулируем спокойный рациональный ответ.",
        reply_markup=b.as_markup(),
    )


@router.message(ToolState.ai_cbt_waiting, F.text)
async def msg_cbt_turn(message: Message, state: FSMContext) -> None:
    txt = (message.text or "").strip()
    if txt.startswith("/"):
        return
    res = await run_cbt_thought_record(situation=txt, automatic_thought=txt, emotion="Тревога", intensity_before=75)
    await db.record_tool_use(message.from_user.id, "ai_psychotherapist", "ai_assistant", "bot", "session", xp_gain=8)
    dist_txt = "\n".join(f"• <b>{esc(d['title'])}</b> — {esc(d['reframe'])}" for d in res["distortions"][:3])
    b = InlineKeyboardBuilder()
    b.row(webapp_button("📱 Открыть полный КПТ-хаб", tab="ai_assistant"))
    b.row(InlineKeyboardButton(text="🏠 Меню", callback_data="nav:home"))
    await render_hud(
        message,
        f"<b>🛋️ Разбор по протоколу КПТ</b>\n\n"
        f"<b>Замеченные паттерны мышления:</b>\n{dist_txt}\n\n"
        f"<b>Поддерживающий ответ:</b>\n{esc(res['therapist_response'][:2500])}",
        reply_markup=b.as_markup(),
    )


# --- JoJo Stands Parts 3–9 Interactive Bot Browser ---

def _jojo_kb(active_part: int = 0):
    b = InlineKeyboardBuilder()
    btns = [
        InlineKeyboardButton(
            text=f"{'✅ ' if active_part == p else ''}Ч.{p}",
            callback_data=f"v6:jojo:part:{p}",
        )
        for p in (3, 4, 5, 6, 7, 8, 9)
    ]
    b.row(*btns[:4])
    b.row(*btns[4:], InlineKeyboardButton(text="Все", callback_data="v6:jojo:part:0"))
    b.row(InlineKeyboardButton(text="🃏 Пробудить свой Стенд!", callback_data="v6:jojo:awaken"))
    b.row(webapp_button("📱 Все Стенды с 6-осевыми радарами", tab="jojo_adult_encyc"))
    b.row(InlineKeyboardButton(text="⬅️ К разделу", callback_data="nav:cat:jojo_adult_encyc"), InlineKeyboardButton(text="🏠 Меню", callback_data="nav:home"))
    return b.as_markup()


async def _render_jojo_bot(target: Message | CallbackQuery, part: int = 0) -> None:
    data = search_jojo_stands_all(part_num=part)
    sample = data["items"][:6]
    lines = "\n\n".join(
        f"🃏 <b>{esc(s['name'])}</b> ({esc(s['part'])})\n"
        f"👤 Владелец: <b>{esc(s['user'])}</b> • <code>{esc(s['stats'])}</code>\n"
        f"{esc(s['ability'][:170])}"
        for s in sample
    )
    title_suffix = f"Часть {part}" if part else f"Части 3–9 (всего в базе: {data['total_catalog']})"
    await render_hud(
        target,
        f"<b>🃏 Полный Атлас Стендов JoJo — {esc(title_suffix)}</b>\n"
        f"<blockquote>Показаны первые {len(sample)} из {data['matched']} стендов выборки</blockquote>\n\n{lines}",
        reply_markup=_jojo_kb(part),
    )


@router.message(Command("stands"))
async def cmd_stands(message: Message) -> None:
    await db.record_tool_use(message.from_user.id, "jojo_stands_all", "jojo_adult_encyc", "bot", "all")
    await _render_jojo_bot(message, 0)


@router.callback_query(F.data == "tool:open:jojo_stands_all")
async def cb_open_jojo_all(call: CallbackQuery) -> None:
    await db.record_tool_use(call.from_user.id, "jojo_stands_all", "jojo_adult_encyc", "bot", "all")
    await _render_jojo_bot(call, 0)


@router.callback_query(F.data.startswith("v6:jojo:part:"))
async def cb_jojo_part(call: CallbackQuery) -> None:
    p = int(call.data.split(":")[-1])
    await _render_jojo_bot(call, p)


@router.callback_query(F.data == "v6:jojo:awaken")
async def cb_jojo_awaken(call: CallbackQuery) -> None:
    aw = awaken_personal_stand("")["stand"]
    await render_hud(
        call,
        f"<b>🌟 Стрела Реквиема выбрала ваш Стенд!</b>\n\n"
        f"🃏 <b>{esc(aw['name'])}</b> — <i>{esc(aw['part'])}</i>\n"
        f"👤 Каноничный владелец: <b>{esc(aw['user'])}</b>\n"
        f"📊 <code>{esc(aw['stats'])}</code>\n\n"
        f"{esc(aw['ability'])}",
        reply_markup=_jojo_kb(aw["part_num"]),
    )


# --- Universal Rich Card Handler for all remaining v6 Tools ---

V6_TOOL_PREVIEWS: set[str] = {
    "breast_size_calc",
    "adult_actresses_db",
    "hentai_tags_dict",
    "infinite_craft_lab",
    "spend_billionaire",
    "absurd_password_game",
    "deep_sea_space_scale",
    "trolley_problem_sim",
    "asteroid_launcher_sim",
    "pc_builder_pro",
    "materials_fasteners_encyc",
    "outfit_looksmax_hub",
    "dota2_guide",
    "elden_ring_guide",
    "minecraft_guide",
    "fortnite_cs2_guides",
    "gta_genshin_roblox_guides",
    "billiards_3d_sim",
    "curling_sim",
    "carrom_sim",
    "bowling_3d_sim",
    "air_hockey_sim",
    "solar_system_3d",
    "eclipse_comet_tracker",
    "cell_atom_quarks_3d",
    "periodic_table_v6",
    "graph_plotter_2d_3d",
    "fourier_epicycles_3d",
    "irrational_numbers_inf",
    "library_of_babel",
    "earth_stats_2026",
    "world_genres_tags",
    "cult_lore_encyc",
    "iq_eq_quizzes_hub",
    "tier_list_maker",
    "survey_cv_builder",
    "universal_file_converter",
    "car_specs_catalog",
    "route_planner_calc",
    "color_matching_studio",
    "world_time_sun",
    "phys_ballistics_optics",
    "public_chat",
    "anatomy_reference",
    "hormone_encyclopedia",
    "vitamin_reference",
    "nutrition_bju_calc",
    "bone_skeleton_guide",
    "menstrual_cycle_tracker",
    "pregnancy_test_guide",
    "medicine_safety_guide",
    "habit_change_guide",
    "appearance_wellbeing_guide",
    "semen_health_guide",
    "alarm_clock",
    "sleep_calculator",
    "music_keyboard",
    "music_guitar",
    "music_drums",
    "body_hair_growth",
    "sleep_hygiene",
    "world_calendar_clock",
    "appliance_anatomy",
    "welding_safety_guide",
    "world_socket_guide",
    "connector_port_encyclopedia",
    "utility_bill_guide",
    "unit_alphabet_catalog",
    "welding_process_selector",
    "word_chain_games",
    "mahjong_solitaire",
    "flower_bouquet_calc",
    "religion_symbols_atlas",
    "solar_moons_catalog",
    "light_refraction_lab",
    "film_episode_ratings",
    "anime_comic_tournament",
    "cooking_recipe_guide",
    "citizenship_guide",
    "lifetime_human_statistics",
    "matter_phase_lab",
    "optics_eyewear_tools",
}


def _build_v6_summary_html(tid: str) -> str:
    meta = TOOLS_BY_ID.get(tid, {"title": tid, "emoji": "🔹", "desc": ""})
    header = f"<b>{meta['emoji']} {esc(meta['title'])}</b>\n<blockquote>{esc(meta['desc'])}</blockquote>\n\n"

    if tid == "breast_size_calc":
        return (
            header
            + "Ориентир размера строится только по фактическим измерениям обхвата под грудью и груди стоя.\n"
            + "Рост, возраст, рацион и увлечения чашку не предсказывают; размеры брендов различаются.\n\n"
            + "Откройте инструмент в приложении, чтобы ввести измерения. Примерка нескольких близких размеров надёжнее таблицы."
        )
    if tid == "adult_actresses_db":
        sample = "\n".join(
            f"• {a['flag']} <b>{esc(a['name'])}</b> — {a['height_cm']} см, {a['weight_kg']} кг, <code>{esc(a['measurements_cm'])}</code> (чашка {esc(a['cup'])})"
            for a in ADULT_ACTRESSES_DB[:5]
        )
        return header + f"В каталоге <b>{len(ADULT_ACTRESSES_DB)}</b> анкет с фильтрацией по росту, чашке, цвету волос и стране (18+):\n{sample}"
    if tid == "hentai_tags_dict":
        sample = "\n".join(
            f"• <b>{esc(t['tag_en'])}</b> ({esc(t['jp_romaji'])}) — {esc(t['title_ru'])}: {esc(t['definition'][:105])}…"
            for t in HENTAI_TAGS_DICT[:5]
        )
        return header + f"В словаре <b>{len(HENTAI_TAGS_DICT)}</b> терминов и кодов жанра (18+):\n{sample}"
    if tid == "pc_builder_pro":
        b = evaluate_pc_build()
        fps = b["fps_benchmarks"][2]
        return (
            header
            + f"Эталонная сборка: <b>{esc(b['selected']['cpu']['name'])}</b> + <b>{esc(b['selected']['gpu']['name'])}</b>\n"
            + f"• Пиковое потребление: <code>{b['est_peak_draw_w']} Вт</code> (совместимость: {'✅ Да' if b['compatible'] else '⚠️ Ошибки'})\n"
            + f"• {esc(fps['game'])}: <b>{fps['fps_1440p']} FPS (1440p)</b> • Стоимость: <code>{b['total_price_rub']:,} ₽</code>"
        )
    if tid == "car_specs_catalog":
        cars = "\n".join(
            f"• <b>{esc(c['make'])} {esc(c['model'])}</b> — {c['hp']} л.с., 0–100 за <code>{c['zero_to_100_s']} с</code> ({c['top_speed_kmh']} км/ч)"
            for c in CAR_MODELS_CATALOG[:5]
        )
        return header + f"Справочник характеристик ({len(CAR_MODELS_CATALOG)} культовых моделей):\n{cars}"
    if tid == "route_planner_calc":
        rt = calculate_route_plan("Москва", "Санкт-Петербург")
        return (
            header
            + f"Пример: <b>Москва → Санкт-Петербург</b>\n"
            + f"• По трассе: <code>{rt['route_distance_km']} км</code> ({rt['duration_formatted']})\n"
            + f"• Топливо: <code>{rt['fuel_liters']} л</code> (~{rt['fuel_cost_rub']} ₽)"
        )
    if tid in ("dota2_guide", "elden_ring_guide", "minecraft_guide", "fortnite_cs2_guides", "gta_genshin_roblox_guides"):
        idx_map = {
            "dota2_guide": 0,
            "elden_ring_guide": 1,
            "minecraft_guide": 2,
            "fortnite_cs2_guides": 3,
            "gta_genshin_roblox_guides": 6,
        }
        g = GAMING_WIKIS_DB[min(len(GAMING_WIKIS_DB) - 1, idx_map.get(tid, 0))]
        sec = g["sections"][0]
        return header + f"<b>{g['emoji']} {esc(g['game'])} — {esc(sec['title'])}</b>\n{esc(sec['body'][:550])}"
    if tid == "trolley_problem_sim":
        return (
            header
            + "• 8 классических и современных этических дилемм (Филиппа Фут, Джудит Томсон, ИИ-автопилот, петля времени).\n"
            + "• Сравнение утилитаризма и деонтологии + статистика решений участников."
        )
    if tid == "asteroid_launcher_sim":
        return (
            header
            + "• Настройка диаметра (10 м – 15 км), плотности (лёд / камень / железо), скорости (11–72 км/с) и угла входа.\n"
            + "• Расчёт тротилового эквивалента (Мт ТНТ), диаметра и глубины кратера, радиуса ударной волны и магнитуды Рихтера."
        )
    if tid == "air_hockey_sim":
        return (
            header
            + "• Неоновый стол аэрохоккея 60 FPS с физикой упругого соударения шайбы и биты.\n"
            + "• Настраиваемая скорость соперника-ИИ и матч до 7 голов."
        )
    if tid == "fourier_epicycles_3d":
        return (
            header
            + "• Визуализация суммы вращающихся векторов (эпициклов Фурье) для меандра, пилообразной, треугольной волны и фигур Лиссажу."
        )
    if tid == "world_time_sun":
        return (
            header
            + "• Реальное положение солнечного зенита, линия терминатора День/Ночь, ночные огни мегаполисов и мировое время на 3D-глобусе Земли."
        )
    if tid == "phys_ballistics_optics":
        return (
            header
            + "• Баллистическая траектория под углом на Земле (9.81 м/с²), Луне (1.62 м/с²), Марсе (3.72 м/с²) и Юпитере (24.79 м/с²) + расчёт фокуса линз."
        )
    if tid == "eclipse_comet_tracker":
        evs = get_upcoming_eclipses_and_comets()["events"][:4]
        lines = "\n".join(f"• <b>{esc(e['countdown_label'])}</b> — {esc(e['title'])}" for e in evs)
        return header + f"Ближайшие события после 25.10.2026:\n{lines}"
    if tid == "solar_system_3d":
        pls = ", ".join(p["name"] for p in SOLAR_SYSTEM_BODIES[:9])
        return header + f"Интерактивный 3D-планетарий и астрофизика объектов: {esc(pls)}."
    if tid == "irrational_numbers_inf":
        pi_d = compute_irrational_digits("pi", 80)
        return header + f"π = <code>3.{pi_d['fractional_digits'][:70]}…</code>\nВычисление до 5000 знаков и поиск любой даты внутри цифр."
    if tid == "library_of_babel":
        hit = library_of_babel_search("multi tg tool 25.10.2026")
        return header + f"Любой текст уже хранится в шестигранниках Борхеса!\nПример адреса: <code>{esc(hit['address'])}</code>"
    if tid == "earth_stats_2026":
        st = get_earth_stats_and_correlation("penis_length_cm", "penis_girth_cm")
        return (
            header
            + f"Актуальный срез на <b>{st['as_of_date']}</b> (население Земли: <code>8 312 480 000</code>):\n"
            + f"• Корреляция длины и обхвата: <b>r = {st['pearson_r']}</b>\n"
            + "• Доступны интерактивные Scatter-графики по 33 странам (длина/обхват, размер груди, IQ/PISA, ВВП ППС, рост)."
        )
    if tid == "cult_lore_encyc":
        u_names = ", ".join(u["universe"] for u in CULT_LORE_DB)
        return header + f"Развёрнутые хроники вселенных: <b>{esc(u_names)}</b>."
    if tid == "outfit_looksmax_hub":
        st_names = ", ".join(o["style"] for o in OUTFIT_STYLES_DB[:5])
        return header + f"Капсулы образов ({esc(st_names)}…) и {len(LOOKSMAXXING_ATLAS)} направлений доказательного Looksmaxxing."

    return header + "Откройте интерактивный 3D/графический режим инструмента кнопкой ниже:"


@router.callback_query(F.data.func(lambda d: isinstance(d, str) and d.startswith("tool:open:") and d.split(":", 2)[2] in V6_TOOL_PREVIEWS))
async def cb_open_v6_preview_tool(call: CallbackQuery) -> None:
    tid = call.data.split(":", 2)[2]
    meta = TOOLS_BY_ID[tid]
    cat_id = meta["category_id"]
    await db.record_tool_use(call.from_user.id, tid, cat_id, "bot", "open")

    b = InlineKeyboardBuilder()
    b.row(webapp_button(f"📱 Запустить «{meta['title'][:28]}»", tab=cat_id))
    b.row(
        InlineKeyboardButton(text="⬅️ К разделу", callback_data=f"nav:cat:{cat_id}"),
        InlineKeyboardButton(text="🏠 Меню", callback_data="nav:home"),
    )
    await render_hud(call, _build_v6_summary_html(tid), reply_markup=b.as_markup())
