from __future__ import annotations

import hashlib
import hmac
import json
import time
from typing import Any
from urllib.parse import parse_qsl, unquote

from fastapi import Request

from backend.config import BOT_TOKEN, DEFAULT_DEMO_USER_ID
from backend.database import db

_INIT_DATA_CACHE: dict[tuple[str, str], tuple[float, dict[str, Any]]] = {}
_ENSURED_USERS_TTL: dict[tuple[str, int, str, str, bool], float] = {}
_CACHE_TTL_SEC = 180.0
_MAX_CACHE_ITEMS = 256


def _parse_and_verify_init_data(init_data: str, bot_token: str) -> dict[str, Any] | None:
    if not init_data:
        return None

    now = time.monotonic()
    cache_key = (init_data, bot_token)
    cached = _INIT_DATA_CACHE.get(cache_key)
    if cached and (now - cached[0]) < _CACHE_TTL_SEC:
        return cached[1]

    try:
        pairs = dict(parse_qsl(init_data, keep_blank_values=True))
    except Exception:
        return None

    user_json = pairs.get("user")
    if not user_json:
        return None

    # Strictly require and verify HMAC-SHA256 signature whenever bot_token is configured
    given_hash = pairs.pop("hash", "")
    if bot_token:
        if not given_hash:
            return None
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
        secret_key = hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()
        computed_hash = hmac.new(secret_key, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(computed_hash, given_hash):
            return None

    try:
        user_obj = json.loads(user_json)
        if isinstance(user_obj, dict) and user_obj.get("id"):
            if len(_INIT_DATA_CACHE) >= _MAX_CACHE_ITEMS:
                _INIT_DATA_CACHE.clear()
            _INIT_DATA_CACHE[cache_key] = (now, user_obj)
            return user_obj
    except Exception:
        return None
    return None


async def _ensure_user_cached(uid: int, username: str, first_name: str, is_real: bool) -> None:
    now = time.monotonic()
    key = (str(db.db_path), uid, username, first_name, is_real)
    last_ts = _ENSURED_USERS_TTL.get(key)
    if last_ts and (now - last_ts) < 90.0:
        return
    await db.ensure_user(uid, username=username, first_name=first_name, is_real=is_real)
    if len(_ENSURED_USERS_TTL) >= _MAX_CACHE_ITEMS:
        _ENSURED_USERS_TTL.clear()
    _ENSURED_USERS_TTL[key] = now


async def resolve_api_user(request: Request, fallback_id: int = DEFAULT_DEMO_USER_ID) -> int:
    """
    Resolves the calling user from Telegram WebApp initData (real Telegram user -> is_real=True),
    or falls back to browser session ID (is_real=False so browser guests never pollute Leaderboard).
    """
    saved_token = await db.get_setting("bot_token", BOT_TOKEN)

    init_data = (request.headers.get("X-Telegram-Init-Data") or "").strip()
    if init_data:
        tg_user = _parse_and_verify_init_data(init_data, saved_token)
        if tg_user:
            uid = int(tg_user["id"])
            uname = str(tg_user.get("username") or "")
            fname = str(tg_user.get("first_name") or "Пользователь")
            await _ensure_user_cached(uid, username=uname, first_name=fname, is_real=True)
            return uid

    # Fallback: unsigned Telegram user header ONLY in local dev when no bot_token is configured anywhere
    raw_tg_user = (request.headers.get("X-Telegram-User") or "").strip()
    if raw_tg_user and not saved_token:
        try:
            u = json.loads(unquote(raw_tg_user))
            if u.get("id"):
                uid = int(u["id"])
                await _ensure_user_cached(
                    uid,
                    username=str(u.get("username") or ""),
                    first_name=str(u.get("first_name") or "Пользователь"),
                    is_real=True,
                )
                return uid
        except Exception:
            pass

    # Browser guest session ID (isolated per browser, is_real=False -> excluded from global Top)
    guest_hdr = (request.headers.get("X-Guest-Id") or "").strip()
    if guest_hdr.isdigit():
        gid = int(guest_hdr)
        if gid >= 900_000_000_000:
            await _ensure_user_cached(gid, username="", first_name="Гость", is_real=False)
            return gid

    return fallback_id
