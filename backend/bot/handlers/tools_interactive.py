from __future__ import annotations

import asyncio
from typing import Any
from aiogram import Bot, F, Router
from aiogram.dispatcher.event.bases import SkipHandler
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import BufferedInputFile, CallbackQuery, InlineKeyboardButton, Message

from backend.bot.handlers.helpers import esc, load_media_bytes, progress_bar, render_hud
from backend.bot.keyboards import pass_forge_kb, qr_theme_kb, todos_kb, tool_back_kb
from backend.bot.states import ToolState
from backend.database import db
from backend.tools.dev_tools import (
    evaluate_regex,
    explain_cron,
    format_convert_data,
    generate_ids_and_timestamps,
    transform_codec,
)
from backend.tools.image_lab import (
    inspect_and_clean_image,
    render_code_card,
    stego_decode_png,
    stego_encode_png,
    transform_image,
)
from backend.tools.pdf_forge import (
    images_to_pdf,
    inspect_pdf,
    render_text_to_pdf,
    transform_pdf,
)
from backend.tools.qr_studio import (
    QR_THEMES,
    build_vcard_payload,
    build_wifi_payload,
    generate_barcode_png,
    generate_styled_qr,
)
from backend.tools.security_lab import (
    compute_hashes,
    decrypt_nx1,
    encrypt_nx1,
    generate_passwords,
    generate_totp_info,
    identify_hash,
    inspect_jwt,
)
from backend.tools.smart_calc import (
    calculate_finance,
    calculate_subnet,
    convert_units,
    evaluate_math,
)
from backend.tools.text_studio import (
    analyze_and_diff_text,
    fix_keyboard_layout,
    run_randomizer,
    stylize_text,
)

router = Router(name="tools_interactive")


