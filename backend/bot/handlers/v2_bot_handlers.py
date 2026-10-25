from __future__ import annotations

import asyncio
from aiogram import F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, InlineKeyboardButton, Message
from aiogram.utils.keyboard import InlineKeyboardBuilder

from backend.bot.handlers.helpers import esc, load_media_bytes, progress_bar, render_hud
from backend.bot.keyboards import tool_back_kb, webapp_button
from backend.bot.states import ToolState
from backend.database import db
from backend.tools.knowledge_hub import (
    CONCEPTS_WIKI_DB,
    CONSTITUTIONS_DB,
    RELIGIONS_DB,
    query_population,
    roll_random_stand,
    search_formulas,
)
from backend.tools.party_and_fun import (
    LIGURIA_TEXT,
    calculate_pencil_index,
    calculate_vodka_party,
    get_boredom_ideas,
)
from backend.tools.rhyme_and_links import (
    decode_qr_from_bytes,
    generate_russian_rhymes,
    inspect_and_clean_url,
)
from backend.tools.smart_units_nlp import smart_parse_and_convert
from backend.tools.social_and_dating import (
    ALTUSHKA_PERSONAS,
    altushka_chat_reply,
    check_turing_guess,
    get_turing_round,
)

router = Router(name="v2_bot_handlers")


# ==============================================================================
# 1. Сканирование QR-кода прямо с присланной картинки
# ==============================================================================
@router.callback_query(F.data.startswith("imgact:qr_decode:"))
async def cb_decode_qr_from_photo(call: CallbackQuery) -> None:
    key = call.data.split(":")[2]
    try:
        raw, _ = await load_media_bytes(call.bot, key)
        res = await asyncio.to_thread(decode_qr_from_bytes, raw)
        await db.record_tool_use(call.from_user.id, "qr_decoder", "qr", "bot", "QR Photo Scan", xp_gain=10)
        if not res["found"]:
            await render_hud(
                call,
                f"<b>📷 Сканер QR-кодов</b>\n\n⚠️ {esc(res['message'])}",
                reply_markup=tool_back_kb("qr_decoder"),
            )
            return
        items_html = "\n".join(f"• <code>{esc(t)}</code>" for t in res["results"])
        await render_hud(
            call,
            f"<b>✅ QR-код успешно расшифрован!</b>\n"
            f"<blockquote>Тип: <b>{esc(res['content_type'])}</b> • Размер: {res['image_size']}</blockquote>\n\n"
            f"{items_html}",
            reply_markup=tool_back_kb("qr_decoder"),
        )
    except Exception as e:
        await call.answer(f"Ошибка чтения QR: {e}", show_alert=True)


# ==============================================================================
# 2. Алкогольный калькулятор 0..40 («чтобы не бежать за догоном»)
# ==============================================================================
async def _render_vodka_bot(target: Message | CallbackQuery, people: int = 4, level: int = 18) -> None:
    res = calculate_vodka_party(people_count=people, target_level=level, reserve_no_run=True)
    b = InlineKeyboardBuilder()
    b.row(
        InlineKeyboardButton(text="👥 2 чел", callback_data=f"v2:alko:2:{level}"),
        InlineKeyboardButton(text="👥 4 чел", callback_data=f"v2:alko:4:{level}"),
        InlineKeyboardButton(text="👥 6 чел", callback_data=f"v2:alko:6:{level}"),
        InlineKeyboardButton(text="👥 10 чел", callback_data=f"v2:alko:10:{level}"),
    )
    b.row(
        InlineKeyboardButton(text="😌 Ур.10", callback_data=f"v2:alko:{people}:10"),
        InlineKeyboardButton(text="🎸 Ур.18", callback_data=f"v2:alko:{people}:18"),
        InlineKeyboardButton(text="🕺 Ур.26", callback_data=f"v2:alko:{people}:26"),
        InlineKeyboardButton(text="🚀 Ур.34", callback_data=f"v2:alko:{people}:34"),
    )
    b.row(webapp_button("🎛 Точный расчёт (вес/закуска/напиток) в Mini App", tab="party"))
    b.row(InlineKeyboardButton(text="⬅️ К разделу", callback_data="nav:cat:party"), InlineKeyboardButton(text="🏠 Домой", callback_data="nav:home"))

    await render_hud(
        target,
        f"<b>🥃 Алко-Калькулятор «Без второго похода»</b>\n"
        f"<blockquote>Компания: <b>{people} чел.</b> • Шкала опьянения: <b>{level} / 40</b> ({res['estimated_promille']}‰)\n"
        f"{esc(res['stage_title'])}</blockquote>\n\n"
        f"🍾 <b>Брать в магазине (Водка 40%, с запасом +15%):</b>\n"
        f"• Бутылок 0.5 л: <b>{res['bottles_05']} шт.</b> (или по 0.7 л: <b>{res['bottles_07']} шт.</b>)\n"
        f"• Всего объём: <b>{res['total_liters']} л</b> ({res['per_person_ml']} мл / {res['shots_50ml_per_person']} стопок на чел.)\n"
        f"• 🥩 Закуски: <b>{res['snacks_kg']} кг</b> • 🧃 Запивки/воды: <b>{res['water_chasers_liters']} л</b>\n"
        f"• ⏱ Полное выветривание: ~<b>{res['sober_after_hours']} ч.</b>",
        reply_markup=b.as_markup(),
    )


