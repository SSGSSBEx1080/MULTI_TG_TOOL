from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _resolve_data_dir() -> Path:
    explicit = os.getenv("DATA_DIR", "").strip()
    if explicit:
        return Path(explicit)
    # Auto-detect Amvera Cloud / Docker persistent volume mounted at /data
    amvera_mount = Path("/data")
    if amvera_mount.is_dir() and os.access(amvera_mount, os.W_OK):
        return amvera_mount
    return BASE_DIR / "data"


DATA_DIR = _resolve_data_dir()
UPLOADS_DIR = DATA_DIR / "uploads"
GENERATED_DIR = DATA_DIR / "generated"
STATIC_UI_DIR = BASE_DIR / "backend" / "static_ui"
BUNDLED_FONTS_DIR = BASE_DIR / "backend" / "fonts"

for directory in (DATA_DIR, UPLOADS_DIR, GENERATED_DIR):
    directory.mkdir(parents=True, exist_ok=True)

DATABASE_PATH = Path(os.getenv("DATABASE_PATH", str(DATA_DIR / "nexus.db")))
if not DATABASE_PATH.is_absolute():
    DATABASE_PATH = BASE_DIR / DATABASE_PATH

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
WEBAPP_URL = os.getenv("WEBAPP_URL", "").strip()

# Simulated synthetic token used exclusively for the local SimulatorSession Bot instance
SIMULATOR_BOT_TOKEN = "123456789:AAH_NEXUS_SIMULATOR_VIRTUAL_TOKEN_X9"
DEFAULT_DEMO_USER_ID = 777000


def _font_path(filename: str) -> str:
    bundled = BUNDLED_FONTS_DIR / filename
    if bundled.exists():
        return str(bundled)
    return f"/usr/share/fonts/truetype/dejavu/{filename}"


FONT_REGULAR = _font_path("DejaVuSans.ttf")
FONT_BOLD = _font_path("DejaVuSans-Bold.ttf")
FONT_MONO = _font_path("DejaVuSansMono.ttf")
FONT_MONO_BOLD = _font_path("DejaVuSansMono-Bold.ttf")
