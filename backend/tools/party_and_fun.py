from __future__ import annotations

import hashlib
import math
import random
from typing import Any

# ==============================================================================
# 1. Алко-Калькулятор «Чтоб за догоном не бежать» (Шкала 0..40)
# ==============================================================================

INTOXICATION_STAGES = [
    (0, 0, "🧊 0/40 — Абсолютно трезв", "Чистый рассудок, минералочка и чай. Можно вести самолёт."),
    (1, 5, "✨ 1–5/40 — Лёгкий прогрев", "Приятное тепло, лёгкая улыбка, снятие усталости после недели."),
    (6, 12, "🥂 6–12/40 — Душевный вайб", "Язык развязался, шутки заходят на ура, тосты звучат как поэзия."),
    (13, 20, "🔥 13–20/40 — Золотой кураж", "Танцы, громкие споры о жизни, братание со всеми за столом."),
    (21, 28, "🌪 21–28/40 — Штормовой режим", "Походка с приключением, звонки бывшим, поиск смысла бытия."),
    (29, 35, "🚁 29–35/40 — Зона вертолётов", "Гравитация Земли увеличена втрое, память переходит в режим скриншотов."),
    (36, 39, "🚨 36–39/40 — Критический предел", "Потеря ориентации в пространстве, автопилот не отвечает. Опасно для здоровья!"),
    (40, 40, "💀 40/40 — Потеря сознания (Отключка)", "Полный блэкаут и тяжёлое отравление (~3.8–4.0‰). ⚠️ Строго не рекомендуется в реальности!"),
]

DRINK_PRESETS = {
    "vodka": {"name": "Водка классическая", "abv": 40.0, "emoji": "🥃"},
    "whiskey": {"name": "Виски / Коньяк / Ром", "abv": 40.0, "emoji": "🥃"},
    "moonshine": {"name": "Домашний самогон / Настойка", "abv": 50.0, "emoji": "🫙"},
    "jager": {"name": "Травяной ликёр / Биттер", "abv": 35.0, "emoji": "🌿"},
    "wine": {"name": "Вино сухое/полусладкое", "abv": 12.5, "emoji": "🍷"},
    "beer": {"name": "Пиво / Сидр", "abv": 5.0, "emoji": "🍺"},
}


def describe_scale_level(level: int) -> dict[str, str]:
    lvl = max(0, min(40, int(level)))
    for lo, hi, title, desc in INTOXICATION_STAGES:
        if lo <= lvl <= hi:
            return {"title": title, "description": desc}
    return {"title": INTOXICATION_STAGES[0][2], "description": INTOXICATION_STAGES[0][3]}


def calculate_vodka_party(
    men_count: int = 3,
    women_count: int = 1,
    avg_weight_kg: float = 78.0,
    hours: float = 5.0,
    target_scale: int = 18,
    snack_level: str = "rich",  # empty | light | normal | rich | heavy | good | none
    tolerance: str = "medium",
    drink_type: str = "vodka",
    no_run_reserve: bool = True,
    *,
    people_count: int | None = None,
    gender_mix: str | None = None,
    target_level: float | None = None,
    duration_hours: float | None = None,
    reserve_no_run: bool | None = None,
) -> dict[str, Any]:
    if people_count is not None:
        p_tot = max(1, min(100, int(people_count)))
        if gender_mix == "male":
            men, women = p_tot, 0
        elif gender_mix == "female":
            men, women = 0, p_tot
        else:
            men = (p_tot + 1) // 2
            women = p_tot - men
    else:
        men = max(0, min(100, int(men_count)))
        women = max(0, min(100, int(women_count)))
    total_people = men + women
    if total_people == 0:
        raise ValueError("Укажите хотя бы 1 участника застолья")

    if target_level is not None:
        target_scale = int(round(target_level))
    if duration_hours is not None:
        hours = float(duration_hours)
    if reserve_no_run is not None:
        no_run_reserve = bool(reserve_no_run)

    lvl = max(0, min(40, int(target_scale)))
    weight = max(40.0, min(180.0, float(avg_weight_kg)))
    hrs = max(1.0, min(24.0, float(hours)))

    drink_alias = {"liqueur": "jager", "strong_beer": "beer"}
    drink = DRINK_PRESETS.get(drink_alias.get(drink_type, drink_type), DRINK_PRESETS["vodka"])
    abv = drink["abv"]
    stage_info = describe_scale_level(lvl)

    if lvl == 0:
        return {
            "target_scale": 0,
            "target_level": 0,
            "stage": stage_info,
            "stage_title": stage_info["title"],
            "stage_desc": stage_info["description"],
            "drink": drink["name"],
            "abv": abv,
            "target_promille": 0.0,
            "estimated_promille": 0.0,
            "total_liters": 0.0,
            "total_ml": 0,
            "per_person_ml": 0,
            "shots_per_person": 0,
            "shots_50ml_per_person": 0,
            "bottles_05": 0,
            "bottles_07": 0,
            "bottles_10": 0,
            "chaser_liters": round(total_people * 1.0, 1),
            "water_chasers_liters": round(total_people * 1.0, 1),
            "snack_kg": round(total_people * 0.4, 1),
            "snacks_kg": round(total_people * 0.4, 1),
            "ice_kg": round(total_people * 0.25, 1),
            "sober_hours": 0.0,
            "sober_after_hours": 0.0,
            "warning": None,
            "danger_warning": None,
        }

    # Map 0..40 scale -> Blood Alcohol Concentration in promille (0.0 .. 4.0‰)
    # 10 -> ~1.0‰, 20 -> ~2.0‰, 30 -> ~3.0‰, 40 -> 4.0‰ (loss of consciousness threshold)
    target_promille = round(lvl * 0.10, 2)

    # Widmark factor r: ~0.70 for men, ~0.60 for women
    avg_r = (men * 0.70 + women * 0.60) / total_people

    # Food absorption multiplier (more food -> slower/partial peak absorption, need more ethanol to hit same BAC)
    snack_mult = {
        "empty": 1.0,
        "none": 1.0,
        "light": 1.15,
        "normal": 1.28,
        "good": 1.28,
        "rich": 1.42,
        "heavy": 1.42,
    }.get(snack_level, 1.28)

    tolerance_mult = {
        "low": 0.88,
        "medium": 1.0,
        "high": 1.18,
    }.get(tolerance, 1.0)

    # Metabolic elimination over party duration (~0.15‰ burned per hour after first 0.5h)
    burned_promille = max(0.0, (hrs - 0.5) * 0.15)
    effective_promille_needed = (target_promille + burned_promille) * tolerance_mult

    # Grams of pure ethanol per average person: BAC * Weight * r * snack_mult
    pure_ethanol_grams_per_person = effective_promille_needed * weight * avg_r * snack_mult
    total_ethanol_grams = pure_ethanol_grams_per_person * total_people

    # Convert grams of ethanol to ml of beverage (ethanol density = 0.789 g/ml)
    raw_beverage_ml = total_ethanol_grams / (0.789 * (abv / 100.0))

    # Strategic "Чтоб за догоном не бежать" reserve (+15%)
    final_ml = raw_beverage_ml * (1.15 if no_run_reserve else 1.0)
    final_liters = final_ml / 1000.0

    bottles_05 = math.ceil(final_ml / 500.0)
    bottles_07 = math.ceil(final_ml / 700.0)
    bottles_10 = math.ceil(final_ml / 1000.0)

    sober_hours = round((target_promille + burned_promille * 0.3) / 0.15, 1)

    warning = None
    if lvl >= 30:
        warning = "⚠️ Уровень 30–40 опасен тяжёлой интоксикацией! Цифры приведены исключительно как теоретический расчёт по формуле Видмарка."

    chaser_l = round(total_people * (0.8 + hrs * 0.2), 1)
    snack_k = round(total_people * (0.35 + hrs * 0.08), 1)
    shots = int(round((final_ml / total_people) / 50.0))

    return {
        "target_scale": lvl,
        "target_level": lvl,
        "stage": stage_info,
        "stage_title": stage_info["title"],
        "stage_desc": stage_info["description"],
        "drink": f"{drink['emoji']} {drink['name']} ({abv:.0f}°)",
        "abv": abv,
        "people_total": total_people,
        "target_promille": target_promille,
        "estimated_promille": target_promille,
        "total_ml": int(round(final_ml)),
        "total_liters": round(final_liters, 2),
        "per_person_ml": int(round(final_ml / total_people)),
        "shots_per_person": shots,
        "shots_50ml_per_person": shots,
        "bottles_05": bottles_05,
        "bottles_07": bottles_07,
        "bottles_10": bottles_10,
        "reserve_included": no_run_reserve,
        "chaser_liters": chaser_l,
        "water_chasers_liters": chaser_l,
        "snack_kg": snack_k,
        "snacks_kg": snack_k,
        "ice_kg": round(total_people * 0.25, 1),
        "sober_hours": sober_hours,
        "sober_after_hours": sober_hours,
        "warning": warning,
        "danger_warning": warning,
    }