# ==============================================================================
# Universal Tool Launcher (callback `tool:open:<tool_id>`)
# ==============================================================================
@router.callback_query(F.data.startswith("tool:open:"))
async def cb_open_tool(
    callback: CallbackQuery,
    state: FSMContext,
    user_favorites: list[str],
) -> None:
    await state.clear()
    tool_id = callback.data.split(":")[2]
    is_fav = tool_id in user_favorites
    uid = callback.from_user.id

    # --- Instant Zero-Typing Tools ---
    if tool_id == "pass_forge":
        await _render_passwords(callback, length=20, mode="chars", is_fav=is_fav)
        return

    if tool_id == "qr_studio":
        await state.set_state(ToolState.qr_waiting_input)
        await state.update_data(qr_theme="cyber", qr_shape="rounded")
        await render_hud(
            callback,
            "<b>✨ Дизайнер Градиентных QR-кодов</b>\n"
            "<blockquote>🎨 Стиль: <b>Кибер Неон</b> • Форма: <b>Скруглённый</b></blockquote>\n\n"
            "Выберите тему ниже и <b>отправьте ссылку или любой текст</b> в чат (можно добавить бейдж через <code>|</code>, например: <code>https://t.me | TG</code>):",
            reply_markup=qr_theme_kb("cyber", "rounded"),
        )
        return

    if tool_id == "wifi_qr":
        await state.set_state(ToolState.wifi_waiting_input)
        await render_hud(
            callback,
            "<b>📶 Генератор Wi-Fi QR</b>\n"
            "<blockquote>Гости смогут подключиться к сети наведением камеры телефона!</blockquote>\n\n"
            "Отправьте название сети и пароль через <code>|</code>:\n"
            "Пример: <code>Home_5G | MySecretPass2026</code>",
            reply_markup=tool_back_kb(tool_id, is_fav),
        )
        return

    if tool_id == "vcard_qr":
        await state.set_state(ToolState.qr_waiting_input)
        await state.update_data(qr_theme="royal", qr_shape="rounded", vcard_mode=True)
        await render_hud(
            callback,
            "<b>🪪 Цифровая Визитка vCard QR</b>\n\n"
            "Отправьте данные через <code>|</code>:\n"
            "<code>Имя Фамилия | +79991234567 | email@domain.com | Компания</code>",
            reply_markup=tool_back_kb(tool_id, is_fav),
        )
        return

    if tool_id == "barcode_gen":
        await state.set_state(ToolState.barcode_waiting_input)
        await render_hud(
            callback,
            "<b>🏷️ Генератор Штрихкодов (Code128 / EAN-13)</b>\n\n"
            "Отправьте артикул (латиница/цифры для Code128 или 12–13 цифр для EAN-13):\n"
            "Пример: <code>MT-2026-PRO</code> или <code>460700123456</code>",
            reply_markup=tool_back_kb(tool_id, is_fav),
        )
        return

    if tool_id == "stego_lab":
        await state.set_state(ToolState.stego_hide_waiting_text)
        await render_hud(
            callback,
            "<b>🕵️ Крипто-Стеганография LSB (AES-256)</b>\n"
            "<blockquote>Прячет секретный текст прямо в младшие биты пикселей PNG без видимых искажений!</blockquote>\n\n"
            "• Чтобы <b>создать стего-картинку</b>: отправьте текст (или <code>Секрет | Пароль</code> для AES-256 защиты).\n"
            "• Чтобы <b>спрятать в своё фото</b> или <b>извлечь тайну</b>: просто отправьте PNG/фото в чат!",
            reply_markup=tool_back_kb(tool_id, is_fav),
        )
        return

    if tool_id in ("exif_clean", "img_transform"):
        await render_hud(
            callback,
            "<b>🖼️ Фото-Лаборатория и Очистка EXIF</b>\n\n"
            "Просто <b>отправьте любое изображение или фото</b> в чат — бот мгновенно покажет интерактивную панель:\n"
            "• 🧹 Удаление всех EXIF/GPS метаданных + палитра доминантных цветов\n"
            "• 🎭 Конвертация в готовый Telegram-стикер <code>512×512 WEBP</code>\n"
            "• 🌆 Киберпанк-дуотон, Пиксель-арт и сборка в PDF!",
            reply_markup=tool_back_kb(tool_id, is_fav),
        )
        return

    if tool_id == "code_card":
        await state.set_state(ToolState.code_card_waiting_code)
        await render_hud(
            callback,
            "<b>📸 Carbon Скриншот Кода</b>\n"
            "<blockquote>Превращает фрагмент кода в стильную карточку macOS с подсветкой синтаксиса!</blockquote>\n\n"
            "Отправьте любой кусок кода следующим сообщением (или используйте <code>/code ваш_код</code>):",
            reply_markup=tool_back_kb(tool_id, is_fav),
        )
        return

    if tool_id == "text_to_pdf":
        await state.set_state(ToolState.text_pdf_waiting_content)
        await render_hud(
            callback,
            "<b>📑 Вёрстка Текста в PDF (Кириллица)</b>\n\n"
            "Отправьте текст документа. Первая строка станет заголовком, поддерживаются списки <code>- пункт</code> и подзаголовки <code># Раздел</code>:",
            reply_markup=tool_back_kb(tool_id, is_fav),
        )
        return

    if tool_id in ("img_to_pdf", "pdf_inspect", "pdf_protect"):
        await render_hud(
            callback,
            "<b>📄 PDF Кузница</b>\n\n"
            "• Отправьте <b>PDF-документ</b> в чат, чтобы извлечь текст, повернуть страницы или зашифровать его паролем <code>AES-256</code>.\n"
            "• Или отправьте <b>любое фото</b> и нажмите «📄 Конвертировать в PDF»!",
            reply_markup=tool_back_kb(tool_id, is_fav),
        )
        return

    if tool_id == "aes_cipher":
        await state.set_state(ToolState.aes_encrypt_waiting)
        await render_hud(
            callback,
            "<b>🧬 Шифратор AES-256-GCM (Контейнер NX1)</b>\n\n"
            "• Для <b>шифрования</b> отправьте: <code>Секретный текст | Пароль</code>\n"
            "• Для <b>расшифровки</b> отправьте: <code>NX1.ваш_шифр | Пароль</code>",
            reply_markup=tool_back_kb(tool_id, is_fav),
        )
        return

    if tool_id == "hash_lab":
        await state.set_state(ToolState.hash_waiting_input)
        await render_hud(
            callback,
            "<b>#️⃣ Мульти-Хеш и Распознаватель</b>\n\n"
            "Отправьте любую строку для расчёта MD5 / SHA-256 / SHA-512 / BLAKE2b (или вставьте готовый хеш для определения алгоритма):",
            reply_markup=tool_back_kb(tool_id, is_fav),
        )
        return

    if tool_id == "jwt_totp":
        totp = generate_totp_info(account=f"user_{uid}@multi_tg_tool")
        await state.set_state(ToolState.jwt_waiting_input)
        await db.record_tool_use(uid, "jwt_totp", "security", "bot", "2FA + JWT Ready")
        await render_hud(
            callback,
            f"<b>⏱️ JWT Инспектор & Живой 2FA TOTP</b>\n"
            f"<blockquote>🔑 Демо-ключ Base32: <code>{totp['secret']}</code>\n"
            f"🔢 Текущий 2FA код: <code>{totp['code']}</code> (осталось {totp['remaining_seconds']} сек)\n"
            f"⏭ Следующий код: <code>{totp['next_code']}</code></blockquote>\n\n"
            f"Отправьте в чат <b>JWT-токен</b> (<code>eyJ...</code>) для декодирования или свой <b>Base32 секрет 2FA</b> для генерации кода:",
            reply_markup=tool_back_kb(tool_id, is_fav),
        )
        return

    if tool_id == "json_yaml":
        await state.set_state(ToolState.json_waiting_input)
        await render_hud(
            callback,
            "<b>🧩 JSON ↔ YAML Форматтер и Валидатор</b>\n\n"
            "Отправьте JSON или YAML — бот проверит синтаксис, красиво отформатирует JSON и покажет YAML-версию:",
            reply_markup=tool_back_kb(tool_id, is_fav),
        )
        return

    if tool_id == "regex_lab":
        await state.set_state(ToolState.regex_waiting_input)
        await render_hud(
            callback,
            "<b>🎯 Regex Лаборатория</b>\n\n"
            "Отправьте шаблон и проверяемый текст через <code>|</code>:\n"
            "Пример: <code>([a-z0-9_]+)@([a-z.]+) | Почта dev@tg.org и support@tg.org</code>",
            reply_markup=tool_back_kb(tool_id, is_fav),
        )
        return

    if tool_id == "encoders":
        await state.set_state(ToolState.codec_waiting_input)
        await render_hud(
            callback,
            "<b>📡 Универсальный Кодер (Base64 / Base58 / Hex / Морзе)</b>\n\n"
            "Отправьте любой текст (или азбуку Морзе вида <code>.--. .-. .. .-- . -</code>) — бот мгновенно закодирует и декодирует его во всех форматах:",
            reply_markup=tool_back_kb(tool_id, is_fav),
        )
        return

    if tool_id == "cron_uuid":
        gen = generate_ids_and_timestamps("uuid4", 3)
        u7 = generate_ids_and_timestamps("uuid7", 2)["ids"]
        ulid_val = generate_ids_and_timestamps("ulid", 1)["ids"][0]
        await state.set_state(ToolState.cron_waiting_input)
        await db.record_tool_use(uid, "cron_uuid", "dev", "bot", "UUID + Cron")
        ids_block = "\n".join(f"• <code>{x}</code>" for x in gen["ids"])
        await render_hud(
            callback,
            f"<b>⚙️ Генератор UUID/ULID & Cron-Расписания</b>\n"
            f"<blockquote>🕒 Unix сейчас: <code>{gen['time_info']['unix_sec']}</code> ({gen['time_info']['iso_utc'][:19]}Z)</blockquote>\n\n"
            f"<b>UUID v4:</b>\n{ids_block}\n"
            f"<b>UUID v7:</b> <code>{u7[0]}</code>\n"
            f"<b>ULID:</b> <code>{ulid_val}</code>\n\n"
            f"👇 Отправьте <b>Cron-выражение</b> (например <code>*/15 9-18 * * 1-5</code>) или Unix-таймстемп для разбора:",
            reply_markup=tool_back_kb(tool_id, is_fav),
        )
        return

    if tool_id == "smart_calc":
        await state.set_state(ToolState.calc_waiting_expr)
        await render_hud(
            callback,
            "<b>📐 Научный и Программистский Калькулятор</b>\n\n"
            "Отправьте выражение (поддерживаются <code>sin, cos, sqrt, log, fact, gcd, pi, 0xFF & 0b1010, 2^16</code>):",
            reply_markup=tool_back_kb(tool_id, is_fav),
        )
        return

    if tool_id == "unit_conv":
        await state.set_state(ToolState.unit_waiting_input)
        await render_hud(
            callback,
            "<b>⚖️ Конвертер Величин</b>\n\n"
            "Отправьте значение и единицу измерения:\n"
            "Примеры: <code>12.5 km</code>, <code>2048 MB</code>, <code>98.6 F</code>, <code>75 kg</code>, <code>100 mph</code>",
            reply_markup=tool_back_kb(tool_id, is_fav),
        )
        return

    if tool_id == "finance_calc":
        await state.set_state(ToolState.finance_waiting_input)
        await render_hud(
            callback,
            "<b>💎 Финансовый Калькулятор (Вклад / Кредит / Чек)</b>\n\n"
            "• <b>Вклад со сложным %</b>: <code>вклад 500000 18 12</code> (сумма, % годовых, мес.)\n"
            "• <b>Кредит (аннуитет)</b>: <code>кредит 1500000 19 36</code>\n"
            "• <b>Разделить счёт</b>: <code>чек 6400 4 10</code> (сумма, гостей, % чаевых)",
            reply_markup=tool_back_kb(tool_id, is_fav),
        )
        return

    if tool_id == "subnet_calc":
        await state.set_state(ToolState.subnet_waiting_cidr)
        await render_hud(
            callback,
            "<b>🌐 IP / CIDR Калькулятор Подсетей</b>\n\n"
            "Отправьте IP-адрес и маску префикса (например: <code>192.168.10.42/26</code> или <code>10.20.0.0/16</code>):",
            reply_markup=tool_back_kb(tool_id, is_fav),
        )
        return

    if tool_id == "layout_fixer":
        await state.set_state(ToolState.layout_waiting_text)
        await render_hud(
            callback,
            "<b>⌨️ Авто-Фикс Раскладки (QWERTY ↔ ЙЦУКЕН) & Транслит</b>\n\n"
            "Отправьте текст, набранный не в той раскладке (например <code>Ghbdtn, rfr ltkf?</code>), или русский текст для ГОСТ-транслита и URL-slug:",
            reply_markup=tool_back_kb(tool_id, is_fav),
        )
        return

    if tool_id == "font_styler":
        await state.set_state(ToolState.fonts_waiting_text)
        await render_hud(
            callback,
            "<b>✨ Генератор Стильных Шрифтов & Регистров</b>\n\n"
            "Отправьте слово или фразу (например <code>MULTI_TG_TOOL</code>):",
            reply_markup=tool_back_kb(tool_id, is_fav),
        )
        return

    if tool_id == "text_diff":
        await state.set_state(ToolState.diff_waiting_texts)
        await render_hud(
            callback,
            "<b>📊 Глубокая Аналитика Текста & Diff Сравнение</b>\n\n"
            "Отправьте любой текст для подсчёта слов, времени чтения и частотности (или два фрагмента через <code>===</code> для построчного Diff-сравнения):",
            reply_markup=tool_back_kb(tool_id, is_fav),
        )
        return

    if tool_id == "randomizer":
        dice_demo = run_randomizer("dice", "2d20+5")
        coin_demo = run_randomizer("coin")
        await state.set_state(ToolState.random_waiting_input)
        await db.record_tool_use(uid, "randomizer", "text", "bot", "Dice + Coin")
        await render_hud(
            callback,
            f"<b>🎲 Рандомайзер, RPG-Кубики и Деление на Команды</b>\n"
            f"<blockquote>🪙 Монетка сейчас: <b>{coin_demo['result']}</b>\n"
            f"🎲 Бросок 2d20+5: <b>{dice_demo['total']}</b> (выпало {dice_demo['rolls']})</blockquote>\n\n"
            f"• Бросить кубики: отправьте <code>3d6+2</code> или <code>d100</code>\n"
            f"• Разделить людей на 2 команды: отправьте список имён через запятую!",
            reply_markup=tool_back_kb(tool_id, is_fav),
        )
        return

    if tool_id == "notes_vault":
        await _render_notes_view(callback, state, is_fav)
        return

    if tool_id == "todo_board":
        await _render_todos_view(callback)
        return

    raise SkipHandler()


