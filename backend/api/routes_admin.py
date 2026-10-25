from __future__ import annotations

import hmac
from typing import Any
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from backend.bot.factory import bot_manager
from backend.config import ADMIN_SECRET, BASE_DIR, BOT_TOKEN
from backend.database import db

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _mask_token(tok: str) -> str:
    if not tok or len(tok) < 12:
        return ""
    return f"{tok[:9]}••••••••••{tok[-4:]}"


@router.get("/dashboard")
async def get_admin_dashboard() -> dict[str, Any]:
    analytics = await db.get_analytics()
    saved_tok = await db.get_setting("bot_token", BOT_TOKEN)
    return {
        "analytics": analytics,
        "bot_status": {
            **bot_manager.live_status,
            "masked_token": _mask_token(saved_tok),
            "simulator_active": True,
            "commands_registered": len(bot_manager.sim_session.registered_commands),
        },
    }


class TokenUpdateReq(BaseModel):
    bot_token: str


@router.post("/bot-token")
async def update_bot_token(req: TokenUpdateReq, request: Request) -> dict[str, Any]:
    provided_secret = (request.headers.get("X-Admin-Secret") or "").strip()
    if not ADMIN_SECRET or not hmac.compare_digest(provided_secret, ADMIN_SECRET):
        raise HTTPException(
            status_code=403,
            detail="Управление токеном бота защищено и доступно только через переменные окружения сервера.",
        )

    clean = (req.bot_token or "").strip()
    await db.set_setting("bot_token", clean)

    env_file = BASE_DIR / ".env"
    lines: list[str] = []
    if env_file.exists():
        lines = [ln for ln in env_file.read_text().splitlines() if not ln.startswith("BOT_TOKEN=")]
    if clean:
        lines.append(f"BOT_TOKEN={clean}")
    env_file.write_text("\n".join(lines) + "\n")

    status = await bot_manager.start_live_polling(clean)
    return {
        "bot_status": {
            **status,
            "masked_token": _mask_token(clean),
            "simulator_active": True,
        }
    }
