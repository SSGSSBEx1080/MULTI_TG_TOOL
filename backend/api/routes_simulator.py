from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any

from aiogram.types import CallbackQuery, Chat, Document, InlineQuery, Message, PhotoSize, Update, User
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from backend.bot.factory import bot_manager
from backend.config import DEFAULT_DEMO_USER_ID

router = APIRouter(prefix="/api/sim", tags=["simulator"])


def _sim_user(user_id: int = DEFAULT_DEMO_USER_ID, first_name: str = "Гость") -> User:
    return User(id=user_id, is_bot=False, first_name=first_name, username="guest_user")


def _sim_chat(user_id: int = DEFAULT_DEMO_USER_ID, first_name: str = "Гость") -> Chat:
    return Chat(id=user_id, type="private", first_name=first_name, username="guest_user")


def _snapshot(user_id: int) -> dict[str, Any]:
    sess = bot_manager.sim_session
    toast = sess.last_toast.pop(0, None)
    return {
        "bot": {
            "id": sess.bot_user.id,
            "first_name": sess.bot_user.first_name,
            "username": sess.bot_user.username,
        },
        "messages": sess.get_chat_history(user_id),
        "commands": sess.registered_commands,
        "api_logs": list(sess.api_logs)[:30],
        "toast": toast,
    }


@router.get("/state")
async def get_sim_state(user_id: int = DEFAULT_DEMO_USER_ID) -> dict[str, Any]:
    sess = bot_manager.sim_session
    if not sess.get_chat_history(user_id):
        # Bootstrap with /start automatically so Simulator opens alive & ready!
        u = _sim_user(user_id)
        c = _sim_chat(user_id)
        msg_id = sess.append_user_message(user_id, "/start")
        upd = Update(
            update_id=sess.next_update_id(),
            message=Message(
                message_id=msg_id,
                date=datetime.now(timezone.utc),
                chat=c,
                from_user=u,
                text="/start",
            ),
        )
        await bot_manager.dp.feed_update(bot_manager.sim_bot, upd)
    return _snapshot(user_id)


class SimTextReq(BaseModel):
    text: str
    user_id: int = DEFAULT_DEMO_USER_ID


@router.post("/send-text")
async def sim_send_text(req: SimTextReq) -> dict[str, Any]:
    sess = bot_manager.sim_session
    u = _sim_user(req.user_id)
    c = _sim_chat(req.user_id)
    msg_id = sess.append_user_message(req.user_id, req.text)
    upd = Update(
        update_id=sess.next_update_id(),
        message=Message(
            message_id=msg_id,
            date=datetime.now(timezone.utc),
            chat=c,
            from_user=u,
            text=req.text,
        ),
    )
    await bot_manager.dp.feed_update(bot_manager.sim_bot, upd)
    return _snapshot(req.user_id)


class SimCallbackReq(BaseModel):
    message_id: int
    callback_data: str
    user_id: int = DEFAULT_DEMO_USER_ID


@router.post("/callback")
async def sim_callback(req: SimCallbackReq) -> dict[str, Any]:
    sess = bot_manager.sim_session
    u = _sim_user(req.user_id)
    c = _sim_chat(req.user_id)
    history = sess.get_chat_history(req.user_id)
    target = next((m for m in reversed(history) if m["message_id"] == req.message_id), None)

    is_media = bool(target and target.get("media_type"))
    msg_obj = Message(
        message_id=req.message_id,
        date=datetime.now(timezone.utc),
        chat=c,
        from_user=sess.bot_user,
        text=None if is_media else (target["text"] if target else ""),
        caption=(target["text"] if target else "") if is_media else None,
    )
    cb = CallbackQuery(
        id=f"cb_{secrets.token_hex(6)}",
        from_user=u,
        chat_instance=f"ci_{req.user_id}",
        message=msg_obj,
        data=req.callback_data,
    )
    upd = Update(update_id=sess.next_update_id(), callback_query=cb)
    await bot_manager.dp.feed_update(bot_manager.sim_bot, upd)
    return _snapshot(req.user_id)


@router.post("/upload")
async def sim_upload(
    file: UploadFile = File(...),
    mode: str = Form("auto"),  # auto | photo | document
    user_id: int = Form(DEFAULT_DEMO_USER_ID),
) -> dict[str, Any]:
    sess = bot_manager.sim_session
    raw = await file.read(15 * 1024 * 1024 + 1)
    if len(raw) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Файл слишком большой (максимум 15 МБ)")
    fname = file.filename or "upload.bin"
    mime = file.content_type or "application/octet-stream"
    reg = sess.register_uploaded_file(fname, raw, mime_type=mime)

    u = _sim_user(user_id)
    c = _sim_chat(user_id)

    is_image = mime.startswith("image/") or fname.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))
    # Keep PNG files sent in document mode lossless so LSB Steganography preserves exact LSB bits!
    send_as_photo = (mode == "photo") or (mode == "auto" and is_image and not fname.lower().endswith(".png"))

    if send_as_photo:
        msg_id = sess.append_user_message(
            user_id,
            text="",
            media_url=reg["media_url"],
            media_type="photo",
            file_name=fname,
        )
        msg = Message(
            message_id=msg_id,
            date=datetime.now(timezone.utc),
            chat=c,
            from_user=u,
            photo=[
                PhotoSize(
                    file_id=reg["file_id"],
                    file_unique_id=reg["file_unique_id"],
                    width=800,
                    height=800,
                    file_size=reg["file_size"],
                )
            ],
        )
    else:
        msg_id = sess.append_user_message(
            user_id,
            text="",
            media_url=reg["media_url"],
            media_type="document",
            file_name=fname,
        )
        msg = Message(
            message_id=msg_id,
            date=datetime.now(timezone.utc),
            chat=c,
            from_user=u,
            document=Document(
                file_id=reg["file_id"],
                file_unique_id=reg["file_unique_id"],
                file_name=fname,
                mime_type=mime,
                file_size=reg["file_size"],
            ),
        )

    upd = Update(update_id=sess.next_update_id(), message=msg)
    await bot_manager.dp.feed_update(bot_manager.sim_bot, upd)
    return _snapshot(user_id)


class SimInlineReq(BaseModel):
    query: str = ""
    user_id: int = DEFAULT_DEMO_USER_ID


@router.post("/inline")
async def sim_inline_query(req: SimInlineReq) -> dict[str, Any]:
    sess = bot_manager.sim_session
    u = _sim_user(req.user_id)
    iq = InlineQuery(
        id=f"iq_{secrets.token_hex(6)}",
        from_user=u,
        query=req.query,
        offset="",
    )
    upd = Update(update_id=sess.next_update_id(), inline_query=iq)
    await bot_manager.dp.feed_update(bot_manager.sim_bot, upd)
    return {
        "query": req.query,
        "results": sess.last_inline_results,
        "api_logs": list(sess.api_logs)[:30],
    }


@router.post("/reset")
async def sim_reset(user_id: int = DEFAULT_DEMO_USER_ID) -> dict[str, Any]:
    bot_manager.sim_session.clear_chat(user_id)
    return await get_sim_state(user_id)