# ==============================================================================
# Password Forge Callbacks & /pass Command
# ==============================================================================
async def _render_passwords(
    target: Message | CallbackQuery,
    length: int = 20,
    mode: str = "chars",
    is_fav: bool = False,
) -> None:
    uid = target.from_user.id
    res = generate_passwords(length=length, count=5, mode=mode)
    await db.record_tool_use(uid, "pass_forge", "security", "bot", f"{mode}:{length}")
    pw_lines = "\n".join(f"• <code>{esc(p)}</code>" for p in res["passwords"])
    text = (
        f"<b>🛡️ Генератор Криптостойких Паролей</b>\n"
        f"<blockquote>🔐 <b>Оценка:</b> {res['grade']}\n"
        f"🧬 <b>Энтропия:</b> <code>{res['entropy_bits']} бит</code>\n"
        f"⏱ <b>Взлом (100 GH/s):</b> {res['crack_time']}</blockquote>\n\n"
        f"<i>Нажмите на любой пароль, чтобы скопировать:</i>\n"
        f"{pw_lines}"
    )
    await render_hud(target, text, reply_markup=pass_forge_kb(length=length, mode=mode, is_fav=is_fav))


@router.message(Command("pass"))
async def cmd_pass(message: Message, user_favorites: list[str]) -> None:
    await _render_passwords(message, length=20, mode="chars", is_fav=("pass_forge" in user_favorites))


@router.callback_query(F.data.startswith("sec:pass:"))
async def cb_pass_update(callback: CallbackQuery, user_favorites: list[str]) -> None:
    parts = callback.data.split(":")
    length = int(parts[2])
    mode = parts[3]
    await _render_passwords(callback, length=length, mode=mode, is_fav=("pass_forge" in user_favorites))


# ==============================================================================
# QR Studio & Slash /qr
# ==============================================================================
@router.callback_query(F.data.startswith("qr:cfg:"))
async def cb_qr_cfg(callback: CallbackQuery, state: FSMContext) -> None:
    _, _, theme, shape = callback.data.split(":")
    await state.set_state(ToolState.qr_waiting_input)
    await state.update_data(qr_theme=theme, qr_shape=shape)
    theme_lbl = QR_THEMES.get(theme, QR_THEMES["cyber"])["label"]
    await render_hud(
        callback,
        f"<b>✨ Дизайнер Градиентных QR-кодов</b>\n"
        f"<blockquote>🎨 Стиль: <b>{esc(theme_lbl)}</b> • Форма: <b>{esc(shape)}</b></blockquote>\n\n"
        f"Отправьте ссылку или текст для генерации QR (можно добавить бейдж: <code>https://t.me | NX</code>):",
        reply_markup=qr_theme_kb(theme, shape),
    )


@router.message(Command("qr"))
async def cmd_qr(message: Message, user_favorites: list[str]) -> None:
    arg = (message.text or "").partition(" ")[2].strip()
    if not arg:
        arg = "https://t.me/multi_tg_bot"
    parts = [p.strip() for p in arg.split("|")]
    payload = parts[0]
    badge = parts[1] if len(parts) > 1 else "MT"
    png = await asyncio.to_thread(
        generate_styled_qr, payload, theme="cyber", shape="rounded", badge_text=badge, caption=payload[:42]
    )
    await db.record_tool_use(message.from_user.id, "qr_studio", "qr", "bot", payload[:50])
    await message.answer_photo(
        BufferedInputFile(png, filename="qr_code.png"),
        caption=f"✨ <b>QR-код готов!</b>\nСодержимое: <code>{esc(payload[:120])}</code>",
        parse_mode="HTML",
        reply_markup=tool_back_kb("qr_studio", "qr_studio" in user_favorites),
    )


@router.message(ToolState.qr_waiting_input, F.text, ~F.text.startswith("/"))
async def handle_qr_input(message: Message, state: FSMContext, user_favorites: list[str]) -> None:
    data = await state.get_data()
    theme = data.get("qr_theme", "cyber")
    shape = data.get("qr_shape", "rounded")
    raw = (message.text or "").strip()

    if data.get("vcard_mode"):
        parts = [p.strip() for p in raw.split("|")]
        name = parts[0] if parts else "Контакт"
        phone = parts[1] if len(parts) > 1 else ""
        email = parts[2] if len(parts) > 2 else ""
        org = parts[3] if len(parts) > 3 else ""
        payload = build_vcard_payload(name, phone=phone, email=email, org=org)
        png = await asyncio.to_thread(
            generate_styled_qr, payload, theme="royal", shape="rounded", badge_text="ID", caption=name
        )
        await state.clear()
        await db.record_tool_use(message.from_user.id, "vcard_qr", "qr", "bot", name)
        await message.answer_photo(
            BufferedInputFile(png, filename="vcard_qr.png"),
            caption=f"🪪 <b>Визитка vCard QR создана:</b> <b>{esc(name)}</b>",
            parse_mode="HTML",
            reply_markup=tool_back_kb("vcard_qr", "vcard_qr" in user_favorites),
        )
        return

    parts = [p.strip() for p in raw.split("|")]
    payload = parts[0]
    badge = parts[1] if len(parts) > 1 else ""
    png = await asyncio.to_thread(
        generate_styled_qr, payload, theme=theme, shape=shape, badge_text=badge, caption=payload[:44]
    )
    await state.clear()
    await db.record_tool_use(message.from_user.id, "qr_studio", "qr", "bot", payload[:50])
    await message.answer_photo(
        BufferedInputFile(png, filename="qr_code.png"),
        caption=f"✨ <b>Дизайнерский QR-код готов!</b>\nДанные: <code>{esc(payload[:150])}</code>",
        parse_mode="HTML",
        reply_markup=tool_back_kb("qr_studio", "qr_studio" in user_favorites),
    )


@router.message(ToolState.wifi_waiting_input, F.text, ~F.text.startswith("/"))
async def handle_wifi_qr(message: Message, state: FSMContext, user_favorites: list[str]) -> None:
    parts = [p.strip() for p in (message.text or "").split("|")]
    ssid = parts[0] if parts else "WiFi"
    pwd = parts[1] if len(parts) > 1 else ""
    payload = build_wifi_payload(ssid, pwd)
    png = await asyncio.to_thread(
        generate_styled_qr, payload, theme="emerald", shape="rounded", badge_text="WiFi", caption=f"Wi-Fi: {ssid}"
    )
    await state.clear()
    await db.record_tool_use(message.from_user.id, "wifi_qr", "qr", "bot", ssid)
    await message.answer_photo(
        BufferedInputFile(png, filename="wifi_qr.png"),
        caption=f"📶 <b>Wi-Fi QR готов!</b>\nСеть: <code>{esc(ssid)}</code>",
        parse_mode="HTML",
        reply_markup=tool_back_kb("wifi_qr", "wifi_qr" in user_favorites),
    )


@router.message(ToolState.barcode_waiting_input, F.text, ~F.text.startswith("/"))
async def handle_barcode_input(message: Message, state: FSMContext, user_favorites: list[str]) -> None:
    raw = (message.text or "").strip()
    kind = "ean13" if (raw.isdigit() and len(raw) in (12, 13)) else "code128"
    try:
        png = await asyncio.to_thread(generate_barcode_png, raw, kind=kind)
    except Exception as exc:
        await message.answer(f"⚠️ Ошибка: {esc(exc)}")
        return
    await state.clear()
    await db.record_tool_use(message.from_user.id, "barcode_gen", "qr", "bot", f"{kind}:{raw}")
    await message.answer_photo(
        BufferedInputFile(png, filename="barcode.png"),
        caption=f"🏷️ <b>Штрихкод {kind.upper()}</b> для <code>{esc(raw)}</code>",
        parse_mode="HTML",
        reply_markup=tool_back_kb("barcode_gen", "barcode_gen" in user_favorites),
    )


