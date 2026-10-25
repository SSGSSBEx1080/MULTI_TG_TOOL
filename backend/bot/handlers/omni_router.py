from __future__ import annotations

from aiogram import F, Router
from aiogram.types import InlineKeyboardButton, Message
from aiogram.utils.keyboard import InlineKeyboardBuilder

from backend.bot.handlers.helpers import esc, render_hud, store_media_ref
from backend.bot.keyboards import pdf_context_kb, photo_context_kb
from backend.database import db
from backend.tools.omni_detector import smart_omni_detect

router = Router(name="omni_router")


@router.message(F.photo)
async def handle_dropped_photo(message: Message) -> None:
    best = message.photo[-1]
    key = store_media_ref(best.file_id, filename="photo.jpg")
    await render_hud(
        message,
        f"<b>🖼️ Изображение получено ({best.width}×{best.height})!</b>\n"
        f"<blockquote>⚡ <b>Smart Media Drop:</b> выберите действие в 1 нажатие ниже</blockquote>",
        reply_markup=photo_context_kb(key),
    )


@router.message(F.document)
async def handle_dropped_document(message: Message) -> None:
    doc = message.document
    fname = (doc.file_name or "file").lower()
    mime = (doc.mime_type or "").lower()
    key = store_media_ref(doc.file_id, filename=doc.file_name or "document")

    if fname.endswith(".pdf") or "pdf" in mime:
        await render_hud(
            message,
            f"<b>📄 PDF документ «{esc(doc.file_name)}» получен!</b>\n"
            f"<blockquote>⚡ Выберите операцию над PDF файлом:</blockquote>",
            reply_markup=pdf_context_kb(key),
        )
        return

    if fname.endswith((".png", ".jpg", ".jpeg", ".webp", ".bmp")) or mime.startswith("image/"):
        await render_hud(
            message,
            f"<b>🖼️ Файл изображения «{esc(doc.file_name)}» получен без сжатия!</b>\n"
            f"<blockquote>Идеально подходит для извлечения/записи LSB-стеганографии и чистки EXIF:</blockquote>",
            reply_markup=photo_context_kb(key),
        )
        return

    await message.answer(
        f"📦 Получен файл <code>{esc(doc.file_name)}</code> ({round((doc.file_size or 0) / 1024, 1)} КБ).\n"
        f"Поддерживаются изображения (PNG/JPG/WEBP) и PDF-документы.",
        parse_mode="HTML",
    )


