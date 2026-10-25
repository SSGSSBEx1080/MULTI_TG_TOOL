from __future__ import annotations

from typing import Any
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from backend.api.tg_auth import resolve_api_user
from backend.config import DEFAULT_DEMO_USER_ID
from backend.database import db

router = APIRouter(prefix="/api/workspace", tags=["workspace"])


@router.get("/state")
async def get_workspace_state(
    request: Request,
    user_id: int = DEFAULT_DEMO_USER_ID,
    search: str = "",
) -> dict[str, Any]:
    uid = await resolve_api_user(request, user_id)
    return await db.get_workspace_bundle(uid, search=search)


class FavToggleReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    tool_id: str


@router.post("/favorites/toggle")
async def api_toggle_fav(req: FavToggleReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    added = await db.toggle_favorite(uid, req.tool_id)
    favorites = await db.list_favorites(uid)
    return {"added": added, "favorites": favorites}


class CreateNoteReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    title: str
    content: str
    tag: str = "general"
    pinned: bool = False


@router.post("/notes")
async def api_create_note(req: CreateNoteReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    note = await db.create_note(uid, req.title, req.content, req.tag, req.pinned)
    await db.record_tool_use(uid, "notes_vault", "workspace", "miniapp", req.title[:30], xp_gain=8)
    return {"note": note, "notes": await db.list_notes(uid)}


@router.post("/notes/{note_id}/pin")
async def api_pin_note(note_id: int, request: Request, user_id: int = DEFAULT_DEMO_USER_ID) -> dict[str, Any]:
    uid = await resolve_api_user(request, user_id)
    await db.toggle_note_pin(uid, note_id)
    return {"notes": await db.list_notes(uid)}


@router.delete("/notes/{note_id}")
@router.post("/notes/{note_id}/delete")
async def api_delete_note(note_id: int, request: Request, user_id: int = DEFAULT_DEMO_USER_ID) -> dict[str, Any]:
    uid = await resolve_api_user(request, user_id)
    await db.delete_note(uid, note_id)
    return {"notes": await db.list_notes(uid)}


class CreateTodoReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    text: str
    priority: str = "normal"


@router.post("/todos")
async def api_create_todo(req: CreateTodoReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Введите текст задачи")
    todo = await db.add_todo(uid, req.text, req.priority)
    await db.record_tool_use(uid, "todo_board", "workspace", "miniapp", req.text[:30], xp_gain=6)
    return {"todo": todo, "todos": await db.list_todos(uid)}


@router.post("/todos/{todo_id}/toggle")
async def api_toggle_todo(todo_id: int, request: Request, user_id: int = DEFAULT_DEMO_USER_ID) -> dict[str, Any]:
    uid = await resolve_api_user(request, user_id)
    todos = await db.toggle_todo(uid, todo_id)
    return {"todos": todos}


@router.delete("/todos/{todo_id}")
@router.post("/todos/{todo_id}/delete")
async def api_delete_todo(todo_id: int, request: Request, user_id: int = DEFAULT_DEMO_USER_ID) -> dict[str, Any]:
    uid = await resolve_api_user(request, user_id)
    await db.delete_todo(uid, todo_id)
    return {"todos": await db.list_todos(uid)}


@router.post("/todos/clear-done")
async def api_clear_done_todos(request: Request, user_id: int = DEFAULT_DEMO_USER_ID) -> dict[str, Any]:
    uid = await resolve_api_user(request, user_id)
    removed = await db.clear_completed_todos(uid)
    return {"removed": removed, "todos": await db.list_todos(uid)}


# --- Habit Tracker Endpoints ---
@router.get("/habits")
async def api_list_habits(request: Request, user_id: int = DEFAULT_DEMO_USER_ID) -> dict[str, Any]:
    uid = await resolve_api_user(request, user_id)
    return {"habits": await db.list_habits(uid)}


class CreateHabitReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    title: str
    icon: str = "✅"
    target_per_week: int = 7


@router.post("/habits")
async def api_create_habit(req: CreateHabitReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        habits = await db.create_habit(uid, req.title, req.icon, req.target_per_week)
        await db.record_tool_use(uid, "habit_tracker", "workspace", "miniapp", req.title[:30], xp_gain=8)
        return {"habits": habits}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


class ToggleHabitReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    date: str | None = None


@router.post("/habits/{habit_id}/toggle")
async def api_toggle_habit(habit_id: int, req: ToggleHabitReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        return await db.toggle_habit_date(uid, habit_id, req.date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/habits/{habit_id}")
@router.post("/habits/{habit_id}/delete")
async def api_delete_habit(habit_id: int, request: Request, user_id: int = DEFAULT_DEMO_USER_ID) -> dict[str, Any]:
    uid = await resolve_api_user(request, user_id)
    habits = await db.delete_habit(uid, habit_id)
    return {"habits": habits}
