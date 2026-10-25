from __future__ import annotations

import hashlib
from aiogram import Router
from aiogram.types import InlineQuery, InlineQueryResultArticle, InputTextMessageContent

from backend.bot.handlers.helpers import esc
from backend.database import db
from backend.tools.dev_tools import generate_ids_and_timestamps, transform_codec
from backend.tools.security_lab import compute_hashes, generate_passwords
from backend.tools.smart_calc import evaluate_math
from backend.tools.text_studio import fix_keyboard_layout, run_randomizer, stylize_text

router = Router(name="inline_mode")


def _article(idx: str, title: str, desc: str, html_body: str) -> InlineQueryResultArticle:
    return InlineQueryResultArticle(
        id=idx,
        title=title,
        description=desc,
        input_message_content=InputTextMessageContent(
            message_text=html_body,
            parse_mode="HTML",
        ),
    )


@router.inline_query()
async def handle_inline_query(inline_query: InlineQuery) -> None:
    q = (inline_query.query or "").strip()
    results: list[InlineQueryResultArticle] = []

    if not q:
        pw = generate_passwords(length=20, count=1)["passwords"][0]
        coin = run_randomizer("coin")["result"]
        d20 = run_randomizer("dice", "1d20")
        uid_v4 = generate_ids_and_timestamps("uuid4", 1)["ids"][0]

        results = [
            _article("quick_pass", "🔐 Надёжный пароль (20 симв.)", pw, f"🔐 Сгенерирован пароль:\n<code>{esc(pw)}</code>"),
            _article("quick_coin", f"🪙 Подбросить монетку: {coin}", "Случайный жребий", f"🪙 Монетка NEXUS: <b>{coin}</b>"),
            _article("quick_d20", f"🎲 Бросок d20: выпало {d20['total']}", "RPG кубик 1–20", f"🎲 Бросок 1d20: <b>{d20['total']}</b>"),
            _article("quick_uuid", "⚙️ Новый UUID v4", uid_v4, f"⚙️ UUID v4: <code>{uid_v4}</code>"),
        ]
        await inline_query.answer(results, cache_time=1, is_personal=True)
        return

    # 1. Try Math Calculator first
    try:
        calc = evaluate_math(q)
        results.append(
            _article(
                "calc_res",
                f"📐 = {calc['formatted']}",
                f"Вычисление: {q}",
                f"📐 <code>{esc(q)}</code> = <b><code>{esc(calc['formatted'])}</code></b>",
            )
        )
    except Exception:
        pass

    # 2. Keyboard Layout Fixer & Translit
    layout = fix_keyboard_layout(q)
    results.append(
        _article(
            "layout_fix",
            f"⌨️ Раскладка: {layout['primary'][:60]}",
            f"Транслит: {layout['translit'][:60]}",
            f"⌨️ {esc(layout['primary'])}",
        )
    )

    # 3. Stylish Unicode Fonts
    try:
        styled = stylize_text(q)["styles"]
        mono = styled["Monospace"]
        bold_s = styled["Bold Sans"]
        scaps = styled["Small Caps (RU/EN)"]
        results.append(
            _article("style_bold", f"✨ Bold: {bold_s[:50]}", "Стильный шрифт для поста", esc(bold_s))
        )
        results.append(
            _article("style_caps", f"✨ Small Caps: {scaps[:50]}", "Малые прописные", esc(scaps))
        )
        results.append(
            _article("style_mono", f"✨ Mono: {mono[:50]}", "Моноширинный Unicode", esc(mono))
        )
    except Exception:
        pass

    # 4. SHA-256 & Base64
    sha = compute_hashes(q)["SHA-256"]
    b64 = transform_codec(q, "base64", "encode")
    morse = transform_codec(q, "morse", "encode")
    q_hash_id = hashlib.md5(q.encode("utf-8")).hexdigest()[:8]

    results.append(
        _article(
            f"sha_{q_hash_id}",
            "#️⃣ SHA-256 хеш",
            sha[:48] + "…",
            f"#️⃣ <b>SHA-256:</b>\n<code>{sha}</code>",
        )
    )
    results.append(
        _article(
            f"b64_{q_hash_id}",
            "📡 Base64 Encode",
            b64[:60],
            f"📡 <b>Base64:</b> <code>{esc(b64)}</code>",
        )
    )
    results.append(
        _article(
            f"morse_{q_hash_id}",
            "📡 Азбука Морзе",
            morse[:60],
            f"📡 <b>Морзе:</b> <code>{esc(morse)}</code>",
        )
    )

    await db.record_tool_use(inline_query.from_user.id, "inline_query", "dev", "inline", q[:40], xp_gain=5)
    await inline_query.answer(results[:10], cache_time=1, is_personal=True)