# ==============================================================================
# Image Actions, Steganography & Carbon Code Card
# ==============================================================================
@router.message(Command("stego"))
async def cmd_stego(message: Message, user_favorites: list[str]) -> None:
    arg = (message.text or "").partition(" ")[2].strip()
    if not arg:
        await message.answer("Использование: <code>/stego Секретный текст | Пароль(опционально)</code>", parse_mode="HTML")
        return
    parts = [p.strip() for p in arg.split("|")]
    secret_msg = parts[0]
    pwd = parts[1] if len(parts) > 1 else ""
    png, meta = await asyncio.to_thread(stego_encode_png, secret_msg, password=pwd)
    await db.record_tool_use(message.from_user.id, "stego_lab", "image", "bot", "LSB Encode")
    lock_str = "🔒 Защищено AES-256 паролем" if meta["encrypted"] else "🔓 Открытый LSB контейнер"
    await message.answer_document(
        BufferedInputFile(png, filename="stego_carrier.png"),
        caption=(
            f"🕵️ <b>Секрет спрятан внутри PNG без потери качества!</b>\n"
            f"<blockquote>{lock_str}\n"
            f"📦 Объём: {meta['payload_bytes']} байт ({meta['usage_pct']}% ёмкости пикселей)</blockquote>\n"
            f"<i>Отправьте этот файл обратно боту, чтобы проверить извлечение!</i>"
        ),
        parse_mode="HTML",
        reply_markup=tool_back_kb("stego_lab", "stego_lab" in user_favorites),
    )


@router.message(ToolState.stego_hide_waiting_text, F.text, ~F.text.startswith("/"))
async def handle_stego_hide_text(message: Message, state: FSMContext, bot: Bot, user_favorites: list[str]) -> None:
    data = await state.get_data()
    cover_key = data.get("cover_key")
    cover_bytes = None
    if cover_key:
        try:
            cover_bytes, _ = await load_media_bytes(bot, cover_key)
        except Exception:
            cover_bytes = None

    parts = [p.strip() for p in (message.text or "").split("|")]
    secret_msg = parts[0]
    pwd = parts[1] if len(parts) > 1 else ""
    png, meta = await asyncio.to_thread(stego_encode_png, secret_msg, password=pwd, cover_bytes=cover_bytes)
    await state.clear()
    await db.record_tool_use(message.from_user.id, "stego_lab", "image", "bot", "LSB Encode")
    lock_str = "🔒 Зашифровано AES-256" if meta["encrypted"] else "🔓 Без пароля"
    await message.answer_document(
        BufferedInputFile(png, filename="stego_vault.png"),
        caption=(
            f"🕵️ <b>Стеганограмма успешно создана!</b>\n"
            f"<blockquote>{lock_str} • Размер: {meta['width']}×{meta['height']}\n"
            f"Занято ёмкости пикселей: {meta['usage_pct']}%</blockquote>\n"
            f"<i>Важно: пересылайте в Telegram как «Файл/Документ», чтобы мессенджер не сжал PNG в JPEG.</i>"
        ),
        parse_mode="HTML",
        reply_markup=tool_back_kb("stego_lab", "stego_lab" in user_favorites),
    )


@router.message(ToolState.stego_decode_waiting_password, F.text, ~F.text.startswith("/"))
async def handle_stego_decode_pwd(message: Message, state: FSMContext, bot: Bot, user_favorites: list[str]) -> None:
    data = await state.get_data()
    key = data.get("stego_key", "")
    pwd = (message.text or "").strip()
    try:
        raw, _ = await load_media_bytes(bot, key)
        res = stego_decode_png(raw, password=pwd)
    except Exception as exc:
        await message.answer(f"❌ {esc(exc)}")
        return
    await state.clear()
    await db.record_tool_use(message.from_user.id, "stego_lab", "image", "bot", "LSB Decode")
    await render_hud(
        message,
        f"🔓 <b>Тайное сообщение расшифровано!</b>\n"
        f"<blockquote>📐 Носитель: {res['dimensions']} • AES-256 ✅</blockquote>\n\n"
        f"<pre>{esc(res['secret_text'])}</pre>",
        reply_markup=tool_back_kb("stego_lab", "stego_lab" in user_favorites),
    )


@router.callback_query(F.data.startswith("imgact:"))
async def cb_image_action(
    callback: CallbackQuery,
    state: FSMContext,
    bot: Bot,
    user_favorites: list[str],
) -> None:
    _, action, file_key = callback.data.split(":")
    uid = callback.from_user.id
    try:
        raw, _ = await load_media_bytes(bot, file_key)
    except Exception as exc:
        await callback.answer(str(exc), show_alert=True)
        return

    if action == "stego_hide":
        await state.set_state(ToolState.stego_hide_waiting_text)
        await state.update_data(cover_key=file_key)
        await callback.answer()
        await callback.message.answer(
            "🕵️ Отправьте <b>секретный текст</b> (или <code>Секрет | Пароль</code>), который нужно вшить внутрь этого изображения:",
            parse_mode="HTML",
        )
        return

    if action == "stego_read":
        try:
            res = stego_decode_png(raw)
            await callback.answer("Секрет найден!")
            await db.record_tool_use(uid, "stego_lab", "image", "bot", "Stego Read")
            await callback.message.answer(
                f"🔓 <b>Обнаружено скрытое послание!</b>\n\n<pre>{esc(res['secret_text'])}</pre>",
                parse_mode="HTML",
                reply_markup=tool_back_kb("stego_lab", "stego_lab" in user_favorites),
            )
        except ValueError as exc:
            msg = str(exc)
            if "защищено паролем" in msg:
                await state.set_state(ToolState.stego_decode_waiting_password)
                await state.update_data(stego_key=file_key)
                await callback.answer()
                await callback.message.answer(
                    "🔐 Стего-контейнер защищён <b>AES-256</b>! Отправьте пароль для расшифровки:",
                    parse_mode="HTML",
                )
            else:
                await callback.answer(msg, show_alert=True)
        return

    if action == "exif":
        clean_bytes, info = inspect_and_clean_image(raw)
        await callback.answer("EXIF очищен!")
        await db.record_tool_use(uid, "exif_clean", "image", "bot", "EXIF Strip")
        pal_str = "  ".join(f"<code>{c}</code>" for c in info["palette"])
        await callback.message.answer_document(
            BufferedInputFile(clean_bytes, filename=f"clean_safe.{info['output_format'].lower()}"),
            caption=(
                f"🧹 <b>Приватная очистка EXIF завершена!</b>\n"
                f"<blockquote>📐 Разрешение: {info['width']}×{info['height']} ({info['megapixels']} MP)\n"
                f"🏷 Удалено EXIF-тегов: <b>{info['exif_found_count']}</b>\n"
                f"📦 Размер: {info['original_size_kb']} КБ → {info['clean_size_kb']} КБ\n"
                f"🔑 SHA-256: <code>{info['sha256']}</code></blockquote>\n"
                f"🎨 <b>Палитра:</b> {pal_str}"
            ),
            parse_mode="HTML",
            reply_markup=tool_back_kb("exif_clean", "exif_clean" in user_favorites),
        )
        return

    if action == "topdf":
        pdf_bytes = await asyncio.to_thread(images_to_pdf, [raw])
        await callback.answer("PDF создан!")
        await db.record_tool_use(uid, "img_to_pdf", "pdf", "bot", "Photo->PDF")
        await callback.message.answer_document(
            BufferedInputFile(pdf_bytes, filename="image_document.pdf"),
            caption="📄 <b>Изображение упаковано в PDF документ!</b>",
            parse_mode="HTML",
            reply_markup=tool_back_kb("img_to_pdf", "img_to_pdf" in user_favorites),
        )
        return

    # Visual transforms: sticker / cyberpunk / pixelate
    out_bytes, meta = await asyncio.to_thread(transform_image, raw, action=action)
    await callback.answer("Готово!")
    await db.record_tool_use(uid, "img_transform", "image", "bot", action)
    if action == "sticker":
        await callback.message.answer_document(
            BufferedInputFile(out_bytes, filename="telegram_sticker_512.webp"),
            caption=(
                f"🎭 <b>Готовый файл для @Stickers!</b>\n"
                f"Формат: <code>WEBP {meta['dimensions']}</code> ({meta['after_kb']} КБ)"
            ),
            parse_mode="HTML",
            reply_markup=tool_back_kb("img_transform", "img_transform" in user_favorites),
        )
    else:
        await callback.message.answer_photo(
            BufferedInputFile(out_bytes, filename=f"image_{action}.webp"),
            caption=f"✨ Эффект <b>{esc(action)}</b> применён ({meta['dimensions']}, {meta['after_kb']} КБ)",
            parse_mode="HTML",
            reply_markup=tool_back_kb("img_transform", "img_transform" in user_favorites),
        )


