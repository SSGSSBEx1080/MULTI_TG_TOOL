from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from backend.api.app import create_app
from backend.database import Database, db


@pytest.mark.asyncio
async def test_todo_migration_keeps_legacy_rows_and_adds_safe_defaults(tmp_path) -> None:
    import aiosqlite

    path = tmp_path / "legacy.sqlite"
    conn = await aiosqlite.connect(path)
    await conn.execute(
        """CREATE TABLE todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            done INTEGER DEFAULT 0,
            priority TEXT DEFAULT 'normal',
            created_at REAL NOT NULL
        )"""
    )
    await conn.execute(
        "INSERT INTO todos (user_id, text, done, priority, created_at) VALUES (?, ?, ?, ?, ?)",
        (424242, "Legacy task " + ("with a long existing description " * 8), 0, "high", 1700000000.0),
    )
    await conn.commit()
    await conn.close()

    database = Database(path)
    await database.init()
    try:
        items = await database.list_todos(424242)
        assert len(items) == 1
        assert items[0]["text"].startswith("Legacy task")
        assert len(items[0]["text"]) > 200
        assert items[0]["priority"] == "high"
        assert items[0]["due_date"] is None
        assert items[0]["category"] == "general"
        assert items[0]["estimated_minutes"] == 0
        updated_legacy = await database.update_todo(424242, items[0]["id"], {"due_date": "2030-01-01"})
        assert updated_legacy is not None
        assert updated_legacy["text"] == items[0]["text"]
    finally:
        await database.close()


@pytest.mark.asyncio
async def test_todos_validate_metadata_and_update_only_the_owners_row(tmp_path) -> None:
    database = Database(tmp_path / "todos.sqlite")
    await database.init()
    try:
        task = await database.add_todo(
            98765,
            "  Prepare release  ",
            "urgent",
            "2030-04-05",
            "work",
            75,
        )
        assert task["text"] == "Prepare release"
        assert task["priority"] == "urgent"
        assert task["due_date"] == "2030-04-05"
        assert task["category"] == "work"
        assert task["estimated_minutes"] == 75

        changed = await database.update_todo(
            98765,
            task["id"],
            {"due_date": None, "estimated_minutes": 30, "category": "study"},
        )
        assert changed is not None
        assert changed["due_date"] is None
        assert changed["estimated_minutes"] == 30
        assert changed["category"] == "study"
        assert changed["text"] == "Prepare release"
        assert await database.update_todo(12345, task["id"], {"text": "Not yours"}) is None

        invalid_values = [
            {"text": "   "},
            {"text": "x" * 201},
            {"priority": "critical"},
            {"due_date": "2030-02-30"},
            {"category": "misc"},
            {"estimated_minutes": -1},
            {"estimated_minutes": 1441},
        ]
        for changes in invalid_values:
            with pytest.raises(ValueError):
                await database.update_todo(98765, task["id"], changes)
        with pytest.raises(ValueError):
            await database.add_todo(98765, "", estimated_minutes=15)
    finally:
        await database.close()


@pytest.mark.asyncio
async def test_todo_api_create_edit_filtering_fields_and_existing_actions(tmp_path, monkeypatch) -> None:
    await db.close()
    monkeypatch.setattr(db, "db_path", tmp_path / "workspace.sqlite")
    await db.init()
    app = create_app()
    transport = ASGITransport(app=app)
    headers = {"X-Guest-Id": "900000123987"}
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            created_response = await client.post(
                "/api/workspace/todos",
                headers=headers,
                json={
                    "text": "Submit report",
                    "priority": "high",
                    "due_date": "2030-05-20",
                    "category": "work",
                    "estimated_minutes": 40,
                },
            )
            assert created_response.status_code == 200
            task = created_response.json()["todo"]
            assert task["category"] == "work"
            assert task["estimated_minutes"] == 40

            invalid_date = await client.post(
                "/api/workspace/todos", headers=headers, json={"text": "Bad date", "due_date": "not-a-date"}
            )
            assert invalid_date.status_code == 400
            invalid_estimate = await client.post(
                "/api/workspace/todos", headers=headers, json={"text": "Too long", "estimated_minutes": 1441}
            )
            assert invalid_estimate.status_code == 422
            invalid_category = await client.post(
                "/api/workspace/todos", headers=headers, json={"text": "Bad category", "category": "misc"}
            )
            assert invalid_category.status_code == 422

            updated = await client.patch(
                f"/api/workspace/todos/{task['id']}",
                headers=headers,
                json={"text": "Submit the report", "due_date": None, "estimated_minutes": 60},
            )
            assert updated.status_code == 200
            assert updated.json()["todo"]["text"] == "Submit the report"
            assert updated.json()["todo"]["due_date"] is None
            assert updated.json()["todo"]["estimated_minutes"] == 60
            missing = await client.patch("/api/workspace/todos/999999", headers=headers, json={"text": "Missing"})
            assert missing.status_code == 404

            toggled = await client.post(f"/api/workspace/todos/{task['id']}/toggle", headers=headers, json={})
            assert toggled.status_code == 200
            assert toggled.json()["todos"][0]["done"] == 1
            cleared = await client.post("/api/workspace/todos/clear-done", headers=headers, json={})
            assert cleared.status_code == 200
            assert cleared.json()["removed"] == 1
            assert cleared.json()["todos"] == []
    finally:
        await db.close()