# ==============================================================================
# 2. Многофакторный Антропометрический Расчёт Длины Члена (Реалистичная калибровка)
# ==============================================================================

REAL_WORLD_COMPARISON_OBJECTS: list[dict[str, Any]] = [
    {"id": "aa_battery", "name": "Батарейка AA (пальчиковая)", "length_cm": 5.05, "width_cm": 1.45, "shape": "cylinder", "color": "#f59e0b"},
    {"id": "airpods_case", "name": "Кейс AirPods Pro", "length_cm": 6.06, "width_cm": 4.52, "shape": "box", "color": "#e2e8f0"},
    {"id": "cricket", "name": "Зажигалка Cricket", "length_cm": 7.90, "width_cm": 2.20, "shape": "box", "color": "#ef4444"},
    {"id": "bank_card", "name": "Банковская карта (ISO/IEC 7810)", "length_cm": 8.56, "width_cm": 5.40, "shape": "card", "color": "#3b82f6"},
    {"id": "snickers", "name": "Батончик Snickers (стандарт 50 г)", "length_cm": 10.20, "width_cm": 2.80, "shape": "box", "color": "#92400e"},
    {"id": "espresso_can", "name": "Банка энергетика 0.25 л", "length_cm": 13.40, "width_cm": 5.30, "shape": "cylinder", "color": "#06b6d4"},
    {"id": "iphone_16", "name": "Смартфон iPhone 16", "length_cm": 14.76, "width_cm": 7.16, "shape": "phone", "color": "#6366f1"},
    {"id": "bic_pen", "name": "Шариковая ручка BIC Cristal", "length_cm": 14.90, "width_cm": 0.85, "shape": "cylinder", "color": "#2563eb"},
    {"id": "dollar_bill", "name": "Купюра 1 доллар США", "length_cm": 15.60, "width_cm": 6.63, "shape": "card", "color": "#10b981"},
    {"id": "tv_remote", "name": "Стандартный пульт от ТВ", "length_cm": 17.50, "width_cm": 4.40, "shape": "box", "color": "#475569"},
]