@router.message(Command("code"))
async def cmd_code_card(message: Message, user_favorites: list[str]) -> None:
    snippet = (message.text or "").partition(" ")[2].strip()
    if not snippet:
        snippet = 'async def start_bot():\n    print("MULTI_TG_TOOL Ready")\n    return True'
    png = await asyncio.to_thread(render_code_card, snippet, language="python", title="bot.py", theme="tokyo")
    await db.record_tool_use(message.from_user.id, "code_card", "image", "bot", "Carbon PNG")
    await message.answer_photo(
        BufferedInputFile(png, filename="code_card.png"),
        caption="📸 <b>Карточка кода сгенерирована!</b>",
        parse_mode="HTML",
        reply_markup=tool_back_kb("code_card", "code_card" in user_favorites),
    )


@router.message(ToolState.code_card_waiting_code, F.text, ~F.text.startswith("/"))
async def handle_code_card(message: Message, state: FSMContext, user_favorites: list[str]) -> None:
    png = await asyncio.to_thread(render_code_card, message.text or "", language="", title="snippet", theme="tokyo")
    await state.clear()
    await db.record_tool_use(message.from_user.id, "code_card", "image", "bot", "Carbon PNG")
    await message.answer_photo(
        BufferedInputFile(png, filename="code_card.png"),
        caption="📸 <b>Ваш скриншот кода готов!</b>",
        parse_mode="HTML",
        reply_markup=tool_back_kb("code_card", "code_card" in user_favorites),
    )


# ==============================================================================
# PDF Forge Actions & Text->PDF
# ==============================================================================
@router.message(ToolState.text_pdf_waiting_content, F.text, ~F.text.startswith("/"))
async def handle_text_to_pdf(message: Message, state: FSMContext, user_favorites: list[str]) -> None:
    raw = (message.text or "").strip()
    lines = raw.splitlines()
    title = lines[0].lstrip("# ").strip()[:80] if lines else "Документ MULTI_TG_TOOL"
    pdf_bytes = await asyncio.to_thread(render_text_to_pdf, title=title, content=raw)
    await state.clear()
    await db.record_tool_use(message.from_user.id, "text_to_pdf", "pdf", "bot", title[:40])
    await message.answer_document(
        BufferedInputFile(pdf_bytes, filename="document.pdf"),
        caption=f"📑 <b>PDF документ свёрстан!</b>\nЗаголовок: <b>{esc(title)}</b>",
        parse_mode="HTML",
        reply_markup=tool_back_kb("text_to_pdf", "text_to_pdf" in user_favorites),
    )


@router.callback_query(F.data.startswith("pdfact:"))
async def cb_pdf_action(
    callback: CallbackQuery,
    state: FSMContext,
    bot: Bot,
    user_favorites: list[str],
) -> None:
    _, action, file_key = callback.data.split(":")
    uid = callback.from_user.id
    try:
        raw, fname = await load_media_bytes(bot, file_key)
    except Exception as exc:
        await callback.answer(str(exc), show_alert=True)
        return

    if action == "inspect":
        info = inspect_pdf(raw)
        await callback.answer("Текст извлечён!")
        await db.record_tool_use(uid, "pdf_inspect", "pdf", "bot", fname)
        preview = info["extracted_text"][:1800] or "(Текстовый слой пуст или отсканирован)"
        await callback.message.answer(
            f"🔎 <b>Анализ PDF документа</b>\n"
            f"<blockquote>📄 Страниц: <b>{info['page_count']}</b> • Размер: {info['size_kb']} КБ\n"
            f"🔒 Шифрование: {'Да' if info['is_encrypted'] else 'Нет'}</blockquote>\n\n"
            f"<pre>{esc(preview)}</pre>",
            parse_mode="HTML",
            reply_markup=tool_back_kb("pdf_inspect", "pdf_inspect" in user_favorites),
        )
        return

    if action == "rotate":
        out_pdf, meta = transform_pdf(raw, rotate_deg=90)
        await callback.answer("Повёрнуто на 90°!")
        await db.record_tool_use(uid, "pdf_protect", "pdf", "bot", "Rotate 90")
        await callback.message.answer_document(
            BufferedInputFile(out_pdf, filename="rotated_90.pdf"),
            caption=f"🔄 <b>Все страницы ({meta['output_pages']}) повёрнуты на 90°!</b>",
            parse_mode="HTML",
            reply_markup=tool_back_kb("pdf_protect", "pdf_protect" in user_favorites),
        )
        return

    if action == "encrypt":
        await state.set_state(ToolState.pdf_encrypt_waiting_password)
        await state.update_data(pdf_key=file_key)
        await callback.answer()
        await callback.message.answer(
            "🔒 Введите <b>пароль</b> для шифрования PDF алгоритмом <code>AES-256</code>:",
            parse_mode="HTML",
        )


@router.message(ToolState.pdf_encrypt_waiting_password, F.text, ~F.text.startswith("/"))
async def handle_pdf_encrypt_pwd(message: Message, state: FSMContext, bot: Bot, user_favorites: list[str]) -> None:
    data = await state.get_data()
    key = data.get("pdf_key", "")
    pwd = (message.text or "").strip()
    raw, _ = await load_media_bytes(bot, key)
    out_pdf, meta = transform_pdf(raw, password=pwd)
    await state.clear()
    await db.record_tool_use(message.from_user.id, "pdf_protect", "pdf", "bot", "AES-256 PDF")
    await message.answer_document(
        BufferedInputFile(out_pdf, filename="protected_aes256.pdf"),
        caption=f"🔒 <b>PDF защищён AES-256!</b>\nСтраниц: {meta['output_pages']} • Пароль: <code>{esc(pwd)}</code>",
        parse_mode="HTML",
        reply_markup=tool_back_kb("pdf_protect", "pdf_protect" in user_favorites),
    )


# ==============================================================================
# Security, Dev, Calc & Text FSM Handlers + Slash Shortcuts
# ==============================================================================
@router.message(ToolState.aes_encrypt_waiting, F.text, ~F.text.startswith("/"))
async def handle_aes_cipher(message: Message, state: FSMContext, user_favorites: list[str]) -> None:
    parts = [p.strip() for p in (message.text or "").split("|")]
    if len(parts) < 2:
        await message.answer("⚠️ Укажите данные и пароль через <code>|</code>, например: <code>Секрет | MyPass</code>", parse_mode="HTML")
        return
    body, pwd = parts[0], parts[1]
    try:
        if body.startswith("NX1."):
            plain = decrypt_nx1(body, pwd)
            res_text = f"🔓 <b>Расшифрованное сообщение:</b>\n\n<pre>{esc(plain)}</pre>"
        else:
            enc = encrypt_nx1(body, pwd)
            res_text = (
                f"🧬 <b>Зашифровано AES-256-GCM (PBKDF2 120k):</b>\n\n"
                f"<code>{esc(enc)}</code>\n\n"
                f"<i>Скопируйте и перешлите собеседнику — без пароля прочитать невозможно.</i>"
            )
    except Exception as exc:
        await message.answer(f"❌ {esc(exc)}")
        return
    await state.clear()
    await db.record_tool_use(message.from_user.id, "aes_cipher", "security", "bot", "AES-256")
    await render_hud(message, res_text, reply_markup=tool_back_kb("aes_cipher", "aes_cipher" in user_favorites))


@router.message(Command("hash"))
@router.message(ToolState.hash_waiting_input, F.text, ~F.text.startswith("/"))
async def handle_hash_lab(message: Message, state: FSMContext, user_favorites: list[str]) -> None:
    raw = (message.text or "").strip()
    if raw.startswith("/hash"):
        raw = raw.partition(" ")[2].strip() or "MULTI_TG_TOOL"
    await state.clear()
    hashes_res = compute_hashes(raw)
    detected = identify_hash(raw)
    await db.record_tool_use(message.from_user.id, "hash_lab", "security", "bot", "Multi-Hash")
    lines = [f"• <b>{k}:</b> <code>{v}</code>" for k, v in hashes_res.items() if k != "mode"]
    det_line = f"\n🔎 <b>Если это хеш:</b> {', '.join(detected)}" if len(raw) >= 32 else ""
    await render_hud(
        message,
        f"<b>#️⃣ Криптографические Хеши</b>\n"
        f"<blockquote>Вход ({len(raw)} симв.): <code>{esc(raw[:60])}</code>{det_line}</blockquote>\n\n"
        + "\n".join(lines),
        reply_markup=tool_back_kb("hash_lab", "hash_lab" in user_favorites),
    )


