from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
import datetime as dt
import json
import secrets
import time
from pathlib import Path
from typing import Any, AsyncIterator
import aiosqlite

from backend.config import DATABASE_PATH, DEFAULT_DEMO_USER_ID

RANKS = [
    (0, "🌱 Новичок", 50),
    (50, "⚡ Участник", 150),
    (150, "🛠 Практик", 400),
    (400, "🎯 Специалист", 1000),
    (1000, "🏆 Мастер", 3000),
    (3000, "👑 Легенда", 10000),
]

FAKE_SEED_USER_IDS = (0, 777000, 880101, 880102, 880103, 880104, 880201, 880202, 880203, 880204)

DEFAULT_AUTHOR_INFO = {
    "title": "QLS • MULTI_TG_TOOL",
    "name": "QLS • MULTI_TG_TOOL",
    "tagline": "Официальные ссылки",
    "bio": "Площадки проекта и поддержка.",
    "donation_note": "Поддержка проекта:",
    "links": [
        {"label": "📺 YouTube", "title": "📺 YouTube", "url": "https://www.youtube.com/@qls8571", "badge": "YouTube", "emoji": "📺"},
        {"label": "🎵 TikTok", "title": "🎵 TikTok", "url": "https://www.tiktok.com/@qls_senya1488", "badge": "TikTok", "emoji": "🎵"},
        {"label": "✈️ Telegram — @QLSCENR", "title": "✈️ Telegram — @QLSCENR", "url": "https://t.me/QLSCENR", "badge": "Telegram", "emoji": "✈️"},
        {"label": "💎 Поддержать проект (ЮMoney)", "title": "💎 Поддержать проект (ЮMoney)", "url": "https://yoomoney.ru/fundraise/1JT4BDKO99S.260826", "badge": "Донат", "emoji": "💎"},
    ],
}

WEEKDAY_RU_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]


def compute_rank(xp: int) -> dict[str, Any]:
    current_title = RANKS[0][1]
    floor_xp = 0
    next_xp = 50
    level = 1
    for idx, (min_xp, title, cap_xp) in enumerate(RANKS, start=1):
        if xp >= min_xp:
            current_title = title
            floor_xp = min_xp
            next_xp = cap_xp
            level = idx
    span = max(1, next_xp - floor_xp)
    progress = min(100, int(((xp - floor_xp) / span) * 100))
    return {
        "level": level,
        "title": current_title,
        "xp": xp,
        "next_xp": next_xp,
        "progress_pct": progress,
    }


def compute_badges(user_row: dict[str, Any]) -> list[str]:
    badges: list[str] = []
    if user_row.get("xp", 0) >= 500:
        badges.append("🔥 Активный")
    if user_row.get("tools_used", 0) >= 15:
        badges.append("🛠 Практик")
    if user_row.get("best_game_score", 0) >= 200:
        badges.append("🕹 Игрок")
    if user_row.get("profile_views", 0) >= 10:
        badges.append("👁 Известный")
    if user_row.get("respects", 0) >= 5:
        badges.append("👍 Респект")
    return badges