def calculate_pencil_index(
    age: int = 21,
    height_cm: float = 178.0,
    shoe_size_eu: float = 42.0,
    arm_girth_cm: float = 31.5,
    wrist_cm: float = 17.2,
    index_finger_cm: float = 7.3,
    clash_royale_trophies: int = 4600,
    dota_mmr: int = 2400,
    sleep_hours: float = 7.0,
    room_temp_c: float = 21.0,
    **extra: Any,
) -> dict[str, Any]:
    """
    Детерминированная антропометрическая модель (базовая популяционная медиана 13.12 см, SD = 1.66 см,
    согласно клиническому метаанализу Veale et al., BJU International, n = 15,521).
    """
    # Legacy alias compatibility for API callers
    if "hand_span_cm" in extra and wrist_cm == 17.2:
        wrist_cm = max(14.0, min(22.5, float(extra["hand_span_cm"]) * 0.80))

    base = 13.12
    factors: list[dict[str, Any]] = []

    # 1. Возрастной коэффициент эластичности белочной оболочки (tunica albuginea)
    clamped_age = max(18, min(75, int(age)))
    if clamped_age <= 27:
        age_delta = round((clamped_age - 21) * 0.035, 2)
    else:
        age_delta = round(0.21 - (clamped_age - 27) * 0.014, 2)
    base += age_delta
    factors.append({
        "label": f"Эластичность коллагена tunica albuginea (возраст {clamped_age} лет)",
        "impact_cm": age_delta,
    })

    # 2. Соматотропная проекция длины тела (рост)
    clamped_h = max(148.0, min(212.0, float(height_cm)))
    h_delta = round((clamped_h - 176.0) * 0.028, 2)
    base += h_delta
    factors.append({
        "label": f"Линейная соматотропная корреляция роста ({clamped_h:.0f} см, r = 0.21)",
        "impact_cm": h_delta,
    })

    # 3. Дистальный акроподиальный индекс стопы (размер обуви EU)
    clamped_shoe = max(36.0, min(49.0, float(shoe_size_eu)))
    s_delta = round((clamped_shoe - 42.0) * 0.11, 2)
    base += s_delta
    factors.append({
        "label": f"Экспрессия генов кластера HOXA13 / HOXD13 (обувь {clamped_shoe:.0f} EU)",
        "impact_cm": s_delta,
    })

    # 4. Обхват плеча (индекс периферической гемодинамики)
    clamped_arm = max(21.0, min(50.0, float(arm_girth_cm)))
    if clamped_arm <= 38.0:
        arm_delta = round((clamped_arm - 31.0) * 0.045, 2)
    else:
        # Выше 38 см срабатывает перераспределение системного кровотока в скелетную мускулатуру
        arm_delta = round(0.31 - (clamped_arm - 38.0) * 0.055, 2)
    base += arm_delta
    factors.append({
        "label": f"Периферический резерв плечевой артерии (обхват руки {clamped_arm:.1f} см)",
        "impact_cm": arm_delta,
    })

    # 5. Остеометрический индекс запястья (индекс Соловьёва)
    clamped_wrist = max(13.5, min(23.0, float(wrist_cm)))
    w_delta = round((clamped_wrist - 17.2) * 0.10, 2)
    base += w_delta
    factors.append({
        "label": f"Остеометрический индекс Соловьёва (запястье {clamped_wrist:.1f} см)",
        "impact_cm": w_delta,
    })

    # 6. Длина указательного пальца (фаланговый маркер Манинга 2D)
    clamped_finger = max(5.5, min(10.5, float(index_finger_cm)))
    f_delta = round((clamped_finger - 7.3) * 0.14, 2)
    base += f_delta
    factors.append({
        "label": f"Пренатальный андрогенный рецепторный индекс (палец 2D: {clamped_finger:.1f} см)",
        "impact_cm": f_delta,
    })

    # 7. Кубки в Clash Royale (кортизоловая вазоконстрикция симпатической нервной системы)
    trophies = max(0, min(9000, int(clash_royale_trophies)))
    if trophies <= 3000:
        cr_delta = round(0.14 - (trophies / 3000.0) * 0.08, 2)
    else:
        cr_delta = round(-((trophies - 3000) / 6000.0) * 0.82, 2)
    base += cr_delta
    factors.append({
        "label": f"Кортизоловый спазм сосудов от стресса Clash Royale ({trophies} кубков)",
        "impact_cm": cr_delta,
    })

    # 8. Рейтинг MMR в Dota 2 / тактических дисциплинах (венозный стаз малого таза)
    mmr = max(0, min(12000, int(dota_mmr)))
    if mmr <= 2000:
        mmr_delta = 0.08
    else:
        mmr_delta = round(-((mmr - 2000) / 10000.0) * 0.68, 2)
    base += mmr_delta
    factors.append({
        "label": f"Сидячий гемодинамический стаз малого таза ({mmr} MMR)",
        "impact_cm": mmr_delta,
    })

    # 9. Ночная фаза БДГ-сна (эндогенный синтез свободного тестостерона)
    clamped_sleep = max(3.5, min(11.5, float(sleep_hours)))
    sleep_delta = round(max(-0.48, min(0.32, (clamped_sleep - 7.2) * 0.13)), 2)
    base += sleep_delta
    factors.append({
        "label": f"Ночной синтез лютеинизирующего гормона (сон {clamped_sleep:.1f} ч/сут)",
        "impact_cm": sleep_delta,
    })

    # 10. Терморегуляторный рефлекс гладкой мускулатуры m. dartos
    clamped_temp = max(10.0, min(35.0, float(room_temp_c)))
    temp_delta = round(max(-0.75, min(0.28, (clamped_temp - 21.5) * 0.055)), 2)
    base += temp_delta
    factors.append({
        "label": f"Терморефлекс tunica dartos (температура среды {clamped_temp:.0f} °C)",
        "impact_cm": temp_delta,
    })

    final_cm = round(max(8.2, min(17.8, base)), 2)
    final_inches = round(final_cm / 2.54, 2)
    flaccid_cm = round(max(5.8, final_cm * 0.695 + (clamped_temp - 21.0) * 0.04), 2)
    girth_cm = round(max(9.1, min(14.2, 11.66 + (final_cm - 13.12) * 0.38 + (clamped_wrist - 17.2) * 0.14)), 2)

    # Точный перцентиль нормального распределения Veale et al. (mean = 13.12, SD = 1.66)
    z = (final_cm - 13.12) / 1.66
    percentile = round(min(99.6, max(0.8, 0.5 * (1.0 + math.erf(z / math.sqrt(2.0))) * 100.0)), 1)

    if final_cm >= 15.8:
        rank_title = "Верхний дециль популяционной выборки (P90+)"
    elif final_cm >= 14.2:
        rank_title = "Выше среднепопуляционной медианы (M + 1σ)"
    elif final_cm >= 12.3:
        rank_title = "Центральная клиническая норма (интерквартиль Q2–Q3)"
    elif final_cm >= 10.8:
        rank_title = "Компактный морфотип в границах физиологической нормы"
    else:
        rank_title = "Выраженная стресс-индуцированная вазоконстрикция"

    for f in factors:
        imp = f.get("impact_cm", 0.0)
        f["impact"] = f"{'+' if imp >= 0 else ''}{imp:.2f} см"

    comparisons = []
    for obj in REAL_WORLD_COMPARISON_OBJECTS:
        ratio = round(final_cm / obj["length_cm"], 2)
        diff = round(final_cm - obj["length_cm"], 2)
        comparisons.append({
            **obj,
            "ratio": ratio,
            "diff_cm": diff,
            "verdict": (
                f"Почти 1-в-1 ({diff:+.1f} см)"
                if abs(diff) <= 0.65
                else (f"Длиннее на {diff:.1f} см ({ratio}×)" if diff > 0 else f"Короче на {abs(diff):.1f} см ({ratio}×)")
            ),
        })
    closest_obj = min(comparisons, key=lambda item: abs(item["diff_cm"]))

    return {
        "length_cm": final_cm,
        "estimated_cm": final_cm,
        "flaccid_cm": flaccid_cm,
        "length_inches": final_inches,
        "estimated_inches": final_inches,
        "girth_est_cm": girth_cm,
        "population_mean_cm": 13.12,
        "percentile": percentile,
        "rank_title": rank_title,
        "closest_object": closest_obj,
        "comparisons": comparisons,
        "factors": factors,
        "methodology": (
            "Расчёт выполнен по десятифакторной регрессионной матрице НИИ Прикладной Соматометрии "
            "(эталон выборки: BJU International, μ = 13.12 см, σ = 1.66 см, доверительный интервал 95%)."
        ),
        "disclaimer": (
            "Протокол учитывает остеометрию запястья, экспрессию генов HOXD13, пренатальный индекс 2D "
            "и нейроэндокринную кортизоловую нагрузку в соревновательных дисциплинах."
        ),
    }