@router.message(Command("alcohol"))
async def cmd_alcohol(message: Message) -> None:
    await db.record_tool_use(message.from_user.id, "vodka_calc", "party", "bot", "/alcohol")
    await _render_vodka_bot(message, 4, 18)


@router.callback_query(F.data == "tool:open:vodka_calc")
async def cb_open_vodka(call: CallbackQuery) -> None:
    await db.record_tool_use(call.from_user.id, "vodka_calc", "party", "bot", "Open")
    await _render_vodka_bot(call, 4, 18)


@router.callback_query(F.data.startswith("v2:alko:"))
async def cb_change_vodka(call: CallbackQuery) -> None:
    _, _, p_str, l_str = call.data.split(":")
    await _render_vodka_bot(call, int(p_str), int(l_str))


# ==============================================================================
# 3. Что делать если скучно (105+ идей + Лигурия + фильтр 18+)
# ==============================================================================
async def _render_boredom_bot(target: Message | CallbackQuery, spicy: bool = False) -> None:
    res = get_boredom_ideas(category="all", include_spicy=spicy, count=5)
    lines = "\n\n".join(
        f"<b>{i+1}. [{esc(it['cat'].upper())}]</b> {esc(it['title'])}"
        for i, it in enumerate(res["items"])
    )
    b = InlineKeyboardBuilder()
    b.row(
        InlineKeyboardButton(text="🎲 Ещё 5 крутых идей!", callback_data=f"v2:bored:{1 if spicy else 0}"),
        InlineKeyboardButton(
            text="🔞 18+: ВКЛ" if spicy else "🔞 18+: ВЫКЛ",
            callback_data=f"v2:bored:{0 if spicy else 1}",
        ),
    )
    b.row(
        InlineKeyboardButton(text="🗣 Скороговорка «Лигурия»", callback_data="v2:liguria"),
        webapp_button("📋 Все 105+ идей в Mini App", tab="party"),
    )
    b.row(InlineKeyboardButton(text="⬅️ К разделу", callback_data="nav:cat:party"), InlineKeyboardButton(text="🏠 Домой", callback_data="nav:home"))
    await render_hud(
        target,
        f"<b>💡 Что поделать, когда скучно (База: {res['total_in_vault']} идей!)</b>\n\n{lines}",
        reply_markup=b.as_markup(),
    )


@router.message(Command("bored"))
async def cmd_bored(message: Message) -> None:
    await db.record_tool_use(message.from_user.id, "boredom_advisor", "party", "bot", "/bored")
    await _render_boredom_bot(message, False)


@router.callback_query(F.data == "tool:open:boredom_advisor")
async def cb_open_boredom(call: CallbackQuery) -> None:
    await db.record_tool_use(call.from_user.id, "boredom_advisor", "party", "bot", "Open")
    await _render_boredom_bot(call, False)


@router.callback_query(F.data.startswith("v2:bored:"))
async def cb_roll_boredom(call: CallbackQuery) -> None:
    spicy = call.data.split(":")[2] == "1"
    await _render_boredom_bot(call, spicy)


@router.callback_query(F.data == "v2:liguria")
async def cb_show_liguria(call: CallbackQuery) -> None:
    b = InlineKeyboardBuilder()
    b.row(InlineKeyboardButton(text="⬅️ Назад к идеям", callback_data="tool:open:boredom_advisor"))
    await render_hud(
        call,
        f"<b>🗣 Легендарная скороговорка «Лигурия» (тренировка дикции)</b>\n\n"
        f"<blockquote>{esc(LIGURIA_TEXT[:3500])}</blockquote>",
        reply_markup=b.as_markup(),
    )


