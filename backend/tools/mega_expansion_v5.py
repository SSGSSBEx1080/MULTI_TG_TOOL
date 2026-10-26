from __future__ import annotations

import colorsys
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation, ROUND_FLOOR, ROUND_HALF_UP
import math
import re
from typing import Any
from zoneinfo import ZoneInfo

# ==============================================================================
# 1. HEALTH, MACROS, SLEEP, 1RM PLATES & RUNNING PACE
# ==============================================================================
ACTIVITY_LEVELS: dict[str, tuple[str, float]] = {
    "sedentary": ("Сидячий образ жизни (офис, без тренировок)", 1.2),
    "light": ("Лёгкая активность (1–3 тренировки в неделю)", 1.375),
    "moderate": ("Средняя активность (3–5 тренировок в неделю)", 1.55),
    "active": ("Высокая активность (6–7 тренировок в неделю)", 1.725),
    "athlete": ("Профессиональный спорт / тяжёлый труд", 1.9),
}


def calculate_bmi_and_macros(
    sex: str,
    age: int,
    height_cm: float,
    weight_kg: float,
    activity: str = "moderate",
    goal: str = "maintain",
) -> dict[str, Any]:
    h = max(100.0, min(250.0, float(height_cm)))
    w = max(25.0, min(300.0, float(weight_kg)))
    a = max(10, min(110, int(age)))
    is_male = (sex or "m").lower().startswith("m")

    bmi = round(w / ((h / 100.0) ** 2), 1)
    if bmi < 18.5:
        bmi_cat = "Дефицит массы тела"
    elif bmi < 25.0:
        bmi_cat = "Нормальная масса тела"
    elif bmi < 30.0:
        bmi_cat = "Избыточная масса (предожирение)"
    else:
        bmi_cat = "Ожирение"

    healthy_min = round(18.5 * ((h / 100.0) ** 2), 1)
    healthy_max = round(24.9 * ((h / 100.0) ** 2), 1)

    # Mifflin-St Jeor BMR
    bmr = 10.0 * w + 6.25 * h - 5.0 * a + (5.0 if is_male else -161.0)
    act_label, mult = ACTIVITY_LEVELS.get(activity, ACTIVITY_LEVELS["moderate"])
    tdee = bmr * mult

    goal_norm = (goal or "maintain").lower()
    if goal_norm == "cut":
        target_kcal = max(1200.0, tdee * 0.82)
        protein_g = w * 2.0
        fat_g = w * 0.85
        goal_label = "Снижение веса (−18%)"
    elif goal_norm == "bulk":
        target_kcal = tdee * 1.14
        protein_g = w * 1.9
        fat_g = w * 1.0
        goal_label = "Набор мышечной массы (+14%)"
    else:
        target_kcal = tdee
        protein_g = w * 1.7
        fat_g = w * 0.9
        goal_label = "Поддержание формы"

    rem_kcal = max(200.0, target_kcal - (protein_g * 4.0 + fat_g * 9.0))
    carbs_g = rem_kcal / 4.0
    water_l = round(w * (0.035 if mult >= 1.55 else 0.031), 2)

    return {
        "bmi": bmi,
        "bmi_category": bmi_cat,
        "healthy_weight_range_kg": f"{healthy_min} – {healthy_max} кг",
        "bmr_kcal": round(bmr),
        "tdee_kcal": round(tdee),
        "target_kcal": round(target_kcal),
        "goal_label": goal_label,
        "activity_label": act_label,
        "macros": {
            "protein_g": round(protein_g),
            "fat_g": round(fat_g),
            "carbs_g": round(carbs_g),
        },
        "water_liters": water_l,
    }


def calculate_sleep_cycles(mode: str = "wakeup", time_hhmm: str = "07:30", fall_asleep_min: int = 14) -> dict[str, Any]:
    m = re.match(r"^\s*(\d{1,2}):(\d{2})\s*$", time_hhmm or "07:30")
    if not m:
        raise ValueError("Формат времени ЧЧ:ММ, например 07:30")
    hh, mm = int(m.group(1)) % 24, int(m.group(2)) % 60
    fall = max(0, min(60, int(fall_asleep_min)))
    base = datetime(2026, 1, 2, hh, mm)

    slots: list[dict[str, Any]] = []
    if mode == "bedtime":
        # User goes to sleep at time_hhmm -> suggest optimal wake-up times
        sleep_start = base + timedelta(minutes=fall)
        for cycles in (6, 5, 4, 3):
            dt = sleep_start + timedelta(minutes=90 * cycles)
            hrs = round((90 * cycles) / 60.0, 1)
            slots.append(
                {
                    "time": dt.strftime("%H:%M"),
                    "cycles": cycles,
                    "hours": hrs,
                    "quality": "Оптимум" if cycles in (5, 6) else ("Допустимо" if cycles == 4 else "Короткий сон"),
                }
            )
    else:
        # User needs to wake up at time_hhmm -> suggest optimal bedtimes
        for cycles in (6, 5, 4, 3):
            dt = base - timedelta(minutes=90 * cycles + fall)
            hrs = round((90 * cycles) / 60.0, 1)
            slots.append(
                {
                    "time": dt.strftime("%H:%M"),
                    "cycles": cycles,
                    "hours": hrs,
                    "quality": "Оптимум" if cycles in (5, 6) else ("Допустимо" if cycles == 4 else "Минимум"),
                }
            )
    return {
        "mode": mode,
        "reference_time": f"{hh:02d}:{mm:02d}",
        "fall_asleep_min": fall,
        "recommendations": slots,
    }


def calculate_1rm_and_plates(weight_kg: float, reps: int, bar_kg: float = 20.0) -> dict[str, Any]:
    w = max(5.0, min(600.0, float(weight_kg)))
    r = max(1, min(30, int(reps)))
    bar = max(5.0, min(35.0, float(bar_kg)))

    if r == 1:
        epley = brzycki = lander = w
    else:
        epley = w * (1.0 + r / 30.0)
        brzycki = w * (36.0 / max(1.0, 37.0 - r))
        lander = (100.0 * w) / max(10.0, 101.3 - 2.67123 * r)
    avg_1rm = round((epley + brzycki + lander) / 3.0, 1)

    zones = [
        {"pct": pct, "weight_kg": round((avg_1rm * pct / 100.0) / 2.5) * 2.5, "reps_hint": hint}
        for pct, hint in ((95, "1–2 повт."), (90, "3–4 повт."), (85, "5–6 повт."), (80, "7–8 повт."), (75, "9–10 повт."), (70, "12 повт."))
    ]

    # Barbell plate loader per side for target `w`
    per_side = max(0.0, (w - bar) / 2.0)
    rem = per_side
    plates_per_side: list[float] = []
    for p in (25.0, 20.0, 15.0, 10.0, 5.0, 2.5, 1.25):
        while rem + 1e-6 >= p and len(plates_per_side) < 12:
            plates_per_side.append(p)
            rem -= p

    return {
        "input_weight_kg": w,
        "reps": r,
        "one_rep_max_kg": avg_1rm,
        "formulas": {
            "epley": round(epley, 1),
            "brzycki": round(brzycki, 1),
            "lander": round(lander, 1),
        },
        "training_table": zones,
        "bar_kg": bar,
        "plates_per_side": plates_per_side,
        "loaded_exact_kg": round(bar + sum(plates_per_side) * 2.0, 2),
    }


