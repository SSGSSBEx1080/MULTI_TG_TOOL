from __future__ import annotations

import base64
import json
import math
import time
from functools import lru_cache
from pathlib import Path
from typing import Any

DATA_FILE = Path(__file__).resolve().parent / "universes_data.json"

VALID_SCOPES = {"marvel", "dc", "zitraks"}


@lru_cache(maxsize=1)
def get_universes_catalog() -> dict[str, Any]:
    with DATA_FILE.open("r", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def _build_indexes() -> dict[str, dict[str, Any]]:
    cat = get_universes_catalog()

    marvel_items: dict[str, dict[str, Any]] = {}
    for phase in cat["marvel"]["mcu_phases"]:
        for it in phase["items"]:
            marvel_items[it["id"]] = {**it, "group_id": phase["id"], "group_title": phase["title"], "section": "mcu"}
    for grp in cat["marvel"]["other_groups"]:
        for it in grp["items"]:
            marvel_items[it["id"]] = {**it, "group_id": grp["id"], "group_title": grp["title"], "section": "other"}
    for it in cat["marvel"]["upcoming"]:
        marvel_items[it["id"]] = {**it, "group_id": "upcoming", "group_title": "Анонсы", "section": "upcoming"}

    dc_items: dict[str, dict[str, Any]] = {p["id"]: p for p in cat["dc"]["projects"]}

    zitraks_advs: dict[str, dict[str, Any]] = {}
    for br in cat["zitraks"]["branches"]:
        for adv in br["advancements"]:
            zitraks_advs[adv["uid"]] = {
                **adv,
                "branch_id": br["id"],
                "branch_title": br["title"],
                "store": br["store"],
                "n": br["n"],
            }

    return {
        "marvel": marvel_items,
        "dc": dc_items,
        "zitraks": zitraks_advs,
    }


def is_valid_item_id(scope: str, item_id: str) -> bool:
    if scope not in VALID_SCOPES:
        return False
    return item_id in _build_indexes()[scope]


def filter_valid_ids(scope: str, item_ids: list[str]) -> list[str]:
    if scope not in VALID_SCOPES:
        return []
    valid_map = _build_indexes()[scope]
    seen: set[str] = set()
    out: list[str] = []
    for raw in item_ids:
        k = str(raw).strip()
        if k in valid_map and k not in seen:
            seen.add(k)
            out.append(k)
    return out


def mc_level_of(xp: int) -> dict[str, int]:
    """Exact Minecraft XP level curve used by ZitraksMode Wiki."""
    def need(lv: int) -> float:
        if lv <= 16:
            return float(lv * lv + 6 * lv)
        if lv <= 31:
            return 2.5 * lv * lv - 40.5 * lv + 360.0
        return 4.5 * lv * lv - 162.5 * lv + 2220.0

    lv = 0
    while need(lv + 1) <= xp:
        lv += 1
    cur = max(0, int(round(xp - need(lv))))
    span = max(1, int(math.ceil(need(lv + 1) - need(lv))))
    pct = min(100, int((cur / span) * 100))
    return {"level": lv, "current_xp": cur, "span_xp": span, "progress_pct": pct}


def compute_marvel_summary(checked_ids: list[str]) -> dict[str, Any]:
    cat = get_universes_catalog()["marvel"]
    checked = set(checked_ids)

    mcu_total = 0
    mcu_done = 0
    phases_progress: list[dict[str, Any]] = []
    for ph in cat["mcu_phases"]:
        tot = len(ph["items"])
        done = sum(1 for it in ph["items"] if it["id"] in checked)
        mcu_total += tot
        mcu_done += done
        phases_progress.append(
            {
                "id": ph["id"],
                "title": ph["title"],
                "years": ph["years"],
                "done": done,
                "total": tot,
                "pct": int(round((done / tot) * 100)) if tot else 0,
            }
        )

    other_total = sum(len(g["items"]) for g in cat["other_groups"])
    other_done = sum(
        1 for g in cat["other_groups"] for it in g["items"] if it["id"] in checked
    )
    up_total = len(cat["upcoming"])
    up_done = sum(1 for it in cat["upcoming"] if it["id"] in checked)

    released_total = mcu_total + other_total
    released_done = mcu_done + other_done
    return {
        "mcu_done": mcu_done,
        "mcu_total": mcu_total,
        "mcu_pct": int(round((mcu_done / mcu_total) * 100)) if mcu_total else 0,
        "other_done": other_done,
        "other_total": other_total,
        "upcoming_done": up_done,
        "upcoming_total": up_total,
        "total_done": released_done + up_done,
        "total_items": released_total + up_total,
        "released_pct": int(round((released_done / released_total) * 100)) if released_total else 0,
        "phases": phases_progress,
    }


def compute_dc_summary(checked_ids: list[str]) -> dict[str, Any]:
    cat = get_universes_catalog()["dc"]
    checked = set(checked_ids)
    projects = cat["projects"]

    done_projects = [p for p in projects if p["id"] in checked]
    watched_minutes = sum(int(p.get("minutes") or 0) for p in done_projects)
    total_minutes = sum(int(p.get("minutes") or 0) for p in projects)

    imdb_vals: list[float] = []
    for p in done_projects:
        try:
            imdb_vals.append(float(p["imdb"]))
        except (ValueError, TypeError):
            pass

    eras_progress: list[dict[str, Any]] = []
    for era in cat["eras"]:
        era_items = [p for p in projects if p["era"] == era["id"]]
        tot = len(era_items)
        done = sum(1 for p in era_items if p["id"] in checked)
        eras_progress.append(
            {
                "id": era["id"],
                "short": era["short"],
                "title": era["title"],
                "done": done,
                "total": tot,
                "pct": int(round((done / tot) * 100)) if tot else 0,
            }
        )

    tot_all = len(projects)
    done_all = len(done_projects)
    return {
        "done": done_all,
        "total": tot_all,
        "pct": int(round((done_all / tot_all) * 100)) if tot_all else 0,
        "watched_minutes": watched_minutes,
        "watched_hours": round(watched_minutes / 60.0, 1),
        "total_minutes": total_minutes,
        "avg_imdb": round(sum(imdb_vals) / len(imdb_vals), 2) if imdb_vals else None,
        "eras": eras_progress,
    }


def compute_zitraks_summary(checked_ids: list[str]) -> dict[str, Any]:
    cat = get_universes_catalog()["zitraks"]
    checked = set(checked_ids)

    got_adv = 0
    total_adv = 0
    xp = 0
    xp_total = 0
    completed_branches = 0
    branches_progress: list[dict[str, Any]] = []

    for br in cat["branches"]:
        advs = br["advancements"]
        b_tot = len(advs)
        b_done_list = [a for a in advs if a["uid"] in checked]
        b_done = len(b_done_list)
        b_xp = sum(int(a["xp"]) for a in b_done_list)
        b_xp_all = sum(int(a["xp"]) for a in advs)

        got_adv += b_done
        total_adv += b_tot
        xp += b_xp
        xp_total += b_xp_all
        if b_tot > 0 and b_done == b_tot:
            completed_branches += 1

        branches_progress.append(
            {
                "id": br["id"],
                "n": br["n"],
                "guest": br["guest"],
                "letter": br["letter"],
                "title": br["title"],
                "done": b_done,
                "total": b_tot,
                "xp": b_xp,
            }
        )

    lv_info = mc_level_of(xp)
    rank_title = "Только заспавнился"
    for min_lv, r_name in cat["ranks"]:
        if lv_info["level"] >= int(min_lv):
            rank_title = str(r_name)

    return {
        "got": got_adv,
        "total": total_adv,
        "pct": int(round((got_adv / total_adv) * 100)) if total_adv else 0,
        "xp": xp,
        "xp_total": xp_total,
        "level": lv_info["level"],
        "level_cur_xp": lv_info["current_xp"],
        "level_span_xp": lv_info["span_xp"],
        "level_pct": lv_info["progress_pct"],
        "rank": rank_title,
        "completed_branches": completed_branches,
        "total_branches": len(cat["branches"]),
        "points_count": len(cat["points"]),
        "guest_points_count": len(cat["guest_points"]),
        "branches": branches_progress,
    }


def export_zmsave_code(checked_ids: list[str], nick: str = "Игрок") -> str:
    """Export ZitraksMode progress into official ZM1.<base64> format compatible with ssgssbex1080.github.io."""
    by_store: dict[str, list[str]] = {}
    valid_advs = _build_indexes()["zitraks"]
    for uid in checked_ids:
        meta = valid_advs.get(uid)
        if not meta:
            continue
        by_store.setdefault(meta["store"], []).append(meta["key"])

    snap = {store: json.dumps(keys, ensure_ascii=False) for store, keys in by_store.items()}
    payload = {
        "v": 1,
        "p": {
            "nick": (nick or "Игрок")[:16],
            "avatar": "steve",
            "created": int(time.time() * 1000),
        },
        "d": snap,
    }
    raw_bytes = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return "ZM1." + base64.b64encode(raw_bytes).decode("ascii")


def parse_zmsave_code(code: str) -> list[str]:
    """Parse official ZM1.<base64> code or .zmsave JSON into valid ZitraksMode advancement uids."""
    text = (code or "").strip()
    if not text:
        raise ValueError("Пустой код сохранения")

    if text.startswith("ZM1."):
        b64_part = text[4:].strip()
        # Add padding if missing
        b64_part += "=" * (-len(b64_part) % 4)
        try:
            decoded = base64.b64decode(b64_part).decode("utf-8")
            obj = json.loads(decoded)
        except Exception as exc:
            raise ValueError("Некорректный код ZM1.") from exc
    elif text.startswith("{"):
        try:
            obj = json.loads(text)
        except Exception as exc:
            raise ValueError("Некорректный JSON файла .zmsave") from exc
    elif text.startswith("["):
        try:
            arr = json.loads(text)
            return filter_valid_ids("zitraks", [str(x) for x in arr])
        except Exception as exc:
            raise ValueError("Некорректный список достижений") from exc
    else:
        raise ValueError("Формат не распознан. Ожидается код ZM1.... или JSON .zmsave")

    d_map = obj.get("d") if isinstance(obj, dict) else None
    if not isinstance(d_map, dict):
        raise ValueError("В сохранении отсутствует блок данных d")

    uids: list[str] = []
    for store_key, raw_val in d_map.items():
        if not (store_key.endswith(".adv") and isinstance(store_key, str)):
            continue
        keys_list: list[Any] = []
        if isinstance(raw_val, str):
            try:
                parsed = json.loads(raw_val)
                if isinstance(parsed, list):
                    keys_list = parsed
            except Exception:
                continue
        elif isinstance(raw_val, list):
            keys_list = raw_val
        for k in keys_list:
            uids.append(f"{store_key}:{k}")

    return filter_valid_ids("zitraks", uids)