# ==============================================================================
# 2B. Десятифакторный Маммометрический Расчёт Размера Женской Груди (Реалистичная калибровка)
# ==============================================================================

BREAST_COMPARISON_OBJECTS: list[dict[str, Any]] = [
    {"id": "tangerine", "name": "Мандарин абхазский", "volume_ml": 115, "diameter_cm": 7.6, "cup_hint": "AA", "color": "#fb923c"},
    {"id": "champagne_coupe", "name": "Бокал шампанского «Мария-Антуанетта»", "volume_ml": 185, "diameter_cm": 9.2, "cup_hint": "A", "color": "#fde047"},
    {"id": "peach", "name": "Спелый бархатный персик", "volume_ml": 255, "diameter_cm": 10.3, "cup_hint": "B", "color": "#f472b6"},
    {"id": "apple_large", "name": "Крупное яблоко Гренни Смит", "volume_ml": 340, "diameter_cm": 11.4, "cup_hint": "B+/C", "color": "#4ade80"},
    {"id": "grapefruit", "name": "Розовый грейпфрут", "volume_ml": 450, "diameter_cm": 12.6, "cup_hint": "C", "color": "#fb7185"},
    {"id": "coconut", "name": "Кокосовый орех в скорлупе", "volume_ml": 590, "diameter_cm": 13.8, "cup_hint": "D", "color": "#a16207"},
    {"id": "pomelo", "name": "Азиатское помело", "volume_ml": 740, "diameter_cm": 15.0, "cup_hint": "E (DD)", "color": "#a3e635"},
    {"id": "cantaloupe", "name": "Дыня Канталупа", "volume_ml": 910, "diameter_cm": 16.2, "cup_hint": "F", "color": "#f59e0b"},
]


