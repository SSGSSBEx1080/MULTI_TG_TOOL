from __future__ import annotations

import json
import secrets
import time
from pathlib import Path
from typing import Any
import aiosqlite

from backend.config import DATABASE_PATH, DEFAULT_DEMO_USER_ID

RANKS = [
    (0, "🌱 Искатель", 50),
    (50, "⚡ Оператор", 150),
    (150, "🛠 Инженер", 400),
    (400, "🧬 Архитектор", 1000),
    (1000, "🌌 Кибермаг QLS", 3000),
    (3000, "👑 Абсолют NEXUS", 10000),
]

DEFAULT_AUTHOR_INFO = {
    "title": "QLS • MULTI_TG_TOOL",
    "name": "QLS • MULTI_TG_TOOL",
    "tagline": "В тени 🕶️",
    "bio": "Официальные площадки и прямая поддержка проекта.",
    "donation_note": "Прямая поддержка проекта:",
    "links": [
        {"label": "📺 YouTube", "title": "📺 YouTube", "url": "https://www.youtube.com/@qls8571", "badge": "YouTube", "emoji": "📺"},
        {"label": "🎵 TikTok", "title": "🎵 TikTok", "url": "https://www.tiktok.com/@qls_senya1488", "badge": "TikTok", "emoji": "🎵"},
        {"label": "✈️ Telegram — @QLSCENR", "title": "✈️ Telegram — @QLSCENR", "url": "https://t.me/QLSCENR", "badge": "Telegram", "emoji": "✈️"},
        {"label": "💎 Поддержать проект (ЮMoney)", "title": "💎 Поддержать проект (ЮMoney)", "url": "https://yoomoney.ru/fundraise/1JT4BDKO99S.260826", "badge": "Донат", "emoji": "💎"},
    ],
}


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
        badges.append("🔥 Ветеран")
    if user_row.get("tools_used", 0) >= 15:
        badges.append("🛠 Мастер на все руки")
    if user_row.get("best_game_score", 0) >= 200:
        badges.append("🕹 Король Аркад")
    if user_row.get("profile_views", 0) >= 10:
        badges.append("🌟 Популярный")
    if user_row.get("respects", 0) >= 5:
        badges.append("💎 Авторитет")
    if not badges:
        badges.append("🌱 Первопроходец")
    return badges


