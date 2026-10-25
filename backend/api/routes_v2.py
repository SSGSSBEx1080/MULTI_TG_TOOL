from __future__ import annotations

from typing import Any
from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from backend.config import DEFAULT_DEMO_USER_ID
from backend.database import db
from backend.tools.knowledge_hub import (
    CONCEPTS_WIKI_DB,
    JOJO_STANDS_DB,
    PROG_LANGS_DB,
    RELIGIONS_DB,
    query_population,
    roll_random_stand,
    search_constitutions,
    search_formulas,
)
from backend.tools.party_and_fun import (
    FOREIGN_TONGUE_TWISTERS,
    LIGURIA_TEXT,
    calculate_pencil_index,
    calculate_vodka_party,
    get_boredom_ideas,
)
from backend.tools.rhyme_and_links import (
    decode_qr_from_bytes,
    generate_russian_rhymes,
    inspect_and_clean_url,
)
from backend.tools.smart_units_nlp import smart_parse_and_convert
from backend.tools.social_and_dating import (
    altushka_chat_reply,
    check_turing_guess,
    get_altushka_personas,
    get_turing_round,
)

router = APIRouter(tags=["nexus-v2"])


# ==============================================================================
# 1. Вечеринка, Юмор и Анти-Скука (105+ идей + Лигурия)
# ==============================================================================
class AlcoholCalcReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    people_count: int = 4
    avg_weight_kg: float = 75.0
    gender_mix: str = "mixed"
    target_level: float = 18.0
    duration_hours: float = 5.0
    snack_level: str = "good"
    drink_type: str = "vodka"
    reserve_no_run: bool = True


@router.post("/api/v2/party/alcohol")
async def api_party_alcohol(req: AlcoholCalcReq) -> dict[str, Any]:
    res = calculate_vodka_party(
        people_count=req.people_count,
        avg_weight_kg=req.avg_weight_kg,
        gender_mix=req.gender_mix,
        target_level=req.target_level,
        duration_hours=req.duration_hours,
        snack_level=req.snack_level,
        drink_type=req.drink_type,
        reserve_no_run=req.reserve_no_run,
    )
    await db.record_tool_use(req.user_id, "vodka_calc", "party", "miniapp", f"{req.people_count} чел • ур.{req.target_level}", xp_gain=8)
    return res


class PencilCalcReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    height_cm: float = 180.0
    shoe_size_eu: float = 43.0
    nose_type: str = "medium"
    hand_span_cm: float = 21.0
    voice_timbre: str = "baritone"
    dota_mmr: int = 3000
    linux_user: bool = False
    coffee_cups: int = 2
    gym_pushups: int = 35
    zodiac_vibe: str = "fire"


@router.post("/api/v2/party/pencil")
async def api_party_pencil(req: PencilCalcReq) -> dict[str, Any]:
    res = calculate_pencil_index(
        height_cm=req.height_cm,
        shoe_size_eu=req.shoe_size_eu,
        nose_type=req.nose_type,
        hand_span_cm=req.hand_span_cm,
        voice_timbre=req.voice_timbre,
        dota_mmr=req.dota_mmr,
        linux_user=req.linux_user,
        coffee_cups=req.coffee_cups,
        gym_pushups=req.gym_pushups,
        zodiac_vibe=req.zodiac_vibe,
    )
    await db.record_tool_use(req.user_id, "pencil_calc", "party", "miniapp", f"{res['estimated_cm']} см", xp_gain=8)
    return res


@router.get("/api/v2/party/boredom")
async def api_party_boredom(
    category: str = "all",
    include_spicy: bool = False,
    count: int = 6,
    search: str = "",
    user_id: int = DEFAULT_DEMO_USER_ID,
) -> dict[str, Any]:
    res = get_boredom_ideas(category=category, include_spicy=include_spicy, count=count, search=search)
    await db.record_tool_use(user_id, "boredom_advisor", "party", "miniapp", category, xp_gain=5)
    return res


@router.get("/api/v2/party/liguria")
async def api_party_liguria() -> dict[str, Any]:
    return {
        "liguria": LIGURIA_TEXT,
        "foreign_twisters": FOREIGN_TONGUE_TWISTERS,
        "word_count": len(LIGURIA_TEXT.split()),
    }