def calculate_running_pace(distance_km: float, time_minutes: float, age: int = 28, resting_hr: int = 62) -> dict[str, Any]:
    dist = max(0.1, min(250.0, float(distance_km)))
    mins = max(0.5, min(3000.0, float(time_minutes)))
    pace_min_per_km = mins / dist
    p_m = int(pace_min_per_km)
    p_s = int(round((pace_min_per_km - p_m) * 60))
    if p_s == 60:
        p_m += 1
        p_s = 0
    speed_kmh = round(dist / (mins / 60.0), 2)

    # Riegel race predictor: T2 = T1 * (D2 / D1)^1.06
    def _fmt_dur(total_min: float) -> str:
        sec = int(round(total_min * 60))
        h, rem = divmod(sec, 3600)
        m, s = divmod(rem, 60)
        return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"

    predictions = [
        {"race": name, "km": d2, "predicted_time": _fmt_dur(mins * ((d2 / dist) ** 1.06))}
        for name, d2 in (("5 км", 5.0), ("10 км", 10.0), ("Полумарафон", 21.0975), ("Марафон", 42.195))
    ]

    max_hr = max(140, 220 - max(12, min(90, int(age))))
    rhr = max(38, min(110, int(resting_hr)))
    hrr = max(30, max_hr - rhr)
    hr_zones = [
        {
            "zone": f"Z{i} • {title}",
            "bpm": f"{round(rhr + hrr * lo)}–{round(rhr + hrr * hi)} уд/мин",
        }
        for i, title, lo, hi in (
            (1, "Восстановление", 0.50, 0.60),
            (2, "Аэробная база (жиросжигание)", 0.60, 0.70),
            (3, "Темповая выносливость", 0.70, 0.80),
            (4, "ПАНО / Пороговая", 0.80, 0.90),
            (5, "VO2Max Максимум", 0.90, 1.00),
        )
    ]

    return {
        "pace_formatted": f"{p_m}:{p_s:02d} мин/км",
        "speed_kmh": speed_kmh,
        "predictions": predictions,
        "hr_zones": hr_zones,
    }


# ==============================================================================
# 2. AUTO, TIRES, WORLD TIMEZONES & RUSSIAN REGION PLATE CODES
# ==============================================================================
def calculate_fuel_trip(
    distance_km: float,
    consumption_l_100: float,
    fuel_price: float,
    passengers: int = 1,
    tolls_rub: float = 0.0,
    round_trip: bool = False,
) -> dict[str, Any]:
    dist_one_way = float(distance_km)
    cons = float(consumption_l_100)
    price = float(fuel_price)
    tolls_one_way = float(tolls_rub)
    if not all(math.isfinite(value) for value in (dist_one_way, cons, price, tolls_one_way)):
        raise ValueError("Все значения поездки должны быть конечными числами")
    if not 0 < dist_one_way <= 100_000:
        raise ValueError("Расстояние должно быть больше 0 и не более 100 000 км")
    if not 0 < cons <= 60:
        raise ValueError("Расход должен быть больше 0 и не более 60 л/100 км")
    if not 0 <= price <= 1_000:
        raise ValueError("Цена топлива должна быть от 0 до 1 000 ₽/л")
    if not 0 <= tolls_one_way <= 10_000_000:
        raise ValueError("Платные дороги должны стоить от 0 до 10 000 000 ₽")
    if isinstance(passengers, bool) or int(passengers) != passengers or not 1 <= int(passengers) <= 60:
        raise ValueError("Число пассажиров должно быть целым от 1 до 60")

    multiplier = 2.0 if round_trip else 1.0
    dist = dist_one_way * multiplier
    pax = int(passengers)
    tolls = tolls_one_way * multiplier

    liters = (dist / 100.0) * cons
    fuel_cost = liters * price
    total_cost = fuel_cost + tolls
    return {
        "total_distance_km": round(dist, 1),
        "liters_needed": round(liters, 2),
        "fuel_cost": round(fuel_cost, 2),
        "tolls_cost": round(tolls, 2),
        "total_cost": round(total_cost, 2),
        "per_person": round(total_cost / pax, 2),
        "cost_per_km": round(total_cost / dist, 2),
    }


def _parse_tire_spec(spec: str) -> dict[str, float]:
    m = re.match(r"^\s*(\d{3})\s*[/\s]\s*(\d{2,3})\s*[RrРр]?\s*(\d{2})\s*$", spec or "")
    if not m:
        raise ValueError(f"Некорректный размер шины «{spec}». Пример: 205/55 R16")
    width = float(m.group(1))
    profile = float(m.group(2))
    rim_in = float(m.group(3))
    if not 80 <= width <= 500:
        raise ValueError("Ширина шины должна быть от 80 до 500 мм")
    if not 20 <= profile <= 100:
        raise ValueError("Профиль шины должен быть от 20 до 100%")
    if not 8 <= rim_in <= 32:
        raise ValueError("Диаметр диска должен быть от 8 до 32 дюймов")
    sidewall_mm = width * (profile / 100.0)
    rim_mm = rim_in * 25.4
    diam_mm = rim_mm + 2.0 * sidewall_mm
    if not 250 <= diam_mm <= 1_800:
        raise ValueError("Расчётный внешний диаметр шины должен быть от 250 до 1 800 мм")
    return {
        "width_mm": width,
        "profile_pct": profile,
        "rim_in": rim_in,
        "sidewall_mm": round(sidewall_mm, 1),
        "rim_mm": round(rim_mm, 1),
        "diameter_mm": round(diam_mm, 1),
        "circumference_mm": round(diam_mm * math.pi, 1),
    }


def compare_tires(old_spec: str, new_spec: str) -> dict[str, Any]:
    old_t = _parse_tire_spec(old_spec)
    new_t = _parse_tire_spec(new_spec)
    diff_diam = round(new_t["diameter_mm"] - old_t["diameter_mm"], 1)
    clearance_diff = round(diff_diam / 2.0, 1)
    pct_diff = ((new_t["diameter_mm"] - old_t["diameter_mm"]) / old_t["diameter_mm"]) * 100.0
    real_speed_at_100 = round(100.0 * (new_t["diameter_mm"] / old_t["diameter_mm"]), 1)
    safe = abs(pct_diff) <= 3.0
    return {
        "old": old_t,
        "new": new_t,
        "diameter_diff_mm": diff_diam,
        "clearance_diff_mm": clearance_diff,
        "diameter_diff_pct": round(pct_diff, 2),
        "real_speed_at_100kmh": real_speed_at_100,
        "compatible": safe,
        "verdict": "Разница диаметра в пределах общего ориентира 3%" if safe else "Разница больше 3% — тщательно проверьте допустимость размера",
        "fitment_note": "Порог 3% — только предварительный ориентир. Он не подтверждает совместимость с автомобилем: проверьте допуски производителя, ширину диска, индексы нагрузки/скорости и зазоры.",
    }