@router.message(F.text)
async def handle_smart_omni_text(message: Message) -> None:
    raw = (message.text or "").strip()
    if not raw:
        return

    det = smart_omni_detect(raw)
    kind = det["kind"]
    res = det["result"]
    uid = message.from_user.id

    builder = InlineKeyboardBuilder()
    builder.row(
        InlineKeyboardButton(text="✨ Сделать QR из этого", callback_data="tool:open:qr_studio"),
        InlineKeyboardButton(text="🏠 Главное меню", callback_data="nav:home"),
    )

    if kind == "layout_fix":
        await db.record_tool_use(uid, "layout_fixer", "text", "omni", "Auto Layout Fix")
        await render_hud(
            message,
            f"<b>{esc(det['title'])}</b>\n"
            f"<blockquote>⚡ Smart Omni-Input распознал перепутанную раскладку</blockquote>\n\n"
            f"<code>{esc(res['fixed'])}</code>",
            reply_markup=builder.as_markup(),
        )
        return

    if kind == "smart_unit":
        await db.record_tool_use(uid, "smart_units", "calc", "omni", raw[:35])
        conv_lines = "\n".join(
            f"{'🔥' if c['popular'] else '▫️'} <code>{c['formatted']}</code> — <b>{esc(c['label'])}</b>"
            for c in res["conversions"][:8]
        )
        hint_html = f"\n\n💡 <i>{esc(res['real_world_hint'])}</i>" if res.get("real_world_hint") else ""
        await render_hud(
            message,
            f"<b>{esc(det['title'])}</b>\n"
            f"<blockquote>⚡ Авто-перевод по популярности ({esc(res['category_title'])})</blockquote>\n\n"
            f"{conv_lines}{hint_html}",
            reply_markup=builder.as_markup(),
        )
        return

    if kind == "rhyme":
        await db.record_tool_use(uid, "rhyme_gen", "text", "omni", res["word"])
        exact = ", ".join(res["exact_rhymes"][:12]) or "—"
        asson = ", ".join(res["assonance_rhymes"][:10]) or "—"
        await render_hud(
            message,
            f"<b>{esc(det['title'])}</b> (слогов: {res['syllables']})\n\n"
            f"💎 <b>Точные:</b> {esc(exact)}\n"
            f"🎵 <b>Созвучные:</b> {esc(asson)}",
            reply_markup=builder.as_markup(),
        )
        return

    if kind == "population":
        await db.record_tool_use(uid, "population_hub", "knowledge", "omni", raw[:30])
        pl_lines = "\n\n".join(
            f"📍 <b>{esc(p['name'])}</b> ({esc(p['type'])})\n👥 Население: <code>{p['formatted_pop']}</code> чел. — <i>{esc(p['note'])}</i>"
            for p in res["places"][:3]
        )
        await render_hud(
            message,
            f"<b>{esc(det['title'])}</b>\n\n{pl_lines}",
            reply_markup=builder.as_markup(),
        )
        return

    if kind == "math":
        await db.record_tool_use(uid, "smart_calc", "calc", "omni", raw[:40])
        bases_str = f"\nHEX: <code>{res['bases']['hex']}</code> • BIN: <code>{res['bases']['bin']}</code>" if res.get("bases") else ""
        await render_hud(
            message,
            f"<b>📐 {esc(det['title'])}</b>\n"
            f"<blockquote>Выражение: <code>{esc(raw)}</code></blockquote>\n\n"
            f"Ответ: <code>{esc(res['formatted'])}</code>{bases_str}",
            reply_markup=builder.as_markup(),
        )
        return

    if kind == "subnet":
        await db.record_tool_use(uid, "subnet_calc", "calc", "omni", res["cidr"])
        await render_hud(
            message,
            f"<b>{esc(det['title'])}</b>\n\n"
            f"• Маска: <code>{res['netmask']}</code>\n"
            f"• Broadcast: <code>{res['broadcast_address']}</code>\n"
            f"• Хосты ({res['usable_hosts']}): <code>{res['first_host']} — {res['last_host']}</code>",
            reply_markup=builder.as_markup(),
        )
        return

    if kind == "json":
        await db.record_tool_use(uid, "json_yaml", "dev", "omni", "Auto JSON")
        await render_hud(
            message,
            f"<b>{esc(det['title'])}</b>\n\n<pre>{esc(res['pretty'])}</pre>",
            reply_markup=builder.as_markup(),
        )
        return

    if kind == "jwt":
        import json
        await db.record_tool_use(uid, "jwt_totp", "security", "omni", "Auto JWT")
        pld = json.dumps(res["payload"], ensure_ascii=False, indent=2)
        await render_hud(
            message,
            f"<b>{esc(det['title'])}</b>\n"
            f"<blockquote>exp: {esc(res['exp_status'])}</blockquote>\n\n"
            f"<pre>{esc(pld)}</pre>",
            reply_markup=builder.as_markup(),
        )
        return

    if kind == "cron":
        await db.record_tool_use(uid, "cron_uuid", "dev", "omni", raw)
        runs = "\n".join(f"• <code>{r}</code>" for r in res["next_runs"][:3])
        await render_hud(
            message,
            f"<b>{esc(det['title'])}</b>\n"
            f"<blockquote>{esc(res['human_ru'])}</blockquote>\n\n{runs}",
            reply_markup=builder.as_markup(),
        )
        return

    if kind == "url_payload":
        import asyncio
        from backend.tools.qr_studio import generate_styled_qr
        from aiogram.types import BufferedInputFile

        png = await asyncio.to_thread(
            generate_styled_qr, raw, theme="cyber", shape="rounded", badge_text="MT", caption=raw[:42]
        )
        await db.record_tool_use(uid, "qr_studio", "qr", "omni", raw[:40])
        await message.answer_photo(
            BufferedInputFile(png, filename="smart_qr.png"),
            caption=f"⚡ <b>QR-код по ссылке:</b>\n<code>{esc(raw[:100])}</code>",
            parse_mode="HTML",
            reply_markup=builder.as_markup(),
        )
        return

    if kind == "hash":
        await render_hud(
            message,
            f"<b>{esc(det['title'])}</b>\n\nДлина: {res['length']} hex-символов.",
            reply_markup=builder.as_markup(),
        )
        return

    # Intuitive Omni-Search across Tools, Constitutions, Religions & Encyclopedia + Text Summary
    from backend.tools.knowledge_hub import intuitive_omni_search

    omni = intuitive_omni_search(raw)
    builder_txt = InlineKeyboardBuilder()
    for t_hit in omni.get("tools", [])[:3]:
        emoji = t_hit.get("emoji", "🔹")
        builder_txt.row(
            InlineKeyboardButton(text=f"{emoji} {t_hit['title'][:36]}", callback_data=f"tool:open:{t_hit['tool_id']}")
        )
    builder_txt.row(
        InlineKeyboardButton(text="🌐 Спросить ИИ с Интернетом", callback_data="tool:open:ai_web_chat"),
    )
    builder_txt.row(
        InlineKeyboardButton(text="⌨️ Сменить раскладку", callback_data="tool:open:layout_fixer"),
        InlineKeyboardButton(text="✨ Шрифты", callback_data="tool:open:font_styler"),
    )
    builder_txt.row(
        InlineKeyboardButton(text="📚 Справочники", callback_data="nav:cat:knowledge"),
        InlineKeyboardButton(text="🏠 Главное меню", callback_data="nav:home"),
    )

    top_article = (omni.get("articles") or [None])[0]
    article_block = ""
    if top_article:
        article_block = (
            f"\n\n<b>{esc(top_article['title'])}</b>\n"
            f"<i>{esc(top_article['kind'])}</i>\n"
            f"{esc(top_article['snippet'][:380])}"
        )

    await render_hud(
        message,
        f"<b>🔎 Поиск и разбор запроса</b>\n"
        f"<blockquote>Слов: <b>{res['words']}</b> • Символов: <b>{res['chars_total']}</b></blockquote>"
        f"{article_block}",
        reply_markup=builder_txt.as_markup(),
    )