# ==============================================================================
# 4. Биометрический калькулятор длины пениса / члена
# ==============================================================================
async def _render_pencil_bot(call: CallbackQuery, height_cm: int = 182, shoe_eu: int = 43) -> None:
    res = calculate_pencil_index(height_cm=height_cm, shoe_size_eu=shoe_eu, linux_user=False, gym_pushups=35)
    b = InlineKeyboardBuilder()
    for h_val, s_val, lbl in [
        (172, 41, "172 см / 41"),
        (180, 43, "180 см / 43"),
        (188, 45, "188 см / 45"),
        (196, 46, "196 см / 46"),
    ]:
        mark = "🔘 " if (h_val == height_cm and s_val == shoe_eu) else ""
        b.button(text=f"{mark}{lbl}", callback_data=f"v2:pen:{h_val}:{s_val}")
    b.adjust(2)
    b.row(webapp_button("🎛 Все 10 параметров в приложении", tab="party"))
    b.row(
        InlineKeyboardButton(text="⬅️ К разделу", callback_data="nav:cat:party"),
        InlineKeyboardButton(text="🏠 Меню", callback_data="nav:home"),
    )
    await render_hud(
        call,
        f"<b>📏 Биометрический калькулятор длины члена</b>\n"
        f"<blockquote>Параметры: рост {height_cm} см, обувь {shoe_eu} EU, 35 отжиманий</blockquote>\n\n"
        f"• Длина пениса: <b>{res['estimated_cm']} см ({res['estimated_inches']}\")</b>\n"
        f"• Категория: <b>{esc(res['rank_title'])}</b>\n"
        f"• Процентиль: выше, чем у <b>{res['percentile']}%</b> выборки\n\n"
        f"Выберите пресет ниже или откройте все 10 параметров в приложении:",
        reply_markup=b.as_markup(),
    )


@router.callback_query(F.data == "tool:open:pencil_calc")
async def cb_open_pencil(call: CallbackQuery) -> None:
    await _render_pencil_bot(call, 180, 43)


@router.callback_query(F.data.startswith("v2:pen:"))
async def cb_calc_pencil_preset(call: CallbackQuery) -> None:
    parts = call.data.split(":")
    h_val = int(parts[2])
    s_val = int(parts[3])
    await db.record_tool_use(call.from_user.id, "pencil_calc", "party", "bot", f"{h_val}/{s_val}", xp_gain=6)
    await _render_pencil_bot(call, h_val, s_val)


# ==============================================================================
# 5. Умный Авто-Конвертер Величин («6 дюймов») & Генератор Рифм
# ==============================================================================
@router.message(Command("units"))
@router.callback_query(F.data == "tool:open:smart_units")
async def open_smart_units(event: Message | CallbackQuery, state: FSMContext) -> None:
    await state.set_state(ToolState.smart_units_waiting)
    demo = smart_parse_and_convert("6 дюймов")
    top_lines = "\n".join(f"{'🔥' if c['popular'] else '•'} <b>{c['formatted']} {c['label']}</b>" for c in demo["conversions"][:5])
    await render_hud(
        event,
        f"<b>🔮 Умный Авто-Конвертер Величин</b>\n"
        f"<blockquote>Пример для <code>6 дюймов</code> (по популярности):</blockquote>\n"
        f"{top_lines}\n\n"
        f"✍️ <b>Напишите любую величину своими словами</b> (например: <code>6 дюймов</code>, <code>5 футов 11 дюймов</code>, <code>100 миль в час</code>, <code>2.5 пуда</code>, <code>451 фаренгейт</code>):",
        reply_markup=tool_back_kb("smart_units"),
    )


@router.message(ToolState.smart_units_waiting, F.text, ~F.text.startswith("/"))
async def handle_smart_units_input(message: Message, state: FSMContext) -> None:
    try:
        res = smart_parse_and_convert(message.text or "")
        await db.record_tool_use(message.from_user.id, "smart_units", "calc", "bot", (message.text or "")[:30])
        lines = "\n".join(
            f"{'🔥' if c['popular'] else '▫️'} <code>{c['formatted']}</code> — <b>{esc(c['label'])}</b>"
            for c in res["conversions"][:9]
        )
        hint = f"\n\n💡 <i>{esc(res['real_world_hint'])}</i>" if res.get("real_world_hint") else ""
        await render_hud(
            message,
            f"<b>🔮 {esc(res['category_title'])}: {esc(res['parsed_display'])}</b>\n\n{lines}{hint}",
            reply_markup=tool_back_kb("smart_units"),
        )
    except ValueError as e:
        await message.answer(f"⚠️ {esc(str(e))}", parse_mode="HTML")


@router.message(Command("rhyme"))
@router.callback_query(F.data == "tool:open:rhyme_gen")
async def open_rhyme_gen(event: Message | CallbackQuery, state: FSMContext) -> None:
    await state.set_state(ToolState.rhyme_waiting_word)
    await render_hud(
        event,
        "<b>🎤 Детальный Генератор Русских Рифм</b>\n"
        "<blockquote>Подбирает точные, ассонансные, глагольные и панч-рифмы с разбором слогов!</blockquote>\n\n"
        "✍️ <b>Отправьте любое русское слово</b> (например: <code>любовь</code>, <code>рассвет</code>, <code>тишина</code>, <code>код</code>, <code>свобода</code>):",
        reply_markup=tool_back_kb("rhyme_gen"),
    )


