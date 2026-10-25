from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.api import routes_admin, routes_simulator, routes_tools, routes_v2, routes_workspace
from backend.bot.factory import bot_manager
from backend.config import BOT_TOKEN, DATA_DIR, STATIC_UI_DIR
from backend.database import db


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    await db.init()
    await bot_manager.init_simulator()
    saved_token = await db.get_setting("bot_token", BOT_TOKEN)
    if saved_token:
        await bot_manager.start_live_polling(saved_token)
    yield
    await bot_manager.stop_live_polling()
    await bot_manager.sim_bot.session.close()


def create_app() -> FastAPI:
    app = FastAPI(
        title="NEXUS • Telegram Multi-Tool Ecosystem",
        version="2.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(routes_tools.router)
    app.include_router(routes_workspace.router)
    app.include_router(routes_simulator.router)
    app.include_router(routes_admin.router)
    app.include_router(routes_v2.router)

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "NEXUS Multi-Tool"}

    app.mount("/media", StaticFiles(directory=str(DATA_DIR)), name="media")

    assets_dir = STATIC_UI_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        candidate = (STATIC_UI_DIR / full_path).resolve()
        if full_path and candidate.is_file() and str(candidate).startswith(str(STATIC_UI_DIR.resolve())):
            return FileResponse(candidate)
        index_html = STATIC_UI_DIR / "index.html"
        if index_html.is_file():
            return FileResponse(index_html)
        return JSONResponse(
            {
                "service": "NEXUS Backend Ready",
                "docs": "/docs",
                "hint": "Build frontend into backend/static_ui",
            }
        )

    return app


app = create_app()