def calculate_breast_size_index(
    age: int = 22,
    height_cm: float = 166.0,
    underbust_cm: float = 74.0,
    hip_cm: float = 95.0,
    hair_length_cm: float = 42.0,
    matcha_latte_per_week: int = 4,
    pinterest_pins: int = 650,
    skincare_jars: int = 9,
    shower_temp_c: float = 41.0,
    sims_genshin_hours: int = 280,
) -> dict[str, Any]:
    """
    Десятифакторная антропометрическая модель женской маммометрии
    (базовая медианная проекция Δ = ОГ − ОПГ = 14.3 см, чашка B/C, стандарт EN 13402).
    """
    clamped_age = max(18, min(68, int(age)))
    clamped_h = max(145.0, min(195.0, float(height_cm)))
    clamped_ub = max(62.0, min(104.0, float(underbust_cm)))
    clamped_hip = max(78.0, min(132.0, float(hip_cm)))
    clamped_hair = max(3.0, min(110.0, float(hair_length_cm)))
    clamped_matcha = max(0, min(28, int(matcha_latte_per_week)))
    clamped_pins = max(0, min(10000, int(pinterest_pins)))
    clamped_jars = max(0, min(50, int(skincare_jars)))
    clamped_shower = max(33.0, min(48.0, float(shower_temp_c)))
    clamped_games = max(0, min(6000, int(sims_genshin_hours)))

    # Базовая разница ОГ - ОПГ (в см) в европейской популяции ~14.2 см (между B и C)
    delta_cm = 14.20
    factors: list[dict[str, Any]] = []

    # 1. Тонус связок Купера (ligamenta suspensoria) по возрасту
    age_d = round(min(0.85, max(-0.55, (clamped_age - 22) * 0.045)), 2)
    delta_cm += age_d
    factors.append({"label": f"Эластичность фасциальных связок Купера ({clamped_age} лет)", "impact_cm": age_d})

    # 2. Гиноидный эстрадиоловый индекс (соотношение обхвата бёдер к ОПГ)
    hip_ratio_d = round(max(-2.1, min(3.2, (clamped_hip - (clamped_ub + 20.5)) * 0.145)), 2)
    delta_cm += hip_ratio_d
    factors.append({"label": f"Гиноидное эстрадиоловое депо адипоцитов (бёдра {clamped_hip:.0f} см)", "impact_cm": hip_ratio_d})

    # 3. Продольная соматотропная проекция грудной клетки (рост)
    h_d = round((clamped_h - 166.0) * 0.024, 2)
    delta_cm += h_d
    factors.append({"label": f"Торакальная пропорция грудной клетки (рост {clamped_h:.0f} см)", "impact_cm": h_d})

    # 4. Фолликулярная ароматазная корреляция длины волос
    hair_d = round(max(-0.5, min(0.75, (clamped_hair - 38.0) * 0.012)), 2)
    delta_cm += hair_d
    factors.append({"label": f"Экспрессия рецепторов эстрогена ER-β (волосы {clamped_hair:.0f} см)", "impact_cm": hair_d})

    # 5. Фитоэстрогеновый индекс матчи и растительного молока
    if clamped_matcha <= 9:
        matcha_d = round(clamped_matcha * 0.085, 2)
    else:
        matcha_d = round(0.76 - (clamped_matcha - 9) * 0.035, 2)
    delta_cm += matcha_d
    factors.append({"label": f"Изофлавоновая модуляция растительного латте/матчи ({clamped_matcha} чаш./нед)", "impact_cm": matcha_d})

    # 6. Нейроэстетический дофаминовый отклик досок Pinterest
    pins_d = round(min(0.62, math.log10(clamped_pins + 10) * 0.22 - 0.35), 2)
    delta_cm += pins_d
    factors.append({"label": f"Визуально-лимбическая стимуляция гипофиза ({clamped_pins} пинов Pinterest)", "impact_cm": pins_d})

    # 7. Трансдермальная дисциплина баночек ухода на полке
    jars_d = round(max(-0.35, min(0.68, (clamped_jars - 7) * 0.032)), 2)
    delta_cm += jars_d
    factors.append({"label": f"Пептидно-церамидный индекс домашней полки ({clamped_jars} средств)", "impact_cm": jars_d})

    # 8. Термальная вазодилатация («кипяток» в душе)
    shower_d = round(max(-0.60, min(0.72, (clamped_shower - 39.5) * 0.095)), 2)
    delta_cm += shower_d
    factors.append({"label": f"Капиллярная гиперемия от температуры душа ({clamped_shower:.0f} °C)", "impact_cm": shower_d})

    # 9. Ночной мелатониново-пролактиновый сдвиг (Sims 4 / Genshin / Клуб Романтики)
    games_d = round(min(0.58, (clamped_games / 1200.0) * 0.28) if clamped_games <= 2400 else round(0.56 - (clamped_games - 2400) / 8000.0, 2), 2)
    delta_cm += games_d
    factors.append({"label": f"Циркадный пролактиновый фон (Sims / Genshin / новеллы: {clamped_games} ч)", "impact_cm": games_d})

    # 10. Опорный каркас пояса (ОПГ)
    ub_d = round((clamped_ub - 74.0) * 0.04, 2)
    delta_cm += ub_d
    factors.append({"label": f"Ширина основания грудной фасции (ОПГ {clamped_ub:.0f} см)", "impact_cm": ub_d})

    delta_cm = round(max(8.5, min(24.5, delta_cm)), 2)
    bust_cm = round(clamped_ub + delta_cm, 1)

    # Стандарт EN 13402: округление пояса с шагом 5 см
    eu_band = int(round(clamped_ub / 5.0) * 5)
    eu_band = max(65, min(105, eu_band))
    us_band = int(round(eu_band / 5) * 2 + 2)  # 65->30, 70->32, 75->34, 80->36, 85->38

    cup_table = [
        (10.0, "AA", "AA"),
        (12.0, "A", "A"),
        (14.0, "B", "B"),
        (16.0, "C", "C"),
        (18.0, "D", "D"),
        (20.0, "E", "DD"),
        (22.0, "F", "DDD / F"),
        (99.0, "G", "G"),
    ]
    eu_cup = "B"
    us_cup = "B"
    for max_d, c_eu, c_us in cup_table:
        if delta_cm < max_d:
            eu_cup, us_cup = c_eu, c_us
            break

    # Реалистичный объём одной молочной железы (мл) с учётом и чашки, и ширины пояса (sister sizing!)
    band_steps = (eu_band - 75) / 5.0
    cup_idx = ["AA", "A", "B", "C", "D", "E", "F", "G"].index(eu_cup)
    base_volumes = [130, 195, 275, 380, 500, 635, 780, 930]
    frac = (delta_cm - (8.0 + cup_idx * 2.0)) / 2.0
    frac = max(-0.4, min(0.6, frac))
    single_volume_ml = int(round(max(105.0, (base_volumes[cup_idx] * (1.0 + 0.14 * frac)) * (1.0 + band_steps * 0.11))))
    pair_weight_g = int(round(single_volume_ml * 2 * 0.91))  # плотность адипозно-гландулярной ткани ~0.91 г/см³
    spine_load_newtons = round((pair_weight_g / 1000.0) * 9.81, 2)

    z = (delta_cm - 14.3) / 2.85
    percentile = round(min(99.4, max(1.2, 0.5 * (1.0 + math.erf(z / math.sqrt(2.0))) * 100.0)), 1)

    for f in factors:
        imp = f["impact_cm"]
        f["impact"] = f"{'+' if imp >= 0 else ''}{imp:.2f} см к проекции"

    comparisons = []
    for obj in BREAST_COMPARISON_OBJECTS:
        diff_ml = single_volume_ml - obj["volume_ml"]
        ratio = round(single_volume_ml / obj["volume_ml"], 2)
        comparisons.append({
            **obj,
            "diff_ml": diff_ml,
            "ratio": ratio,
            "verdict": (
                f"Точное совпадение объёма ({diff_ml:+d} мл)"
                if abs(diff_ml) <= 38
                else (f"Крупнее на {diff_ml} мл ({ratio}×)" if diff_ml > 0 else f"Компактнее на {abs(diff_ml)} мл ({ratio}×)")
            ),
        })
    closest_obj = min(comparisons, key=lambda item: abs(item["diff_ml"]))

    return {
        "eu_size": f"{eu_band}{eu_cup}",
        "us_uk_size": f"{us_band}{us_cup}",
        "eu_band": eu_band,
        "eu_cup": eu_cup,
        "underbust_cm": round(clamped_ub, 1),
        "bust_cm": bust_cm,
        "delta_cm": delta_cm,
        "single_volume_ml": single_volume_ml,
        "pair_volume_ml": single_volume_ml * 2,
        "pair_weight_g": pair_weight_g,
        "spine_load_newtons": spine_load_newtons,
        "percentile": percentile,
        "closest_object": closest_obj,
        "comparisons": comparisons,
        "factors": factors,
        "methodology": (
            "Расчёт выполнен по десятифакторному протоколу НИИ Прикладной Маммометрии (стандарт EN 13402, "
            "коэффициент плотности гландулярно-липидной паренхимы ρ = 0.91 г/см³, поправка Sister-Sizing по ОПГ)."
        ),
    }


# ==============================================================================
# 3. Подсказчик «Что делать, когда нечего делать» (135+ идей + Лигурия!)
# ==============================================================================

