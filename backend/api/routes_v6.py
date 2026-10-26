from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, File, Form, HTTPException, Request, Response, UploadFile
from pydantic import BaseModel, Field

from backend.api.tg_auth import resolve_api_user
from backend.config import DEFAULT_DEMO_USER_ID
from backend.database import db
from backend.tools.adult_and_jojo_db import (
    awaken_personal_stand,
    search_adult_actresses,
    search_hentai_tags,
    search_jojo_stands_all,
)
from backend.tools.ai_web_assistant import ask_ai_with_internet, run_cbt_thought_record
from backend.tools.mega_expansion_v6_hubs import (
    EQ_TEST_QUESTIONS,
    GAMING_WIKIS_DB,
    IQ_TEST_QUESTIONS,
    LOOKSMAXXING_ATLAS,
    MATERIALS_FASTENERS_DB,
    OUTFIT_STYLES_DB,
    SPEND_BILLIONAIRE_ITEMS,
    calculate_route_plan,
    combine_infinite_craft,
    convert_universal_file,
    evaluate_pc_build,
    get_pc_parts_catalog,
    search_car_models,
)
from backend.tools.mega_expansion_v6_science_lore import (
    CELL_ATOM_QUARKS_DB,
    CULT_LORE_DB,
    SOLAR_SYSTEM_BODIES,
    WORLD_GENRES_TAGS_DB,
    compute_irrational_digits,
    get_earth_stats_and_correlation,
    get_upcoming_eclipses_and_comets,
    library_of_babel_browse,
    library_of_babel_search,
)
from backend.tools.party_and_fun import calculate_breast_size_index

router = APIRouter(tags=["v6-mega"])


# --- 1. AI ASSISTANT WITH LIVE INTERNET + CBT PSYCHOTHERAPIST ---

class AiChatReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    message: str
    history: list[dict[str, str]] = []
    use_web: bool = True
    mode: str = "general"
    page_context: str = ""


