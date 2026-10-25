from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.api import routes_admin, routes_simulator, routes_tools, routes_v2, routes_v6, routes_workspace
from backend.bot.factory import bot_manager
from backend.config import BOT_TOKEN, GENERATED_DIR, STATIC_UI_DIR, UPLOADS_DIR
from backend.database import db


class ImmutableStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        if response.status_code == 200:
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


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
    await db.close()


def create_app() -> FastAPI:
    app = FastAPI(
        title="MULTI_TG_TOOL • Ecosystem",
        version="3.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(GZipMiddleware, minimum_size=800)
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
    app.include_router(routes_v6.router)

    @app.exception_handler(ValueError)
    async def handle_unhandled_value_error(_request: Request, exc: ValueError) -> JSONResponse:
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "MULTI_TG_TOOL"}

    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    app.mount("/media/generated", StaticFiles(directory=str(GENERATED_DIR)), name="media_generated")
    app.mount("/media/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="media_uploads")

    assets_dir = STATIC_UI_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", ImmutableStaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        if full_path == "api" or full_path == "media" or full_path.startswith(("api/", "media/")):
            raise HTTPException(status_code=404, detail="Not Found")
        static_root = STATIC_UI_DIR.resolve()
        if full_path:
            candidate = (STATIC_UI_DIR / full_path).resolve()
            if candidate.is_file() and str(candidate).startswith(str(static_root)):
                cache_hdr = "no-cache" if candidate.name == "index.html" else "public, max-age=86400"
                return FileResponse(candidate, headers={"Cache-Control": cache_hdr})
        index_html = STATIC_UI_DIR / "index.html"
        if index_html.is_file():
            return FileResponse(index_html, headers={"Cache-Control": "no-cache"})
        return JSONResponse(
            {
                "service": "MULTI_TG_TOOL Backend Ready",
                "docs": "/docs",
                "hint": "Build frontend into backend/static_ui",
            }
        )

    return app


app = create_app()