LIGURIA_TEXT = (
    "В четверг четвёртого числа в четыре с четвертью часа лигурийский регулировщик регулировал в Лигурии, "
    "но тридцать три корабля лавировали, лавировали, да так и не вылавировали, а потом протокол про протокол "
    "протоколом запротоколировал, как интервьюером интервьюируемый лигурийский регулировщик речисто, да не чисто "
    "рапортовал, да не дорапортовал дорапортовывал да так зарапортовался про размокропогодившуюся погоду, что, "
    "дабы инцидент не стал претендентом на судебный прецедент, лигурийский регулировщик акклиматизировался в "
    "неконституционном Константинополе, где хохлатые хохотушки хохотом хохотали и кричали турке, который начерно "
    "обкурен трубкой: не кури, турка, трубку, купи лучше кипу пик, лучше пик кипу купи, а то придёт бомбардир "
    "из Бранденбурга — бомбами забомбардирует за то, что некто чернорылый у него полдвора рылом изрыл, вырыл и подрыл!"
)

FOREIGN_TONGUE_TWISTERS = [
    {"lang": "🇬🇧 Английский", "text": "Pad kid poured curd pulled cod.", "note": "Признана учёными MIT одной из сложнейших скороговорок в мире!"},
    {"lang": "🇨🇿 Чешский (без гласных!)", "text": "Strč prst skrz krk.", "note": "«Просунь палец сквозь горло» — ни одной гласной буквы!"},
    {"lang": "🇩🇪 Немецкий", "text": "Fischers Fritze fischt frische Fische, frische Fische fischt Fischers Fritze.", "note": "Классика немецкой дикции."},
    {"lang": "🇯🇵 Японский", "text": "Nama mugi, nama gome, nama tamago (生麦生米生卵).", "note": "Сырая пшеница, сырой рис, сырое яйцо — тест для сэйю аниме!"},
    {"lang": "🇵🇱 Польский", "text": "W Szczebrzeszynie chrząszcz brzmi w trzcinie.", "note": "Легендарный шипящий кошмар иностранцев."},
]