class Database:
    def __init__(self, db_path: Path = DATABASE_PATH) -> None:
        self.db_path = db_path

    async def init(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        async with aiosqlite.connect(self.db_path) as db:
            await db.executescript(
                """
                PRAGMA journal_mode=WAL;

                CREATE TABLE IF NOT EXISTS users (
                    user_id INTEGER PRIMARY KEY,
                    username TEXT DEFAULT '',
                    first_name TEXT DEFAULT 'Пользователь',
                    bio TEXT DEFAULT 'Исследователь экосистемы NEXUS',
                    avatar_emoji TEXT DEFAULT '🦊',
                    xp INTEGER DEFAULT 0,
                    tools_used INTEGER DEFAULT 0,
                    profile_views INTEGER DEFAULT 0,
                    respects INTEGER DEFAULT 0,
                    best_game_score INTEGER DEFAULT 0,
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
                    vibe TEXT DEFAULT 'Альт / Гейминг',
                    avatar_emoji TEXT DEFAULT '🖤',
                    rating_sum INTEGER DEFAULT 0,
                    rating_count INTEGER DEFAULT 0,
                    likes_count INTEGER DEFAULT 0,
                    created_at REAL NOT NULL
                );
                """
            )
            # Safe schema migrations if upgrading an earlier nexus.db
            cur = await db.execute("PRAGMA table_info(users)")
            existing_cols = {r[1] for r in await cur.fetchall()}
            migrations = [
                ("bio", "TEXT DEFAULT 'Исследователь экосистемы NEXUS'"),
                ("avatar_emoji", "TEXT DEFAULT '🦊'"),
                ("profile_views", "INTEGER DEFAULT 0"),
                ("respects", "INTEGER DEFAULT 0"),
                ("best_game_score", "INTEGER DEFAULT 0"),
            ]
            for col_name, col_def in migrations:
                if col_name not in existing_cols:
                    await db.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")
            await db.commit()
        await self._seed_demo_if_needed()

    async def _seed_demo_if_needed(self) -> None:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            now = time.time()

            # Ensure main demo user
            cur = await db.execute("SELECT COUNT(*) AS c FROM users")
            user_cnt = (await cur.fetchone())["c"]
            if user_cnt < 4:
                demo_users = [
                    (DEFAULT_DEMO_USER_ID, "QLSCENR", "QLS", "Архитектор в тени 🕶️", "👑", 620, 42, 28, 19, 840),
                    (880101, "jotaro_kujo", "Джотаро", "Yare Yare Daze • Мейнер Star Platinum и Тетриса", "⭐", 1240, 87, 64, 41, 1450),
                    (880102, "alt_ksusha", "Ксюша Альтушка", "Слушаю пост-панк, пью вишнёвый энергос и оцениваю анкеты в Бибинто 🖤", "🦇", 890, 53, 112, 77, 620),
                    (880103, "dota_theory", "Артур 7к ММР", "Собираю кастомные билды на всех героев кроме Кеза и Рингмастера", "⚔️", 540, 39, 31, 15, 980),
                    (880104, "phys_ege_100", "Мария Сотка", "Сдала физику и профильный мат на 100, живу в справочнике формул", "🧬", 430, 34, 45, 29, 510),
                ]
                for uid, uname, fname, bio, emo, xp, t_used, p_views, resp, g_score in demo_users:
                    await db.execute(
                        """
                        INSERT INTO users (user_id, username, first_name, bio, avatar_emoji, xp, tools_used, profile_views, respects, best_game_score, created_at, last_active)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(user_id) DO UPDATE SET
                            bio = excluded.bio,
                            avatar_emoji = excluded.avatar_emoji,
                            profile_views = MAX(users.profile_views, excluded.profile_views),
                            respects = MAX(users.respects, excluded.respects),
                            best_game_score = MAX(users.best_game_score, excluded.best_game_score)
                        """,
                        (uid, uname, fname, bio, emo, xp, t_used, p_views, resp, g_score, now - 86400 * 5, now),
                    )

            # Seed Dating / Bibinto profiles if empty
            d_cur = await db.execute("SELECT COUNT(*) AS c FROM dating_profiles")
            if (await d_cur.fetchone())["c"] == 0:
                bibinto_seed = [
                    (880102, "Ксюша", 19, "Санкт-Петербург", "Чёрные стрелки, парные аватарки, смотрю Сайки Кусуо и ищу с кем пойти в кооп 🖤", "Альтушка / Аниме", "🦇", 184, 20, 48),
                    (880201, "Алина", 21, "Москва", "Художница, обожаю мангу «Бродяга» и ночные прогулки с чаем в термосе ✨", "Творчество / Манга", "🎨", 169, 19, 39),
                    (880202, "Рин", 20, "Екатеринбург", "Пройду за тебя босса в Sekiro, если приготовишь вкусную пасту по рецепту 🍜", "Хардкор Гейминг", "🎮", 192, 21, 61),
                    (880203, "Даниил", 22, "Новосибирск", "Собираю самовоспроизводящийся 3D-принтер и шарю за все 9 частей ДжоДжо", "Инженерия / JoJo", "🤖", 145, 17, 27),
                    (880204, "Вика", 19, "Казань", "Готика, винил, котики и мемы в 3 часа ночи. Оценивай честно!", "Готика / Музыка", "🐈‍⬛", 176, 19, 44),
                ]
                for uid, name, age, city, bio, vibe, emo, r_sum, r_cnt, likes in bibinto_seed:
                    await db.execute(
                        """
                        INSERT INTO dating_profiles (user_id, display_name, age, city, bio, vibe, avatar_emoji, rating_sum, rating_count, likes_count, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (uid, name, age, city, bio, vibe, emo, r_sum, r_cnt, likes, now - 7200),
                    )

            # Seed Anon Chat room if empty
            a_cur = await db.execute("SELECT COUNT(*) AS c FROM anon_messages")
            if (await a_cur.fetchone())["c"] == 0:
                seed_msgs = [
                    ("global", 880102, "🦇 Тёмный Лотос", "Кто-нибудь реально выговаривал всю скороговорку «Лигурия» без сбоя дыхания? 😅"),
                    ("global", 880103, "⚔️ Фантом #404", "Я дошёл до «четвертьчетверика чечевицы» и сломал язык ахах"),
                    ("global", 880101, "⭐ Странник", "Добро пожаловать в анонимную частоту NEXUS! Здесь никто не знает твой ID."),
                ]
                for idx, (room, sid, alias, txt) in enumerate(seed_msgs):
                    await db.execute(
                        "INSERT INTO anon_messages (room, sender_id, alias, text, created_at) VALUES (?, ?, ?, ?, ?)",
                        (room, sid, alias, txt, now - (3 - idx) * 180),
                    )

            # Seed Game Scores if empty
            g_cur = await db.execute("SELECT COUNT(*) AS c FROM game_scores")
            if (await g_cur.fetchone())["c"] == 0:
                for uid, gid, sc in [
                    (880101, "tetris", 1450),
                    (880103, "wolf_eggs", 980),
                    (DEFAULT_DEMO_USER_ID, "doodle_jump", 840),
                    (880102, "clicker", 620),
                ]:
                    await db.execute(
                        "INSERT INTO game_scores (user_id, game_id, score, created_at) VALUES (?, ?, ?, ?)",
                        (uid, gid, sc, now - 3600),
                    )

            # Seed Favorites & Notes if empty
            f_cur = await db.execute("SELECT COUNT(*) AS c FROM favorites WHERE user_id = ?", (DEFAULT_DEMO_USER_ID,))
            if (await f_cur.fetchone())[0] == 0:
                for fav in ("vodka_calc", "boredom_buster", "arcade_games", "jojo_wiki", "smart_units", "author_links"):
                    await db.execute(
                        "INSERT OR IGNORE INTO favorites (user_id, tool_id, created_at) VALUES (?, ?, ?)",
                        (DEFAULT_DEMO_USER_ID, fav, now),
                    )

            await db.commit()

    def _enrich_user(self, row: aiosqlite.Row | dict[str, Any]) -> dict[str, Any]:
        data = dict(row)
        rnk = compute_rank(data.get("xp", 0))
        data["rank"] = rnk
        data["rank_title"] = rnk["title"]
        data["progress_pct"] = rnk["progress_pct"]
        data["badges"] = compute_badges(data)
        return data

    async def ensure_user(
        self, user_id: int, username: str = "", first_name: str = "Пользователь"
    ) -> dict[str, Any]:
        now = time.time()
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute("SELECT * FROM users WHERE user_id = ?", (user_id,))
            row = await cur.fetchone()
            if row is None:
                await db.execute(
                    """
                    INSERT INTO users (user_id, username, first_name, xp, tools_used, created_at, last_active)
                    VALUES (?, ?, ?, 15, 0, ?, ?)
                    """,
                    (user_id, username or "", first_name or "Пользователь", now, now),
                )
                await db.commit()
                cur = await db.execute("SELECT * FROM users WHERE user_id = ?", (user_id,))
                row = await cur.fetchone()
            else:
                await db.execute(
                    "UPDATE users SET last_active = ? WHERE user_id = ?",
                    (now, user_id),
                )
                await db.commit()
            return self._enrich_user(row)

    async def get_public_profile(
        self, target_user_id: int, visitor_user_id: int = 0, viewer_id: int | None = None
    ) -> dict[str, Any]:
        if viewer_id is not None:
            visitor_user_id = viewer_id
        now = time.time()
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute("SELECT * FROM users WHERE user_id = ?", (target_user_id,))
            row = await cur.fetchone()
            if row is None:
                raise ValueError("Профиль пользователя не найден")

            if visitor_user_id and visitor_user_id != target_user_id:
                await db.execute(
                    "UPDATE users SET profile_views = profile_views + 1 WHERE user_id = ?",
                    (target_user_id,),
                )
                await db.execute(
                    "INSERT INTO profile_visits (target_user_id, visitor_user_id, visited_at) VALUES (?, ?, ?)",
                    (target_user_id, visitor_user_id, now),
                )
                await db.commit()
                cur = await db.execute("SELECT * FROM users WHERE user_id = ?", (target_user_id,))
                row = await cur.fetchone()

            uv_cur = await db.execute(
                "SELECT COUNT(DISTINCT visitor_user_id) AS c FROM profile_visits WHERE target_user_id = ?",
                (target_user_id,),
            )
            uniq_vis = (await uv_cur.fetchone())["c"]

            fav_cur = await db.execute(
                "SELECT tool_id FROM favorites WHERE user_id = ? LIMIT 8", (target_user_id,)
            )
            favs = [r[0] for r in await fav_cur.fetchall()]

            g_cur = await db.execute(
                "SELECT game_id, MAX(score) AS best FROM game_scores WHERE user_id = ? GROUP BY game_id ORDER BY best DESC",
                (target_user_id,),
            )
            game_list = [{"game_id": r["game_id"], "score": r["best"]} for r in await g_cur.fetchall()]

            top_t_cur = await db.execute(
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
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "UPDATE users SET first_name = ?, bio = ?, avatar_emoji = ? WHERE user_id = ?",
                (first_name.strip()[:40] or "Игрок", bio.strip()[:180], avatar_emoji.strip()[:4] or "🦊", user_id),
            )
            await db.commit()
        return await self.ensure_user(user_id)

    async def update_user_profile(
        self, user_id: int, bio: str, avatar_emoji: str = "⚡", first_name: str | None = None
    ) -> dict[str, Any]:
        cur_u = await self.ensure_user(user_id)
        fname = first_name.strip() if first_name and first_name.strip() else cur_u.get("first_name", "Игрок")
        return await self.update_user_bio(user_id, fname, bio, avatar_emoji)

    async def give_respect(
        self, target_user_id: int, from_user_id: int = 0, sender_id: int | None = None
    ) -> dict[str, Any]:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "UPDATE users SET respects = respects + 1, xp = xp + 15 WHERE user_id = ?",
                (target_user_id,),
            )
            await db.commit()
        return await self.get_public_profile(target_user_id, visitor_user_id=0)

    async def get_leaderboard(self, sort_by: str = "xp", limit: int = 25) -> list[dict[str, Any]]:
        order_col = {
            "xp": "xp DESC",
            "tools": "tools_used DESC",
            "games": "best_game_score DESC",
            "views": "profile_views DESC",
            "respects": "respects DESC",
        }.get(sort_by, "xp DESC")
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute(f"SELECT * FROM users ORDER BY {order_col} LIMIT ?", (limit,))
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
        xp_gain: int = 12,
    ) -> dict[str, Any]:
        await self.ensure_user(user_id)
        now = time.time()
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                UPDATE users
                SET xp = xp + ?, tools_used = tools_used + 1, last_active = ?
                WHERE user_id = ?
                """,
                (xp_gain, now, user_id),
            )
            await db.execute(
                """
                INSERT INTO telemetry (user_id, tool_id, category, source, detail, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (user_id, tool_id, category, source, detail[:200], now),
            )
            await db.commit()
        return await self.ensure_user(user_id)

    async def record_game_score(self, user_id: int, game_id: str, score: int) -> dict[str, Any]:
        await self.ensure_user(user_id)
        now = time.time()
        xp_bonus = max(5, min(80, score // 15))
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            await db.execute(
                "INSERT INTO game_scores (user_id, game_id, score, created_at) VALUES (?, ?, ?, ?)",
                (user_id, game_id, int(score), now),
            )
            await db.execute(
                """
                UPDATE users
                SET best_game_score = MAX(best_game_score, ?),
                    xp = xp + ?,
                    last_active = ?
                WHERE user_id = ?
                """,
                (int(score), xp_bonus, now, user_id),
            )
            await db.commit()
            cur = await db.execute(
                """
                SELECT g.game_id, MAX(g.score) AS score, u.first_name, u.avatar_emoji, u.user_id
                FROM game_scores g
                JOIN users u ON u.user_id = g.user_id
                WHERE g.game_id = ?
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
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            if game_id in ("all", ""):
                cur = await db.execute(
                    """
                    SELECT g.game_id, MAX(g.score) AS best_score, u.first_name, u.avatar_emoji, u.user_id
                    FROM game_scores g
                    JOIN users u ON u.user_id = g.user_id
                    GROUP BY g.user_id, g.game_id
                    ORDER BY best_score DESC
                    LIMIT ?
                    """,
                    (limit,),
                )
            else:
                cur = await db.execute(
                    """
                    SELECT g.game_id, MAX(g.score) AS best_score, u.first_name, u.avatar_emoji, u.user_id
                    FROM game_scores g
                    JOIN users u ON u.user_id = g.user_id
                    WHERE g.game_id = ?
                    GROUP BY g.user_id
                    ORDER BY best_score DESC
                    LIMIT ?
                    """,
                    (game_id, limit),
                )
            return [dict(r) for r in await cur.fetchall()]

    # --- Short & Absurdly Long Links ---
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
        filler = (
            "sverkhdlinnaya-giper-ssylka-nexus-multitool-chtoby-drug-udivilsya-maksimalno-"
            + secrets.token_hex(36)
            + "-konets-marshruta"
        )
        now = time.time()
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute("SELECT * FROM short_links WHERE code = ?", (code,))
            if await cur.fetchone():
                code = f"{code}_{secrets.token_hex(2)}"
            await db.execute(
                """
                INSERT INTO short_links (code, long_code, target_url, clicks, created_by, created_at)
                VALUES (?, ?, ?, 0, ?, ?)
                """,
                (code, filler, url, user_id, now),
            )
            await db.commit()
        return {"code": code, "long_code": filler, "target_url": url, "clicks": 0}

    async def resolve_link(self, token: str) -> str | None:
        async with aiosqlite.connect(self.db_path) as db:
            cur = await db.execute(
                "SELECT code, target_url FROM short_links WHERE code = ? OR long_code = ?",
                (token, token),
            )
            row = await cur.fetchone()
            if not row:
                return None
            await db.execute("UPDATE short_links SET clicks = clicks + 1 WHERE code = ?", (row[0],))
            await db.commit()
            return row[1]

    async def list_links(self, limit: int = 12) -> list[dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute("SELECT * FROM short_links ORDER BY created_at DESC LIMIT ?", (limit,))
            return [dict(r) for r in await cur.fetchall()]

    async def list_user_links(self, user_id: int = 0) -> list[dict[str, Any]]:
        return await self.list_links(12)

    # --- Anonymous Chat ---
    async def post_anon_message(
        self, first_arg: str | int, second_arg: int | str, alias: str = "", text: str = "", room: str = "global"
    ) -> list[dict[str, Any]]:
        if isinstance(first_arg, int) and isinstance(second_arg, str):
            sender_id = first_arg
            msg_text = second_arg
            mask_hex = f"{(sender_id * 2654435761) & 0xFFFF:04X}"
            alias_str = f"🕵️ Фантом #{mask_hex}"
            room_str = room or "global"
        else:
            room_str = str(first_arg) or "global"
            sender_id = int(second_arg)
            alias_str = alias.strip()[:32] or "🕵️ Аноним"
            msg_text = text
        now = time.time()
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "INSERT INTO anon_messages (room, sender_id, alias, text, created_at) VALUES (?, ?, ?, ?, ?)",
                (room_str, sender_id, alias_str, msg_text.strip()[:600], now),
            )
            await db.commit()
        return await self.get_anon_messages(room_str)

    async def get_anon_messages(self, room: str = "global", limit: int = 40) -> list[dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute(
                "SELECT * FROM anon_messages WHERE room = ? ORDER BY id DESC LIMIT ?",
                (room or "global", limit),
            )
            rows = [dict(r) for r in await cur.fetchall()]
            rows.reverse()
            return rows

    async def list_anon_messages(self, room: str = "global", limit: int = 40) -> list[dict[str, Any]]:
        return await self.get_anon_messages(room=room, limit=limit)

    # --- Bibinto / Dating ---
    def _enrich_dating(self, row: aiosqlite.Row | dict[str, Any]) -> dict[str, Any]:
        d = dict(row)
        d["id"] = d.get("id") or d.get("user_id")
        d["avg_rating"] = d.get("avg_score", 0.0)
        d["votes_count"] = d.get("rating_count", 0)
        d["avatar_style"] = d.get("avatar_emoji", "🔥")
        return d

    async def list_dating_profiles(self) -> list[dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute(
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
        vibe: str = "Гейминг / Аниме",
        avatar_emoji: str = "🔥",
    ) -> dict[str, Any]:
        now = time.time()
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT INTO dating_profiles (user_id, display_name, age, city, bio, vibe, avatar_emoji, rating_sum, rating_count, likes_count, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 10, 1, 1, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    display_name = excluded.display_name,
                    age = excluded.age,
                    city = excluded.city,
                    bio = excluded.bio,
                    vibe = excluded.vibe,
                    avatar_emoji = excluded.avatar_emoji
                """,
                (user_id, display_name.strip()[:32], max(18, min(99, int(age))), city.strip()[:40], bio.strip()[:240], vibe.strip()[:40], avatar_emoji.strip()[:4] or "🔥", now),
            )
            await db.commit()
        profiles = await self.list_dating_profiles()
        return next((p for p in profiles if p["user_id"] == user_id), profiles[0])

    async def create_dating_profile(
        self,
        user_id: int,
        display_name: str,
        age: int,
        city: str,
        vibe: str,
        bio: str,
        avatar_style: str = "⚡",
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
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                UPDATE dating_profiles
                SET rating_sum = rating_sum + ?,
                    rating_count = rating_count + 1,
                    likes_count = likes_count + ?
                WHERE user_id = ?
                """,
                (clamped, like_inc, target_user_id),
            )
            await db.commit()
        profiles = await self.list_dating_profiles()
        return next((p for p in profiles if p["user_id"] == target_user_id), {})

    # --- Author Card Settings ---
    def _normalize_author(self, info: dict[str, Any]) -> dict[str, Any]:
        out = dict(info)
        out["title"] = out.get("title") or out.get("name") or "QLS • MULTI_TG_TOOL"
        out["name"] = out["title"]
        out["donation_note"] = out.get("donation_note") or "Прямая поддержка проекта:"
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

    # --- Existing Favorites, Notes, Todos, Settings & Analytics ---
    async def toggle_favorite(self, user_id: int, tool_id: str) -> bool:
        async with aiosqlite.connect(self.db_path) as db:
            cur = await db.execute(
                "SELECT 1 FROM favorites WHERE user_id = ? AND tool_id = ?",
                (user_id, tool_id),
            )
            if await cur.fetchone():
                await db.execute(
                    "DELETE FROM favorites WHERE user_id = ? AND tool_id = ?",
                    (user_id, tool_id),
                )
                await db.commit()
                return False
            await db.execute(
                "INSERT INTO favorites (user_id, tool_id, created_at) VALUES (?, ?, ?)",
                (user_id, tool_id, time.time()),
            )
            await db.commit()
            return True

    async def list_favorites(self, user_id: int) -> list[str]:
        async with aiosqlite.connect(self.db_path) as db:
            cur = await db.execute(
                "SELECT tool_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC",
                (user_id,),
            )
            return [r[0] for r in await cur.fetchall()]

    async def list_notes(self, user_id: int, search: str = "") -> list[dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            if search.strip():
                q = f"%{search.strip()}%"
                cur = await db.execute(
                    "SELECT * FROM notes WHERE user_id = ? AND (title LIKE ? OR content LIKE ? OR tag LIKE ?) ORDER BY pinned DESC, updated_at DESC",
                    (user_id, q, q, q),
                )
            else:
                cur = await db.execute(
                    "SELECT * FROM notes WHERE user_id = ? ORDER BY pinned DESC, updated_at DESC",
                    (user_id,),
                )
            return [dict(r) for r in await cur.fetchall()]

    async def create_note(
        self, user_id: int, title: str, content: str, tag: str = "general", pinned: bool = False
    ) -> dict[str, Any]:
        now = time.time()
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute(
                "INSERT INTO notes (user_id, title, content, tag, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (user_id, title.strip() or "Заметка", content.strip(), tag.strip() or "general", int(pinned), now, now),
            )
            note_id = cur.lastrowid
            await db.commit()
            cur = await db.execute("SELECT * FROM notes WHERE id = ?", (note_id,))
            return dict(await cur.fetchone())

    async def toggle_note_pin(self, user_id: int, note_id: int) -> bool:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "UPDATE notes SET pinned = CASE WHEN pinned = 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ? AND user_id = ?",
                (time.time(), note_id, user_id),
            )
            await db.commit()
            return True

    async def delete_note(self, user_id: int, note_id: int) -> bool:
        async with aiosqlite.connect(self.db_path) as db:
            cur = await db.execute("DELETE FROM notes WHERE id = ? AND user_id = ?", (note_id, user_id))
            await db.commit()
            return cur.rowcount > 0

    async def list_todos(self, user_id: int) -> list[dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute("SELECT * FROM todos WHERE user_id = ? ORDER BY done ASC, id DESC", (user_id,))
            return [dict(r) for r in await cur.fetchall()]

    async def add_todo(self, user_id: int, text: str, priority: str = "normal") -> dict[str, Any]:
        now = time.time()
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute(
                "INSERT INTO todos (user_id, text, done, priority, created_at) VALUES (?, ?, 0, ?, ?)",
                (user_id, text.strip(), priority, now),
            )
            todo_id = cur.lastrowid
            await db.commit()
            cur = await db.execute("SELECT * FROM todos WHERE id = ?", (todo_id,))
            return dict(await cur.fetchone())

    async def toggle_todo(self, user_id: int, todo_id: int) -> list[dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "UPDATE todos SET done = CASE WHEN done = 1 THEN 0 ELSE 1 END WHERE id = ? AND user_id = ?",
                (todo_id, user_id),
            )
            await db.commit()
        return await self.list_todos(user_id)

    async def delete_todo(self, user_id: int, todo_id: int) -> bool:
        async with aiosqlite.connect(self.db_path) as db:
            cur = await db.execute("DELETE FROM todos WHERE id = ? AND user_id = ?", (todo_id, user_id))
            await db.commit()
            return cur.rowcount > 0

    async def clear_completed_todos(self, user_id: int) -> int:
        async with aiosqlite.connect(self.db_path) as db:
            cur = await db.execute("DELETE FROM todos WHERE user_id = ? AND done = 1", (user_id,))
            await db.commit()
            return cur.rowcount

    async def set_setting(self, key: str, value: str) -> None:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (key, value),
            )
            await db.commit()

    async def get_setting(self, key: str, default: str = "") -> str:
        async with aiosqlite.connect(self.db_path) as db:
            cur = await db.execute("SELECT value FROM app_settings WHERE key = ?", (key,))
            row = await cur.fetchone()
            return row[0] if row else default

    async def get_analytics(self) -> dict[str, Any]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            u_cur = await db.execute(
                "SELECT COUNT(*) AS total_users, COALESCE(SUM(tools_used), 0) AS total_runs, COALESCE(SUM(xp), 0) AS total_xp, COALESCE(SUM(profile_views), 0) AS total_views FROM users"
            )
            u_stats = dict(await u_cur.fetchone())

            cat_cur = await db.execute(
                "SELECT category, COUNT(*) AS count FROM telemetry GROUP BY category ORDER BY count DESC"
            )
            by_category = [dict(r) for r in await cat_cur.fetchall()]

            tool_cur = await db.execute(
                "SELECT tool_id, COUNT(*) AS count FROM telemetry GROUP BY tool_id ORDER BY count DESC LIMIT 12"
            )
            top_tools = [dict(r) for r in await tool_cur.fetchall()]

            src_cur = await db.execute(
                "SELECT source, COUNT(*) AS count FROM telemetry GROUP BY source ORDER BY count DESC"
            )
            by_source = [dict(r) for r in await src_cur.fetchall()]

            recent_cur = await db.execute(
                """
                SELECT t.id, t.user_id, u.first_name, u.username, t.tool_id, t.category, t.source, t.detail, t.created_at
                FROM telemetry t
                LEFT JOIN users u ON u.user_id = t.user_id
                ORDER BY t.id DESC
                LIMIT 25
                """
            )
            recent_events = [dict(r) for r in await recent_cur.fetchall()]
            leaders = await self.get_leaderboard("xp")

            notes_cur = await db.execute("SELECT COUNT(*) AS c FROM notes")
            todos_cur = await db.execute("SELECT COUNT(*) AS c FROM todos")

            return {
                "summary": {
                    **u_stats,
                    "notes_count": (await notes_cur.fetchone())["c"],
                    "todos_count": (await todos_cur.fetchone())["c"],
                },
                "by_category": by_category,
                "top_tools": top_tools,
                "by_source": by_source,
                "recent_events": recent_events,
                "leaderboard": leaders,
            }


db = Database()