@router.message(ToolState.rhyme_waiting_word, F.text, ~F.text.startswith("/"))
async def handle_rhyme_word(message: Message, state: FSMContext) -> None:
    try:
        res = generate_russian_rhymes(message.text or "")
        await db.record_tool_use(message.from_user.id, "rhyme_gen", "text", "bot", res["word"])
        exact = ", ".join(res["exact_rhymes"][:12]) or "—"
        asson = ", ".join(res["assonance_rhymes"][:12]) or "—"
        verbs = ", ".join(res["verb_rhymes"][:10]) or "—"
        await render_hud(
            message,
            f"<b>🎤 Рифмы к слову «{esc(res['word'])}»</b>\n"
            f"<blockquote>Слогов: <b>{res['syllables']}</b> • Фонетический хвост: <code>{esc(res['phonetic_ending'])}</code> • Найдено: <b>{res['total_found']}</b></blockquote>\n\n"
            f"💎 <b>Точные и богатые:</b>\n{esc(exact)}\n\n"
            f"🎵 <b>Звучные и ассонансные:</b>\n{esc(asson)}\n\n"
            f"⚡ <b>Глагольные / морфологические:</b>\n{esc(verbs)}\n\n"
            f"📜 <b>Пример четверостишия:</b>\n<i>{esc(res['sample_quatrain'])}</i>",
            reply_markup=tool_back_kb("rhyme_gen"),
        )
    except ValueError as e:
        await message.answer(f"⚠️ {esc(str(e))}", parse_mode="HTML")


# ==============================================================================
# 6. Укоротитель & Удлинитель Ссылок + Сканер QR подсказка
# ==============================================================================
@router.callback_query(F.data == "tool:open:qr_decoder")
async def cb_open_qr_decoder_hint(call: CallbackQuery) -> None:
    await render_hud(
        call,
        "<b>📷 Сканер и Декодер QR-кодов по картинке</b>\n\n"
        "Просто <b>пришлите в этот чат фото или скриншот с QR-кодом</b> (или нажмите 📎 Скрепку в симуляторе / откройте камеру-загрузчик в Mini App), "
        "и нажмите кнопку <b>«📷 Распознать QR-код с фото»</b>!",
        reply_markup=tool_back_kb("qr_decoder"),
    )


@router.callback_query(F.data == "tool:open:url_transformer")
async def cb_open_url_transformer(call: CallbackQuery, state: FSMContext) -> None:
    await state.set_state(ToolState.url_transform_waiting)
    await render_hud(
        call,
        "<b>🔗 Укоротитель, Удлинитель и Очиститель Ссылок</b>\n"
        "<blockquote>Удаляет следящие UTM-хвосты, создаёт короткую ссылку <code>/s/...</code> и эпически длинную <code>/long/...</code>!</blockquote>\n\n"
        "✍️ <b>Отправьте любую ссылку:</b>",
        reply_markup=tool_back_kb("url_transformer"),
    )


@router.message(ToolState.url_transform_waiting, F.text, ~F.text.startswith("/"))
async def handle_url_transform(message: Message) -> None:
    try:
        from backend.config import WEBAPP_URL

        cleaned = inspect_and_clean_url(message.text or "")
        row = await db.create_link_pair(message.from_user.id, cleaned["cleaned_url"])
        await db.record_tool_use(message.from_user.id, "url_transformer", "qr", "bot", cleaned["domain"])
        base = WEBAPP_URL.rstrip("/")
        await render_hud(
            message,
            f"<b>🔗 Ссылка обработана</b>\n\n"
            f"🧹 <b>Чистая (без UTM):</b> <code>{esc(cleaned['cleaned_url'])}</code>\n"
            f"⚡ <b>Короткая ссылка:</b> <code>{esc(base)}/s/{row['code']}</code>\n"
            f"🐍 <b>Длинная ссылка:</b>\n<code>{esc(base)}/long/{row['long_code']}</code>",
            reply_markup=tool_back_kb("url_transformer"),
        )
    except ValueError as e:
        await message.answer(f"⚠️ {esc(str(e))}", parse_mode="HTML")


# ==============================================================================
# 7. Мега-База Знаний (Конституции, Религии, Мульти-Вики JoJo, ЕГЭ, Население)
# ==============================================================================
@router.callback_query(F.data == "tool:open:constitutions_hub")
async def cb_constitutions_bot(call: CallbackQuery) -> None:
    sample = "\n\n".join(
        f"{c['flag']} <b>{esc(c['country'])} ({c['year']} г.)</b> — {esc(c['structure'])}\n<i>{esc(c['unique_fact'])}</i>"
        for c in CONSTITUTIONS_DB[:5]
    )
    b = InlineKeyboardBuilder()
    b.row(webapp_button("⚖️ Открыть все 18 Конституций и поиск в Mini App", tab="knowledge"))
    b.row(InlineKeyboardButton(text="⬅️ К разделу", callback_data="nav:cat:knowledge"), InlineKeyboardButton(text="🏠 Домой", callback_data="nav:home"))
    await render_hud(call, f"<b>⚖️ Сборник Конституций Стран Мира</b>\n\n{sample}", reply_markup=b.as_markup())