RU_PLATE_REGIONS: list[tuple[list[str], str, str]] = [
    (["01", "101"], "Республика Адыгея", "Майкоп"),
    (["02", "102", "702"], "Республика Башкортостан", "Уфа"),
    (["03", "103"], "Республика Бурятия", "Улан-Удэ"),
    (["04"], "Республика Алтай", "Горно-Алтайск"),
    (["05"], "Республика Дагестан", "Махачкала"),
    (["06"], "Республика Ингушетия", "Магас"),
    (["07"], "Кабардино-Балкарская Республика", "Нальчик"),
    (["08"], "Республика Калмыкия", "Элиста"),
    (["09"], "Карачаево-Черкесская Республика", "Черкесск"),
    (["10"], "Республика Карелия", "Петрозаводск"),
    (["11", "111"], "Республика Коми", "Сыктывкар"),
    (["12"], "Республика Марий Эл", "Йошкар-Ола"),
    (["13", "113"], "Республика Мордовия", "Саранск"),
    (["14"], "Республика Саха (Якутия)", "Якутск"),
    (["15"], "Республика Северная Осетия — Алания", "Владикавказ"),
    (["16", "116", "716"], "Республика Татарстан", "Казань"),
    (["17"], "Республика Тыва", "Кызыл"),
    (["18", "118"], "Удмуртская Республика", "Ижевск"),
    (["19"], "Республика Хакасия", "Абакан"),
    (["21", "121"], "Чувашская Республика", "Чебоксары"),
    (["22", "122"], "Алтайский край", "Барнаул"),
    (["23", "93", "123", "193", "323"], "Краснодарский край", "Краснодар / Сочи"),
    (["24", "84", "88", "124"], "Красноярский край", "Красноярск"),
    (["25", "125", "725"], "Приморский край", "Владивосток"),
    (["26", "126"], "Ставропольский край", "Ставрополь"),
    (["27"], "Хабаровский край", "Хабаровск"),
    (["28"], "Амурская область", "Благовещенск"),
    (["29"], "Архангельская область", "Архангельск"),
    (["30", "130"], "Астраханская область", "Астрахань"),
    (["31"], "Белгородская область", "Белгород"),
    (["32"], "Брянская область", "Брянск"),
    (["33"], "Владимирская область", "Владимир"),
    (["34", "134"], "Волгоградская область", "Волгоград"),
    (["35"], "Вологодская область", "Вологда"),
    (["36", "136"], "Воронежская область", "Воронеж"),
    (["37"], "Ивановская область", "Иваново"),
    (["38", "85", "138"], "Иркутская область", "Иркутск"),
    (["39", "91"], "Калининградская область", "Калининград"),
    (["40"], "Калужская область", "Калуга"),
    (["41"], "Камчатский край", "Петропавловск-Камчатский"),
    (["42", "142"], "Кемеровская область — Кузбасс", "Кемерово"),
    (["43"], "Кировская область", "Киров"),
    (["44"], "Костромская область", "Кострома"),
    (["45"], "Курганская область", "Курган"),
    (["46"], "Курская область", "Курск"),
    (["47", "147"], "Ленинградская область", "Гатчина"),
    (["48"], "Липецкая область", "Липецк"),
    (["49"], "Магаданская область", "Магадан"),
    (["50", "90", "150", "190", "750", "790", "250", "550"], "Московская область", "Подмосковье"),
    (["51"], "Мурманская область", "Мурманск"),
    (["52", "152", "252"], "Нижегородская область", "Нижний Новгород"),
    (["53"], "Новгородская область", "Великий Новгород"),
    (["54", "154", "754"], "Новосибирская область", "Новосибирск"),
    (["55", "155"], "Омская область", "Омск"),
    (["56", "156"], "Оренбургская область", "Оренбург"),
    (["57"], "Орловская область", "Орёл"),
    (["58", "158"], "Пензенская область", "Пенза"),
    (["59", "81", "159"], "Пермский край", "Пермь"),
    (["60"], "Псковская область", "Псков"),
    (["61", "161", "761"], "Ростовская область", "Ростов-на-Дону"),
    (["62"], "Рязанская область", "Рязань"),
    (["63", "163", "763"], "Самарская область", "Самара"),
    (["64", "164"], "Саратовская область", "Саратов"),
    (["65"], "Сахалинская область", "Южно-Сахалинск"),
    (["66", "96", "196"], "Свердловская область", "Екатеринбург"),
    (["67"], "Смоленская область", "Смоленск"),
    (["68"], "Тамбовская область", "Тамбов"),
    (["69"], "Тверская область", "Тверь"),
    (["70"], "Томская область", "Томск"),
    (["71"], "Тульская область", "Тула"),
    (["72", "172"], "Тюменская область", "Тюмень"),
    (["73", "173"], "Ульяновская область", "Ульяновск"),
    (["74", "174", "774"], "Челябинская область", "Челябинск"),
    (["75", "80"], "Забайкальский край", "Чита"),
    (["76"], "Ярославская область", "Ярославль"),
    (["77", "97", "99", "177", "197", "199", "777", "797", "799", "977"], "Москва", "Москва"),
    (["78", "98", "178", "198"], "Санкт-Петербург", "Санкт-Петербург"),
    (["79"], "Еврейская автономная область", "Биробиджан"),
    (["82"], "Республика Крым", "Симферополь"),
    (["83"], "Ненецкий автономный округ", "Нарьян-Мар"),
    (["86", "186"], "Ханты-Мансийский АО — Югра", "Ханты-Мансийск / Сургут"),
    (["87"], "Чукотский автономный округ", "Анадырь"),
    (["89"], "Ямало-Ненецкий АО", "Салехард / Новый Уренгой"),
    (["92"], "Севастополь", "Севастополь"),
    (["95"], "Чеченская Республика", "Грозный"),
]


def search_plate_codes(query: str = "") -> dict[str, Any]:
    q = (query or "").strip().lower()
    items = []
    for codes, region, capital in RU_PLATE_REGIONS:
        if not q or q in [c.lower() for c in codes] or any(q in c for c in codes) or q in region.lower() or q in capital.lower():
            items.append({"codes": codes, "region": region, "capital": capital})
    return {"query": query, "count": len(items), "results": items[:35]}


