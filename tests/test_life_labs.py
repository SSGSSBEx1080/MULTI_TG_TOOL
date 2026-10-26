from __future__ import annotations

import hashlib
import hmac
import json
import math
from urllib.parse import urlencode

import pytest
from httpx import ASGITransport, AsyncClient

from backend.api.app import create_app
from backend.database import db


def signed_init_data(token: str, user_id: int, username: str, first_name: str) -> str:
    fields = {
        "auth_date": "1792950000",
        "query_id": f"QID{user_id}",
        "user": json.dumps({"id": user_id, "first_name": first_name, "username": username}, separators=(",", ":")),
    }
    check = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    signature = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return urlencode({**fields, "hash": signature})


@pytest.mark.asyncio
async def test_everyday_labs_public_chat_and_calculators(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(db, "db_path", tmp_path / "everyday.db")
    await db.init()
    token = "123456789:TEST_EVERYDAY_CHAT_HMAC_KEY"
    await db.set_setting("bot_token", token)
    h1 = {"X-Telegram-Init-Data": signed_init_data(token, 555001, "alex", "Алекс")}
    h2 = {"X-Telegram-Init-Data": signed_init_data(token, 555002, "maria", "Мария")}
    try:
        transport = ASGITransport(app=create_app())
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            catalog = (await client.get("/api/life/catalog")).json()
            for section in ("foods", "vitamins", "minerals", "anatomy", "bones", "hormones", "units", "ports", "sockets", "moons", "welding", "recipes"):
                assert catalog[section]
            assert len(catalog["foods"]) >= 80 and len(catalog["units"]) >= 90
            assert len(catalog["recipes"]) >= 12 and len(catalog["bones"]) >= 25 and len(catalog["hormones"]) >= 25
            foods_by_name = {row["name"]: row for row in catalog["foods"]}
            assert len(foods_by_name) == len(catalog["foods"])
            for food in foods_by_name.values():
                assert all(math.isfinite(food[key]) and food[key] >= 0 for key in ("kcal", "kj", "protein", "fat", "carbs", "fiber", "he"))
            units_by_id = {unit["id"]: unit for unit in catalog["units"]}
            assert len(units_by_id) == len(catalog["units"])
            assert all(math.isfinite(unit["scale"]) and unit["scale"] > 0 and math.isfinite(unit["offset"]) for unit in units_by_id.values())
            recipes_by_id = {recipe["id"]: recipe for recipe in catalog["recipes"]}
            assert len(recipes_by_id) == len(catalog["recipes"])
            assert all(item["name"] in foods_by_name for recipe in recipes_by_id.values() for item in recipe["ingredients"])
            assert any(x["planet"] == "Церера" and x["count"] == "0" for x in catalog["moons"])

            nutrition = await client.post("/api/life/nutrition", json={"food": "Овсяные хлопья, сухие", "grams": 50})
            assert nutrition.status_code == 200
            assert nutrition.json()["kcal"] == 183.0
            assert nutrition.json()["kj"] == 765.5
            assert nutrition.json()["bread_units"] == 2.5
            assert (await client.post("/api/life/nutrition", json={"food": "missing", "grams": 50})).status_code == 404

            sleep = await client.post("/api/life/sleep", json={"wake_time": "07:30", "latency_min": 15})
            assert sleep.status_code == 200 and [x["bedtime"] for x in sleep.json()["options"]] == ["01:15", "23:45", "22:15"]
            bouquet = await client.post("/api/life/bouquet", json={"stems": [{"name": "Роза", "count": 5, "price": 200}], "wrapping": 100, "labor": 50, "markup_pct": 20})
            assert bouquet.status_code == 200 and bouquet.json()["suggested_price"] == 1380

            unit = await client.post("/api/life/convert", json={"value": 100, "from_unit": "celsius", "to_unit": "fahrenheit"})
            assert unit.status_code == 200 and unit.json()["result"] == pytest.approx(212)
            mile = await client.post("/api/life/convert", json={"value": 1, "from_unit": "mi", "to_unit": "km"})
            assert mile.status_code == 200 and mile.json()["result"] == pytest.approx(1.609344)
            assert (await client.post("/api/life/convert", json={"value": -40, "from_unit": "celsius", "to_unit": "fahrenheit"})).json()["result"] == pytest.approx(-40)
            assert (await client.post("/api/life/convert", json={"value": 1, "from_unit": "km", "to_unit": "kg"})).status_code == 400
            assert (await client.post("/api/life/convert", json={"value": -300, "from_unit": "celsius", "to_unit": "kelvin"})).status_code == 400
            assert (await client.get("/api/life/recipes?q=веганское")).json()["count"] == 4
            assert (await client.get("/api/life/recipes?q=лосось")).json()["count"] == 1
            recipe = await client.get("/api/life/recipes/chicken-rice-bowl?servings=2")
            assert recipe.status_code == 200 and recipe.json()["ingredients"][0]["grams"] == 240
            assert recipe.json()["nutrition"]["kcal"] > 0
            assert (await client.get("/api/life/recipes/missing")).status_code == 404
            assert (await client.get("/api/life/recipes/chicken-rice-bowl?servings=21")).status_code == 400

            unauthorized = await client.post("/api/life/chat", json={"user_id": 555001, "topic": "science", "text": "Spoof"})
            assert unauthorized.status_code == 401
            first = await client.post("/api/life/chat", headers=h1, json={"user_id": 555001, "topic": "science", "text": "Первое сообщение"})
            assert first.status_code == 200 and first.json()["messages"][-1]["sender_name"] == "Алекс"
            msg = first.json()["messages"][-1]
            reacted = await client.post(f"/api/life/chat/{msg['id']}/reaction", headers=h1, json={"user_id": 555001, "topic": "science", "emoji": "🔥"})
            assert reacted.status_code == 200 and reacted.json()["messages"][-1]["reactions"][0]["me"]
            reply = await client.post("/api/life/chat", headers=h2, json={"user_id": 555002, "topic": "science", "text": "Ответ", "reply_to_id": msg["id"]})
            assert reply.status_code == 200 and "Первое сообщение" in reply.json()["messages"][-1]["reply_preview"]
            forbidden = await client.post(f"/api/life/chat/{msg['id']}/action", headers=h2, json={"user_id": 555002, "topic": "science", "action": "edit", "text": "не своё"})
            assert forbidden.status_code == 400
            edited = await client.post(f"/api/life/chat/{msg['id']}/action", headers=h1, json={"user_id": 555001, "topic": "science", "action": "edit", "text": "Исправлено"})
            assert edited.status_code == 200 and edited.json()["messages"][0]["text"] == "Исправлено"
            pinned = await client.post(f"/api/life/chat/{msg['id']}/action", headers=h1, json={"user_id": 555001, "topic": "science", "action": "pin"})
            assert pinned.status_code == 200 and pinned.json()["pinned"]["id"] == msg["id"]
    finally:
        await db.close()