@router.callback_query(F.data == "tool:open:religions_hub")
async def cb_religions_bot(call: CallbackQuery) -> None:
    sample = "\n\n".join(
        f"{r['emoji']} <b>{esc(r['name'])}</b> ({r['followers']})\n📖 Писание: {esc(r['scripture'])}\n💡 Суть: {esc(r['core_beliefs'])}"
        for r in RELIGIONS_DB[:5]
    )
    b = InlineKeyboardBuilder()
    b.row(webapp_button("🕉️ Полное сравнение религий в Mini App", tab="knowledge"))
    b.row(InlineKeyboardButton(text="⬅️ К разделу", callback_data="nav:cat:knowledge"), InlineKeyboardButton(text="🏠 Домой", callback_data="nav:home"))
    await render_hud(call, f"<b>🕉️ Энциклопедия Мировых Религий</b>\n\n{sample}", reply_markup=b.as_markup())


@router.message(Command("stand"))
@router.callback_query(F.data == "tool:open:multi_wiki")
@router.callback_query(F.data == "v2:roll_stand")
async def cb_multi_wiki_bot(event: Message | CallbackQuery) -> None:
    st = roll_random_stand()
    concept = CONCEPTS_WIKI_DB[0]
    b = InlineKeyboardBuilder()
    b.row(InlineKeyboardButton(text="🌟 Пробудить другой Стенд JoJo!", callback_data="v2:roll_stand"))
    b.row(webapp_button("📚 Открыть всю Мульти-Вики (JoJo ч.3-9 + Понятия + ЯП)", tab="knowledge"))
    b.row(InlineKeyboardButton(text="⬅️ К разделу", callback_data="nav:cat:knowledge"), InlineKeyboardButton(text="🏠 Домой", callback_data="nav:home"))
    await render_hud(
        event,
        f"<b>🌟 Мульти-Вики: Стенды JoJo, Умные Понятия & Код</b>\n\n"
        f"🃏 <b>Случайный Стенд: {esc(st['name'])}</b>\n"
        f"• Владелец: <b>{esc(st['user'])}</b> ({esc(st['part'])})\n"
        f"• Статы: <code>{esc(st['stats'])}</code>\n"
        f"• Способность: {esc(st['ability'])}\n\n"
        f"🧠 <b>Термин дня — {esc(concept['term'])}:</b>\n{esc(concept['desc'])}",
        reply_markup=b.as_markup(),
    )


@router.callback_query(F.data == "tool:open:ege_formulas")
async def cb_ege_formulas_bot(call: CallbackQuery) -> None:
    phys = search_formulas("Физика")[:3]
    alg = search_formulas("Алгебра")[:3]
    txt = "<b>⚡ Физика:</b>\n" + "\n".join(f"• {esc(f['name'])}: <code>{esc(f['formula'])}</code>" for f in phys)
    txt += "\n\n<b>📐 Алгебра и Профиль:</b>\n" + "\n".join(f"• {esc(f['name'])}: <code>{esc(f['formula'])}</code>" for f in alg)
    b = InlineKeyboardBuilder()
    b.row(webapp_button("📐 Все формулы ЕГЭ (Физика/Алгебра/Геометрия/ИКТ)", tab="knowledge"))
    b.row(InlineKeyboardButton(text="⬅️ К разделу", callback_data="nav:cat:knowledge"), InlineKeyboardButton(text="🏠 Домой", callback_data="nav:home"))
    await render_hud(call, f"<b>📐 Справочник Формул ЕГЭ / ОГЭ</b>\n\n{txt}", reply_markup=b.as_markup())


@router.callback_query(F.data == "tool:open:population_hub")
async def cb_population_bot(call: CallbackQuery, state: FSMContext) -> None:
    await state.set_state(ToolState.population_waiting)
    res = query_population("")
    top_lines = "\n".join(f"• <b>{esc(p['name'])}</b> ({esc(p['type'])}): <code>{p['formatted_pop']}</code> чел." for p in res["places"][:6])
    await render_hud(
        call,
        f"<b>🌍 Численность Населения (Живой счётчик Земли: <code>{res['live_earth_population']}</code>)</b>\n\n"
        f"{top_lines}\n\n"
        f"✍️ <b>Напишите название любой страны, города, ПГТ или деревни</b> (например: <code>Москва</code>, <code>Токио</code>, <code>Оймякон</code>, <code>Териберка</code>, <code>Мурино</code>):",
        reply_markup=tool_back_kb("population_hub"),
    )