# ==============================================================================
# 2. Умный Конвертер Единиц Измерения (Авто-понимание «6 дюймов»)
# ==============================================================================
class SmartUnitsReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    query: str


@router.post("/api/v2/units/smart")
async def api_smart_units(req: SmartUnitsReq) -> dict[str, Any]:
    try:
        res = smart_parse_and_convert(req.query)
        await db.record_tool_use(req.user_id, "smart_units", "calc", "miniapp", req.query[:30], xp_gain=6)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==============================================================================
# 3. Мега-База Знаний (Конституции, Религии, Мульти-Вики, ЕГЭ, Население)
# ==============================================================================
@router.get("/api/v2/knowledge/constitutions")
async def api_constitutions(q: str = "") -> dict[str, Any]:
    items = search_constitutions(q)
    return {"count": len(items), "items": items}


@router.get("/api/v2/knowledge/religions")
async def api_religions(q: str = "") -> dict[str, Any]:
    ql = (q or "").strip().lower()
    items = [
        r for r in RELIGIONS_DB
        if not ql
        or ql in r["name"].lower()
        or ql in r["scripture"].lower()
        or ql in r["core_beliefs"].lower()
        or ql in r["branches"].lower()
    ]
    return {"count": len(items), "items": items}


@router.get("/api/v2/knowledge/wiki")
async def api_multi_wiki(q: str = "", section: str = "all") -> dict[str, Any]:
    ql = (q or "").strip().lower()

    stands = [
        s for s in JOJO_STANDS_DB
        if not ql or ql in s["name"].lower() or ql in s["user"].lower() or ql in s["part"].lower() or ql in s["ability"].lower()
    ]
    concepts = [
        c for c in CONCEPTS_WIKI_DB
        if not ql or ql in c["term"].lower() or ql in c["cat"].lower() or ql in c["desc"].lower()
    ]
    langs = [
        l for l in PROG_LANGS_DB
        if not ql or ql in l["lang"].lower() or ql in l["best_for"].lower() or ql in l["typing"].lower()
    ]

    sec = section.lower()
    return {
        "jojo_stands": stands if sec in ("all", "jojo") else [],
        "concepts": concepts if sec in ("all", "concepts") else [],
        "prog_langs": langs if sec in ("all", "prog") else [],
    }


class RollStandReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    name: str = ""


@router.post("/api/v2/knowledge/roll-stand")
async def api_roll_stand(req: RollStandReq) -> dict[str, Any]:
    stand = roll_random_stand(req.name)
    await db.record_tool_use(req.user_id, "jojo_stand", "knowledge", "miniapp", stand["name"][:30], xp_gain=6)
    return {"stand": stand}


@router.get("/api/v2/knowledge/formulas")
async def api_formulas(subject: str = "all", q: str = "") -> dict[str, Any]:
    items = search_formulas(subject=subject, q=q)
    return {"count": len(items), "items": items}


@router.get("/api/v2/knowledge/population")
async def api_population(q: str = "", user_id: int = DEFAULT_DEMO_USER_ID) -> dict[str, Any]:
    res = query_population(q)
    if q.strip():
        await db.record_tool_use(user_id, "population_atlas", "knowledge", "miniapp", q[:30], xp_gain=5)
    return res


# ==============================================================================
# 4. Генератор Рифм + Чтение QR по Картинке + Укоротитель / Удлинитель Ссылок
# ==============================================================================
class RhymeReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    word: str


@router.post("/api/v2/rhyme")
async def api_rhyme(req: RhymeReq) -> dict[str, Any]:
    try:
        res = generate_russian_rhymes(req.word)
        await db.record_tool_use(req.user_id, "rhyme_generator", "text", "miniapp", res["word"], xp_gain=8)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api/v2/qr/decode")
async def api_qr_decode(
    file: UploadFile = File(...),
    user_id: int = DEFAULT_DEMO_USER_ID,
) -> dict[str, Any]:
    try:
        raw = await file.read()
        res = decode_qr_from_bytes(raw)
        await db.record_tool_use(user_id, "qr_decoder", "visual", "miniapp", "QR Scan", xp_gain=10)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ошибка чтения изображения: {e}")


class LinkCreateReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    url: str


@router.post("/api/v2/links/create")
async def api_create_link(req: LinkCreateReq, request: Request) -> dict[str, Any]:
    try:
        cleaned = inspect_and_clean_url(req.url)
        row = await db.create_link_pair(req.user_id, cleaned["cleaned_url"])
        base = str(request.base_url).rstrip("/")
        short_url = f"{base}/s/{row['code']}"
        long_url = f"{base}/long/{row['long_code']}?utm_epic=ultra_mega_nexus_quantum_hyper_redirect_v2_9000&verify=definitely_not_a_rickroll"
        await db.record_tool_use(req.user_id, "url_transformer", "visual", "miniapp", cleaned["domain"], xp_gain=8)
        return {
            **row,
            "short_url": short_url,
            "long_url": long_url,
            "short_path": f"/s/{row['code']}",
            "long_path": f"/long/{row['long_code']}",
            "cleaned_info": cleaned,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/v2/links/list")
async def api_list_links(request: Request, user_id: int = DEFAULT_DEMO_USER_ID) -> dict[str, Any]:
    rows = await db.list_user_links(user_id)
    base = str(request.base_url).rstrip("/")
    enriched = [
        {
            **r,
            "short_url": f"{base}/s/{r['code']}",
            "long_url": f"{base}/long/{r['long_code']}",
        }
        for r in rows
    ]
    return {"links": enriched}


@router.get("/s/{code}", include_in_schema=False)
async def redirect_short_link(code: str):
    target = await db.resolve_link(code)
    if not target:
        raise HTTPException(status_code=404, detail="Короткая ссылка не найдена")
    return RedirectResponse(url=target, status_code=307)


@router.get("/long/{long_code}", include_in_schema=False)
async def redirect_long_link(long_code: str):
    target = await db.resolve_link(long_code)
    if not target:
        raise HTTPException(status_code=404, detail="Длинная ссылка не найдена")
    return RedirectResponse(url=target, status_code=307)


# ==============================================================================
# 5. Аркада Мини-Игр (Волк ловит яйца, Doodle Jump, Тетрис, Кибер-Кликер)
# ==============================================================================
class GameScoreReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    game_id: str
    score: int


@router.post("/api/v2/games/score")
async def api_submit_game_score(req: GameScoreReq) -> dict[str, Any]:
    res = await db.submit_game_score(req.user_id, req.game_id, req.score)
    highs = await db.get_game_highscores(req.game_id, limit=8)
    return {**res, "highscores": highs}


@router.get("/api/v2/games/highscores")
async def api_get_game_highscores(game_id: str = "all") -> dict[str, Any]:
    highs = await db.get_game_highscores(game_id=game_id, limit=12)
    return {"highscores": highs}


# ==============================================================================
# 6. Лидерборд по всем параметрам + Профили с счётчиком заходов + Соц-хаб
# ==============================================================================
@router.get("/api/v2/social/leaderboard")
async def api_social_leaderboard(sort_by: str = "xp") -> dict[str, Any]:
    rows = await db.get_leaderboard(sort_by=sort_by, limit=20)
    return {"sort_by": sort_by, "users": rows}


@router.get("/api/v2/social/profile/{target_user_id}")
async def api_social_public_profile(
    target_user_id: int,
    viewer_id: int = DEFAULT_DEMO_USER_ID,
) -> dict[str, Any]:
    return await db.get_public_profile(target_user_id=target_user_id, viewer_id=viewer_id)


class ProfileUpdateReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    bio: str
    avatar_emoji: str = "⚡"
    first_name: str | None = None


@router.post("/api/v2/social/profile/update")
async def api_social_update_profile(req: ProfileUpdateReq) -> dict[str, Any]:
    updated = await db.update_user_profile(
        user_id=req.user_id,
        bio=req.bio,
        avatar_emoji=req.avatar_emoji,
        first_name=req.first_name,
    )
    return {"profile": updated}


class RespectReq(BaseModel):
    sender_id: int = DEFAULT_DEMO_USER_ID
    target_user_id: int


@router.post("/api/v2/social/respect")
async def api_social_respect(req: RespectReq) -> dict[str, Any]:
    profile = await db.give_respect(target_user_id=req.target_user_id, sender_id=req.sender_id)
    return {"profile": profile}


# --- Анонимный Чат ---
@router.get("/api/v2/social/anon")
async def api_get_anon_feed(room: str = "global") -> dict[str, Any]:
    msgs = await db.list_anon_messages(room=room, limit=40)
    return {"room": room, "messages": msgs}


class AnonPostReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    text: str
    room: str = "global"


@router.post("/api/v2/social/anon")
async def api_post_anon_msg(req: AnonPostReq) -> dict[str, Any]:
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Пустое сообщение")
    msgs = await db.post_anon_message(req.user_id, req.text, room=req.room)
    return {"room": req.room, "messages": msgs}


# --- Игра «Угадай: Человек или ИИ?» ---
@router.get("/api/v2/social/turing")
async def api_get_turing(exclude: str = "") -> dict[str, Any]:
    excl = [int(x) for x in exclude.split(",") if x.strip().isdigit()]
    return get_turing_round(excl)


class TuringGuessReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    round_id: int
    guess: str  # "human" | "ai"


@router.post("/api/v2/social/turing")
async def api_check_turing(req: TuringGuessReq) -> dict[str, Any]:
    res = check_turing_guess(req.round_id, req.guess)
    await db.record_tool_use(
        req.user_id,
        "turing_game",
        "social",
        "miniapp",
        "Верно!" if res["correct"] else "Промах",
        xp_gain=res["xp_reward"],
    )
    return res


# --- Bibinto: Оценка внешности и вайба 1..10 ---
@router.get("/api/v2/social/bibinto")
async def api_list_bibinto() -> dict[str, Any]:
    profiles = await db.list_dating_profiles()
    return {"profiles": profiles}


class BibintoRateReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    profile_id: int
    score: int


@router.post("/api/v2/social/bibinto/rate")
async def api_rate_bibinto(req: BibintoRateReq) -> dict[str, Any]:
    updated = await db.rate_dating_profile(req.profile_id, req.score, req.user_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Анкета не найдена")
    all_profiles = await db.list_dating_profiles()
    return {"rated": updated, "profiles": all_profiles}


class BibintoCreateReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    display_name: str
    age: int
    city: str
    vibe: str
    bio: str
    avatar_style: str = "⚡"


@router.post("/api/v2/social/bibinto/create")
async def api_create_bibinto(req: BibintoCreateReq) -> dict[str, Any]:
    if req.age < 18:
        raise HTTPException(status_code=400, detail="Раздел анкет и дейтинга строго 18+.")
    profiles = await db.create_dating_profile(
        user_id=req.user_id,
        display_name=req.display_name,
        age=req.age,
        city=req.city,
        vibe=req.vibe,
        bio=req.bio,
        avatar_style=req.avatar_style,
    )
    return {"profiles": profiles}


# --- Знакомство и флирт с Милыми Альтушками 18+ ---
@router.get("/api/v2/social/altushka")
async def api_altushka_list() -> dict[str, Any]:
    return {"personas": get_altushka_personas()}


class AltushkaChatReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    persona_id: str = "ksyusha"
    message: str
    affection: int = 25


@router.post("/api/v2/social/altushka")
async def api_altushka_chat(req: AltushkaChatReq) -> dict[str, Any]:
    res = altushka_chat_reply(req.persona_id, req.message, req.affection)
    await db.record_tool_use(req.user_id, "altushka_chat", "social", "miniapp", req.persona_id, xp_gain=6)
    return res


# ==============================================================================
# 7. Витрина Ссылок Автора (QLS СЕНЯ)
# ==============================================================================
@router.get("/api/v2/author")
async def api_get_author() -> dict[str, Any]:
    return await db.get_author_info()


class AuthorUpdateReq(BaseModel):
    title: str
    tagline: str
    bio: str
    links: list[dict[str, str]]
    donation_note: str


@router.post("/api/v2/author")
async def api_save_author(req: AuthorUpdateReq) -> dict[str, Any]:
    return await db.save_author_info(req.model_dump())