class Database:
    def __init__(self, db_path: Path = DATABASE_PATH) -> None:
        self.db_path = db_path
        self._conn: aiosqlite.Connection | None = None
        self._conn_loop: asyncio.AbstractEventLoop | None = None
        self._conn_path: Path | None = None
        self._lock: asyncio.Lock | None = None
        self._lock_loop: asyncio.AbstractEventLoop | None = None
        self._settings_cache: dict[str, str | None] = {}
        self._user_cache: dict[int, tuple[float, dict[str, Any]]] = {}

    def _get_lock(self) -> asyncio.Lock:
        loop = asyncio.get_running_loop()
        if self._lock is None or self._lock_loop is not loop:
            self._lock = asyncio.Lock()
            self._lock_loop = loop
        return self._lock

    async def _get_connection(self) -> aiosqlite.Connection:
        loop = asyncio.get_running_loop()
        if (
            self._conn is not None
            and self._conn_loop is loop
            and self._conn_path == self.db_path
        ):
            return self._conn

        if self._conn is not None and self._conn_loop is loop:
            try:
                await self._conn.close()
            except Exception:
                pass
            self._conn = None

        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn_worker = aiosqlite.connect(self.db_path, timeout=10.0)
        conn_worker.daemon = True
        conn = await conn_worker
        conn.row_factory = aiosqlite.Row
        # Network-PVC safe SQLite tuning (Amvera /data CephFS/NFS):
        # TRUNCATE avoids -shm mmap stalls and repeated file creation/deletion while keeping fast commits.
        await conn.execute("PRAGMA busy_timeout = 5000;")
        try:
            await conn.execute("PRAGMA journal_mode = TRUNCATE;")
        except Exception:
            await conn.execute("PRAGMA journal_mode = DELETE;")
        await conn.execute("PRAGMA synchronous = NORMAL;")
        await conn.execute("PRAGMA temp_store = MEMORY;")
        await conn.execute("PRAGMA cache_size = -8000;")

        self._conn = conn
        self._conn_loop = loop
        self._conn_path = self.db_path
        self._settings_cache.clear()
        self._user_cache.clear()
        return conn

    @asynccontextmanager
    async def _session(self) -> AsyncIterator[aiosqlite.Connection]:
        lock = self._get_lock()
        async with lock:
            conn = await self._get_connection()
            yield conn

    async def close(self) -> None:
        if self._conn is not None:
            try:
                await self._conn.close()
            except Exception:
                pass
            self._conn = None
            self._conn_loop = None
            self._conn_path = None

    def _invalidate_user(self, user_id: int) -> None:
        self._user_cache.pop(user_id, None)

    async def init(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        async with self._session() as conn:
            await conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                    user_id INTEGER PRIMARY KEY,
                    username TEXT DEFAULT '',
                    first_name TEXT DEFAULT 'Пользователь',
                    bio TEXT DEFAULT '',
                    avatar_emoji TEXT DEFAULT '👤',
                    xp INTEGER DEFAULT 0,
                    tools_used INTEGER DEFAULT 0,
                    profile_views INTEGER DEFAULT 0,
                    respects INTEGER DEFAULT 0,
                    best_game_score INTEGER DEFAULT 0,
                    is_real INTEGER DEFAULT 0,
                    created_at REAL NOT NULL,
                    last_active REAL NOT NULL
                );

                CREATE TABLE IF NOT EXISTS profile_visits (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    target_user_id INTEGER NOT NULL,
                    visitor_user_id INTEGER NOT NULL,
                    visited_at REAL NOT NULL
                );

                CREATE TABLE IF NOT EXISTS favorites (
                    user_id INTEGER NOT NULL,
                    tool_id TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    PRIMARY KEY (user_id, tool_id)
                );

                CREATE TABLE IF NOT EXISTS user_checklists (
                    user_id INTEGER NOT NULL,
                    scope TEXT NOT NULL,
                    item_id TEXT NOT NULL,
                    updated_at REAL NOT NULL,
                    PRIMARY KEY (user_id, scope, item_id)
                );
                CREATE INDEX IF NOT EXISTS idx_user_checklists_scope
                    ON user_checklists (user_id, scope);

                CREATE TABLE IF NOT EXISTS notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    tag TEXT DEFAULT 'general',
                    pinned INTEGER DEFAULT 0,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                );

                CREATE TABLE IF NOT EXISTS todos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    text TEXT NOT NULL,
                    done INTEGER DEFAULT 0,
                    priority TEXT DEFAULT 'normal',
                    created_at REAL NOT NULL
                );

                CREATE TABLE IF NOT EXISTS habits (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    icon TEXT DEFAULT '✅',
                    target_per_week INTEGER DEFAULT 7,
                    created_at REAL NOT NULL
                );

                CREATE TABLE IF NOT EXISTS habit_logs (
                    habit_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    log_date TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    PRIMARY KEY (habit_id, log_date)
                );

                CREATE TABLE IF NOT EXISTS telemetry (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    tool_id TEXT NOT NULL,
                    category TEXT NOT NULL,
                    source TEXT NOT NULL,
                    detail TEXT DEFAULT '',
                    created_at REAL NOT NULL
                );

                CREATE TABLE IF NOT EXISTS app_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS short_links (
                    code TEXT PRIMARY KEY,
                    long_code TEXT UNIQUE NOT NULL,
                    target_url TEXT NOT NULL,
                    clicks INTEGER DEFAULT 0,
                    created_by INTEGER DEFAULT 0,
                    created_at REAL NOT NULL
                );

                CREATE TABLE IF NOT EXISTS game_scores (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    game_id TEXT NOT NULL,
                    score INTEGER NOT NULL,
                    created_at REAL NOT NULL
                );

                CREATE TABLE IF NOT EXISTS anon_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    room TEXT NOT NULL DEFAULT 'global',
                    sender_id INTEGER NOT NULL,
                    alias TEXT NOT NULL,
                    text TEXT NOT NULL,
                    created_at REAL NOT NULL
                );

                CREATE TABLE IF NOT EXISTS dating_profiles (
                    user_id INTEGER PRIMARY KEY,
                    display_name TEXT NOT NULL,
                    age INTEGER NOT NULL,
                    city TEXT NOT NULL,
                    bio TEXT NOT NULL,
                    vibe TEXT DEFAULT '',
                    avatar_emoji TEXT DEFAULT '👤',
                    rating_sum INTEGER DEFAULT 0,
                    rating_count INTEGER DEFAULT 0,
                    likes_count INTEGER DEFAULT 0,
                    created_at REAL NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_users_real_xp ON users(is_real, xp DESC);
                CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id, pinned DESC, updated_at DESC);
                CREATE INDEX IF NOT EXISTS idx_todos_user ON todos(user_id, done ASC, id DESC);
                CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id, id ASC);
                CREATE INDEX IF NOT EXISTS idx_habit_logs_user ON habit_logs(user_id);
                CREATE INDEX IF NOT EXISTS idx_telemetry_user ON telemetry(user_id);
                CREATE INDEX IF NOT EXISTS idx_telemetry_tool ON telemetry(tool_id);
                CREATE INDEX IF NOT EXISTS idx_game_scores_game ON game_scores(game_id, user_id);
                CREATE INDEX IF NOT EXISTS idx_anon_room_id ON anon_messages(room, id DESC);
                CREATE INDEX IF NOT EXISTS idx_visits_target ON profile_visits(target_user_id);
                """
            )
            cur = await conn.execute("PRAGMA table_info(users)")
            existing_cols = {r[1] for r in await cur.fetchall()}
            migrations = [
                ("bio", "TEXT DEFAULT ''"),
                ("avatar_emoji", "TEXT DEFAULT '👤'"),
                ("profile_views", "INTEGER DEFAULT 0"),
                ("respects", "INTEGER DEFAULT 0"),
                ("best_game_score", "INTEGER DEFAULT 0"),
                ("is_real", "INTEGER DEFAULT 0"),
            ]
            for col_name, col_def in migrations:
                if col_name not in existing_cols:
                    await conn.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")

            # Purge legacy fake/demo accounts from existing databases so only real Telegram users remain
            placeholders = ",".join("?" for _ in FAKE_SEED_USER_IDS)
            await conn.execute(f"DELETE FROM users WHERE user_id IN ({placeholders})", FAKE_SEED_USER_IDS)
            await conn.execute(f"DELETE FROM game_scores WHERE user_id IN ({placeholders})", FAKE_SEED_USER_IDS)
            await conn.execute(f"DELETE FROM dating_profiles WHERE user_id IN ({placeholders})", FAKE_SEED_USER_IDS)
            await conn.execute(f"DELETE FROM anon_messages WHERE sender_id IN ({placeholders})", FAKE_SEED_USER_IDS)
            await conn.execute(
                f"UPDATE users SET is_real = 1 WHERE user_id > 10000 AND user_id NOT IN ({placeholders}) AND user_id < 900000000000",
                FAKE_SEED_USER_IDS,
            )
            await conn.execute("UPDATE users SET bio = '' WHERE bio = 'Исследователь экосистемы NEXUS'")
            await conn.commit()
            self._user_cache.clear()

    def _enrich_user(self, row: aiosqlite.Row | dict[str, Any]) -> dict[str, Any]:
        data = dict(row)
        rnk = compute_rank(data.get("xp", 0))
        data["rank"] = rnk
        data["rank_title"] = rnk["title"]
        data["progress_pct"] = rnk["progress_pct"]
        data["badges"] = compute_badges(data)
        return data

    async def ensure_user(
        self,
        user_id: int,
        username: str = "",
        first_name: str = "Пользователь",
        is_real: bool | None = None,
    ) -> dict[str, Any]:
        now = time.time()
        real_flag = 1 if is_real else (
            1 if (is_real is None and user_id > 10000 and user_id not in FAKE_SEED_USER_IDS and user_id < 900000000000) else 0
        )

        # Fast-path memory cache: avoid redundant UPDATE+COMMIT on every single GET API call within 180s
        cached = self._user_cache.get(user_id)
        if cached is not None:
            sync_ts, cached_user = cached
            uname_unchanged = (not username) or (cached_user.get("username") == username)
            fname_unchanged = (not first_name or first_name == "Пользователь") or (cached_user.get("first_name") == first_name)
            real_unchanged = (not real_flag) or (cached_user.get("is_real", 0) >= real_flag)
            if (now - sync_ts) < 180.0 and uname_unchanged and fname_unchanged and real_unchanged:
                return dict(cached_user)

        async with self._session() as conn:
            cur = await conn.execute("SELECT * FROM users WHERE user_id = ?", (user_id,))
            row = await cur.fetchone()
            if row is None:
                await conn.execute(
                    """
                    INSERT INTO users (user_id, username, first_name, bio, avatar_emoji, xp, tools_used, is_real, created_at, last_active)
                    VALUES (?, ?, ?, '', '👤', 0, 0, ?, ?, ?)
                    """,
                    (user_id, username or "", first_name or "Пользователь", real_flag, now, now),
                )
                await conn.commit()
                cur = await conn.execute("SELECT * FROM users WHERE user_id = ?", (user_id,))
                row = await cur.fetchone()
            else:
                new_uname = username if username else row["username"]
                new_fname = first_name if (first_name and first_name != "Пользователь") else row["first_name"]
                needs_write = (
                    new_uname != row["username"]
                    or new_fname != row["first_name"]
                    or (real_flag > (row["is_real"] or 0))
                    or (now - float(row["last_active"] or 0.0) >= 180.0)
                )
                if needs_write:
                    await conn.execute(
                        """
                        UPDATE users
                        SET last_active = ?,
                            username = ?,
                            first_name = ?,
                            is_real = MAX(is_real, ?)
                        WHERE user_id = ?
                        """,
                        (now, new_uname, new_fname, real_flag, user_id),
                    )
                    await conn.commit()
                    cur = await conn.execute("SELECT * FROM users WHERE user_id = ?", (user_id,))
                    row = await cur.fetchone()

            enriched = self._enrich_user(row)
            self._user_cache[user_id] = (now, enriched)
            return dict(enriched)

    async def get_public_profile(
        self, target_user_id: int, visitor_user_id: int = 0, viewer_id: int | None = None
    ) -> dict[str, Any]:
        if viewer_id is not None:
            visitor_user_id = viewer_id
        now = time.time()
        async with self._session() as conn:
            cur = await conn.execute("SELECT * FROM users WHERE user_id = ?", (target_user_id,))
            row = await cur.fetchone()
            if row is None:
                raise ValueError("Профиль пользователя не найден")

            if visitor_user_id and visitor_user_id != target_user_id and visitor_user_id not in FAKE_SEED_USER_IDS:
                await conn.execute(
                    "UPDATE users SET profile_views = profile_views + 1 WHERE user_id = ?",
                    (target_user_id,),
                )
                await conn.execute(
                    "INSERT INTO profile_visits (target_user_id, visitor_user_id, visited_at) VALUES (?, ?, ?)",
                    (target_user_id, visitor_user_id, now),
                )
                await conn.commit()
                self._invalidate_user(target_user_id)
                cur = await conn.execute("SELECT * FROM users WHERE user_id = ?", (target_user_id,))
                row = await cur.fetchone()

            uv_cur = await conn.execute(
                "SELECT COUNT(DISTINCT visitor_user_id) AS c FROM profile_visits WHERE target_user_id = ?",
                (target_user_id,),
            )
            uniq_vis = (await uv_cur.fetchone())["c"]

            fav_cur = await conn.execute(
                "SELECT tool_id FROM favorites WHERE user_id = ? LIMIT 8", (target_user_id,)
            )
            favs = [r[0] for r in await fav_cur.fetchall()]

            g_cur = await conn.execute(
                "SELECT game_id, MAX(score) AS best FROM game_scores WHERE user_id = ? GROUP BY game_id ORDER BY best DESC",
                (target_user_id,),
            )
            game_list = [{"game_id": r["game_id"], "score": r["best"]} for r in await g_cur.fetchall()]

            top_t_cur = await conn.execute(
                "SELECT tool_id, COUNT(*) AS cnt FROM telemetry WHERE user_id = ? GROUP BY tool_id ORDER BY cnt DESC LIMIT 5",
                (target_user_id,),
            )
            top_tools = [dict(r) for r in await top_t_cur.fetchall()]

            user_data = self._enrich_user(row)
            user_data["unique_visitors"] = max(1, uniq_vis) if user_data.get("profile_views", 0) > 0 else 0
            user_data["favorites"] = favs
            user_data["game_records"] = game_list
            user_data["top_tools"] = top_tools
            return user_data

    async def update_user_bio(self, user_id: int, first_name: str, bio: str, avatar_emoji: str) -> dict[str, Any]:
        await self.ensure_user(user_id)
        async with self._session() as conn:
            await conn.execute(
                "UPDATE users SET first_name = ?, bio = ?, avatar_emoji = ? WHERE user_id = ?",
                (first_name.strip()[:40] or "Пользователь", bio.strip()[:180], avatar_emoji.strip()[:4] or "👤", user_id),
            )
            await conn.commit()
            self._invalidate_user(user_id)
        return await self.ensure_user(user_id)

    async def update_user_profile(
        self, user_id: int, bio: str, avatar_emoji: str = "👤", first_name: str | None = None
    ) -> dict[str, Any]:
        cur_u = await self.ensure_user(user_id)
        fname = first_name.strip() if first_name and first_name.strip() else cur_u.get("first_name", "Пользователь")
        return await self.update_user_bio(user_id, fname, bio, avatar_emoji)

    async def give_respect(
        self, target_user_id: int, from_user_id: int = 0, sender_id: int | None = None
    ) -> dict[str, Any]:
        actual_sender = sender_id if sender_id is not None else from_user_id
        if actual_sender and actual_sender == target_user_id:
            return await self.get_public_profile(target_user_id, visitor_user_id=0)
        async with self._session() as conn:
            await conn.execute(
                "UPDATE users SET respects = respects + 1, xp = xp + 15 WHERE user_id = ?",
                (target_user_id,),
            )
            await conn.commit()
            self._invalidate_user(target_user_id)
        return await self.get_public_profile(target_user_id, visitor_user_id=0)

    async def get_leaderboard(self, sort_by: str = "xp", limit: int = 30) -> list[dict[str, Any]]:
        order_col = {
            "xp": "xp DESC, tools_used DESC",
            "tools": "tools_used DESC, xp DESC",
            "games": "best_game_score DESC, xp DESC",
            "views": "profile_views DESC, xp DESC",
            "respects": "respects DESC, xp DESC",
        }.get(sort_by, "xp DESC")
        async with self._session() as conn:
            cur = await conn.execute(
                f"SELECT * FROM users WHERE is_real = 1 ORDER BY {order_col} LIMIT ?",
                (limit,),
            )
            rows = await cur.fetchall()
            out = []
            for idx, r in enumerate(rows, start=1):
                item = self._enrich_user(r)
                item["position"] = idx
                out.append(item)
            return out

    async def record_tool_use(
        self,
        user_id: int,
        tool_id: str,
        category: str,
        source: str = "bot",
        detail: str = "",
        xp_gain: int = 10,
    ) -> dict[str, Any]:
        await self.ensure_user(user_id)
        now = time.time()
        async with self._session() as conn:
            await conn.execute(
                """
                UPDATE users
                SET xp = xp + ?, tools_used = tools_used + 1, last_active = ?
                WHERE user_id = ?
                """,
                (xp_gain, now, user_id),
            )
            await conn.execute(
                """
                INSERT INTO telemetry (user_id, tool_id, category, source, detail, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (user_id, tool_id, category, source, detail[:200], now),
            )
            await conn.commit()
            self._invalidate_user(user_id)
        return await self.ensure_user(user_id)

    async def record_game_score(self, user_id: int, game_id: str, score: int) -> dict[str, Any]:
        await self.ensure_user(user_id)
        now = time.time()
        xp_bonus = max(5, min(80, score // 15))
        async with self._session() as conn:
            await conn.execute(
                "INSERT INTO game_scores (user_id, game_id, score, created_at) VALUES (?, ?, ?, ?)",
                (user_id, game_id, int(score), now),
            )
            await conn.execute(
                """
                UPDATE users
                SET best_game_score = MAX(best_game_score, ?),
                    xp = xp + ?,
                    last_active = ?
                WHERE user_id = ?
                """,
                (int(score), xp_bonus, now, user_id),
            )
            await conn.commit()
            self._invalidate_user(user_id)
            cur = await conn.execute(
                """
                SELECT g.game_id, MAX(g.score) AS score, u.first_name, u.avatar_emoji, u.user_id
                FROM game_scores g
                JOIN users u ON u.user_id = g.user_id
                WHERE g.game_id = ? AND u.is_real = 1
                GROUP BY g.user_id
                ORDER BY score DESC
                LIMIT 10
                """,
                (game_id,),
            )
            top = [dict(r) for r in await cur.fetchall()]
        return {"xp_bonus": xp_bonus, "xp_earned": xp_bonus, "leaderboard": top}

    async def submit_game_score(self, user_id: int, game_id: str, score: int) -> dict[str, Any]:
        return await self.record_game_score(user_id, game_id, score)

    async def get_game_highscores(self, game_id: str = "all", limit: int = 12) -> list[dict[str, Any]]:
        async with self._session() as conn:
            if game_id in ("all", ""):
                cur = await conn.execute(
                    """
                    SELECT g.game_id, MAX(g.score) AS best_score, u.first_name, u.avatar_emoji, u.user_id
                    FROM game_scores g
                    JOIN users u ON u.user_id = g.user_id
                    WHERE u.is_real = 1
                    GROUP BY g.user_id, g.game_id
                    ORDER BY best_score DESC
                    LIMIT ?
                    """,
                    (limit,),
                )
            else:
                cur = await conn.execute(
                    """
                    SELECT g.game_id, MAX(g.score) AS best_score, u.first_name, u.avatar_emoji, u.user_id
                    FROM game_scores g
                    JOIN users u ON u.user_id = g.user_id
                    WHERE g.game_id = ? AND u.is_real = 1
                    GROUP BY g.user_id
                    ORDER BY best_score DESC
                    LIMIT ?
                    """,
                    (game_id, limit),
                )
            return [dict(r) for r in await cur.fetchall()]

    # --- Habit Tracker ---
    def _build_habits_view(
        self, habits: list[dict[str, Any]], logs_by_habit: dict[int, set[str]]
    ) -> list[dict[str, Any]]:
        if not habits:
            return []
        today = dt.date.today()
        last_7_dates = [today - dt.timedelta(days=offset) for offset in range(6, -1, -1)]
        today_iso = today.isoformat()

        enriched: list[dict[str, Any]] = []
        for h in habits:
            hid = h["id"]
            done_dates = logs_by_habit.get(hid, set())
            days_view = []
            week_done = 0
            for d in last_7_dates:
                d_iso = d.isoformat()
                is_done = d_iso in done_dates
                if is_done:
                    week_done += 1
                days_view.append(
                    {
                        "date": d_iso,
                        "label": WEEKDAY_RU_SHORT[d.weekday()],
                        "day_num": f"{d.day:02d}.{d.month:02d}",
                        "done": is_done,
                        "completed": is_done,
                        "is_today": d_iso == today_iso,
                    }
                )

            streak = 0
            cursor = today if today_iso in done_dates else (today - dt.timedelta(days=1))
            while cursor.isoformat() in done_dates:
                streak += 1
                cursor -= dt.timedelta(days=1)

            best_streak = 0
            if done_dates:
                sorted_dates = sorted(dt.date.fromisoformat(x) for x in done_dates)
                cur_run = 1
                best_streak = 1
                for i in range(1, len(sorted_dates)):
                    if (sorted_dates[i] - sorted_dates[i - 1]).days == 1:
                        cur_run += 1
                        best_streak = max(best_streak, cur_run)
                    else:
                        cur_run = 1

            target = max(1, min(7, int(h.get("target_per_week") or 7)))
            enriched.append(
                {
                    **h,
                    "days": days_view,
                    "last_7_days": days_view,
                    "done_today": today_iso in done_dates,
                    "streak": streak,
                    "best_streak": best_streak,
                    "week_done": week_done,
                    "done_week": week_done,
                    "week_pct": min(100, round((week_done / target) * 100)),
                    "total_done": len(done_dates),
                    "total_completions": len(done_dates),
                }
            )
        return enriched

    async def list_habits(self, user_id: int) -> list[dict[str, Any]]:
        async with self._session() as conn:
            h_cur = await conn.execute(
                "SELECT * FROM habits WHERE user_id = ? ORDER BY id ASC",
                (user_id,),
            )
            habits = [dict(r) for r in await h_cur.fetchall()]
            if not habits:
                return []

            l_cur = await conn.execute(
                "SELECT habit_id, log_date FROM habit_logs WHERE user_id = ?",
                (user_id,),
            )
            logs_by_habit: dict[int, set[str]] = {}
            for row in await l_cur.fetchall():
                logs_by_habit.setdefault(row["habit_id"], set()).add(row["log_date"])

        return self._build_habits_view(habits, logs_by_habit)

    async def get_workspace_bundle(self, user_id: int, search: str = "") -> dict[str, Any]:
        profile = await self.ensure_user(user_id)
        async with self._session() as conn:
            fav_cur = await conn.execute(
                "SELECT tool_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC",
                (user_id,),
            )
            favorites = [r[0] for r in await fav_cur.fetchall()]

            if search.strip():
                q = f"%{search.strip()}%"
                n_cur = await conn.execute(
                    "SELECT * FROM notes WHERE user_id = ? AND (title LIKE ? OR content LIKE ? OR tag LIKE ?) ORDER BY pinned DESC, updated_at DESC",
                    (user_id, q, q, q),
                )
            else:
                n_cur = await conn.execute(
                    "SELECT * FROM notes WHERE user_id = ? ORDER BY pinned DESC, updated_at DESC",
                    (user_id,),
                )
            notes = [dict(r) for r in await n_cur.fetchall()]

            t_cur = await conn.execute(
                "SELECT * FROM todos WHERE user_id = ? ORDER BY done ASC, id DESC",
                (user_id,),
            )
            todos = [dict(r) for r in await t_cur.fetchall()]

            h_cur = await conn.execute(
                "SELECT * FROM habits WHERE user_id = ? ORDER BY id ASC",
                (user_id,),
            )
            raw_habits = [dict(r) for r in await h_cur.fetchall()]
            logs_by_habit: dict[int, set[str]] = {}
            if raw_habits:
                l_cur = await conn.execute(
                    "SELECT habit_id, log_date FROM habit_logs WHERE user_id = ?",
                    (user_id,),
                )
                for row in await l_cur.fetchall():
                    logs_by_habit.setdefault(row["habit_id"], set()).add(row["log_date"])

            u_cur = await conn.execute(
                "SELECT category, COUNT(*) AS cnt FROM telemetry WHERE user_id = ? GROUP BY category",
                (user_id,),
            )
            category_usage = {str(r["category"]): int(r["cnt"]) for r in await u_cur.fetchall() if r["category"]}

        return {
            "profile": profile,
            "favorites": favorites,
            "notes": notes,
            "todos": todos,
            "habits": self._build_habits_view(raw_habits, logs_by_habit),
            "category_usage": category_usage,
        }

    async def create_habit(
        self, user_id: int, title: str, icon: str = "✅", target_per_week: int = 7
    ) -> list[dict[str, Any]]:
        clean_title = title.strip()[:60]
        if not clean_title:
            raise ValueError("Введите название привычки")
        await self.ensure_user(user_id)
        async with self._session() as conn:
            await conn.execute(
                "INSERT INTO habits (user_id, title, icon, target_per_week, created_at) VALUES (?, ?, ?, ?, ?)",
                (user_id, clean_title, (icon or "✅").strip()[:4], max(1, min(7, int(target_per_week))), time.time()),
            )
            await conn.commit()
        return await self.list_habits(user_id)

    async def toggle_habit_date(
        self, user_id: int, habit_id: int, log_date: str | None = None
    ) -> dict[str, Any]:
        date_iso = (log_date or dt.date.today().isoformat()).strip()
        dt.date.fromisoformat(date_iso)  # validate YYYY-MM-DD
        await self.ensure_user(user_id)
        marked = False
        async with self._session() as conn:
            h_cur = await conn.execute("SELECT 1 FROM habits WHERE id = ? AND user_id = ?", (habit_id, user_id))
            if not await h_cur.fetchone():
                raise ValueError("Привычка не найдена")
            cur = await conn.execute(
                "SELECT 1 FROM habit_logs WHERE habit_id = ? AND log_date = ?",
                (habit_id, date_iso),
            )
            if await cur.fetchone():
                await conn.execute(
                    "DELETE FROM habit_logs WHERE habit_id = ? AND log_date = ?",
                    (habit_id, date_iso),
                )
                marked = False
            else:
                await conn.execute(
                    "INSERT INTO habit_logs (habit_id, user_id, log_date, created_at) VALUES (?, ?, ?, ?)",
                    (habit_id, user_id, date_iso, time.time()),
                )
                await conn.execute(
                    "UPDATE users SET xp = xp + 5, last_active = ? WHERE user_id = ?",
                    (time.time(), user_id),
                )
                self._invalidate_user(user_id)
                marked = True
            await conn.commit()
        return {
            "marked": marked,
            "completed": marked,
            "date": date_iso,
            "habits": await self.list_habits(user_id),
        }

    async def delete_habit(self, user_id: int, habit_id: int) -> list[dict[str, Any]]:
        async with self._session() as conn:
            await conn.execute("DELETE FROM habit_logs WHERE habit_id = ? AND user_id = ?", (habit_id, user_id))
            await conn.execute("DELETE FROM habits WHERE id = ? AND user_id = ?", (habit_id, user_id))
            await conn.commit()
        return await self.list_habits(user_id)

    # --- Short & Long Links ---
    async def create_link_pair(
        self, first_arg: str | int, second_arg: str = "", user_id: int = 0
    ) -> dict[str, Any]:
        if isinstance(first_arg, int):
            user_id = first_arg
            target_url = second_arg
            custom_code = ""
        else:
            target_url = first_arg
            custom_code = second_arg
        url = target_url.strip()
        if not url.startswith(("http://", "https://", "tg://")):
            url = "https://" + url
        code = (custom_code.strip() or secrets.token_urlsafe(4)).replace("/", "").replace(" ", "")[:24]
        filler = "redirect-" + secrets.token_hex(36)
        now = time.time()
        async with self._session() as conn:
            cur = await conn.execute("SELECT * FROM short_links WHERE code = ?", (code,))
            if await cur.fetchone():
                code = f"{code}_{secrets.token_hex(2)}"
            await conn.execute(
                """
                INSERT INTO short_links (code, long_code, target_url, clicks, created_by, created_at)
                VALUES (?, ?, ?, 0, ?, ?)
                """,
                (code, filler, url, user_id, now),
            )
            await conn.commit()
        return {"code": code, "long_code": filler, "target_url": url, "clicks": 0}

    async def resolve_link(self, token: str) -> str | None:
        async with self._session() as conn:
            cur = await conn.execute(
                "SELECT code, target_url FROM short_links WHERE code = ? OR long_code = ?",
                (token, token),
            )
            row = await cur.fetchone()
            if not row:
                return None
            await conn.execute("UPDATE short_links SET clicks = clicks + 1 WHERE code = ?", (row[0],))
            await conn.commit()
            return row[1]

    async def list_links(self, limit: int = 12) -> list[dict[str, Any]]:
        async with self._session() as conn:
            cur = await conn.execute("SELECT * FROM short_links ORDER BY created_at DESC LIMIT ?", (limit,))
            return [dict(r) for r in await cur.fetchall()]

    async def list_user_links(self, user_id: int = 0) -> list[dict[str, Any]]:
        async with self._session() as conn:
            if user_id:
                cur = await conn.execute(
                    "SELECT * FROM short_links WHERE created_by = ? ORDER BY created_at DESC LIMIT 12",
                    (user_id,),
                )
                rows = [dict(r) for r in await cur.fetchall()]
                if rows:
                    return rows
            cur = await conn.execute("SELECT * FROM short_links ORDER BY created_at DESC LIMIT 12")
            return [dict(r) for r in await cur.fetchall()]

    # --- Anonymous Chat ---
    async def post_anon_message(
        self, first_arg: str | int, second_arg: int | str, alias: str = "", text: str = "", room: str = "global"
    ) -> list[dict[str, Any]]:
        if isinstance(first_arg, int) and isinstance(second_arg, str):
            sender_id = first_arg
            msg_text = second_arg
            mask_hex = f"{(sender_id * 2654435761) & 0xFFFF:04X}"
            alias_str = f"Аноним #{mask_hex}"
            room_str = room or "global"
        else:
            room_str = str(first_arg) or "global"
            sender_id = int(second_arg)
            alias_str = alias.strip()[:32] or "Аноним"
            msg_text = text
        now = time.time()
        async with self._session() as conn:
            await conn.execute(
                "INSERT INTO anon_messages (room, sender_id, alias, text, created_at) VALUES (?, ?, ?, ?, ?)",
                (room_str, sender_id, alias_str, msg_text.strip()[:600], now),
            )
            await conn.commit()
        return await self.get_anon_messages(room_str)

    async def get_anon_messages(self, room: str = "global", limit: int = 40) -> list[dict[str, Any]]:
        async with self._session() as conn:
            cur = await conn.execute(
                "SELECT * FROM anon_messages WHERE room = ? ORDER BY id DESC LIMIT ?",
                (room or "global", limit),
            )
            rows = [dict(r) for r in await cur.fetchall()]
            rows.reverse()
            return rows

    async def list_anon_messages(self, room: str = "global", limit: int = 40) -> list[dict[str, Any]]:
        return await self.get_anon_messages(room=room, limit=limit)

    # --- Dating Profiles ---
    def _enrich_dating(self, row: aiosqlite.Row | dict[str, Any]) -> dict[str, Any]:
        d = dict(row)
        d["id"] = d.get("id") or d.get("user_id")
        d["avg_rating"] = d.get("avg_score", 0.0)
        d["votes_count"] = d.get("rating_count", 0)
        d["avatar_style"] = d.get("avatar_emoji", "👤")
        return d

    async def list_dating_profiles(self) -> list[dict[str, Any]]:
        async with self._session() as conn:
            cur = await conn.execute(
                """
                SELECT *,
                       CASE WHEN rating_count > 0 THEN ROUND(CAST(rating_sum AS REAL) / rating_count, 2) ELSE 0.0 END AS avg_score
                FROM dating_profiles
                ORDER BY avg_score DESC, likes_count DESC
                """
            )
            return [self._enrich_dating(r) for r in await cur.fetchall()]

    async def upsert_dating_profile(
        self,
        user_id: int,
        display_name: str,
        age: int,
        city: str,
        bio: str,
        vibe: str = "",
        avatar_emoji: str = "👤",
    ) -> dict[str, Any]:
        now = time.time()
        async with self._session() as conn:
            await conn.execute(
                """
                INSERT INTO dating_profiles (user_id, display_name, age, city, bio, vibe, avatar_emoji, rating_sum, rating_count, likes_count, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    display_name = excluded.display_name,
                    age = excluded.age,
                    city = excluded.city,
                    bio = excluded.bio,
                    vibe = excluded.vibe,
                    avatar_emoji = excluded.avatar_emoji
                """,
                (user_id, display_name.strip()[:32], max(18, min(99, int(age))), city.strip()[:40], bio.strip()[:240], vibe.strip()[:40], avatar_emoji.strip()[:4] or "👤", now),
            )
            await conn.commit()
        profiles = await self.list_dating_profiles()
        return next((p for p in profiles if p["user_id"] == user_id), profiles[0] if profiles else {})

    async def create_dating_profile(
        self,
        user_id: int,
        display_name: str,
        age: int,
        city: str,
        vibe: str,
        bio: str,
        avatar_style: str = "👤",
    ) -> list[dict[str, Any]]:
        await self.upsert_dating_profile(
            user_id=user_id,
            display_name=display_name,
            age=age,
            city=city,
            bio=bio,
            vibe=vibe,
            avatar_emoji=avatar_style,
        )
        return await self.list_dating_profiles()

    async def rate_dating_profile(
        self, target_user_id: int, score: int, rater_or_liked: int | bool = False
    ) -> dict[str, Any]:
        clamped = max(1, min(10, int(score)))
        liked = bool(rater_or_liked) if isinstance(rater_or_liked, bool) else (clamped >= 8)
        like_inc = 1 if (liked or clamped >= 8) else 0
        async with self._session() as conn:
            await conn.execute(
                """
                UPDATE dating_profiles
                SET rating_sum = rating_sum + ?,
                    rating_count = rating_count + 1,
                    likes_count = likes_count + ?
                WHERE user_id = ?
                """,
                (clamped, like_inc, target_user_id),
            )
            await conn.commit()
        profiles = await self.list_dating_profiles()
        return next((p for p in profiles if p["user_id"] == target_user_id), {})

    # --- Author Card Settings ---
    def _normalize_author(self, info: dict[str, Any]) -> dict[str, Any]:
        out = dict(info)
        out["title"] = out.get("title") or out.get("name") or "QLS • MULTI_TG_TOOL"
        out["name"] = out["title"]
        out["donation_note"] = out.get("donation_note") or "Поддержка проекта:"
        norm_links = []
        for lnk in out.get("links", []):
            lbl = lnk.get("label") or lnk.get("title") or "Ссылка"
            em = lnk.get("emoji") or (lbl.split()[0] if lbl and not lbl[0].isalnum() else "🔗")
            norm_links.append({**lnk, "label": lbl, "title": lbl, "emoji": em})
        out["links"] = norm_links
        return out

    async def get_author_info(self) -> dict[str, Any]:
        raw = await self.get_setting("author_info", "")
        if raw:
            try:
                return self._normalize_author(json.loads(raw))
            except Exception:
                pass
        return self._normalize_author(DEFAULT_AUTHOR_INFO)

    async def set_author_info(self, info: dict[str, Any]) -> dict[str, Any]:
        norm = self._normalize_author(info)
        await self.set_setting("author_info", json.dumps(norm, ensure_ascii=False))
        return norm

    async def save_author_info(self, info: dict[str, Any]) -> dict[str, Any]:
        return await self.set_author_info(info)

    # --- Favorites, Notes, Todos, Settings & Analytics ---
    async def toggle_favorite(self, user_id: int, tool_id: str) -> bool:
        async with self._session() as conn:
            cur = await conn.execute(
                "SELECT 1 FROM favorites WHERE user_id = ? AND tool_id = ?",
                (user_id, tool_id),
            )
            if await cur.fetchone():
                await conn.execute(
                    "DELETE FROM favorites WHERE user_id = ? AND tool_id = ?",
                    (user_id, tool_id),
                )
                await conn.commit()
                return False
            await conn.execute(
                "INSERT INTO favorites (user_id, tool_id, created_at) VALUES (?, ?, ?)",
                (user_id, tool_id, time.time()),
            )
            await conn.commit()
            return True

    async def list_favorites(self, user_id: int) -> list[str]:
        async with self._session() as conn:
            cur = await conn.execute(
                "SELECT tool_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC",
                (user_id,),
            )
            return [r[0] for r in await cur.fetchall()]

    async def list_notes(self, user_id: int, search: str = "") -> list[dict[str, Any]]:
        async with self._session() as conn:
            if search.strip():
                q = f"%{search.strip()}%"
                cur = await conn.execute(
                    "SELECT * FROM notes WHERE user_id = ? AND (title LIKE ? OR content LIKE ? OR tag LIKE ?) ORDER BY pinned DESC, updated_at DESC",
                    (user_id, q, q, q),
                )
            else:
                cur = await conn.execute(
                    "SELECT * FROM notes WHERE user_id = ? ORDER BY pinned DESC, updated_at DESC",
                    (user_id,),
                )
            return [dict(r) for r in await cur.fetchall()]

    async def create_note(
        self, user_id: int, title: str, content: str, tag: str = "general", pinned: bool = False
    ) -> dict[str, Any]:
        now = time.time()
        async with self._session() as conn:
            cur = await conn.execute(
                "INSERT INTO notes (user_id, title, content, tag, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (user_id, title.strip() or "Заметка", content.strip(), tag.strip() or "general", int(pinned), now, now),
            )
            note_id = cur.lastrowid
            await conn.commit()
            cur = await conn.execute("SELECT * FROM notes WHERE id = ?", (note_id,))
            return dict(await cur.fetchone())

    async def toggle_note_pin(self, user_id: int, note_id: int) -> bool:
        async with self._session() as conn:
            await conn.execute(
                "UPDATE notes SET pinned = CASE WHEN pinned = 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ? AND user_id = ?",
                (time.time(), note_id, user_id),
            )
            await conn.commit()
            return True

    async def delete_note(self, user_id: int, note_id: int) -> bool:
        async with self._session() as conn:
            cur = await conn.execute("DELETE FROM notes WHERE id = ? AND user_id = ?", (note_id, user_id))
            await conn.commit()
            return cur.rowcount > 0

    async def list_todos(self, user_id: int) -> list[dict[str, Any]]:
        async with self._session() as conn:
            cur = await conn.execute("SELECT * FROM todos WHERE user_id = ? ORDER BY done ASC, id DESC", (user_id,))
            return [dict(r) for r in await cur.fetchall()]

    async def add_todo(self, user_id: int, text: str, priority: str = "normal") -> dict[str, Any]:
        now = time.time()
        async with self._session() as conn:
            cur = await conn.execute(
                "INSERT INTO todos (user_id, text, done, priority, created_at) VALUES (?, ?, 0, ?, ?)",
                (user_id, text.strip(), priority, now),
            )
            todo_id = cur.lastrowid
            await conn.commit()
            cur = await conn.execute("SELECT * FROM todos WHERE id = ?", (todo_id,))
            return dict(await cur.fetchone())

    async def toggle_todo(self, user_id: int, todo_id: int) -> list[dict[str, Any]]:
        async with self._session() as conn:
            await conn.execute(
                "UPDATE todos SET done = CASE WHEN done = 1 THEN 0 ELSE 1 END WHERE id = ? AND user_id = ?",
                (todo_id, user_id),
            )
            await conn.commit()
        return await self.list_todos(user_id)

    async def delete_todo(self, user_id: int, todo_id: int) -> bool:
        async with self._session() as conn:
            cur = await conn.execute("DELETE FROM todos WHERE id = ? AND user_id = ?", (todo_id, user_id))
            await conn.commit()
            return cur.rowcount > 0

    async def clear_completed_todos(self, user_id: int) -> int:
        async with self._session() as conn:
            cur = await conn.execute("DELETE FROM todos WHERE user_id = ? AND done = 1", (user_id,))
            await conn.commit()
            return cur.rowcount

    async def set_setting(self, key: str, value: str) -> None:
        async with self._session() as conn:
            await conn.execute(
                "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (key, value),
            )
            await conn.commit()
            self._settings_cache[key] = value

    async def get_setting(self, key: str, default: str = "") -> str:
        if key in self._settings_cache:
            val = self._settings_cache[key]
            return val if val is not None else default
        async with self._session() as conn:
            cur = await conn.execute("SELECT value FROM app_settings WHERE key = ?", (key,))
            row = await cur.fetchone()
            if row is not None:
                self._settings_cache[key] = row[0]
                return row[0]
            self._settings_cache[key] = None
            return default

    async def get_user_checklist(self, user_id: int, scope: str) -> list[str]:
        async with self._session() as conn:
            cur = await conn.execute(
                "SELECT item_id FROM user_checklists WHERE user_id = ? AND scope = ? ORDER BY updated_at ASC",
                (user_id, scope),
            )
            return [str(r[0]) for r in await cur.fetchall()]

    async def get_all_user_checklists(self, user_id: int) -> dict[str, list[str]]:
        out: dict[str, list[str]] = {"marvel": [], "dc": [], "zitraks": []}
        async with self._session() as conn:
            cur = await conn.execute(
                "SELECT scope, item_id FROM user_checklists WHERE user_id = ? ORDER BY updated_at ASC",
                (user_id,),
            )
            for row in await cur.fetchall():
                out.setdefault(str(row[0]), []).append(str(row[1]))
        return out

    async def toggle_user_checklist_item(self, user_id: int, scope: str, item_id: str) -> tuple[bool, list[str]]:
        now = time.time()
        async with self._session() as conn:
            cur = await conn.execute(
                "SELECT 1 FROM user_checklists WHERE user_id = ? AND scope = ? AND item_id = ?",
                (user_id, scope, item_id),
            )
            exists = await cur.fetchone() is not None
            if exists:
                await conn.execute(
                    "DELETE FROM user_checklists WHERE user_id = ? AND scope = ? AND item_id = ?",
                    (user_id, scope, item_id),
                )
                checked_now = False
            else:
                await conn.execute(
                    "INSERT INTO user_checklists (user_id, scope, item_id, updated_at) VALUES (?, ?, ?, ?)",
                    (user_id, scope, item_id, now),
                )
                checked_now = True
            await conn.commit()

            list_cur = await conn.execute(
                "SELECT item_id FROM user_checklists WHERE user_id = ? AND scope = ? ORDER BY updated_at ASC",
                (user_id, scope),
            )
            items = [str(r[0]) for r in await list_cur.fetchall()]
        return checked_now, items

    async def bulk_update_user_checklist(
        self,
        user_id: int,
        scope: str,
        item_ids: list[str],
        mode: str = "add",
    ) -> list[str]:
        """mode: 'add' (mark list), 'remove' (unmark list), or 'replace' (overwrite entire scope)."""
        now = time.time()
        async with self._session() as conn:
            if mode == "replace":
                await conn.execute(
                    "DELETE FROM user_checklists WHERE user_id = ? AND scope = ?",
                    (user_id, scope),
                )
                if item_ids:
                    await conn.executemany(
                        "INSERT OR IGNORE INTO user_checklists (user_id, scope, item_id, updated_at) VALUES (?, ?, ?, ?)",
                        [(user_id, scope, k, now) for k in item_ids],
                    )
            elif mode == "remove":
                if item_ids:
                    await conn.executemany(
                        "DELETE FROM user_checklists WHERE user_id = ? AND scope = ? AND item_id = ?",
                        [(user_id, scope, k) for k in item_ids],
                    )
            else:
                if item_ids:
                    await conn.executemany(
                        "INSERT OR IGNORE INTO user_checklists (user_id, scope, item_id, updated_at) VALUES (?, ?, ?, ?)",
                        [(user_id, scope, k, now) for k in item_ids],
                    )
            await conn.commit()
            cur = await conn.execute(
                "SELECT item_id FROM user_checklists WHERE user_id = ? AND scope = ? ORDER BY updated_at ASC",
                (user_id, scope),
            )
            return [str(r[0]) for r in await cur.fetchall()]

    async def get_analytics(self) -> dict[str, Any]:
        async with self._session() as conn:
            u_cur = await conn.execute(
                "SELECT COUNT(*) AS total_users, COALESCE(SUM(tools_used), 0) AS total_runs, COALESCE(SUM(xp), 0) AS total_xp, COALESCE(SUM(profile_views), 0) AS total_views FROM users WHERE is_real = 1"
            )
            u_stats = dict(await u_cur.fetchone())

            cat_cur = await conn.execute(
                "SELECT category, COUNT(*) AS count FROM telemetry GROUP BY category ORDER BY count DESC"
            )
            by_category = [dict(r) for r in await cat_cur.fetchall()]

            tool_cur = await conn.execute(
                "SELECT tool_id, COUNT(*) AS count FROM telemetry GROUP BY tool_id ORDER BY count DESC LIMIT 12"
            )
            top_tools = [dict(r) for r in await tool_cur.fetchall()]

            src_cur = await conn.execute(
                "SELECT source, COUNT(*) AS count FROM telemetry GROUP BY source ORDER BY count DESC"
            )
            by_source = [dict(r) for r in await src_cur.fetchall()]

            recent_cur = await conn.execute(
                """
                SELECT t.id, t.user_id, u.first_name, u.username, t.tool_id, t.category, t.source, t.detail, t.created_at
                FROM telemetry t
                LEFT JOIN users u ON u.user_id = t.user_id
                ORDER BY t.id DESC
                LIMIT 25
                """
            )
            recent_events = [dict(r) for r in await recent_cur.fetchall()]

            notes_cur = await conn.execute("SELECT COUNT(*) AS c FROM notes")
            notes_count = (await notes_cur.fetchone())["c"]
            todos_cur = await conn.execute("SELECT COUNT(*) AS c FROM todos")
            todos_count = (await todos_cur.fetchone())["c"]

        leaders = await self.get_leaderboard("xp")
        return {
            "summary": {
                **u_stats,
                "notes_count": notes_count,
                "todos_count": todos_count,
            },
            "by_category": by_category,
            "top_tools": top_tools,
            "by_source": by_source,
            "recent_events": recent_events,
            "leaderboard": leaders,
        }


db = Database()