@router.message(ToolState.jwt_waiting_input, F.text, ~F.text.startswith("/"))
async def handle_jwt_or_totp(message: Message, state: FSMContext, user_favorites: list[str]) -> None:
    raw = (message.text or "").strip()
    await state.clear()
    try:
        if raw.count(".") == 2 and raw.startswith("eyJ"):
            info = inspect_jwt(raw)
            import json
            hdr = json.dumps(info["header"], ensure_ascii=False, indent=2)
            pld = json.dumps(info["payload"], ensure_ascii=False, indent=2)
            out = (
                f"<b>⏱️ Разбор JWT Токена</b>\n"
                f"<blockquote>Статус exp: <b>{esc(info['exp_status'])}</b></blockquote>\n\n"
                f"<b>Header:</b>\n<pre>{esc(hdr)}</pre>\n"
                f"<b>Payload:</b>\n<pre>{esc(pld)}</pre>"
            )
        else:
            totp = generate_totp_info(secret=raw)
            out = (
                f"<b>🔐 2FA TOTP Генератор</b>\n"
                f"<blockquote>Ключ: <code>{esc(totp['secret'])}</code></blockquote>\n\n"
                f"🔢 Текущий код: <code>{totp['code']}</code> (ещё {totp['remaining_seconds']} сек)\n"
                f"⏭ Следующий: <code>{totp['next_code']}</code>"
            )
    except Exception as exc:
        await message.answer(f"⚠️ {esc(exc)}")
        return
    await db.record_tool_use(message.from_user.id, "jwt_totp", "security", "bot", "JWT/TOTP")
    await render_hud(message, out, reply_markup=tool_back_kb("jwt_totp", "jwt_totp" in user_favorites))


@router.message(ToolState.json_waiting_input, F.text, ~F.text.startswith("/"))
async def handle_json_yaml(message: Message, state: FSMContext, user_favorites: list[str]) -> None:
    raw = (message.text or "").strip()
    try:
        pretty_json = format_convert_data(raw, "auto", "json_pretty")
        as_yaml = format_convert_data(raw, "auto", "yaml")
    except Exception as exc:
        await message.answer(f"❌ {esc(exc)}")
        return
    await state.clear()
    await db.record_tool_use(message.from_user.id, "json_yaml", "dev", "bot", pretty_json["summary"]["detected_format"])
    await render_hud(
        message,
        f"<b>🧩 Форматтер Структур Данных</b>\n"
        f"<blockquote>Распознан: <b>{pretty_json['summary']['detected_format']}</b> • Элементов: {pretty_json['summary']['items_count']}</blockquote>\n\n"
        f"<b>JSON:</b>\n<pre>{esc(pretty_json['output'][:1400])}</pre>\n"
        f"<b>YAML:</b>\n<pre>{esc(as_yaml['output'][:1000])}</pre>",
        reply_markup=tool_back_kb("json_yaml", "json_yaml" in user_favorites),
    )


@router.message(ToolState.regex_waiting_input, F.text, ~F.text.startswith("/"))
async def handle_regex_lab(message: Message, state: FSMContext, user_favorites: list[str]) -> None:
    parts = (message.text or "").split("|", 1)
    if len(parts) < 2:
        await message.answer("⚠️ Отправьте <code>шаблон | текст</code>", parse_mode="HTML")
        return
    try:
        res = evaluate_regex(parts[0].strip(), parts[1].strip())
    except Exception as exc:
        await message.answer(f"❌ {esc(exc)}")
        return
    await state.clear()
    await db.record_tool_use(message.from_user.id, "regex_lab", "dev", "bot", f"Matches:{res['count']}")
    m_lines = [
        f"{m['index']}. <code>{esc(m['match'])}</code> [{m['span'][0]}..{m['span'][1]}]"
        + (f" группы: {esc(m['groups'])}" if m["groups"] else "")
        for m in res["matches"][:12]
    ]
    body = "\n".join(m_lines) if m_lines else "<i>Совпадений не найдено</i>"
    await render_hud(
        message,
        f"<b>🎯 Результат Regex</b>\n"
        f"<blockquote>Найдено совпадений: <b>{res['count']}</b></blockquote>\n\n{body}",
        reply_markup=tool_back_kb("regex_lab", "regex_lab" in user_favorites),
    )


@router.message(ToolState.codec_waiting_input, F.text, ~F.text.startswith("/"))
async def handle_encoders(message: Message, state: FSMContext, user_favorites: list[str]) -> None:
    raw = (message.text or "").strip()
    await state.clear()
    await db.record_tool_use(message.from_user.id, "encoders", "dev", "bot", "Multi-Codec")

    if set(raw).issubset({".", "-", "/", " "}):
        decoded = transform_codec(raw, "morse_ru", "decode")
        text = f"<b>📡 Декодер Морзе</b>\n\nВход: <code>{esc(raw)}</code>\nРезультат: <code>{esc(decoded)}</code>"
    else:
        b64 = transform_codec(raw, "base64", "encode")
        b58 = transform_codec(raw, "base58", "encode")
        hx = transform_codec(raw, "hex", "encode")
        url_e = transform_codec(raw, "url", "encode")
        morse = transform_codec(raw, "morse", "encode")
        text = (
            f"<b>📡 Универсальный Кодер</b>\n\n"
            f"• <b>Base64:</b> <code>{esc(b64[:200])}</code>\n"
            f"• <b>Base58:</b> <code>{esc(b58[:200])}</code>\n"
            f"• <b>Hex:</b> <code>{esc(hx[:200])}</code>\n"
            f"• <b>URL:</b> <code>{esc(url_e[:200])}</code>\n"
            f"• <b>Морзе:</b> <code>{esc(morse[:250])}</code>"
        )
    await render_hud(message, text, reply_markup=tool_back_kb("encoders", "encoders" in user_favorites))


@router.message(ToolState.cron_waiting_input, F.text, ~F.text.startswith("/"))
async def handle_cron_or_ts(message: Message, state: FSMContext, user_favorites: list[str]) -> None:
    raw = (message.text or "").strip()
    await state.clear()
    try:
        if len(raw.split()) == 5:
            info = explain_cron(raw)
            runs = "\n".join(f"• <code>{r}</code>" for r in info["next_runs"])
            out = (
                f"<b>⚙️ Расписание Cron</b>\n"
                f"<blockquote><code>{esc(info['expression'])}</code>\n"
                f"🗣 <b>{esc(info['human_ru'])}</b></blockquote>\n\n"
                f"<b>Ближайшие 5 запусков:</b>\n{runs}"
            )
        else:
            ts = generate_ids_and_timestamps("uuid4", 1, ts_input=raw)["time_info"]
            out = (
                f"<b>🕒 Конвертер Времени</b>\n\n"
                f"• Unix (сек): <code>{ts['unix_sec']}</code>\n"
                f"• Unix (мс): <code>{ts['unix_ms']}</code>\n"
                f"• ISO 8601: <code>{ts['iso_utc']}</code>"
            )
    except Exception as exc:
        await message.answer(f"⚠️ {esc(exc)}")
        return
    await db.record_tool_use(message.from_user.id, "cron_uuid", "dev", "bot", raw[:40])
    await render_hud(message, out, reply_markup=tool_back_kb("cron_uuid", "cron_uuid" in user_favorites))


@router.message(Command("calc"))
@router.message(ToolState.calc_waiting_expr, F.text, ~F.text.startswith("/"))
async def handle_calc(message: Message, state: FSMContext, user_favorites: list[str]) -> None:
    raw = (message.text or "").strip()
    if raw.startswith("/calc"):
        raw = raw.partition(" ")[2].strip() or "(1024 * 64) / 8"
    try:
        res = evaluate_math(raw)
    except Exception as exc:
        await message.answer(f"⚠️ Ошибка вычисления: {esc(exc)}")
        return
    await state.clear()
    await db.record_tool_use(message.from_user.id, "smart_calc", "calc", "bot", raw[:40])
    bases = ""
    if res["bases"]:
        bases = (
            f"\n\n<b>Системы счисления:</b>\n"
            f"• HEX: <code>{res['bases']['hex']}</code>\n"
            f"• BIN: <code>{res['bases']['bin']}</code>\n"
            f"• OCT: <code>{res['bases']['oct']}</code>"
        )
    await render_hud(
        message,
        f"<b>📐 Точный Расчёт</b>\n"
        f"<blockquote>Выражение: <code>{esc(res['expression'])}</code></blockquote>\n\n"
        f"🎯 Результат: <code>{esc(res['formatted'])}</code>{bases}",
        reply_markup=tool_back_kb("smart_calc", "smart_calc" in user_favorites),
    )