@router.post("/api/v6/ai/chat")
async def api_v6_ai_chat(req: AiChatReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    res = await ask_ai_with_internet(
        message=req.message,
        history=req.history,
        use_web=req.use_web,
        mode=req.mode,
        page_context=req.page_context,
    )
    await db.record_tool_use(uid, "ai_web_chat", "ai_assistant", "miniapp", req.mode, xp_gain=8)
    return res


class CbtThoughtReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    situation: str = ""
    automatic_thought: str = ""
    emotion: str = "Тревога"
    intensity_before: int = 75


@router.post("/api/v6/ai/cbt")
async def api_v6_ai_cbt(req: CbtThoughtReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    res = await run_cbt_thought_record(
        situation=req.situation,
        automatic_thought=req.automatic_thought,
        emotion=req.emotion,
        intensity_before=req.intensity_before,
    )
    await db.record_tool_use(uid, "ai_psychotherapist", "ai_assistant", "miniapp", req.emotion, xp_gain=8)
    return res


# --- 2. FEMALE BREAST SIZE CALCULATOR ---

class BreastCalcReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    age: int = 22
    height_cm: float = 166.0
    underbust_cm: float = 74.0
    hip_cm: float = 95.0
    body_fat_pct: float = 24.0
    standing_bust_cm: float = 0.0
    leaning_bust_cm: float = 0.0
    hair_length_cm: float = 42.0
    matcha_latte_per_week: int = 4
    pinterest_pins: int = 650
    skincare_jars: int = 9
    shower_temp_c: float = 41.0
    sims_genshin_hours: int = 280


@router.post("/api/v6/party/breast-calc")
async def api_v6_breast_calc(req: BreastCalcReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    res = calculate_breast_size_index(
        age=req.age,
        height_cm=req.height_cm,
        underbust_cm=req.underbust_cm,
        hip_cm=req.hip_cm,
        body_fat_pct=req.body_fat_pct,
        standing_bust_cm=req.standing_bust_cm,
        leaning_bust_cm=req.leaning_bust_cm,
        hair_length_cm=req.hair_length_cm,
        matcha_latte_per_week=req.matcha_latte_per_week,
        pinterest_pins=req.pinterest_pins,
        skincare_jars=req.skincare_jars,
        shower_temp_c=req.shower_temp_c,
        sims_genshin_hours=req.sims_genshin_hours,
    )
    await db.record_tool_use(uid, "breast_size_calc", "party", "miniapp", str(res.get("eu_size") or "measurements required"), xp_gain=6)
    return res


# --- 3. JOJO STANDS ALL (PARTS 3–9) + 18+ ACTRESSES DB + 18+ HENTAI TAGS ---

@router.get("/api/v6/jojo/stands")
async def api_v6_jojo_stands(q: str = "", part: int = 0, stand_type: str = "") -> dict[str, Any]:
    return search_jojo_stands_all(query=q, part_num=part, stand_type=stand_type)


class AwakenStandReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    name: str = ""


@router.post("/api/v6/jojo/awaken")
async def api_v6_jojo_awaken(req: AwakenStandReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    res = awaken_personal_stand(req.name)
    await db.record_tool_use(uid, "jojo_stands_all", "jojo_adult_encyc", "miniapp", res["stand"]["name"], xp_gain=6)
    return res


@router.get("/api/v6/adult/actresses")
async def api_v6_adult_actresses(
    q: str = "",
    hair: str = "",
    cup: str = "",
    natural_only: bool = False,
    min_height: int = 140,
    max_height: int = 195,
    country: str = "",
) -> dict[str, Any]:
    return search_adult_actresses(
        query=q,
        hair=hair,
        cup=cup,
        natural_only=natural_only,
        min_height=min_height,
        max_height=max_height,
        country=country,
    )


@router.get("/api/v6/adult/hentai-tags")
async def api_v6_hentai_tags(q: str = "", category: str = "", tier: str = "") -> dict[str, Any]:
    return search_hentai_tags(query=q, category=category, tier=tier)


# --- 4. NEAL.FUN SUITE ---

class CraftReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    item_a: str
    item_b: str


@router.post("/api/v6/nealfun/craft")
async def api_v6_nealfun_craft(req: CraftReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    res = combine_infinite_craft(req.item_a, req.item_b)
    await db.record_tool_use(uid, "infinite_craft_lab", "neal_fun_lab", "miniapp", res["result"], xp_gain=3)
    return res


@router.get("/api/v6/nealfun/billionaire")
async def api_v6_nealfun_billionaire() -> dict[str, Any]:
    return {"fortune_usd": 350_000_000_000, "items": SPEND_BILLIONAIRE_ITEMS}


# --- 5. PC BUILDER, CARS, MATERIALS, STYLE & GAMING WIKIS ---

@router.get("/api/v6/pc/catalog")
async def api_v6_pc_catalog() -> dict[str, Any]:
    return get_pc_parts_catalog()


class PcEvalReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    cpu_id: str = "i5_6500"
    gpu_id: str = "gtx_1050ti"
    mb_id: str = "h110_lga1151"
    ram_id: str = "ddr4_16_2133"
    cooler_id: str = "stock_intel"
    ssd_id: str = "sata_480"
    hdd_id: str = "hdd_none"
    psu_id: str = "psu_450"
    case_id: str = "used_office_case"
    case_fans_id: str = "fans_none"
    wifi_adapter_id: str = "wifi_none"
    monitor_id: str = "monitor_none"
    keyboard_id: str = "keyboard_none"
    mouse_id: str = "mouse_none"
    thermal_paste_id: str = "paste_none"


@router.post("/api/v6/pc/evaluate")
async def api_v6_pc_evaluate(req: PcEvalReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    res = evaluate_pc_build(
        cpu_id=req.cpu_id,
        gpu_id=req.gpu_id,
        mb_id=req.mb_id,
        ram_id=req.ram_id,
        cooler_id=req.cooler_id,
        ssd_id=req.ssd_id,
        hdd_id=req.hdd_id,
        psu_id=req.psu_id,
        case_id=req.case_id,
        case_fans_id=req.case_fans_id,
        wifi_adapter_id=req.wifi_adapter_id,
        monitor_id=req.monitor_id,
        keyboard_id=req.keyboard_id,
        mouse_id=req.mouse_id,
        thermal_paste_id=req.thermal_paste_id,
    )
    await db.record_tool_use(uid, "pc_builder_pro", "pc_materials_style", "miniapp", f"{res['total_price_rub']}RUB", xp_gain=7)
    return res


class PcCompareReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    left: PcEvalReq
    right: PcEvalReq


@router.post("/api/v6/pc/compare")
async def api_v6_pc_compare(req: PcCompareReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    left = evaluate_pc_build(**req.left.model_dump(exclude={"user_id"}))
    right = evaluate_pc_build(**req.right.model_dump(exclude={"user_id"}))
    delta = int(right["total_price_rub"] - left["total_price_rub"])
    result = {
        "left": left,
        "right": right,
        "price_delta_rub": delta,
        "cheaper_side": "left" if delta > 0 else "right" if delta < 0 else "equal",
        "note": "Сравнение использует один и тот же справочник и модельные оценки для обеих сборок; FPS и цены ориентировочные.",
    }
    await db.record_tool_use(uid, "pc_build_compare", "pc_materials_style", "miniapp", f"{left['total_price_rub']}:{right['total_price_rub']} RUB", xp_gain=4)
    return result


@router.get("/api/v6/cars/catalog")
async def api_v6_cars_catalog(q: str = "", body_class: str = "") -> dict[str, Any]:
    return search_car_models(query=q, body_class=body_class)


@router.get("/api/v6/materials/catalog")
async def api_v6_materials_catalog() -> dict[str, Any]:
    return MATERIALS_FASTENERS_DB


@router.get("/api/v6/style/looksmax")
async def api_v6_style_looksmax() -> dict[str, Any]:
    return {"outfits": OUTFIT_STYLES_DB, "looksmaxxing": LOOKSMAXXING_ATLAS}


@router.get("/api/v6/gaming/wikis")
async def api_v6_gaming_wikis(game_id: str = "") -> dict[str, Any]:
    gid = (game_id or "").strip().lower()
    items = [g for g in GAMING_WIKIS_DB if not gid or g["id"] == gid]
    return {"games": items if items else GAMING_WIKIS_DB}


# --- 6. ROUTE PLANNER, UNIVERSAL FILE CONVERTER & IQ/EQ TESTS ---

class RoutePlanReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    origin: str = Field(default="Москва", min_length=1, max_length=120)
    destination: str = Field(default="Санкт-Петербург", min_length=1, max_length=120)
    via: str = Field(default="", max_length=360)
    transport: Literal["car", "train", "plane", "bike", "walk"] = "car"
    fuel_l_per_100km: float = Field(default=8.2, ge=0, le=100, allow_inf_nan=False)
    fuel_price_rub: float = Field(default=61.5, ge=0, le=1000, allow_inf_nan=False)


@router.post("/api/v6/route/plan")
async def api_v6_route_plan(req: RoutePlanReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        res = calculate_route_plan(
            origin=req.origin,
            destination=req.destination,
            via=req.via,
            transport=req.transport,
            fuel_l_per_100km=req.fuel_l_per_100km,
            fuel_price_rub=req.fuel_price_rub,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await db.record_tool_use(uid, "route_planner_calc", "auto_travel", "miniapp", f"{res['route_distance_km']}km", xp_gain=6)
    return res


@router.post("/api/v6/files/convert")
async def api_v6_files_convert(
    request: Request,
    file: UploadFile = File(...),
    target_format: str = Form("png"),
) -> Response:
    uid = await resolve_api_user(request, DEFAULT_DEMO_USER_ID)
    raw = await file.read()
    if len(raw) > 25 * 1024 * 1024:
        raise ValueError("Максимальный размер файла для конвертации — 25 МБ")
    out_bytes, mime, out_name = convert_universal_file(raw, file.filename or "file.bin", target_format)
    await db.record_tool_use(uid, "universal_file_converter", "tests_builders_lore", "miniapp", target_format, xp_gain=8)
    safe_ascii = out_name.encode("ascii", errors="ignore").decode("ascii") or f"converted.{target_format}"
    return Response(
        content=out_bytes,
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{safe_ascii}"'},
    )


@router.get("/api/v6/tests/iq-eq")
async def api_v6_tests_iq_eq() -> dict[str, Any]:
    return {"iq_questions": IQ_TEST_QUESTIONS, "eq_questions": EQ_TEST_QUESTIONS}


# --- 7. COSMOS, MICROWORLD, IRRATIONAL NUMBERS, BABEL, LORE & 2026 STATS ---

@router.get("/api/v6/science/solar-system")
async def api_v6_solar_system() -> dict[str, Any]:
    return {"bodies": SOLAR_SYSTEM_BODIES}


@router.get("/api/v6/science/eclipses-comets")
async def api_v6_eclipses_comets(now_iso: str = "2026-10-25T12:00:00Z") -> dict[str, Any]:
    return get_upcoming_eclipses_and_comets(now_iso)


@router.get("/api/v6/science/cell-atom-quarks")
async def api_v6_cell_atom_quarks() -> dict[str, Any]:
    return CELL_ATOM_QUARKS_DB


@router.get("/api/v6/math/irrational")
async def api_v6_math_irrational(constant: str = "pi", digits: int = 600, search: str = "") -> dict[str, Any]:
    return compute_irrational_digits(constant=constant, digits=digits, search_pattern=search)


@router.get("/api/v6/babel/browse")
async def api_v6_babel_browse(
    hex_id: str = "borges1941",
    wall: int = 1,
    shelf: int = 1,
    volume: int = 1,
    page: int = 1,
) -> dict[str, Any]:
    return library_of_babel_browse(hex_id=hex_id, wall=wall, shelf=shelf, volume=volume, page=page)


class BabelSearchReq(BaseModel):
    user_id: int = DEFAULT_DEMO_USER_ID
    phrase: str
    exact_page_only: bool = False


@router.post("/api/v6/babel/search")
async def api_v6_babel_search(req: BabelSearchReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    res = library_of_babel_search(req.phrase, req.exact_page_only)
    await db.record_tool_use(uid, "library_of_babel", "cosmos_micro_math", "miniapp", req.phrase[:24], xp_gain=6)
    return res


@router.get("/api/v6/culture/genres-lore")
async def api_v6_culture_genres_lore() -> dict[str, Any]:
    return {"genres": WORLD_GENRES_TAGS_DB, "lore": CULT_LORE_DB}


@router.get("/api/v6/stats/earth-2026")
async def api_v6_stats_earth_2026(
    x_metric: str = "penis_length_cm",
    y_metric: str = "penis_girth_cm",
    sort_by: str = "gdp_ppp_usd",
) -> dict[str, Any]:
    return get_earth_stats_and_correlation(x_metric=x_metric, y_metric=y_metric, sort_by=sort_by)