@router.message(ToolState.population_waiting, F.text, ~F.text.startswith("/"))
async def handle_population_input(message: Message) -> None:
    res = query_population(message.text or "")
    lines = "\n\n".join(
        f"📍 <b>{esc(p['name'])}</b> ({esc(p['type'])}, {esc(p['country'])})\n"
        f"👥 Население: <b><code>{p['formatted_pop']}</code> чел.</b>\n"
        f"ℹ️ <i>{esc(p['note'])}</i>"
        for p in res["places"][:5]
    )
    await render_hud(
        message,
        f"<b>🌍 Демографический Атлас</b>\n\n{lines}",
        reply_markup=tool_back_kb("population_hub"),
    )


# ==============================================================================
# 8. Аркада Мини-Игр (Волк ловит яйца, Doodle Jump, Тетрис, Кликер)
# ==============================================================================
@router.callback_query(F.data.in_({"tool:open:arcade_wolf", "tool:open:arcade_doodle", "tool:open:arcade_tetris", "tool:open:arcade_clicker"}))
async def cb_open_arcade_bot(call: CallbackQuery) -> None:
    highs = await db.get_game_highscores("all", limit=5)
    top_str = "\n".join(
        f"🏅 <b>{esc(h['first_name'])}</b> — <code>{h['best_score']}</code> очк. ({h['game_id']})"
        for h in highs
    ) or "Пока нет рекордов — станьте первым!"
    b = InlineKeyboardBuilder()
    b.row(webapp_button("🎮 Открыть игры в приложении", tab="arcade"))
    b.row(InlineKeyboardButton(text="⬅️ К разделу", callback_data="nav:cat:arcade"), InlineKeyboardButton(text="🏠 Меню", callback_data="nav:home"))
    await render_hud(
        call,
        f"<b>🎮 Мини-игры MULTI_TG_TOOL (HTML5 Canvas)</b>\n"
        f"<blockquote>• 🐺 Волк ловит яйца\n"
        f"• 🚀 Doodle Jump\n"
        f"• 🧱 Тетрис\n"
        f"• ⚡ Кликер</blockquote>\n\n"
        f"🏆 <b>Рекорды игроков:</b>\n{top_str}\n\n"
        f"Нажмите кнопку ниже, чтобы запустить игру:",
        reply_markup=b.as_markup(),
    )


# ==============================================================================
# 9. Рейтинг игроков + Кликабельные профили (счётчик заходов!) + Автор + Альтушки + Тьюринг
# ==============================================================================
@router.message(Command("top"))
@router.callback_query(F.data == "tool:open:leaderboard_hub")
async def cb_leaderboard_bot(event: Message | CallbackQuery) -> None:
    users = await db.get_leaderboard(sort_by="xp", limit=8)
    if not users:
        lines = "В рейтинге отображаются только реальные пользователи Telegram. Откройте любой инструмент в живом боте, чтобы занять место в таблице."
    else:
        lines = "\n".join(
            f"<b>#{u['position']}</b> {esc(u.get('avatar_emoji') or '👤')} <b>{esc(u['first_name'])}</b> — "
            f"<code>{u['xp']} XP</code> • игр: <code>{u['best_game_score']}</code> • визитов: <code>{u['profile_views']}</code>"
            for u in users
        )
    b = InlineKeyboardBuilder()
    for u in users[:4]:
        b.row(InlineKeyboardButton(
            text=f"👤 {u['first_name']} (визитов: {u['profile_views']})",
            callback_data=f"v2:prof:{u['user_id']}",
        ))
    b.row(webapp_button("📱 Полный рейтинг в приложении", tab="social"))
    b.row(InlineKeyboardButton(text="🏠 Главное меню", callback_data="nav:home"))
    await render_hud(
        event,
        f"<b>🏆 Топ пользователей</b>\n\n{lines}",
        reply_markup=b.as_markup(),
    )


@router.callback_query(F.data.startswith("v2:prof:"))
async def cb_view_user_profile(call: CallbackQuery) -> None:
    target_id = int(call.data.split(":")[2])
    prof = await db.get_public_profile(target_user_id=target_id, viewer_id=call.from_user.id)
    b = InlineKeyboardBuilder()
    b.row(
        InlineKeyboardButton(text=f"👍 Респект ({prof['respects']})", callback_data=f"v2:resp:{target_id}"),
        InlineKeyboardButton(text="⬅️ Назад к рейтингу", callback_data="tool:open:leaderboard_hub"),
    )
    uname_part = f" (@{esc(prof['username'])})" if prof.get("username") else ""
    await render_hud(
        call,
        f"<b>{esc(prof.get('avatar_emoji') or '👤')} {esc(prof['first_name'])}</b>{uname_part}\n"
        + (f"<blockquote>{esc(prof['bio'])}</blockquote>\n" if prof.get("bio") else "\n")
        + f"• Уровень: <b>{esc(prof['rank_title'])}</b> ({progress_bar(prof['progress_pct'])})\n"
        f"• Опыт: <b>{prof['xp']} XP</b> • Запусков: <b>{prof['tools_used']}</b>\n"
        f"• Лучший счёт в играх: <b>{prof['best_game_score']}</b>\n"
        f"• Просмотров профиля: <b>{prof['profile_views']}</b> (уникальных: {prof['unique_visitors']})\n"
        f"• Респектов: <b>{prof['respects']}</b>",
        reply_markup=b.as_markup(),
    )


