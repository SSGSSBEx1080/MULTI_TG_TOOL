from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from backend.api.tg_auth import resolve_api_user, resolve_verified_telegram_user
from backend.config import DEFAULT_DEMO_USER_ID
from backend.database import db
from backend.tools.everyday_labs import (
    FOOD_DB, calculate_flower_bouquet, calculate_nutrition,
    calculate_sleep_windows, convert_measurement, get_recipes, life_catalog, scale_recipe,
)

router = APIRouter(tags=["everyday-life"])
ALLOWED_CHAT_TOPICS = {"general", "games", "science", "music"}


def _chat_topic(topic: str) -> str:
    cleaned = (topic or "general").strip().lower()
    if cleaned not in ALLOWED_CHAT_TOPICS:
        raise HTTPException(status_code=400, detail="Неизвестная тема чата")
    return cleaned


@router.get("/api/life/catalog")
async def catalog() -> dict[str, Any]:
    return life_catalog()


class UnitConversionReq(BaseModel):
    value: float = Field(allow_inf_nan=False, ge=-1e30, le=1e30)
    from_unit: str = Field(min_length=1, max_length=24)
    to_unit: str = Field(min_length=1, max_length=24)


@router.post("/api/life/convert")
async def convert_units(req: UnitConversionReq) -> dict[str, Any]:
    try:
        return convert_measurement(req.value, req.from_unit, req.to_unit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/api/life/recipes")
async def recipes(q: str = "", category: str = "") -> dict[str, Any]:
    items = get_recipes(q[:80], category[:40])
    return {"count": len(items), "items": items}


@router.get("/api/life/recipes/{recipe_id}")
async def recipe_detail(recipe_id: str, servings: float = 1.0) -> dict[str, Any]:
    try:
        return scale_recipe(recipe_id, servings)
    except ValueError as exc:
        status = 404 if str(exc) == "Рецепт не найден" else 400
        raise HTTPException(status_code=status, detail=str(exc))


@router.get("/api/life/foods")
async def foods(q: str = "") -> dict[str, Any]:
    term = q.strip().casefold()[:80]
    items = [x for x in FOOD_DB if not term or term in x["name"].casefold()]
    return {"count": len(items), "items": items}


class NutritionReq(BaseModel):
    food: str = Field(min_length=1, max_length=120)
    grams: float = Field(ge=0, le=10000)


@router.post("/api/life/nutrition")
async def nutrition(req: NutritionReq) -> dict[str, Any]:
    food = next((row for row in FOOD_DB if row["name"] == req.food), None)
    if food is None:
        raise HTTPException(status_code=404, detail="Продукт не найден в справочнике")
    return calculate_nutrition(food, req.grams)


class SleepReq(BaseModel):
    wake_time: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    latency_min: int = Field(default=15, ge=0, le=120)


@router.post("/api/life/sleep")
async def sleep(req: SleepReq) -> dict[str, Any]:
    return calculate_sleep_windows(req.wake_time, req.latency_min)


class BouquetReq(BaseModel):
    stems: list[dict[str, Any]] = Field(default_factory=list, max_length=30)
    wrapping: float = Field(default=8, ge=0, le=100000)
    labor: float = Field(default=12, ge=0, le=100000)
    markup_pct: float = Field(default=25, ge=0, le=300)


@router.post("/api/life/bouquet")
async def bouquet(req: BouquetReq) -> dict[str, Any]:
    return calculate_flower_bouquet(req.stems, req.wrapping, req.labor, req.markup_pct)


@router.get("/api/life/chat")
async def chat_feed(request: Request, topic: str = "general", user_id: int = DEFAULT_DEMO_USER_ID) -> dict[str, Any]:
    uid = await resolve_api_user(request, user_id)
    return await db.get_public_chat_messages(topic=topic, viewer_id=uid)


class ChatPostReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    topic: str = Field(default="general", max_length=32)
    text: str = Field(default="", max_length=1200)
    reply_to_id: int = Field(default=0, ge=0)
    sticker: str = Field(default="", max_length=24)


@router.post("/api/life/chat")
async def chat_post(req: ChatPostReq, request: Request) -> dict[str, Any]:
    uid = await resolve_verified_telegram_user(request)
    try:
        return await db.post_public_chat_message(uid, req.text, req.topic, req.reply_to_id, req.sticker)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


class ChatReactionReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    topic: str = "general"
    emoji: str = Field(max_length=8)


@router.post("/api/life/chat/{message_id}/reaction")
async def chat_reaction(message_id: int, req: ChatReactionReq, request: Request) -> dict[str, Any]:
    uid = await resolve_verified_telegram_user(request)
    return await db.toggle_public_chat_reaction(message_id, uid, req.emoji, _chat_topic(req.topic))


class ChatActionReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    topic: str = "general"
    action: str
    text: str = Field(default="", max_length=1200)


@router.post("/api/life/chat/{message_id}/action")
async def chat_action(message_id: int, req: ChatActionReq, request: Request) -> dict[str, Any]:
    uid = await resolve_verified_telegram_user(request)
    try:
        return await db.edit_or_pin_public_chat_message(message_id, uid, req.action, req.text, req.topic)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
