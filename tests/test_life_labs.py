from __future__ import annotations

import hashlib
import hmac
import json
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
            for section in ("foods", "vitamins", "anatomy", "hormones", "ports", "sockets", "moons", "welding"):
                assert catalog[section]
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