@router.callback_query(F.data.startswith("v2:resp:"))
async def cb_give_respect_bot(call: CallbackQuery) -> None:
    target_id = int(call.data.split(":")[2])
    await db.give_respect(target_user_id=target_id, sender_id=call.from_user.id)
    await call.answer("🔥 Вы выразили респект игроку (+15 XP ему)!")
    call_copy = call.model_copy(update={"data": f"v2:prof:{target_id}"})
    await cb_view_user_profile(call_copy)


# --- Официальные ссылки & Поддержка ---
@router.message(Command("author"))
@router.callback_query(F.data == "tool:open:author_links")
async def cb_author_links_bot(event: Message | CallbackQuery) -> None:
    info = await db.get_author_info()
    b = InlineKeyboardBuilder()
    for lnk in info.get("links", []):
        if str(lnk.get("url", "")).startswith(("http://", "https://")):
            lbl = str(lnk.get("label", "Ссылка"))
            b.row(InlineKeyboardButton(text=lbl, url=lnk["url"]))
    b.row(InlineKeyboardButton(text="🏠 Главное меню", callback_data="nav:home"))
    await render_hud(
        event,
        f"<b>🕶️ {esc(info['title'])}</b>\n"
        f"<blockquote>{esc(info['tagline'])}</blockquote>\n\n"
        f"{esc(info['bio'])}",
        reply_markup=b.as_markup(),
    )


# --- Игра «Угадай: Человек или ИИ?» прямо в чате ---
@router.message(Command("turing"))
@router.callback_query(F.data == "tool:open:turing_game")
async def cb_turing_start(event: Message | CallbackQuery) -> None:
    rnd = get_turing_round()
    b = InlineKeyboardBuilder()
    b.row(
        InlineKeyboardButton(text="🧑 Это Человек!", callback_data=f"v2:tur:{rnd['id']}:human"),
        InlineKeyboardButton(text="🤖 Это Нейросеть (ИИ)!", callback_data=f"v2:tur:{rnd['id']}:ai"),
    )
    b.row(InlineKeyboardButton(text="⬅️ Соц-хаб", callback_data="nav:cat:social"), InlineKeyboardButton(text="🏠 Домой", callback_data="nav:home"))
    await render_hud(
        event,
        f"<b>🤖 Детектор Тьюринга: Человек или ИИ?</b>\n"
        f"<blockquote>Контекст: {esc(rnd['topic'])}</blockquote>\n\n"
        f"«<i>{esc(rnd['text'])}</i>»\n\n"
        f"Кто написал этот текст?",
        reply_markup=b.as_markup(),
    )


@router.callback_query(F.data.startswith("v2:tur:"))
async def cb_turing_answer(call: CallbackQuery) -> None:
    _, _, r_id, guess = call.data.split(":")
    res = check_turing_guess(int(r_id), guess)
    await db.record_tool_use(call.from_user.id, "turing_game", "social", "bot", guess, xp_gain=res["xp_reward"])
    verdict = "✅ <b>В яблочко! (+20 XP)</b>" if res["correct"] else "❌ <b>А вот и нет! (+5 XP за попытку)</b>"
    b = InlineKeyboardBuilder()
    b.row(InlineKeyboardButton(text="🎲 Следующий текст", callback_data="tool:open:turing_game"))
    b.row(InlineKeyboardButton(text="🏠 Главное меню", callback_data="nav:home"))
    await render_hud(
        call,
        f"{verdict}\n"
        f"Автор текста: <b>{esc(res['actual_label'])}</b>\n\n"
        f"🔍 <b>Разбор улик:</b>\n<blockquote>{esc(res['clue'])}</blockquote>",
        reply_markup=b.as_markup(),
    )


