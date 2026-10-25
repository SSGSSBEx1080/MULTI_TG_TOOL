from __future__ import annotations

from typing import Any
from fastapi import APIRouter
from pydantic import BaseModel

from backend.config import DEFAULT_DEMO_USER_ID
from backend.database import db

router = APIRouter(prefix="/api/workspace", tags=["workspace"])


@router.get("/state")
async def get_workspace_state(user_id: int = DEFAULT_DEMO_USER_ID, search: str = "") -> dict[str, Any]:
    profile = await db.ensure_user(user_id)
    favorites = await db.list_favorites(user_id)
    notes = await db.list_notes(user_id, search=search)
    todos = await db.list_todos(user_id)
    return {
        "profile": profile,
        "favorites": favorites,
        "notes": notes,
        "todos": todos,
    }


class FavToggleReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    tool_id: str


@router.post("/favorites/toggle")
async def api_toggle_fav(req: FavToggleReq) -> dict[str, Any]:
    added = await db.toggle_favorite(req.user_id, req.tool_id)
    favorites = await db.list_favorites(req.user_id)
    return {"added": added, "favorites": favorites}


class CreateNoteReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    title: str
    content: str
    tag: str = "general"
    pinned: bool = False


@router.post("/notes")
async def api_create_note(req: CreateNoteReq) -> dict[str, Any]:
    note = await db.create_note(req.user_id, req.title, req.content, req.tag, req.pinned)
    await db.record_tool_use(req.user_id, "notes_vault", "workspace", "miniapp", req.title[:30], xp_gain=8)
    return {"note": note, "notes": await db.list_notes(req.user_id)}


@router.post("/notes/{note_id}/pin")
async def api_pin_note(note_id: int, user_id: int = DEFAULT_DEMO_USER_ID) -> dict[str, Any]:
    await db.toggle_note_pin(user_id, note_id)
    return {"notes": await db.list_notes(user_id)}


@router.delete("/notes/{note_id}")
async def api_delete_note(note_id: int, user_id: int = DEFAULT_DEMO_USER_ID) -> dict[str, Any]:
    await db.delete_note(user_id, note_id)
    return {"notes": await db.list_notes(user_id)}


class CreateTodoReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    text: str
    priority: str = "normal"


@router.post("/todos")
async def api_create_todo(req: CreateTodoReq) -> dict[str, Any]:
    todo = await db.add_todo(req.user_id, req.text, req.priority)
    await db.record_tool_use(req.user_id, "todo_board", "workspace", "miniapp", req.text[:30], xp_gain=6)
    return {"todo": todo, "todos": await db.list_todos(req.user_id)}


@router.post("/todos/{todo_id}/toggle")
async def api_toggle_todo(todo_id: int, user_id: int = DEFAULT_DEMO_USER_ID) -> dict[str, Any]:
    todos = await db.toggle_todo(user_id, todo_id)
    return {"todos": todos}


@router.delete("/todos/{todo_id}")
async def api_delete_todo(todo_id: int, user_id: int = DEFAULT_DEMO_USER_ID) -> dict[str, Any]:
    await db.delete_todo(user_id, todo_id)
    return {"todos": await db.list_todos(user_id)}


@router.post("/todos/clear-done")
async def api_clear_done_todos(user_id: int = DEFAULT_DEMO_USER_ID) -> dict[str, Any]:
    removed = await db.clear_completed_todos(user_id)
    return {"removed": removed, "todos": await db.list_todos(user_id)}