WORLD_CITY_ZONES: list[tuple[str, str, str]] = [
    ("Калининград", "🇷🇺", "Europe/Kaliningrad"),
    ("Франкфурт / Берлин", "🇩🇪", "Europe/Berlin"),
    ("Москва / Санкт-Петербург", "🇷🇺", "Europe/Moscow"),
    ("Дубай", "🇦🇪", "Asia/Dubai"),
    ("Екатеринбург", "🇷🇺", "Asia/Yekaterinburg"),
    ("Алматы / Астана", "🇰🇿", "Asia/Almaty"),
    ("Новосибирск", "🇷🇺", "Asia/Novosibirsk"),
    ("Пекин / Сингапур", "🇨🇳", "Asia/Shanghai"),
    ("Токио / Сеул", "🇯🇵", "Asia/Tokyo"),
    ("Владивосток", "🇷🇺", "Asia/Vladivostok"),
    ("Лондон", "🇬🇧", "Europe/London"),
    ("Нью-Йорк", "🇺🇸", "America/New_York"),
    ("Сан-Франциско", "🇺🇸", "America/Los_Angeles"),
]
MOSCOW_ZONE = ZoneInfo("Europe/Moscow")


def compute_world_timezones(
    msk_hour_float: float | None = None,
    local_date: str | None = None,
) -> dict[str, Any]:
    if local_date:
        try:
            selected_date = date.fromisoformat(local_date)
        except ValueError as exc:
            raise ValueError("Дата должна быть в формате ГГГГ-ММ-ДД") from exc
    else:
        selected_date = datetime.now(MOSCOW_ZONE).date()

    if msk_hour_float is None:
        base_moscow = datetime.now(MOSCOW_ZONE).replace(second=0, microsecond=0)
        if local_date:
            base_moscow = base_moscow.replace(year=selected_date.year, month=selected_date.month, day=selected_date.day)
    else:
        hour_value = float(msk_hour_float)
        if not math.isfinite(hour_value) or not 0 <= hour_value < 24:
            raise ValueError("Время МСК должно быть в диапазоне от 0 до 24 часов")
        whole_hour = int(hour_value)
        minute = int(round((hour_value - whole_hour) * 60))
        base_moscow = datetime(selected_date.year, selected_date.month, selected_date.day, tzinfo=MOSCOW_ZONE)
        base_moscow += timedelta(hours=whole_hour, minutes=minute)

    cities = []
    for city, flag, zone_name in WORLD_CITY_ZONES:
        local_dt = base_moscow.astimezone(ZoneInfo(zone_name))
        offset_minutes = int(local_dt.utcoffset().total_seconds() // 60) if local_dt.utcoffset() else 0
        sign = "+" if offset_minutes >= 0 else "-"
        abs_offset = abs(offset_minutes)
        offset_label = f"UTC{sign}{abs_offset // 60:02d}:{abs_offset % 60:02d}"
        hr = local_dt.hour
        status = "Рабочие часы" if 9 <= hr <= 19 else ("Вечер / Утро" if 7 <= hr <= 22 else "Ночь")
        day_offset = (local_dt.date() - base_moscow.date()).days
        cities.append(
            {
                "city": city,
                "flag": flag,
                "timezone": zone_name,
                "utc_offset": offset_label,
                "utc_offset_minutes": offset_minutes,
                "time": local_dt.strftime("%H:%M"),
                "date": local_dt.date().isoformat(),
                "day_offset": day_offset,
                "hour": hr,
                "status": status,
            }
        )
    return {
        "base": {
            "timezone": "Europe/Moscow",
            "date": base_moscow.date().isoformat(),
            "time": base_moscow.strftime("%H:%M"),
        },
        "cities": cities,
    }


# ==============================================================================
# 3. FINANCE (LOAN / COMPOUND DEPOSIT) & EXPENSE BILL SPLITTER
# ==============================================================================
def calculate_loan_and_deposit(
    mode: str = "loan",
    principal: float = 3_000_000.0,
    annual_rate_pct: float = 16.0,
    months: int = 60,
    monthly_topup: float = 0.0,
) -> dict[str, Any]:
    p = max(100.0, min(1e11, float(principal)))
    rate = max(0.0, min(200.0, float(annual_rate_pct)))
    n = max(1, min(600, int(months)))
    r = (rate / 100.0) / 12.0

    if (mode or "loan").lower() == "deposit":
        balance = p
        invested = p
        schedule = []
        for m in range(1, n + 1):
            interest = balance * r
            balance += interest + max(0.0, float(monthly_topup))
            invested += max(0.0, float(monthly_topup))
            if m <= 6 or m == n or m % 12 == 0:
                schedule.append({"month": m, "balance": round(balance, 2), "profit": round(balance - invested, 2)})
        return {
            "mode": "deposit",
            "final_balance": round(balance, 2),
            "total_invested": round(invested, 2),
            "total_interest_earned": round(balance - invested, 2),
            "effective_gain_pct": round(((balance - invested) / max(invested, 1.0)) * 100.0, 2),
            "schedule_preview": schedule,
        }

    # Annuity loan
    if r == 0:
        monthly_pay = p / n
    else:
        factor = (1.0 + r) ** n
        monthly_pay = p * (r * factor) / (factor - 1.0)
    total_paid = monthly_pay * n
    overpay = total_paid - p
    first_diff = (p / n) + p * r
    last_diff = (p / n) + (p / n) * r

    return {
        "mode": "loan",
        "principal": round(p, 2),
        "monthly_payment": round(monthly_pay, 2),
        "total_paid": round(total_paid, 2),
        "overpayment": round(overpay, 2),
        "overpayment_pct": round((overpay / p) * 100.0, 2),
        "differentiated_range": f"{round(first_diff):,} ₽ → {round(last_diff):,} ₽".replace(",", " "),
    }


BILL_SPLIT_CURRENCY_CODES = frozenset({"RUB", "EUR", "USD", "GBP", "CHF", "PLN", "TRY", "KZT", "GEL", "AMD", "UZS"})


def _split_money_cents(value: Any, label: str, *, maximum: Decimal = Decimal("1000000000000")) -> int:
    try:
        amount = Decimal(str(value if value is not None else 0))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValueError(f"{label}: укажите корректное число") from exc
    if not amount.is_finite():
        raise ValueError(f"{label}: число должно быть конечным")
    if amount < 0 or amount > maximum:
        raise ValueError(f"{label}: сумма должна быть от 0 до {maximum}")
    return int((amount * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _allocate_cents(total_cents: int, weights: list[Decimal]) -> list[int]:
    if not weights:
        return []
    weight_total = sum(weights, Decimal("0"))
    if weight_total <= 0:
        raise ValueError("Для распределения расходов нужны положительные доли")
    exact = [Decimal(total_cents) * weight / weight_total for weight in weights]
    allocated = [int(value.to_integral_value(rounding=ROUND_FLOOR)) for value in exact]
    pennies_left = total_cents - sum(allocated)
    order = sorted(range(len(weights)), key=lambda index: (exact[index] - allocated[index], -index), reverse=True)
    for index in order[:pennies_left]:
        allocated[index] += 1
    return allocated


def split_group_expenses(
    entries: list[dict[str, Any]],
    tip_pct: float = 0.0,
    expenses: list[dict[str, Any]] | None = None,
    currency_code: str = "RUB",
) -> dict[str, Any]:
    """Settle a shared bill equally, by weights, or by individually assigned items.

    Without expenses, each participant's paid amount is accepted as a transaction
    and their share_weight controls their proportion of the bill (default 1).
    With expenses, each item is assigned to its payer and the participants who
    consumed it; item costs are divided in cents with deterministic remainders.
    """
    currency_code = str(currency_code or "").strip().upper()
    if currency_code not in BILL_SPLIT_CURRENCY_CODES:
        raise ValueError(f"Неизвестная валюта счёта: {currency_code or 'пустое значение'}")
    if not isinstance(entries, list) or not entries:
        raise ValueError("Добавьте хотя бы одного участника")
    if len(entries) > 100:
        raise ValueError("За один расчёт можно добавить не более 100 участников")
    cleaned: list[dict[str, Any]] = []
    name_indexes: dict[str, int] = {}
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            raise ValueError(f"Участник {index + 1}: ожидался объект с именем")
        name = str(entry.get("name") or "").strip()
        if not name:
            raise ValueError(f"Укажите имя участника {index + 1}")
        if len(name) > 60:
            raise ValueError(f"Имя участника {index + 1} должно быть не длиннее 60 символов")
        normalized_name = name.casefold()
        if normalized_name in name_indexes:
            raise ValueError(f"Имена участников должны быть уникальными: «{name}» указано дважды")
        name_indexes[normalized_name] = index
        paid_cents = _split_money_cents(entry.get("paid", 0), f"Оплата участника «{name}»")
        try:
            weight = Decimal(str(entry.get("share_weight", 1)))
        except (InvalidOperation, ValueError, TypeError) as exc:
            raise ValueError(f"Доля участника «{name}» должна быть числом") from exc
        if not weight.is_finite() or weight <= 0 or weight > 1000:
            raise ValueError(f"Доля участника «{name}» должна быть больше 0 и не превышать 1000")
        cleaned.append({"name": name, "paid_cents": paid_cents, "share_weight": weight})

    try:
        tip_rate = Decimal(str(tip_pct))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValueError("Процент чаевых должен быть числом") from exc
    if not tip_rate.is_finite():
        raise ValueError("Процент чаевых должен быть конечным числом")
    tip_rate = max(Decimal("0"), min(Decimal("100"), tip_rate))

    actual_paid = [participant["paid_cents"] for participant in cleaned]
    owed_before_tip = [0 for _ in cleaned]
    normalized_expenses: list[dict[str, Any]] = []
    itemized = expenses is not None
    if itemized:
        if not isinstance(expenses, list) or not expenses:
            raise ValueError("Добавьте хотя бы одну позицию в счёт")
        if len(expenses) > 200:
            raise ValueError("За один расчёт можно добавить не более 200 позиций")
        actual_paid = [0 for _ in cleaned]
        for item_index, expense in enumerate(expenses):
            if not isinstance(expense, dict):
                raise ValueError(f"Позиция {item_index + 1}: ожидался объект")
            description = str(expense.get("description") or f"Позиция {item_index + 1}").strip()
            if len(description) > 80:
                raise ValueError(f"Название позиции {item_index + 1} должно быть не длиннее 80 символов")
            amount_cents = _split_money_cents(expense.get("amount", 0), f"Сумма позиции «{description}»")
            payer_name = str(expense.get("payer") or "").strip()
            payer_index = name_indexes.get(payer_name.casefold())
            if payer_index is None:
                raise ValueError(f"Для позиции «{description}» выберите плательщика из списка участников")
            raw_participants = expense.get("participants")
            if not isinstance(raw_participants, list) or not raw_participants:
                raise ValueError(f"Для позиции «{description}» отметьте хотя бы одного участника")
            item_indexes: list[int] = []
            for participant_name in raw_participants:
                participant_index = name_indexes.get(str(participant_name).strip().casefold())
                if participant_index is None:
                    raise ValueError(f"Позиция «{description}»: неизвестный участник «{participant_name}»")
                if participant_index in item_indexes:
                    raise ValueError(f"Позиция «{description}»: участник выбран больше одного раза")
                item_indexes.append(participant_index)
            shares = _allocate_cents(amount_cents, [Decimal("1") for _ in item_indexes])
            actual_paid[payer_index] += amount_cents
            for participant_index, share_cents in zip(item_indexes, shares):
                owed_before_tip[participant_index] += share_cents
            normalized_expenses.append({
                "description": description,
                "amount": amount_cents / 100,
                "payer": cleaned[payer_index]["name"],
                "participants": [cleaned[index]["name"] for index in item_indexes],
            })
        raw_total_cents = sum(actual_paid)
    else:
        raw_total_cents = sum(actual_paid)
        owed_before_tip = _allocate_cents(
            raw_total_cents,
            [participant["share_weight"] for participant in cleaned],
        )

    tip_cents = int((Decimal(raw_total_cents) * tip_rate / Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    total_cents = raw_total_cents + tip_cents
    tip_shares = _allocate_cents(tip_cents, [Decimal(value) for value in owed_before_tip]) if tip_cents else [0 for _ in cleaned]
    owed_total = [base + tip for base, tip in zip(owed_before_tip, tip_shares)]
    effective_paid = _allocate_cents(total_cents, [Decimal(value) for value in actual_paid]) if total_cents else [0 for _ in cleaned]

    settlements: list[dict[str, Any]] = []
    creditors: list[list[Any]] = []
    debtors: list[list[Any]] = []
    for index, participant in enumerate(cleaned):
        balance_cents = effective_paid[index] - owed_total[index]
        settlements.append({
            "name": participant["name"],
            "paid": actual_paid[index] / 100,
            "effective_paid_with_tip": effective_paid[index] / 100,
            "share": owed_total[index] / 100,
            "tip_share": tip_shares[index] / 100,
            "balance": balance_cents / 100,
            "share_weight": float(participant["share_weight"]),
            "status": "receives" if balance_cents > 0 else "owes" if balance_cents < 0 else "settled",
        })
        if balance_cents > 0:
            creditors.append([participant["name"], balance_cents])
        elif balance_cents < 0:
            debtors.append([participant["name"], -balance_cents])

    # Paying down the largest balances first gives a compact, deterministic
    # settlement list while preserving each participant's exact net balance.
    creditors.sort(key=lambda item: item[1], reverse=True)
    debtors.sort(key=lambda item: item[1], reverse=True)
    transfers: list[dict[str, Any]] = []
    debtor_index = creditor_index = 0
    while debtor_index < len(debtors) and creditor_index < len(creditors):
        debtor_name, debtor_cents = debtors[debtor_index]
        creditor_name, creditor_cents = creditors[creditor_index]
        amount_cents = min(debtor_cents, creditor_cents)
        if amount_cents > 0:
            transfers.append({"from": debtor_name, "to": creditor_name, "amount": amount_cents / 100})
        debtors[debtor_index][1] -= amount_cents
        creditors[creditor_index][1] -= amount_cents
        if debtors[debtor_index][1] == 0:
            debtor_index += 1
        if creditors[creditor_index][1] == 0:
            creditor_index += 1

    raw_total = raw_total_cents / 100
    total_with_tip = total_cents / 100
    return {
        "participants": len(cleaned),
        "currency_code": currency_code,
        "raw_total": raw_total,
        "tip_amount": tip_cents / 100,
        "total_with_tip": total_with_tip,
        "per_person": round(total_with_tip / len(cleaned), 2),
        "average_share": round(total_with_tip / len(cleaned), 2),
        "expense_mode": "items" if itemized else "weighted" if any(item["share_weight"] != 1 for item in cleaned) else "equal",
        "expense_count": len(normalized_expenses),
        "expenses": normalized_expenses,
        "settlements": settlements,
        "transfers": transfers,
    }


# ==============================================================================
# 4. PERIODIC TABLE OF 118 ELEMENTS + MOLAR MASS PARSER
# ==============================================================================
# Compact tuple: (Z, symbol, name_ru, name_en, atomic_mass, group_cat)
ELEMENTS_118: list[tuple[int, str, str, str, float, str]] = [
    (1, "H", "Водород", "Hydrogen", 1.008, "Неметалл"),
    (2, "He", "Гелий", "Helium", 4.0026, "Благородный газ"),
    (3, "Li", "Литий", "Lithium", 6.94, "Щелочной металл"),
    (4, "Be", "Бериллий", "Beryllium", 9.0122, "Щёлочноземельный"),
    (5, "B", "Бор", "Boron", 10.81, "Полуметалл"),
    (6, "C", "Углерод", "Carbon", 12.011, "Неметалл"),
    (7, "N", "Азот", "Nitrogen", 14.007, "Неметалл"),
    (8, "O", "Кислород", "Oxygen", 15.999, "Неметалл"),
    (9, "F", "Фтор", "Fluorine", 18.998, "Галоген"),
    (10, "Ne", "Неон", "Neon", 20.180, "Благородный газ"),
    (11, "Na", "Натрий", "Sodium", 22.990, "Щелочной металл"),
    (12, "Mg", "Магний", "Magnesium", 24.305, "Щёлочноземельный"),
    (13, "Al", "Алюминий", "Aluminium", 26.982, "Постпереходный металл"),
    (14, "Si", "Кремний", "Silicon", 28.085, "Полуметалл"),
    (15, "P", "Фосфор", "Phosphorus", 30.974, "Неметалл"),
    (16, "S", "Сера", "Sulfur", 32.06, "Неметалл"),
    (17, "Cl", "Хлор", "Chlorine", 35.45, "Галоген"),
    (18, "Ar", "Аргон", "Argon", 39.948, "Благородный газ"),
    (19, "K", "Калий", "Potassium", 39.098, "Щелочной металл"),
    (20, "Ca", "Кальций", "Calcium", 40.078, "Щёлочноземельный"),
    (21, "Sc", "Скандий", "Scandium", 44.956, "Переходный металл"),
    (22, "Ti", "Титан", "Titanium", 47.867, "Переходный металл"),
    (23, "V", "Ванадий", "Vanadium", 50.942, "Переходный металл"),
    (24, "Cr", "Хром", "Chromium", 51.996, "Переходный металл"),
    (25, "Mn", "Марганец", "Manganese", 54.938, "Переходный металл"),
    (26, "Fe", "Железо", "Iron", 55.845, "Переходный металл"),
    (27, "Co", "Кобальт", "Cobalt", 58.933, "Переходный металл"),
    (28, "Ni", "Никель", "Nickel", 58.693, "Переходный металл"),
    (29, "Cu", "Медь", "Copper", 63.546, "Переходный металл"),
    (30, "Zn", "Цинк", "Zinc", 65.38, "Переходный металл"),
    (31, "Ga", "Галлий", "Gallium", 69.723, "Постпереходный металл"),
    (32, "Ge", "Германий", "Germanium", 72.630, "Полуметалл"),
    (33, "As", "Мышьяк", "Arsenic", 74.922, "Полуметалл"),
    (34, "Se", "Селен", "Selenium", 78.971, "Неметалл"),
    (35, "Br", "Бром", "Bromine", 79.904, "Галоген"),
    (36, "Kr", "Криптон", "Krypton", 83.798, "Благородный газ"),
    (37, "Rb", "Рубидий", "Rubidium", 85.468, "Щелочной металл"),
    (38, "Sr", "Стронций", "Strontium", 87.62, "Щёлочноземельный"),
    (39, "Y", "Иттрий", "Yttrium", 88.906, "Переходный металл"),
    (40, "Zr", "Цирконий", "Zirconium", 91.224, "Переходный металл"),
    (41, "Nb", "Ниобий", "Niobium", 92.906, "Переходный металл"),
    (42, "Mo", "Молибден", "Molybdenum", 95.95, "Переходный металл"),
    (43, "Tc", "Технеций", "Technetium", 98.0, "Переходный металл"),
    (44, "Ru", "Рутений", "Ruthenium", 101.07, "Переходный металл"),
    (45, "Rh", "Родий", "Rhodium", 102.91, "Переходный металл"),
    (46, "Pd", "Палладий", "Palladium", 106.42, "Переходный металл"),
    (47, "Ag", "Серебро", "Silver", 107.87, "Переходный металл"),
    (48, "Cd", "Кадмий", "Cadmium", 112.41, "Переходный металл"),
    (49, "In", "Индий", "Indium", 114.82, "Постпереходный металл"),
    (50, "Sn", "Олово", "Tin", 118.71, "Постпереходный металл"),
    (51, "Sb", "Сурьма", "Antimony", 121.76, "Полуметалл"),
    (52, "Te", "Теллур", "Tellurium", 127.60, "Полуметалл"),
    (53, "I", "Йод", "Iodine", 126.90, "Галоген"),
    (54, "Xe", "Ксенон", "Xenon", 131.29, "Благородный газ"),
    (55, "Cs", "Цезий", "Caesium", 132.91, "Щелочной металл"),
    (56, "Ba", "Барий", "Barium", 137.33, "Щёлочноземельный"),
    (57, "La", "Лантан", "Lanthanum", 138.91, "Лантаноид"),
    (58, "Ce", "Церий", "Cerium", 140.12, "Лантаноид"),
    (59, "Pr", "Празеодим", "Praseodymium", 140.91, "Лантаноид"),
    (60, "Nd", "Неодим", "Neodymium", 144.24, "Лантаноид"),
    (61, "Pm", "Прометий", "Promethium", 145.0, "Лантаноид"),
    (62, "Sm", "Самарий", "Samarium", 150.36, "Лантаноид"),
    (63, "Eu", "Европий", "Europium", 151.96, "Лантаноид"),
    (64, "Gd", "Гадолиний", "Gadolinium", 157.25, "Лантаноид"),
    (65, "Tb", "Тербий", "Terbium", 158.93, "Лантаноид"),
    (66, "Dy", "Диспрозий", "Dysprosium", 162.50, "Лантаноид"),
    (67, "Ho", "Гольмий", "Holmium", 164.93, "Лантаноид"),
    (68, "Er", "Эрбий", "Erbium", 167.26, "Лантаноид"),
    (69, "Tm", "Тулий", "Thulium", 168.93, "Лантаноид"),
    (70, "Yb", "Иттербий", "Ytterbium", 173.05, "Лантаноид"),
    (71, "Lu", "Лютеций", "Lutetium", 174.97, "Лантаноид"),
    (72, "Hf", "Гафний", "Hafnium", 178.49, "Переходный металл"),
    (73, "Ta", "Тантал", "Tantalum", 180.95, "Переходный металл"),
    (74, "W", "Вольфрам", "Tungsten", 183.84, "Переходный металл"),
    (75, "Re", "Рений", "Rhenium", 186.21, "Переходный металл"),
    (76, "Os", "Осмий", "Osmium", 190.23, "Переходный металл"),
    (77, "Ir", "Иридий", "Iridium", 192.22, "Переходный металл"),
    (78, "Pt", "Платина", "Platinum", 195.08, "Переходный металл"),
    (79, "Au", "Золото", "Gold", 196.97, "Переходный металл"),
    (80, "Hg", "Ртуть", "Mercury", 200.59, "Переходный металл"),
    (81, "Tl", "Таллий", "Thallium", 204.38, "Постпереходный металл"),
    (82, "Pb", "Свинец", "Lead", 207.2, "Постпереходный металл"),
    (83, "Bi", "Висмут", "Bismuth", 208.98, "Постпереходный металл"),
    (84, "Po", "Полоний", "Polonium", 209.0, "Полуметалл"),
    (85, "At", "Астат", "Astatine", 210.0, "Галоген"),
    (86, "Rn", "Радон", "Radon", 222.0, "Благородный газ"),
    (87, "Fr", "Франций", "Francium", 223.0, "Щелочной металл"),
    (88, "Ra", "Радий", "Radium", 226.0, "Щёлочноземельный"),
    (89, "Ac", "Актиний", "Actinium", 227.0, "Актиноид"),
    (90, "Th", "Торий", "Thorium", 232.04, "Актиноид"),
    (91, "Pa", "Протактиний", "Protactinium", 231.04, "Актиноид"),
    (92, "U", "Уран", "Uranium", 238.03, "Актиноид"),
    (93, "Np", "Нептуний", "Neptunium", 237.0, "Актиноид"),
    (94, "Pu", "Плутоний", "Plutonium", 244.0, "Актиноид"),
    (95, "Am", "Америций", "Americium", 243.0, "Актиноид"),
    (96, "Cm", "Кюрий", "Curium", 247.0, "Актиноид"),
    (97, "Bk", "Берклий", "Berkelium", 247.0, "Актиноид"),
    (98, "Cf", "Калифорний", "Californium", 251.0, "Актиноид"),
    (99, "Es", "Эйнштейний", "Einsteinium", 252.0, "Актиноид"),
    (100, "Fm", "Фермий", "Fermium", 257.0, "Актиноид"),
    (101, "Md", "Менделевий", "Mendelevium", 258.0, "Актиноид"),
    (102, "No", "Нобелий", "Nobelium", 259.0, "Актиноид"),
    (103, "Lr", "Лоуренсий", "Lawrencium", 266.0, "Актиноид"),
    (104, "Rf", "Резерфордий", "Rutherfordium", 267.0, "Переходный металл"),
    (105, "Db", "Дубний", "Dubnium", 268.0, "Переходный металл"),
    (106, "Sg", "Сиборгий", "Seaborgium", 269.0, "Переходный металл"),
    (107, "Bh", "Борий", "Bohrium", 270.0, "Переходный металл"),
    (108, "Hs", "Хассий", "Hassium", 277.0, "Переходный металл"),
    (109, "Mt", "Мейтнерий", "Meitnerium", 278.0, "Переходный металл"),
    (110, "Ds", "Дармштадтий", "Darmstadtium", 281.0, "Переходный металл"),
    (111, "Rg", "Рентгений", "Roentgenium", 282.0, "Переходный металл"),
    (112, "Cn", "Коперниций", "Copernicium", 285.0, "Переходный металл"),
    (113, "Nh", "Нихоний", "Nihonium", 286.0, "Постпереходный металл"),
    (114, "Fl", "Флеровий", "Flerovium", 289.0, "Постпереходный металл"),
    (115, "Mc", "Московий", "Moscovium", 290.0, "Постпереходный металл"),
    (116, "Lv", "Ливерморий", "Livermorium", 293.0, "Постпереходный металл"),
    (117, "Ts", "Теннессин", "Tennessine", 294.0, "Галоген"),
    (118, "Og", "Оганесон", "Oganesson", 294.0, "Благородный газ"),
]

_SYM_MAP = {sym: (z, sym, ru, en, mass, cat) for z, sym, ru, en, mass, cat in ELEMENTS_118}


def query_periodic_table(query: str = "", formula: str = "") -> dict[str, Any]:
    q = (query or "").strip().lower()
    elements = [
        {"z": z, "symbol": sym, "name_ru": ru, "name_en": en, "mass": mass, "category": cat}
        for z, sym, ru, en, mass, cat in ELEMENTS_118
        if not q or q == str(z) or q == sym.lower() or q in ru.lower() or q in en.lower() or q in cat.lower()
    ]

    molar_result: dict[str, Any] | None = None
    if formula and formula.strip():
        molar_result = calculate_molar_mass(formula.strip())

    return {
        "total_elements": 118,
        "matched_count": len(elements),
        "elements": elements,
        "molar": molar_result,
    }


def calculate_molar_mass(formula: str) -> dict[str, Any]:
    clean = re.sub(r"\s+", "", formula or "")
    if not clean or len(clean) > 64:
        raise ValueError("Введите химическую формулу, например H2SO4, Ca(OH)2 или C6H12O6")

    stack: list[dict[str, int]] = [{}]
    tokens = re.findall(r"([A-Z][a-z]?|\d+|\(|\))", clean)
    if "".join(tokens) != clean:
        raise ValueError(f"Некорректные символы в формуле «{formula}»")

    i = 0
    while i < len(tokens):
        tok = tokens[i]
        if tok == "(":
            stack.append({})
            i += 1
        elif tok == ")":
            if len(stack) < 2:
                raise ValueError("Непарная закрывающая скобка в формуле")
            group = stack.pop()
            mult = 1
            if i + 1 < len(tokens) and tokens[i + 1].isdigit():
                mult = int(tokens[i + 1])
                i += 1
            for k, v in group.items():
                stack[-1][k] = stack[-1].get(k, 0) + v * mult
            i += 1
        elif tok[0].isupper():
            if tok not in _SYM_MAP:
                raise ValueError(f"Неизвестный химический элемент: {tok}")
            cnt = 1
            if i + 1 < len(tokens) and tokens[i + 1].isdigit():
                cnt = int(tokens[i + 1])
                i += 1
            stack[-1][tok] = stack[-1].get(tok, 0) + cnt
            i += 1
        else:
            raise ValueError(f"Неожиданный индекс «{tok}»")

    if len(stack) != 1 or not stack[0]:
        raise ValueError("Незакрытая скобка в формуле")

    counts = stack[0]
    total_mass = sum(_SYM_MAP[sym][4] * cnt for sym, cnt in counts.items())
    breakdown = [
        {
            "symbol": sym,
            "name_ru": _SYM_MAP[sym][2],
            "count": cnt,
            "subtotal_g_mol": round(_SYM_MAP[sym][4] * cnt, 3),
            "mass_pct": round((_SYM_MAP[sym][4] * cnt / total_mass) * 100.0, 2),
        }
        for sym, cnt in counts.items()
    ]
    return {
        "formula": clean,
        "molar_mass_g_mol": round(total_mass, 4),
        "breakdown": breakdown,
    }


# ==============================================================================
# 5. CREATOR DESIGN (COLOR HARMONIES + WCAG) & DEV HTTP / CHMOD LAB
# ==============================================================================
def build_color_harmony(hex_color: str = "#38bdf8") -> dict[str, Any]:
    v = (hex_color or "#38bdf8").strip().lstrip("#")
    if len(v) == 3:
        v = "".join(c * 2 for c in v)
    if len(v) != 6:
        raise ValueError("Введите HEX цвет, например #38bdf8")
    r, g, b = int(v[0:2], 16), int(v[2:4], 16), int(v[4:6], 16)
    h, l, s = colorsys.rgb_to_hls(r / 255.0, g / 255.0, b / 255.0)

    def _hls_hex(hh: float, ll: float, ss: float) -> str:
        rr, gg, bb = colorsys.hls_to_rgb(hh % 1.0, max(0.05, min(0.95, ll)), max(0.0, min(1.0, ss)))
        return f"#{int(round(rr * 255)):02x}{int(round(gg * 255)):02x}{int(round(bb * 255)):02x}"

    def _lum(rgb: tuple[int, int, int]) -> float:
        ch = [(c / 255.0) / 12.92 if c / 255.0 <= 0.03928 else ((c / 255.0 + 0.055) / 1.055) ** 2.4 for c in rgb]
        return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]

    lum_c = _lum((r, g, b))
    contrast_white = round((1.0 + 0.05) / (lum_c + 0.05), 2)
    contrast_black = round((lum_c + 0.05) / 0.05, 2)

    k = 1.0 - max(r, g, b) / 255.0
    if k >= 0.999:
        cmyk = "0%, 0%, 0%, 100%"
    else:
        cc = round((1.0 - r / 255.0 - k) / (1.0 - k) * 100)
        mm = round((1.0 - g / 255.0 - k) / (1.0 - k) * 100)
        yy = round((1.0 - b / 255.0 - k) / (1.0 - k) * 100)
        cmyk = f"{cc}%, {mm}%, {yy}%, {round(k * 100)}%"

    return {
        "hex": f"#{v.lower()}",
        "rgb": f"rgb({r}, {g}, {b})",
        "hsl": f"hsl({round(h * 360)}, {round(s * 100)}%, {round(l * 100)}%)",
        "cmyk": cmyk,
        "wcag_on_white": contrast_white,
        "wcag_on_black": contrast_black,
        "recommended_text": "#ffffff" if contrast_white >= contrast_black else "#0f172a",
        "harmonies": {
            "complementary": [f"#{v.lower()}", _hls_hex(h + 0.5, l, s)],
            "analogous": [_hls_hex(h - 1 / 12, l, s), f"#{v.lower()}", _hls_hex(h + 1 / 12, l, s)],
            "triadic": [f"#{v.lower()}", _hls_hex(h + 1 / 3, l, s), _hls_hex(h + 2 / 3, l, s)],
            "shades": [_hls_hex(h, lv, s) for lv in (0.18, 0.34, 0.50, 0.68, 0.86)],
        },
    }


HTTP_STATUS_DB: list[tuple[int, str, str]] = [
    (200, "OK", "Запрос успешно выполнен"),
    (201, "Created", "Ресурс успешно создан"),
    (204, "No Content", "Успешно, тело ответа отсутствует"),
    (301, "Moved Permanently", "Постоянный редирект на новый URL"),
    (302, "Found", "Временное перенаправление"),
    (304, "Not Modified", "Кэш актуален, повторная передача не нужна"),
    (400, "Bad Request", "Ошибка синтаксиса или параметров запроса"),
    (401, "Unauthorized", "Требуется аутентификация (токен/логин)"),
    (403, "Forbidden", "Доступ запрещён (недостаточно прав)"),
    (404, "Not Found", "Маршрут или ресурс не найден"),
    (405, "Method Not Allowed", "HTTP-метод не поддерживается эндпоинтом"),
    (409, "Conflict", "Конфликт состояния ресурса (дубликат)"),
    (413, "Payload Too Large", "Превышен лимит размера загружаемого файла"),
    (422, "Unprocessable Entity", "Ошибка валидации схемы данных (FastAPI/Pydantic)"),
    (429, "Too Many Requests", "Превышен лимит частоты запросов (Rate Limit)"),
    (500, "Internal Server Error", "Необработанное исключение на сервере"),
    (502, "Bad Gateway", "Прокси/Nginx получил некорректный ответ от upstream"),
    (503, "Service Unavailable", "Сервер перегружен или на обслуживании"),
    (504, "Gateway Timeout", "Превышено время ожидания ответа от бэкенда"),
]


def inspect_http_and_chmod(octal_mode: str = "755", http_query: str = "") -> dict[str, Any]:
    m = re.sub(r"[^0-7]", "", octal_mode or "755")[-3:].rjust(3, "0")
    syms = ""
    roles = []
    for label, ch in zip(("Владелец (User)", "Группа (Group)", "Остальные (Others)"), m):
        v = int(ch)
        s = ("r" if v & 4 else "-") + ("w" if v & 2 else "-") + ("x" if v & 1 else "-")
        syms += s
        roles.append({"role": label, "octal": v, "rwx": s})

    q = (http_query or "").strip().lower()
    codes = [
        {"code": c, "title": t, "desc": d}
        for c, t, d in HTTP_STATUS_DB
        if not q or q in str(c) or q in t.lower() or q in d.lower()
    ]
    return {
        "chmod_octal": m,
        "chmod_symbolic": f"-{syms}",
        "chmod_command": f"chmod {m} file.sh",
        "roles": roles,
        "http_codes": codes,
    }