@router.message(ToolState.unit_waiting_input, F.text, ~F.text.startswith("/"))
async def handle_units(message: Message, state: FSMContext, user_favorites: list[str]) -> None:
    import re
    raw = (message.text or "").strip()
    m = re.match(r"^\s*([+-]?\d+(?:[.,]\d+)?)\s*([A-Za-z/_]+)\s*$", raw)
    if not m:
        await message.answer("⚠️ Формат: <code>15 km</code>, <code>2048 MB</code>, <code>36.6 C</code>, <code>80 kg</code>", parse_mode="HTML")
        return
    val = float(m.group(1).replace(",", "."))
    unit = m.group(2)

    cat_map = {
        "mm": ("length", "mm"), "cm": ("length", "cm"), "m": ("length", "m"), "km": ("length", "km"),
        "in": ("length", "in"), "ft": ("length", "ft"), "mi": ("length", "mi"),
        "mg": ("weight", "mg"), "g": ("weight", "g"), "kg": ("weight", "kg"), "t": ("weight", "t"),
        "lb": ("weight", "lb"), "oz": ("weight", "oz"),
        "b": ("data", "B"), "kb": ("data", "KB"), "mb": ("data", "MB"), "gb": ("data", "GB"), "tb": ("data", "TB"),
        "m/s": ("speed", "m/s"), "km/h": ("speed", "km/h"), "mph": ("speed", "mph"), "kn": ("speed", "kn"),
        "c": ("temperature", "C"), "f": ("temperature", "F"), "k": ("temperature", "K"),
    }
    found = cat_map.get(unit.lower())
    if not found:
        await message.answer("⚠️ Поддерживаются: mm, cm, m, km, in, ft, mi, g, kg, lb, KB, MB, GB, TB, m/s, km/h, mph, C, F, K")
        return
    res = convert_units(val, found[0], found[1])
    await state.clear()
    await db.record_tool_use(message.from_user.id, "unit_conv", "calc", "bot", res["from"])
    lines = "\n".join(f"• <b>{k}:</b> <code>{v}</code>" for k, v in res["all"].items())
    await render_hud(
        message,
        f"<b>⚖️ Конвертация: {esc(res['from'])}</b>\n\n{lines}",
        reply_markup=tool_back_kb("unit_conv", "unit_conv" in user_favorites),
    )


@router.message(ToolState.finance_waiting_input, F.text, ~F.text.startswith("/"))
async def handle_finance(message: Message, state: FSMContext, user_favorites: list[str]) -> None:
    tokens = (message.text or "").strip().split()
    if len(tokens) < 2:
        await message.answer("⚠️ Пример: <code>вклад 500000 18 12</code> или <code>чек 4800 4 10</code>", parse_mode="HTML")
        return
    cmd = tokens[0].lower()
    nums = [float(x.replace(",", ".")) for x in tokens[1:] if x.replace(",", ".").replace(".", "", 1).isdigit()]
    if not nums:
        await message.answer("⚠️ Не удалось прочитать числовые параметры")
        return
    await state.clear()
    if cmd.startswith("чек") or cmd == "split":
        bill = nums[0]
        ppl = int(nums[1]) if len(nums) > 1 else 2
        tip = nums[2] if len(nums) > 2 else 10.0
        res = calculate_finance("split", bill, people_count=ppl, tip_pct=tip)
        out = (
            f"<b>🧾 Разделение Счёта</b>\n"
            f"<blockquote>Сумма: {res['bill']} • Чаевые: {res['tip_amount']} • Гостей: {res['people']}</blockquote>\n\n"
            f"💳 Итого: <code>{res['grand_total']}</code>\n"
            f"👤 <b>С каждого:</b> <code>{res['per_person']}</code>"
        )
    elif cmd.startswith("кред") or cmd == "loan":
        s = nums[0]
        rate = nums[1] if len(nums) > 1 else 18.0
        m = int(nums[2]) if len(nums) > 2 else 24
        res = calculate_finance("loan", s, rate_annual_pct=rate, months=m)
        out = (
            f"<b>🏦 Аннуитетный Кредит</b>\n"
            f"<blockquote>Сумма: {res['principal']} • {res['rate_pct']}% годовых • {res['months']} мес.</blockquote>\n\n"
            f"📅 Платёж в месяц: <code>{res['monthly_payment']}</code>\n"
            f"💰 Общая выплата: <code>{res['total_paid']}</code>\n"
            f"📈 Переплата: <code>{res['overpayment']}</code> ({res['overpayment_pct']}%)"
        )
    else:
        s = nums[0]
        rate = nums[1] if len(nums) > 1 else 16.0
        m = int(nums[2]) if len(nums) > 2 else 12
        res = calculate_finance("compound", s, rate_annual_pct=rate, months=m)
        out = (
            f"<b>💎 Вклад со Сложным Процентом</b>\n"
            f"<blockquote>Старт: {res['initial']} • {rate}% годовых • {res['months']} мес.</blockquote>\n\n"
            f"🚀 Итоговый капитал: <code>{res['final_balance']}</code>\n"
            f"✨ Чистый доход: <code>+{res['profit']}</code> (+{res['yield_pct']}%)"
        )
    await db.record_tool_use(message.from_user.id, "finance_calc", "calc", "bot", cmd)
    await render_hud(message, out, reply_markup=tool_back_kb("finance_calc", "finance_calc" in user_favorites))


@router.message(Command("ip"))
@router.message(ToolState.subnet_waiting_cidr, F.text, ~F.text.startswith("/"))
async def handle_subnet(message: Message, state: FSMContext, user_favorites: list[str]) -> None:
    raw = (message.text or "").strip()
    if raw.startswith("/ip"):
        raw = raw.partition(" ")[2].strip() or "192.168.10.42/26"
    try:
        sub = calculate_subnet(raw)
    except Exception as exc:
        await message.answer(f"⚠️ Некорректная подсеть: {esc(exc)}")
        return
    await state.clear()
    await db.record_tool_use(message.from_user.id, "subnet_calc", "calc", "bot", sub["cidr"])
    await render_hud(
        message,
        f"<b>🌐 Расчёт Подсети {esc(sub['cidr'])}</b>\n"
        f"<blockquote>Тип: {sub['version']} • {'Частная (Private)' if sub['is_private'] else 'Публичная (Public)'}</blockquote>\n\n"
        f"• <b>Адрес сети:</b> <code>{sub['network_address']}</code>\n"
        f"• <b>Маска:</b> <code>{sub['netmask']}</code>\n"
        f"• <b>Broadcast:</b> <code>{sub['broadcast_address']}</code>\n"
        f"• <b>Диапазон хостов:</b> <code>{sub['first_host']} — {sub['last_host']}</code>\n"
        f"• <b>Доступных хостов:</b> <code>{sub['usable_hosts']}</code>\n"
        f"• <b>Бинарная маска:</b> <code>{sub['binary_netmask']}</code>",
        reply_markup=tool_back_kb("subnet_calc", "subnet_calc" in user_favorites),
    )


@router.message(Command("layout"))
@router.message(ToolState.layout_waiting_text, F.text, ~F.text.startswith("/"))
async def handle_layout(message: Message, state: FSMContext, user_favorites: list[str]) -> None:
    raw = (message.text or "").strip()
    if raw.startswith("/layout"):
        raw = raw.partition(" ")[2].strip() or "Ghbdtn, rfr ltkf?"
    await state.clear()
    res = fix_keyboard_layout(raw)
    await db.record_tool_use(message.from_user.id, "layout_fixer", "text", "bot", "Layout Fix")
    await render_hud(
        message,
        f"<b>⌨️ Конвертер Раскладки и Транслитерации</b>\n\n"
        f"🎯 <b>Исправлено:</b>\n<code>{esc(res['primary'])}</code>\n\n"
        f"🔤 <b>ГОСТ Транслит:</b> <code>{esc(res['translit'])}</code>\n"
        f"🔗 <b>URL-Slug:</b> <code>{esc(res['slug'])}</code>",
        reply_markup=tool_back_kb("layout_fixer", "layout_fixer" in user_favorites),
    )