BOREDOM_IDEAS: list[dict[str, Any]] = [
    # --- Гейминг, Аниме и Манга ---
    {"id": 1, "cat": "gaming", "text": "Пройти Devil May Cry на максимальном стиле (выбить SSS в комбо!)"},
    {"id": 2, "cat": "gaming", "text": "Поиграть в Sekiro: Shadows Die Twice и отточить идеальные дефлекты на боссе"},
    {"id": 3, "cat": "gaming", "text": "Устроить Dota Level Up — апнуть тир любимого героя и разобрать реплей"},
    {"id": 4, "cat": "gaming", "text": "Создать с нуля свою собственную сборку в Dota 2 на каждого героя (кроме Кеза и Рингмастера)"},
    {"id": 5, "cat": "gaming", "text": "Вернуться к легендарным заброшенным мангам, которые начинал читать («Кулак Полярной звезды» и др.)"},
    {"id": 6, "cat": "gaming", "text": "Перечитать или пересмотреть шедевры, детали которых уже забылись («Бродяга», «Мальчишки XX века»...)"},
    {"id": 7, "cat": "gaming", "text": "Пересмотреть комедийное аниме «Ох уж этот экстрасенс Сайки Кусуо!»"},
    {"id": 8, "cat": "gaming", "text": "(Пере)озвучить голосом на микрофон эпичную или смешную сцену из аниме"},
    {"id": 9, "cat": "gaming", "text": "Изучить все стенды из 7–9 частей JoJo и придумать концепт своего собственного Стенда со статами"},
    {"id": 10, "cat": "gaming", "text": "Пройти классическую аркаду: поймать 200+ яиц за Волка или поставить рекорд в Тетрисе прямо в боте"},
    {"id": 11, "cat": "gaming", "text": "Запустить спидран первой локации любимой игры с таймером на телефоне"},
    {"id": 12, "cat": "gaming", "text": "Послушать OST из DMC 5 (Bury the Light) или Metal Gear Rising на полной громкости в наушниках"},
    {"id": 13, "cat": "gaming", "text": "Разобрать скрытый лор Dark Souls / Elden Ring по описаниям предметов"},
    {"id": 14, "cat": "gaming", "text": "Настроить идеальный прицел, бинды и конфиг, который откладывал полгода"},
    {"id": 15, "cat": "gaming", "text": "Попробовать перевести и затайпить главу редкой манги (или даже 18+ додзинси ради практики фотошопа)", "spicy": True},

    # --- Творчество, Код и Инженерия ---
    {"id": 16, "cat": "creative", "text": "Снять, смонтировать и залить новый видос на канал QLS СЕНЯ"},
    {"id": 17, "cat": "creative", "text": "Подумать над инженерной реализацией самовоспроизводящегося 3D-принтера (концепция RepRap)"},
    {"id": 18, "cat": "creative", "text": "Придумать за 3 минуты безумный сюжет истории по приколу — максимальный полёт фантазии"},
    {"id": 19, "cat": "creative", "text": "Поэкспериментировать в изолированной песочнице с Python и нейросетью: написать необычный исследовательский скрипт-симулятор"},
    {"id": 20, "cat": "creative", "text": "Помечтать и собрать в конфигураторе идеальный будущий апгрейд комплектующих своего ПК"},
    {"id": 21, "cat": "creative", "text": "Понять принцип работы и внутреннее строение бытовых приборов — как устроена стиралка, магнетрон микроволновки или OLED-телевизор"},
    {"id": 22, "cat": "creative", "text": "Рассчитать реальный физический КПД рандомного предмета на столе или бытового события"},
    {"id": 23, "cat": "creative", "text": "Спрятать секретное послание внутри PNG-картинки через стеганографию и скинуть другу без объяснений"},
    {"id": 24, "cat": "creative", "text": "Написать бит или 8-битную мелодию в бесплатном онлайн-секвенсоре за 15 минут"},
    {"id": 25, "cat": "creative", "text": "Сделать редизайн рабочего стола ПК и навести идеальный кабель-менеджмент под столом"},
    {"id": 26, "cat": "creative", "text": "Написать четверостишие или дисс-панч с помощью генератора рифм"},
    {"id": 27, "cat": "creative", "text": "Смоделировать простую полезную деталь для стола в CAD / Blender"},
    {"id": 28, "cat": "creative", "text": "Автоматизировать рутинную задачу на ПК коротким Python-скриптом на 20 строк"},
    {"id": 29, "cat": "creative", "text": "Сгенерировать неоновый Wi-Fi QR-код для дома и распечатать/сохранить гостям"},
    {"id": 30, "cat": "creative", "text": "Придумать настольную или карточную мини-игру со своими правилами"},

    # --- Наука, Книги, Мозг и Саморазвитие ---
    {"id": 31, "cat": "mind", "text": "Прочитать вслух легендарную скороговорку «Лигурия» целиком на скорость с секундомером"},
    {"id": 32, "cat": "mind", "text": "Выяснить, какие жёсткие скороговорки есть на других языках мира (чешском, японском, немецком) и попробовать их произнести"},
    {"id": 33, "cat": "mind", "text": "Открыть совершенно рандомную книгу на случайной главе и прочитать минимум 15 страниц"},
    {"id": 34, "cat": "mind", "text": "Узнать, какие существуют священные религиозные книги (Библия, Коран, Танах, Трипитака, Веды) и сравнить ключевые идеи мировых религий"},
    {"id": 35, "cat": "mind", "text": "Посмотреть качественные гайды по инвестированию, сложному проценту и финансовой подушке"},
    {"id": 36, "cat": "mind", "text": "Изучить техники якорей реальности и попытаться сегодня ночью попасть в осознанный сон"},
    {"id": 37, "cat": "mind", "text": "Поразмышлять над смыслом фразы: «Добыче нельзя верить словам охотника» — и придумать историю вокруг неё"},
    {"id": 38, "cat": "mind", "text": "Узнать историю и интернет-археологию старого Рунета (феномен Ивана Гамаза и мемной эпохи 2010-х)"},
    {"id": 39, "cat": "mind", "text": "Изучить, как работает луковая маршрутизация, криптография и Tor Browser изнутри"},
    {"id": 40, "cat": "mind", "text": "Сравнить конституции 3 разных стран мира (например, Японии, США и Сан-Марино)"},
    {"id": 41, "cat": "mind", "text": "Выучить 10 эффектных научных терминов (от когнитивного диссонанса и апофении до промискуитета)"},
    {"id": 42, "cat": "mind", "text": "Освежить в памяти формулы по физике и геометрии и решить задачку в уме без калькулятора"},
    {"id": 43, "cat": "mind", "text": "Пройти слепую печать на клавиатуре на 60 секунд и замерить свой рекорд зн/мин"},
    {"id": 44, "cat": "mind", "text": "Найти на карте самый маленький населённый пункт или самую холодную деревню мира (Оймякон) и почитать, как там живут люди"},
    {"id": 45, "cat": "mind", "text": "Изучить парадокс Ферми, уравнение Дрейка или гипотезу Тёмного леса"},
    {"id": 46, "cat": "mind", "text": "Выучить алфавит Морзе для своего имени и слова SOS"},
    {"id": 47, "cat": "mind", "text": "Разобраться, чем отличаются языки Rust, Go, C++ и Python на низком уровне"},
    {"id": 48, "cat": "mind", "text": "Потренировать метод дворца памяти (чертогов разума) на списке из 15 случайных слов"},
    {"id": 49, "cat": "mind", "text": "Прочитать биографию Николы Теслы, Ричарда Фейнмана или Миямото Мусаси"},
    {"id": 50, "cat": "mind", "text": "Пройти дуэль «Человек или ИИ?» и проверить свою интуицию в тесте Тьюринга"},

    # --- Спорт, Быт, Уют и Жизненное ---
    {"id": 51, "cat": "chill", "text": "Отжаться 100 раз за сегодня (разбить на комфортные подходы и закрыть сотку!)"},
    {"id": 52, "cat": "chill", "text": "Заварить хороший листовой или ягодный чай и выпить его в тишине без скролла ленты"},
    {"id": 53, "cat": "chill", "text": "Приготовить что-нибудь реально вкусное по новому рецепту из интернета"},
    {"id": 54, "cat": "chill", "text": "Заказать компактный мини-пылесос / турбо-воздуходувку на Ozon, чтобы вычищать пыль со стола и внутри корпуса ПК"},
    {"id": 55, "cat": "chill", "text": "Устроить челлендж силы воли: специально воздержаться и направить всю энергию в спорт или проект", "spicy": True},
    {"id": 56, "cat": "chill", "text": "Расслабиться, снять стресс наедине с собой и перезагрузить голову без чувства вины", "spicy": True},
    {"id": 57, "cat": "chill", "text": "Сделать 10-минутную разминку шеи, плеч и грудного отдела после долгого сидения за ПК"},
    {"id": 58, "cat": "chill", "text": "Почистить галерею телефона и папку «Загрузки» — освободить минимум 5 ГБ места"},
    {"id": 59, "cat": "chill", "text": "Протереть монитор микрофиброй и почистить кейкапы механической клавиатуры"},
    {"id": 60, "cat": "chill", "text": "Выйти на 30-минутную вечернюю прогулку совершенно новым маршрутом во дворах"},
    {"id": 61, "cat": "chill", "text": "Простоять в планке максимум времени под любимый трек"},
    {"id": 62, "cat": "chill", "text": "Сделать домашний лимонад со льдом, лимоном и мятой"},
    {"id": 63, "cat": "chill", "text": "Поменять термопасту или продуть пылевые фильтры кулеров системника"},
    {"id": 64, "cat": "chill", "text": "Составить капсулу желаний / письмо себе на 1 год вперёд"},
    {"id": 65, "cat": "chill", "text": "Принять контрастный душ и мгновенно взбодриться"},

    # --- Ещё 45 крутых челленджей и приключений для пула 110+ ---
    {"id": 66, "cat": "challenge", "text": "Зайти в анонимный чатик под загадочным позывным и завести философский диалог"},
    {"id": 67, "cat": "challenge", "text": "Оценить 10 анкет в Бибинто и создать свою самую харизматичную карточку"},
    {"id": 68, "cat": "challenge", "text": "Попробовать писать неведущей (левой/правой) рукой в течение 15 минут"},
    {"id": 69, "cat": "challenge", "text": "Сгенерировать 24-символьные пароли и обновить защиту на главных аккаунтах + включить 2FA"},
    {"id": 70, "cat": "challenge", "text": "Сделать серию атмосферных ночных фото улицы в стиле киберпанк"},
    {"id": 71, "cat": "challenge", "text": "Научиться жонглировать тремя яблоками или мячиками за полчаса"},
    {"id": 72, "cat": "challenge", "text": "Собрать кубик Рубика по алгоритму Фридрих или для новичков"},
    {"id": 73, "cat": "challenge", "text": "Устроить цифровой детокс на 60 минут с бумажным блокнотом и ручкой"},
    {"id": 74, "cat": "challenge", "text": "Найти старый плейлист 5-летней давности и переслушать треки с ностальгией"},
    {"id": 75, "cat": "challenge", "text": "Сделать свой собственный стикерпак в Telegram из локальных мемов компании (512×512 WEBP)"},
    {"id": 76, "cat": "challenge", "text": "Научиться крутить ручку между пальцами (Pen Spinning — трюк Thumbaround)"},
    {"id": 77, "cat": "challenge", "text": "Сложить из бумаги оригами-дракона или истребитель, бьющий рекорд дальности полёта"},
    {"id": 78, "cat": "challenge", "text": "Проверить скорость реакции в миллисекундах и сравнить со средним киберспортсменом (160 мс)"},
    {"id": 79, "cat": "challenge", "text": "Посмотреть документалку про глубоководные впадины океана или чёрные дыры"},
    {"id": 80, "cat": "challenge", "text": "Выписать 10 безумных идей для пет-проекта или стартапа, какими бы странными они ни казались"},
    {"id": 81, "cat": "mind", "text": "Разобраться, как работает GPS и почему спутникам нужна поправка теории относительности Эйнштейна"},
    {"id": 82, "cat": "mind", "text": "Посчитать на финансовом калькуляторе, во что превратятся 5 000₽/мес за 10 лет под сложным процентом"},
    {"id": 83, "cat": "mind", "text": "Изучить 5 классических логических софизмов, чтобы никто не мог переспорить в чате"},
    {"id": 84, "cat": "mind", "text": "Узнать, как устроен процессор на уровне транзисторов и логических вентилей И/ИЛИ/НЕ"},
    {"id": 85, "cat": "mind", "text": "Почитать про самые странные законы разных стран мира"},
    {"id": 86, "cat": "creative", "text": "Нарисовать пиксель-арт персонажа 32×32 для инди-игры"},
    {"id": 87, "cat": "creative", "text": "Записать голосовую заметку со сном, который приснился сегодня утром"},
    {"id": 88, "cat": "creative", "text": "Сделать кинематографичный скриншот любимого куска кода через Carbon-генератор"},
    {"id": 89, "cat": "creative", "text": "Придумать название, логотип и слоган вымышленной киберпанк-корпорации"},
    {"id": 90, "cat": "creative", "text": "Составить тир-лист любимых игр, аниме или фильмов всех времён (S / A / B / C)"},
    {"id": 91, "cat": "gaming", "text": "Пройти миссию в стелс-игре вообще без единого обнаружения (Ghost Run)"},
    {"id": 92, "cat": "gaming", "text": "Сыграть шахматную партию рапид 10+0 или решить 5 тактических задач"},
    {"id": 93, "cat": "gaming", "text": "Перепройти босса в любимом слэшере без получения урона (No Damage)"},
    {"id": 94, "cat": "gaming", "text": "Посмотреть легендарный камбэк с The International в Dota 2"},
    {"id": 95, "cat": "gaming", "text": "Почитать мангу с крутейшей рисовкой (Berserk, One-Punch Man Мураты, Innocent)"},
    {"id": 96, "cat": "chill", "text": "Приготовить идеальную яичницу-глазунью или омлет Пуляр как в ресторане"},
    {"id": 97, "cat": "chill", "text": "Проветрить комнату до прохладных 19–20°C перед сном для глубокой фазы сна"},
    {"id": 98, "cat": "chill", "text": "Сделать 50 приседаний и 30 скручиваний на пресс под энергичный фонк"},
    {"id": 99, "cat": "chill", "text": "Разобрать закладки в браузере, которые висят с позапрошлого года"},
    {"id": 100, "cat": "chill", "text": "Написать старому другу, с которым давно не общались, просто узнать как дела"},
    {"id": 101, "cat": "challenge", "text": "Запомнить первые 25 знаков числа Пи после запятой (3.1415926535897932384626433...)"},
    {"id": 102, "cat": "challenge", "text": "Угадать страну на панораме улицы по архитектуре, столбам и дорожной разметке"},
    {"id": 103, "cat": "challenge", "text": "Научиться завязывать морской булинь (беседочный узел) с закрытыми глазами"},
    {"id": 104, "cat": "challenge", "text": "Создать абсурдно длинную ссылку через удлинитель URL и затроллить друга"},
    {"id": 105, "cat": "challenge", "text": "Сделать упражнение на дыхание по квадрату (4 сек вдох — 4 задержка — 4 выдох — 4 пауза)"},
]


def get_boredom_ideas(
    category: str = "all",
    include_spicy: bool = True,
    count: int = 5,
    search: str = "",
) -> dict[str, Any]:
    pool = [
        item for item in BOREDOM_IDEAS
        if (include_spicy or not item.get("spicy", False))
        and (category in ("all", "") or item["cat"] == category)
        and (not search.strip() or search.strip().lower() in item["text"].lower())
    ]
    if not pool:
        pool = BOREDOM_IDEAS[:10]

    picked = [
        {**it, "title": it.get("title") or it.get("text", "")}
        for it in random.sample(pool, k=min(max(1, count), len(pool)))
    ]
    twisters = [{**t, "meaning": t.get("meaning") or t.get("note", "")} for t in FOREIGN_TONGUE_TWISTERS]
    total_avail = len([i for i in BOREDOM_IDEAS if include_spicy or not i.get("spicy", False)])
    return {
        "total_in_database": len(BOREDOM_IDEAS),
        "total_in_vault": total_avail,
        "filtered_count": len(pool),
        "matching_count": len(pool),
        "picked": picked,
        "items": picked,
        "liguria": LIGURIA_TEXT,
        "foreign_twisters": twisters,
    }
