from __future__ import annotations

import asyncio
import base64
from pathlib import Path
from typing import Any
from aiogram.types import BufferedInputFile
from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel, Field

from backend.api.tg_auth import resolve_api_user
from backend.bot.factory import bot_manager
from backend.config import DATA_DIR, DEFAULT_DEMO_USER_ID, GENERATED_DIR
from backend.database import FAKE_SEED_USER_IDS, db
from backend.tools.astrology_and_physics import (
    PHYSICS_CALCULATORS,
    SPECIFIC_HEATS,
    ZODIAC_SIGNS,
    analyze_birth_date,
    calculate_compatibility,
    get_horoscope,
    solve_physics,
)
from backend.tools.knowledge_hub import (
    CONCEPTS_WIKI_DB,
    JOJO_STANDS_DB,
    PROG_LANGS_DB,
    get_earth_webcams,
    get_enriched_religions,
    intuitive_omni_search,
    query_population,
    roll_random_stand,
    search_constitutions,
    search_formulas,
)
from backend.tools.spy_and_guess_engine import (
    create_spy_lobby,
    finish_spy_round_by_host,
    get_spy_lobby_view,
    get_spy_locations_list,
    join_spy_lobby,
    spy_guess_location,
    start_spy_round,
    vote_spy_player,
)
from backend.tools.timbrica_activities import (
    get_ege_stress_deck,
    get_lie_detector_pack,
    roll_croco_words,
    transliterate_multistandard,
    yoficate_russian_text,
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
from backend.tools.universes_hub import (
    VALID_SCOPES,
    compute_dc_summary,
    compute_marvel_summary,
    compute_zitraks_summary,
    export_zmsave_code,
    filter_valid_ids,
    get_universes_catalog,
    is_valid_item_id,
    parse_zmsave_code,
)
from backend.tools.social_and_dating import (
    altushka_chat_reply,
    check_turing_guess,
    get_altushka_personas,
    get_turing_round,
)

router = APIRouter(tags=["nexus-v2"])


# ==============================================================================
# 0. Гороскоп, Знаки Зодиака, Совместимость и Физика
# ==============================================================================
@router.get("/api/v2/astrology/signs")
async def api_astrology_signs() -> dict[str, Any]:
    return {"signs": ZODIAC_SIGNS}


@router.get("/api/v2/astrology/horoscope")
async def api_astrology_horoscope(
    request: Request,
    sign: str = "aries",
    period: str = "today",
    user_id: int = DEFAULT_DEMO_USER_ID,
) -> dict[str, Any]:
    uid = await resolve_api_user(request, user_id)
    res = get_horoscope(sign, period=period)
    await db.record_tool_use(uid, "daily_horoscope", "horoscope", "miniapp", f"{res['sign']['name']}:{period}", xp_gain=5)
    return res


class BirthDateReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    date: str


@router.post("/api/v2/astrology/birth")
async def api_astrology_birth(req: BirthDateReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        res = analyze_birth_date(req.date)
        await db.record_tool_use(uid, "zodiac_info", "horoscope", "miniapp", res["sign"]["name"], xp_gain=6)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


class CompatibilityReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    first: str
    second: str
    name1: str = ""
    name2: str = ""


@router.post("/api/v2/astrology/compatibility")
async def api_astrology_compat(req: CompatibilityReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    if not req.first.strip() or not req.second.strip():
        raise HTTPException(status_code=400, detail="Укажите обе даты рождения или оба знака зодиака")
    try:
        res = calculate_compatibility(req.first, req.second, req.name1, req.name2)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await db.record_tool_use(
        uid,
        "compat_calc",
        "horoscope",
        "miniapp",
        f"{res['person1']['sign']['name']}+{res['person2']['sign']['name']}={res['overall_pct']}%",
        xp_gain=8,
    )
    return res


@router.get("/api/v2/physics/catalog")
async def api_physics_catalog() -> dict[str, Any]:
    materials = [{"id": k, "label": v[0], "c": v[1]} for k, v in SPECIFIC_HEATS.items()]
    return {"calculators": PHYSICS_CALCULATORS, "materials": materials}


class PhysicsSolveReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    calc_id: str
    target_var: str
    params: dict[str, float]


@router.post("/api/v2/physics/solve")
async def api_physics_solve(req: PhysicsSolveReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        res = solve_physics(req.calc_id, req.target_var, req.params)
        await db.record_tool_use(uid, req.calc_id, "physics", "miniapp", f"{req.target_var}={res['si_value']}", xp_gain=8)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==============================================================================
# File Download & Send-to-Telegram-Chat Helpers (for Telegram WebView)
# ==============================================================================
def _resolve_media_path(download_url: str) -> Path:
    from backend.config import GENERATED_DIR, UPLOADS_DIR

    rel = download_url.strip()
    if rel.startswith("/media/"):
        rel = rel[len("/media/") :]
    target = (DATA_DIR / rel).resolve()
    allowed_roots = (GENERATED_DIR.resolve(), UPLOADS_DIR.resolve())
    if not any(target.is_relative_to(root) for root in allowed_roots) or not target.is_file():
        raise HTTPException(status_code=404, detail="Файл не найден на сервере")
    return target


@router.get("/api/v2/files/download")
async def api_download_attachment(url: str, name: str = "file") -> FileResponse:
    target = _resolve_media_path(url)
    safe_name = "".join(c for c in name if c.isalnum() or c in ("-", "_", ".")).strip(".") or target.name
    return FileResponse(path=target, filename=safe_name)


class SendFileToChatReq(BaseModel):
    download_url: str = ""
    data_url: str = ""
    filename: str = "result.png"
    caption: str = ""


@router.post("/api/v2/files/send-to-chat")
async def api_send_file_to_chat(req: SendFileToChatReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, 0)
    if not uid or uid in FAKE_SEED_USER_IDS or uid >= 900_000_000_000:
        raise HTTPException(status_code=400, detail="Отправка в чат доступна при открытии внутри Telegram")
    if not bot_manager.live_bot:
        raise HTTPException(status_code=400, detail="Бот не подключён к Telegram API")

    raw_bytes: bytes
    if req.download_url:
        target = _resolve_media_path(req.download_url)
        raw_bytes = target.read_bytes()
    elif req.data_url and "," in req.data_url:
        raw_bytes = base64.b64decode(req.data_url.split(",", 1)[1])
    else:
        raise HTTPException(status_code=400, detail="Нет данных файла")

    safe_name = "".join(c for c in req.filename if c.isalnum() or c in ("-", "_", ".")).strip(".") or "file.bin"
    try:
        await bot_manager.live_bot.send_document(
            chat_id=uid,
            document=BufferedInputFile(raw_bytes, filename=safe_name),
            caption=(req.caption or safe_name)[:200],
        )
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Не удалось отправить файл в чат: {e}")


# ==============================================================================
# 1. Досуг и Развлечения
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
async def api_party_alcohol(req: AlcoholCalcReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
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
    await db.record_tool_use(uid, "vodka_calc", "party", "miniapp", f"{req.people_count} чел", xp_gain=8)
    return res


class PencilCalcReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    age: int = 21
    height_cm: float = 178.0
    shoe_size_eu: float = 42.0
    arm_girth_cm: float = 31.5
    wrist_cm: float = 17.2
    index_finger_cm: float = 7.3
    ring_finger_cm: float = 7.6
    body_fat_pct: float = 16.0
    clash_royale_trophies: int = 4600
    dota_mmr: int = 2400
    sleep_hours: float = 7.0
    room_temp_c: float = 21.0
    hand_span_cm: float | None = None


@router.post("/api/v2/party/pencil")
async def api_party_pencil(req: PencilCalcReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    extra = {"hand_span_cm": req.hand_span_cm} if req.hand_span_cm is not None else {}
    res = calculate_pencil_index(
        age=req.age,
        height_cm=req.height_cm,
        shoe_size_eu=req.shoe_size_eu,
        arm_girth_cm=req.arm_girth_cm,
        wrist_cm=req.wrist_cm,
        index_finger_cm=req.index_finger_cm,
        ring_finger_cm=req.ring_finger_cm,
        body_fat_pct=req.body_fat_pct,
        clash_royale_trophies=req.clash_royale_trophies,
        dota_mmr=req.dota_mmr,
        sleep_hours=req.sleep_hours,
        room_temp_c=req.room_temp_c,
        **extra,
    )
    await db.record_tool_use(uid, "pencil_calc", "party", "miniapp", f"{res['estimated_cm']} см", xp_gain=8)
    return res


@router.get("/api/v2/party/boredom")
async def api_party_boredom(
    request: Request,
    category: str = "all",
    include_spicy: bool = False,
    count: int = 6,
    search: str = "",
    user_id: int = DEFAULT_DEMO_USER_ID,
) -> dict[str, Any]:
    uid = await resolve_api_user(request, user_id)
    res = get_boredom_ideas(category=category, include_spicy=include_spicy, count=count, search=search)
    await db.record_tool_use(uid, "boredom_advisor", "party", "miniapp", category, xp_gain=5)
    return res


@router.get("/api/v2/party/liguria")
async def api_party_liguria() -> dict[str, Any]:
    return {
        "liguria": LIGURIA_TEXT,
        "foreign_twisters": FOREIGN_TONGUE_TWISTERS,
        "word_count": len(LIGURIA_TEXT.split()),
    }


# ==============================================================================
# 2. Конвертер единиц измерения
# ==============================================================================
class SmartUnitsReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    query: str


@router.post("/api/v2/units/smart")
async def api_smart_units(req: SmartUnitsReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        res = smart_parse_and_convert(req.query)
        await db.record_tool_use(uid, "smart_units", "calc", "miniapp", req.query[:30], xp_gain=6)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==============================================================================
# 3. Справочники
# ==============================================================================
@router.get("/api/v2/knowledge/constitutions")
async def api_constitutions(q: str = "") -> dict[str, Any]:
    items = search_constitutions(q)
    return {"count": len(items), "items": items}


@router.get("/api/v2/knowledge/religions")
async def api_religions(q: str = "") -> dict[str, Any]:
    items = get_enriched_religions(q)
    return {"count": len(items), "items": items}


@router.get("/api/v2/knowledge/webcams")
async def api_earth_webcams(q: str = "") -> dict[str, Any]:
    cams = get_earth_webcams(q)
    return {"count": len(cams), "items": cams}


@router.get("/api/v2/search/intuitive")
async def api_intuitive_search(q: str = "") -> dict[str, Any]:
    return intuitive_omni_search(q)


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
async def api_roll_stand(req: RollStandReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    stand = roll_random_stand(req.name)
    await db.record_tool_use(uid, "jojo_stand", "knowledge", "miniapp", stand["name"][:30], xp_gain=6)
    return {"stand": stand}


@router.get("/api/v2/knowledge/formulas")
async def api_formulas(subject: str = "all", q: str = "") -> dict[str, Any]:
    items = search_formulas(subject=subject, query=q)
    return {"count": len(items), "items": items}


@router.get("/api/v2/knowledge/population")
async def api_population(request: Request, q: str = "", user_id: int = DEFAULT_DEMO_USER_ID) -> dict[str, Any]:
    uid = await resolve_api_user(request, user_id)
    res = query_population(q)
    if q.strip():
        await db.record_tool_use(uid, "population_atlas", "knowledge", "miniapp", q[:30], xp_gain=5)
    return res


# ==============================================================================
# 4. Рифмы + Сканер QR + Ссылки
# ==============================================================================
class RhymeReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    word: str


@router.post("/api/v2/rhyme")
async def api_rhyme(req: RhymeReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        res = generate_russian_rhymes(req.word)
        await db.record_tool_use(uid, "rhyme_generator", "text", "miniapp", res["word"], xp_gain=8)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api/v2/qr/decode")
async def api_qr_decode(
    request: Request,
    file: UploadFile = File(...),
    user_id: int = DEFAULT_DEMO_USER_ID,
) -> dict[str, Any]:
    uid = await resolve_api_user(request, user_id)
    try:
        raw = await file.read(15 * 1024 * 1024 + 1)
        if len(raw) > 15 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Файл слишком большой (максимум 15 МБ)")
        res = await asyncio.to_thread(decode_qr_from_bytes, raw)
        await db.record_tool_use(uid, "qr_decoder", "visual", "miniapp", "QR Scan", xp_gain=10)
        return res
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ошибка чтения изображения: {e}")


class LinkCreateReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    url: str


@router.post("/api/v2/links/create")
async def api_create_link(req: LinkCreateReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        cleaned = inspect_and_clean_url(req.url)
        row = await db.create_link_pair(uid, cleaned["cleaned_url"])
        base = str(request.base_url).rstrip("/")
        short_url = f"{base}/s/{row['code']}"
        long_url = f"{base}/long/{row['long_code']}"
        await db.record_tool_use(uid, "url_transformer", "visual", "miniapp", cleaned["domain"], xp_gain=8)
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
    uid = await resolve_api_user(request, user_id)
    rows = await db.list_user_links(uid)
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
# 5. Игры
# ==============================================================================
class GameScoreReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    game_id: str
    score: int


@router.post("/api/v2/games/score")
async def api_submit_game_score(req: GameScoreReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    res = await db.submit_game_score(uid, req.game_id, req.score)
    highs = await db.get_game_highscores(req.game_id, limit=8)
    return {**res, "highscores": highs}


@router.get("/api/v2/games/highscores")
async def api_get_game_highscores(game_id: str = "all") -> dict[str, Any]:
    highs = await db.get_game_highscores(game_id=game_id, limit=12)
    return {"highscores": highs}


# ==============================================================================
# 6. Рейтинг, Профили и Чаты
# ==============================================================================
@router.get("/api/v2/social/leaderboard")
async def api_social_leaderboard(sort_by: str = "xp") -> dict[str, Any]:
    rows = await db.get_leaderboard(sort_by=sort_by, limit=30)
    return {"sort_by": sort_by, "users": rows}


@router.get("/api/v2/social/profile/{target_user_id}")
async def api_social_public_profile(
    target_user_id: int,
    request: Request,
    viewer_id: int = 0,
) -> dict[str, Any]:
    actual_viewer = viewer_id if viewer_id else await resolve_api_user(request, 0)
    try:
        return await db.get_public_profile(target_user_id=target_user_id, viewer_id=actual_viewer)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


class ProfileUpdateReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    bio: str
    avatar_emoji: str = "👤"
    first_name: str | None = None


@router.post("/api/v2/social/profile/update")
async def api_social_update_profile(req: ProfileUpdateReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    updated = await db.update_user_profile(
        user_id=uid,
        bio=req.bio,
        avatar_emoji=req.avatar_emoji,
        first_name=req.first_name,
    )
    return {"profile": updated}


class RespectReq(BaseModel):
    sender_id: int = DEFAULT_DEMO_USER_ID
    target_user_id: int


@router.post("/api/v2/social/respect")
async def api_social_respect(req: RespectReq, request: Request) -> dict[str, Any]:
    sender = await resolve_api_user(request, req.sender_id)
    profile = await db.give_respect(target_user_id=req.target_user_id, sender_id=sender)
    return {"profile": profile}


@router.get("/api/v2/social/anon")
async def api_get_anon_feed(room: str = "global") -> dict[str, Any]:
    msgs = await db.list_anon_messages(room=room, limit=40)
    return {"room": room, "messages": msgs}


class AnonPostReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    text: str
    room: str = "global"


@router.post("/api/v2/social/anon")
async def api_post_anon_msg(req: AnonPostReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Пустое сообщение")
    msgs = await db.post_anon_message(uid, req.text, room=req.room)
    return {"room": req.room, "messages": msgs}


@router.get("/api/v2/social/turing")
async def api_get_turing(exclude: str = "") -> dict[str, Any]:
    excl = [int(x) for x in exclude.split(",") if x.strip().isdigit()]
    return get_turing_round(excl)


class TuringGuessReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    round_id: int
    guess: str


@router.post("/api/v2/social/turing")
async def api_check_turing(req: TuringGuessReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    res = check_turing_guess(req.round_id, req.guess)
    await db.record_tool_use(
        uid,
        "turing_game",
        "social",
        "miniapp",
        "Верно" if res["correct"] else "Неверно",
        xp_gain=res["xp_reward"],
    )
    return res


@router.get("/api/v2/social/bibinto")
async def api_list_bibinto() -> dict[str, Any]:
    profiles = await db.list_dating_profiles()
    return {"profiles": profiles}


class BibintoRateReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    profile_id: int
    score: int


@router.post("/api/v2/social/bibinto/rate")
async def api_rate_bibinto(req: BibintoRateReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    updated = await db.rate_dating_profile(req.profile_id, req.score, uid)
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
    avatar_style: str = "👤"


@router.post("/api/v2/social/bibinto/create")
async def api_create_bibinto(req: BibintoCreateReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    if req.age < 18:
        raise HTTPException(status_code=400, detail="Раздел анкет строго 18+.")
    profiles = await db.create_dating_profile(
        user_id=uid,
        display_name=req.display_name,
        age=req.age,
        city=req.city,
        vibe=req.vibe,
        bio=req.bio,
        avatar_style=req.avatar_style,
    )
    return {"profiles": profiles}


@router.get("/api/v2/social/altushka")
async def api_altushka_list() -> dict[str, Any]:
    return {"personas": get_altushka_personas()}


class AltushkaChatReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    persona_id: str = "ksyusha"
    message: str
    affection: int = 25


@router.post("/api/v2/social/altushka")
async def api_altushka_chat(req: AltushkaChatReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    res = altushka_chat_reply(req.persona_id, req.message, req.affection)
    await db.record_tool_use(uid, "altushka_chat", "social", "miniapp", req.persona_id, xp_gain=6)
    return res


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
async def api_save_author(req: AuthorUpdateReq, request: Request) -> dict[str, Any]:
    import hmac
    from backend.config import ADMIN_SECRET

    provided_secret = (request.headers.get("X-Admin-Secret") or "").strip()
    if not ADMIN_SECRET or not hmac.compare_digest(provided_secret, ADMIN_SECRET):
        raise HTTPException(status_code=403, detail="Изменение ссылок автора доступно только администратору")
    return await db.save_author_info(req.model_dump())


# ==============================================================================
# 7. Киновселенные (Marvel / DC) и Мод ZitraksMode (Forge 1.19.2)
# ==============================================================================
def _build_scope_summary(scope: str, checked: list[str]) -> dict[str, Any]:
    if scope == "marvel":
        return compute_marvel_summary(checked)
    if scope == "dc":
        return compute_dc_summary(checked)
    return compute_zitraks_summary(checked)


@router.get("/api/v2/universes/catalog")
async def api_universes_catalog() -> dict[str, Any]:
    return get_universes_catalog()


@router.get("/api/v2/universes/state")
async def api_universes_state(request: Request, user_id: int = DEFAULT_DEMO_USER_ID) -> dict[str, Any]:
    uid = await resolve_api_user(request, user_id)
    all_checked = await db.get_all_user_checklists(uid)
    marvel_c = filter_valid_ids("marvel", all_checked.get("marvel", []))
    dc_c = filter_valid_ids("dc", all_checked.get("dc", []))
    zm_c = filter_valid_ids("zitraks", all_checked.get("zitraks", []))
    user_row = await db.ensure_user(uid)
    nick = (user_row.get("first_name") if user_row else None) or "Игрок"
    return {
        "checked": {
            "marvel": marvel_c,
            "dc": dc_c,
            "zitraks": zm_c,
        },
        "summaries": {
            "marvel": compute_marvel_summary(marvel_c),
            "dc": compute_dc_summary(dc_c),
            "zitraks": compute_zitraks_summary(zm_c),
        },
        "zmsave_code": export_zmsave_code(zm_c, nick=nick),
    }


class UniverseToggleReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    scope: str
    item_id: str


@router.post("/api/v2/universes/toggle")
async def api_universes_toggle(req: UniverseToggleReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    scope = req.scope.strip().lower()
    if scope not in VALID_SCOPES:
        raise HTTPException(status_code=400, detail="Неизвестный раздел")
    if not is_valid_item_id(scope, req.item_id):
        raise HTTPException(status_code=400, detail="Неизвестный элемент списка")

    checked_now, raw_list = await db.toggle_user_checklist_item(uid, scope, req.item_id)
    valid_list = filter_valid_ids(scope, raw_list)
    tool_map = {
        "marvel": "marvel_checklist",
        "dc": "dc_checklist",
        "zitraks": "zitraksmode_wiki",
    }
    if checked_now:
        await db.record_tool_use(uid, tool_map[scope], "universes", "miniapp", req.item_id[:40], xp_gain=4)

    out: dict[str, Any] = {
        "scope": scope,
        "item_id": req.item_id,
        "checked_now": checked_now,
        "checked": valid_list,
        "summary": _build_scope_summary(scope, valid_list),
    }
    if scope == "zitraks":
        user_row = await db.ensure_user(uid)
        nick = (user_row.get("first_name") if user_row else None) or "Игрок"
        out["zmsave_code"] = export_zmsave_code(valid_list, nick=nick)
    return out


class UniverseBulkReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    scope: str
    item_ids: list[str]
    mode: str = "add"  # add | remove | replace


@router.post("/api/v2/universes/bulk")
async def api_universes_bulk(req: UniverseBulkReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    scope = req.scope.strip().lower()
    if scope not in VALID_SCOPES:
        raise HTTPException(status_code=400, detail="Неизвестный раздел")
    if req.mode not in ("add", "remove", "replace"):
        raise HTTPException(status_code=400, detail="Некорректный режим обновления")

    clean_ids = filter_valid_ids(scope, req.item_ids)
    updated_raw = await db.bulk_update_user_checklist(uid, scope, clean_ids, mode=req.mode)
    valid_list = filter_valid_ids(scope, updated_raw)
    tool_map = {
        "marvel": "marvel_checklist",
        "dc": "dc_checklist",
        "zitraks": "zitraksmode_wiki",
    }
    if req.mode in ("add", "replace") and clean_ids:
        await db.record_tool_use(uid, tool_map[scope], "universes", "miniapp", f"bulk:{len(clean_ids)}", xp_gain=8)

    out: dict[str, Any] = {
        "scope": scope,
        "checked": valid_list,
        "summary": _build_scope_summary(scope, valid_list),
    }
    if scope == "zitraks":
        user_row = await db.ensure_user(uid)
        nick = (user_row.get("first_name") if user_row else None) or "Игрок"
        out["zmsave_code"] = export_zmsave_code(valid_list, nick=nick)
    return out


class ZmSaveImportReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    code: str
    merge: bool = True


@router.post("/api/v2/universes/zmsave/import")
async def api_zmsave_import(req: ZmSaveImportReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        imported_ids = parse_zmsave_code(req.code)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    mode = "add" if req.merge else "replace"
    updated_raw = await db.bulk_update_user_checklist(uid, "zitraks", imported_ids, mode=mode)
    valid_list = filter_valid_ids("zitraks", updated_raw)
    await db.record_tool_use(uid, "zitraksmode_wiki", "universes", "miniapp", f"import:{len(imported_ids)}", xp_gain=10)
    user_row = await db.ensure_user(uid)
    nick = (user_row.get("first_name") if user_row else None) or "Игрок"
    return {
        "imported_count": len(imported_ids),
        "checked": valid_list,
        "summary": compute_zitraks_summary(valid_list),
        "zmsave_code": export_zmsave_code(valid_list, nick=nick),
    }


# ==============================================================================
# 8. Онлайн-лобби для игры «🕵️ Шпион»
# ==============================================================================
@router.get("/api/v2/spy/locations")
async def api_spy_locations(pack: str = "all") -> dict[str, Any]:
    locs = get_spy_locations_list(pack)
    return {"count": len(locs), "locations": locs}


class SpyCreateReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    host_name: str = "Ведущий"
    pack: str = "all"
    spy_count: int = 1
    round_minutes: int = 6


@router.post("/api/v2/spy/create")
async def api_spy_create(req: SpyCreateReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    view = create_spy_lobby(
        host_user_id=uid,
        host_name=req.host_name,
        pack=req.pack,
        spy_count=req.spy_count,
        round_minutes=req.round_minutes,
    )
    await db.record_tool_use(uid, "spy_lobby", "arcade", "miniapp", f"room:{view['code']}", xp_gain=8)
    return view


class SpyJoinReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    code: str
    player_name: str
    player_token: str = ""


@router.post("/api/v2/spy/join")
async def api_spy_join(req: SpyJoinReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        view = join_spy_lobby(req.code, uid, req.player_name, req.player_token)
        await db.record_tool_use(uid, "spy_lobby", "arcade", "miniapp", f"join:{view['code']}", xp_gain=6)
        return view
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/v2/spy/state")
async def api_spy_state(code: str, token: str = "") -> dict[str, Any]:
    try:
        return get_spy_lobby_view(code, token)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


class SpyActionReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    code: str
    player_token: str
    target_slot_id: str = ""
    guessed_location: str = ""


@router.post("/api/v2/spy/start")
async def api_spy_start(req: SpyActionReq) -> dict[str, Any]:
    try:
        return start_spy_round(req.code, req.player_token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api/v2/spy/vote")
async def api_spy_vote(req: SpyActionReq) -> dict[str, Any]:
    try:
        return vote_spy_player(req.code, req.player_token, req.target_slot_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api/v2/spy/guess")
async def api_spy_guess(req: SpyActionReq) -> dict[str, Any]:
    try:
        return spy_guess_location(req.code, req.player_token, req.guessed_location)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api/v2/spy/finish")
async def api_spy_finish(req: SpyActionReq) -> dict[str, Any]:
    try:
        return finish_spy_round_by_host(req.code, req.player_token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==============================================================================
# 9. Активности Русского языка, Вечеринки и Игр (ЕГЭ Ударения, Ёфикатор, Транслит, Крокодил)
# ==============================================================================
@router.get("/api/v2/timbrica/ege-stress")
async def api_ege_stress(count: int = 15, q: str = "") -> dict[str, Any]:
    return get_ege_stress_deck(count=count, query=q)


class TextTransformReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    text: str


@router.post("/api/v2/timbrica/yoficate")
async def api_yoficate_text(req: TextTransformReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    res = yoficate_russian_text(req.text)
    await db.record_tool_use(uid, "russian_ege_ortho", "text", "miniapp", "yoficate", xp_gain=5)
    return res


@router.post("/api/v2/timbrica/translit")
async def api_translit_multistandard(req: TextTransformReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    res = transliterate_multistandard(req.text)
    await db.record_tool_use(uid, "russian_ege_ortho", "text", "miniapp", "translit", xp_gain=5)
    return res


@router.get("/api/v2/timbrica/croco")
async def api_croco_words(level: str = "all", count: int = 6, letter: str = "") -> dict[str, Any]:
    return roll_croco_words(level=level, count=count, letter=letter)


@router.get("/api/v2/timbrica/lie-questions")
async def api_lie_questions(category: str = "all") -> dict[str, Any]:
    return get_lie_detector_pack(category=category)


# ==============================================================================
# 10. Mega Expansion v5 Endpoints (Health, Auto/Travel, Finance Pro, Periodic, Design, Dev)
# ==============================================================================
from backend.tools.mega_expansion_v5 import (  # noqa: E402
    build_color_harmony,
    calculate_1rm_and_plates,
    calculate_bmi_and_macros,
    calculate_fuel_trip,
    calculate_loan_and_deposit,
    calculate_running_pace,
    calculate_sleep_cycles,
    compare_tires,
    compute_world_timezones,
    inspect_http_and_chmod,
    query_periodic_table,
    search_plate_codes,
    split_group_expenses,
)


class BmiMacrosReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    sex: str = "m"
    age: int = 25
    height_cm: float = 178.0
    weight_kg: float = 75.0
    activity: str = "moderate"
    goal: str = "maintain"


@router.post("/api/v2/v5/bmi-macros")
async def api_v5_bmi_macros(req: BmiMacrosReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    res = calculate_bmi_and_macros(req.sex, req.age, req.height_cm, req.weight_kg, req.activity, req.goal)
    await db.record_tool_use(uid, "bmi_macros", "health", "miniapp", f"BMI={res['bmi']}", xp_gain=6)
    return res


class SleepCyclesReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    mode: str = "wakeup"
    time_hhmm: str = "07:30"
    fall_asleep_min: int = 14


@router.post("/api/v2/v5/sleep-cycles")
async def api_v5_sleep(req: SleepCyclesReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    res = calculate_sleep_cycles(req.mode, req.time_hhmm, req.fall_asleep_min)
    await db.record_tool_use(uid, "sleep_cycles", "health", "miniapp", req.time_hhmm, xp_gain=5)
    return res


class Workout1RmReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    weight_kg: float = 80.0
    reps: int = 5
    bar_kg: float = 20.0


@router.post("/api/v2/v5/workout-1rm")
async def api_v5_1rm(req: Workout1RmReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    res = calculate_1rm_and_plates(req.weight_kg, req.reps, req.bar_kg)
    await db.record_tool_use(uid, "workout_1rm", "health", "miniapp", f"1RM={res['one_rep_max_kg']}", xp_gain=6)
    return res


class RunningPaceReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    distance_km: float = 5.0
    time_minutes: float = 25.0
    age: int = 26
    resting_hr: int = 60


@router.post("/api/v2/v5/running-pace")
async def api_v5_running(req: RunningPaceReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    res = calculate_running_pace(req.distance_km, req.time_minutes, req.age, req.resting_hr)
    await db.record_tool_use(uid, "running_pace", "health", "miniapp", res["pace_formatted"], xp_gain=6)
    return res


class FuelTripReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    distance_km: float = Field(default=450.0, gt=0, le=100_000, allow_inf_nan=False)
    consumption_l_100: float = Field(default=8.2, gt=0, le=60, allow_inf_nan=False)
    fuel_price: float = Field(default=61.5, ge=0, le=1_000, allow_inf_nan=False)
    passengers: int = Field(default=2, ge=1, le=60)
    tolls_rub: float = Field(default=0.0, ge=0, le=10_000_000, allow_inf_nan=False)
    round_trip: bool = False


@router.post("/api/v2/v5/fuel-trip")
async def api_v5_fuel(req: FuelTripReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    res = calculate_fuel_trip(req.distance_km, req.consumption_l_100, req.fuel_price, req.passengers, req.tolls_rub, req.round_trip)
    await db.record_tool_use(uid, "fuel_trip", "auto_travel", "miniapp", f"{res['total_cost']} RUB", xp_gain=6)
    return res


class TireCompareReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    old_spec: str = Field(default="205/55 R16", min_length=5, max_length=20)
    new_spec: str = Field(default="215/60 R16", min_length=5, max_length=20)


@router.post("/api/v2/v5/tires-compare")
async def api_v5_tires(req: TireCompareReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        res = compare_tires(req.old_spec, req.new_spec)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await db.record_tool_use(uid, "tire_calc", "auto_travel", "miniapp", f"{req.old_spec}->{req.new_spec}", xp_gain=6)
    return res


@router.get("/api/v2/v5/plate-codes")
async def api_v5_plates(q: str = "") -> dict[str, Any]:
    return search_plate_codes(q)


@router.get("/api/v2/v5/world-time")
async def api_v5_world_time(msk_hour: float | None = None, local_date: str | None = None) -> dict[str, Any]:
    try:
        return compute_world_timezones(msk_hour, local_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


class FinanceProReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    mode: str = "loan"
    principal: float = 3_000_000.0
    annual_rate_pct: float = 16.5
    months: int = 60
    monthly_topup: float = 0.0


@router.post("/api/v2/v5/finance-pro")
async def api_v5_finance_pro(req: FinanceProReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    res = calculate_loan_and_deposit(req.mode, req.principal, req.annual_rate_pct, req.months, req.monthly_topup)
    await db.record_tool_use(uid, "finance_calc", "calc", "miniapp", req.mode, xp_gain=6)
    return res


class BillSplitReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    entries: list[dict[str, Any]] = Field(min_length=1, max_length=100)
    tip_pct: float = Field(default=0.0, allow_inf_nan=False)
    expenses: list[dict[str, Any]] | None = Field(default=None, max_length=200)
    currency_code: str = Field(default="RUB", min_length=3, max_length=3)


@router.post("/api/v2/v5/bill-split")
async def api_v5_bill_split(req: BillSplitReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        res = split_group_expenses(req.entries, req.tip_pct, req.expenses, req.currency_code)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    detail = f"{res['participants']}p/{res['expense_mode']}"
    await db.record_tool_use(uid, "bill_splitter", "calc", "miniapp", detail, xp_gain=6)
    return res


@router.get("/api/v2/v5/periodic-table")
async def api_v5_periodic(q: str = "", formula: str = "") -> dict[str, Any]:
    return query_periodic_table(q, formula)


class ColorHarmonyReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    hex_color: str = "#38bdf8"


@router.post("/api/v2/v5/color-harmony")
async def api_v5_color_harmony(req: ColorHarmonyReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    res = build_color_harmony(req.hex_color)
    await db.record_tool_use(uid, "color_palette", "creator_design", "miniapp", res["hex"], xp_gain=5)
    return res


@router.get("/api/v2/v5/http-chmod")
async def api_v5_http_chmod(octal: str = "755", q: str = "") -> dict[str, Any]:
    return inspect_http_and_chmod(octal, q)