@router.message(ToolState.fonts_waiting_text, F.text, ~F.text.startswith("/"))
async def handle_fonts(message: Message, state: FSMContext, user_favorites: list[str]) -> None:
    raw = (message.text or "").strip()
    await state.clear()
    res = stylize_text(raw)
    await db.record_tool_use(message.from_user.id, "font_styler", "text", "bot", "Unicode Styles")
    s_lines = "\n".join(f"• {k}: <code>{esc(v)}</code>" for k, v in res["styles"].items())
    c_lines = "\n".join(f"• {k}: <code>{esc(v)}</code>" for k, v in res["cases"].items())
    await render_hud(
        message,
        f"<b>✨ Стильные Шрифты & Регистры</b>\n\n{s_lines}\n\n<b>Программные регистры:</b>\n{c_lines}",
        reply_markup=tool_back_kb("font_styler", "font_styler" in user_favorites),
    )


@router.message(ToolState.diff_waiting_texts, F.text, ~F.text.startswith("/"))
async def handle_text_diff(message: Message, state: FSMContext, user_favorites: list[str]) -> None:
    raw = message.text or ""
    await state.clear()
    if "===" in raw:
        a, b = raw.split("===", 1)
        res = analyze_and_diff_text(a.strip(), b.strip())
    else:
        res = analyze_and_diff_text(raw.strip())
    st = res["stats"]
    await db.record_tool_use(message.from_user.id, "text_diff", "text", "bot", f"Words:{st['words']}")
    diff_block = ""
    if res["diff"]:
        d = res["diff"]
        diff_block = (
            f"\n\n<b>🔍 Diff-сравнение (сходство {d['similarity_pct']}%):</b>\n"
            f"Добавлено: <code>+{d['added_lines']}</code> • Удалено: <code>-{d['removed_lines']}</code>\n"
            f"<pre>{esc(d['unified_diff'][:1200])}</pre>"
        )
    top_w = ", ".join(f"{w['word']} ({w['count']})" for w in st["top_words"][:5]) or "—"
    await render_hud(
        message,
        f"<b>📊 Аналитика Текста</b>\n"
        f"<blockquote>Слов: <b>{st['words']}</b> • Символов: <b>{st['chars_total']}</b> (без пробелов: {st['chars_no_spaces']})\n"
        f"Предложений: {st['sentences']} • Время чтения: ~{st['reading_time_sec']} сек\n"
        f"Лексическое разнообразие: {st['lexical_diversity_pct']}%</blockquote>\n"
        f"🔑 Частые слова: {esc(top_w)}{diff_block}",
        reply_markup=tool_back_kb("text_diff", "text_diff" in user_favorites),
    )


@router.message(Command("dice"))
@router.message(ToolState.random_waiting_input, F.text, ~F.text.startswith("/"))
async def handle_randomizer(message: Message, state: FSMContext, user_favorites: list[str]) -> None:
    raw = (message.text or "").strip()
    if raw.startswith("/dice"):
        raw = raw.partition(" ")[2].strip() or "2d20+5"
    await state.clear()
    await db.record_tool_use(message.from_user.id, "randomizer", "text", "bot", raw[:30])
    if "," in raw or "\n" in raw:
        res = run_randomizer("teams", items_raw=raw, teams_count=2)
        t_lines = "\n".join(
            f"<b>Команда {idx}:</b> {', '.join(esc(p) for p in members)}"
            for idx, members in enumerate(res["teams"], start=1)
        )
        out = f"<b>👥 Случайное распределение по командам</b>\n\n{t_lines}"
    else:
        try:
            res = run_randomizer("dice", dice_expr=raw)
            out = (
                f"<b>🎲 Бросок {esc(res['expression'])}</b>\n\n"
                f"Выпавшие грани: <code>{res['rolls']}</code>\n"
                f"🏆 <b>Итоговая сумма: {res['total']}</b>"
            )
        except Exception as exc:
            await message.answer(f"⚠️ {esc(exc)}")
            return
    await render_hud(message, out, reply_markup=tool_back_kb("randomizer", "randomizer" in user_favorites))


# ==============================================================================
# Personal Workspace: Notes & Interactive Tap-to-Toggle Checklists
# ==============================================================================
async def _render_notes_view(
    target: Message | CallbackQuery, state: FSMContext, is_fav: bool
) -> None:
    uid = target.from_user.id
    notes = await db.list_notes(uid)
    await state.set_state(ToolState.note_waiting_content)
    if not notes:
        body = "<i>У вас пока нет заметок.</i>"
    else:
        chunks = []
        for n in notes[:8]:
            pin = "📌 " if n["pinned"] else "• "
            chunks.append(f"{pin}<b>{esc(n['title'])}</b> <code>[#{esc(n['tag'])}]</code>\n  <i>{esc(n['content'][:120])}</i>")
        body = "\n\n".join(chunks)

    text = (
        f"<b>📝 Заметки ({len(notes)})</b>\n"
        f"<blockquote>Синхронизируются с приложением в реальном времени</blockquote>\n\n"
        f"{body}\n\n"
        f"✍️ <b>Чтобы добавить заметку</b>, отправьте в чат: <code>Заголовок | Текст заметки</code>"
    )
    await render_hud(target, text, reply_markup=tool_back_kb("notes_vault", is_fav))


@router.message(Command("notes"))
async def cmd_notes(message: Message, state: FSMContext, user_favorites: list[str]) -> None:
    await _render_notes_view(message, state, "notes_vault" in user_favorites)


@router.message(ToolState.note_waiting_content, F.text, ~F.text.startswith("/"))
async def handle_new_note(message: Message, state: FSMContext, user_favorites: list[str]) -> None:
    raw = (message.text or "").strip()
    if "|" in raw:
        title, content = raw.split("|", 1)
    else:
        lines = raw.splitlines()
        title = lines[0][:50]
        content = "\n".join(lines[1:]) if len(lines) > 1 else raw
    await db.create_note(message.from_user.id, title=title, content=content, tag="bot")
    await db.record_tool_use(message.from_user.id, "notes_vault", "workspace", "bot", title[:30])
    await _render_notes_view(message, state, "notes_vault" in user_favorites)


async def _render_todos_view(target: Message | CallbackQuery) -> None:
    uid = target.from_user.id
    todos = await db.list_todos(uid)
    total = len(todos)
    done = sum(1 for t in todos if t["done"])
    pct = int(round((done / total) * 100)) if total else 0
    bar = progress_bar(pct, 10)
    text = (
        f"<b>✅ Интерактивный Чек-лист</b>\n"
        f"<blockquote>📊 Выполнено: <b>{done} из {total}</b> ({pct}%)\n"
        f"<code>{bar}</code></blockquote>\n\n"
        f"👇 <i>Нажимайте прямо на кнопки задач ниже, чтобы отмечать выполнение!</i>"
    )
    await render_hud(target, text, reply_markup=todos_kb(todos))


@router.message(Command("todo"))
async def cmd_todo(message: Message) -> None:
    await _render_todos_view(message)


@router.callback_query(F.data.startswith("ws:todo_toggle:"))
async def cb_todo_toggle(callback: CallbackQuery) -> None:
    todo_id = int(callback.data.split(":")[2])
    await db.toggle_todo(callback.from_user.id, todo_id)
    await _render_todos_view(callback)


@router.callback_query(F.data == "ws:todo_clear")
async def cb_todo_clear(callback: CallbackQuery) -> None:
    removed = await db.clear_completed_todos(callback.from_user.id)
    await callback.answer(f"Удалено завершённых задач: {removed}")
    await _render_todos_view(callback)


@router.callback_query(F.data == "ws:todo_add")
async def cb_todo_add_prompt(callback: CallbackQuery, state: FSMContext) -> None:
    await state.set_state(ToolState.todo_waiting_text)
    await callback.answer()
    await callback.message.answer(
        "➕ Отправьте текст новой задачи (добавьте <code>!</code> в начало для высокого приоритета 🔥):",
        parse_mode="HTML",
    )


@router.message(ToolState.todo_waiting_text, F.text, ~F.text.startswith("/"))
async def handle_todo_add_text(message: Message, state: FSMContext) -> None:
    raw = (message.text or "").strip()
    prio = "high" if raw.startswith("!") else "normal"
    clean = raw.lstrip("! ").strip()
    if clean:
        await db.add_todo(message.from_user.id, clean, priority=prio)
        await db.record_tool_use(message.from_user.id, "todo_board", "workspace", "bot", clean[:30])
    await state.clear()
    await _render_todos_view(message)