# --- Милые Альтушки 18+ прямо в чате и в Mini App ---
@router.message(Command("altushka"))
@router.callback_query(F.data == "tool:open:altushka_chat")
async def cb_altushka_start(event: Message | CallbackQuery, state: FSMContext) -> None:
    await state.set_state(ToolState.altushka_chat_waiting)
    await state.update_data(persona_id="ksyusha", affection=30)
    p = ALTUSHKA_PERSONAS["ksyusha"]
    b = InlineKeyboardBuilder()
    b.row(
        InlineKeyboardButton(text="🖤 Ксюша (20)", callback_data="v2:alt:ksyusha"),
        InlineKeyboardButton(text="💜 Алиса (21)", callback_data="v2:alt:alisa"),
    )
    b.row(
        InlineKeyboardButton(text="🍵 Милана (19)", callback_data="v2:alt:milana"),
        InlineKeyboardButton(text="🔥 Рита (22)", callback_data="v2:alt:rita"),
    )
    b.row(webapp_button("💘 Полноэкранный Дейтинг + Bibinto в Mini App", tab="social"))
    b.row(InlineKeyboardButton(text="🏠 Главное меню", callback_data="nav:home"))
    await render_hud(
        event,
        f"<b>💘 Альтушка-Дейтинг (18+ Ролевой Чат)</b>\n"
        f"<blockquote>{p['emoji']} <b>{esc(p['name'])}, {p['age']} лет</b> — {esc(p['archetype'])}\n"
        f"Симпатия: ❤️ 30/100</blockquote>\n\n"
        f"💬 «{esc(p['greeting'])}»\n\n"
        f"✍️ <i>Напишите ей любое сообщение прямо в чат или выберите героиню ниже!</i>",
        reply_markup=b.as_markup(),
    )


@router.callback_query(F.data.startswith("v2:alt:"))
async def cb_switch_altushka(call: CallbackQuery, state: FSMContext) -> None:
    pid = call.data.split(":")[2]
    p = ALTUSHKA_PERSONAS.get(pid, ALTUSHKA_PERSONAS["ksyusha"])
    await state.set_state(ToolState.altushka_chat_waiting)
    await state.update_data(persona_id=pid, affection=30)
    b = InlineKeyboardBuilder()
    b.row(webapp_button("💘 Открыть Дейтинг в Mini App", tab="social"))
    b.row(InlineKeyboardButton(text="⬅️ Сменить героиню", callback_data="tool:open:altushka_chat"), InlineKeyboardButton(text="🏠 Домой", callback_data="nav:home"))
    await render_hud(
        call,
        f"<b>{p['emoji']} {esc(p['name'])}, {p['age']} лет ({esc(p['archetype'])})</b>\n"
        f"<blockquote>Образ: {esc(p['style'])}</blockquote>\n\n"
        f"💬 «{esc(p['greeting'])}»\n\n"
        f"✍️ <i>Отправьте ответное сообщение в чат:</i>",
        reply_markup=b.as_markup(),
    )


@router.message(ToolState.altushka_chat_waiting, F.text, ~F.text.startswith("/"))
async def handle_altushka_message(message: Message, state: FSMContext) -> None:
    data = await state.get_data()
    pid = data.get("persona_id", "ksyusha")
    aff = int(data.get("affection", 30))
    res = altushka_chat_reply(pid, message.text or "", aff)
    await state.update_data(affection=res["affection"])
    await db.record_tool_use(message.from_user.id, "altushka_chat", "social", "bot", pid, xp_gain=6)
    p = res["persona"]
    b = InlineKeyboardBuilder()
    b.row(
        InlineKeyboardButton(text="⬅️ Сменить альтушку", callback_data="tool:open:altushka_chat"),
        InlineKeyboardButton(text="🏠 Главное меню", callback_data="nav:home"),
    )
    await render_hud(
        message,
        f"<b>{p['emoji']} {esc(p['name'])} ({p['age']})</b> • <i>{esc(res['mood'])}</i>\n"
        f"<blockquote>❤️ Симпатия: <b>{res['affection']}/100</b> ({progress_bar(res['affection'])}) — {esc(res['status_title'])}</blockquote>\n\n"
        f"💬 «{esc(res['reply'])}»",
        reply_markup=b.as_markup(),
    )


@router.callback_query(F.data.in_({"tool:open:bibinto_rate", "tool:open:anon_chat"}))
async def cb_open_social_rooms(call: CallbackQuery) -> None:
    b = InlineKeyboardBuilder()
    b.row(webapp_button("💎 Открыть Bibinto & Анонимный Чат в Mini App", tab="social"))
    b.row(InlineKeyboardButton(text="⬅️ К разделу", callback_data="nav:cat:social"), InlineKeyboardButton(text="🏠 Домой", callback_data="nav:home"))
    await render_hud(
        call,
        "<b>💎 Bibinto (Оценка анкет 1–10) & 🎭 Анонимный Чат</b>\n\n"
        "В интерактивном Mini App вас ждут карточки участников со шкалой 1–10, создание своей анкеты и живые комнаты анонимного чата под крипто-масками!",
        reply_markup=b.as_markup(),
    )
