from __future__ import annotations

import re
from typing import Any

# Each category stores units with:
# (factor_to_base_SI, display_label, popularity_rank_lower_is_more_popular, aliases)
SMART_UNIT_CATEGORIES: dict[str, dict[str, Any]] = {
    "length": {
        "title": "📏 Длина и расстояние",
        "base": "m",
        "units": {
            "cm": (0.01, "см (сантиметров)", 1, ["см", "сантиметр", "сантиметра", "сантиметров", "cm"]),
            "mm": (0.001, "мм (миллиметров)", 2, ["мм", "миллиметр", "миллиметра", "миллиметров", "mm"]),
            "m": (1.0, "м (метров)", 3, ["м", "метр", "метра", "метров", "m", "meter", "meters"]),
            "km": (1000.0, "км (километров)", 4, ["км", "километр", "километра", "километров", "km"]),
            "in": (0.0254, "дюймов (in)", 5, ["дюйм", "дюйма", "дюймов", "in", "inch", "inches", '"', "″"]),
            "ft": (0.3048, "футов (ft)", 6, ["фут", "фута", "футов", "ft", "foot", "feet", "'"]),
            "yd": (0.9144, "ярдов (yd)", 7, ["ярд", "ярда", "ярдов", "yd", "yard", "yards"]),
            "mi": (1609.344, "миль (mi)", 8, ["миля", "мили", "миль", "mi", "mile", "miles"]),
            "nmi": (1852.0, "морских миль", 9, ["морская миля", "морских миль", "nmi"]),
            "arshin": (0.7112, "аршин (старорусск.)", 10, ["аршин", "аршина", "аршинов"]),
            "versta": (1066.8, "вёрст (старорусск.)", 11, ["верста", "версты", "верст", "вёрст"]),
        },
    },
    "weight": {
        "title": "⚖️ Масса и вес",
        "base": "kg",
        "units": {
            "kg": (1.0, "кг (килограммов)", 1, ["кг", "килограмм", "килограмма", "килограммов", "кило", "kg"]),
            "g": (0.001, "г (граммов)", 2, ["г", "гр", "грамм", "грамма", "граммов", "g", "gram", "grams"]),
            "t": (1000.0, "т (тонн)", 3, ["т", "тонна", "тонны", "тонн", "t", "ton"]),
            "mg": (0.000001, "мг (миллиграммов)", 4, ["мг", "миллиграмм", "миллиграммов", "mg"]),
            "lb": (0.45359237, "фунтов (lb)", 5, ["фунт", "фунта", "фунтов", "lb", "lbs", "pound", "pounds"]),
            "oz": (0.0283495231, "унций (oz)", 6, ["унция", "унции", "унций", "oz", "ounce", "ounces"]),
            "pud": (16.380496, "пудов (старорусск.)", 7, ["пуд", "пуда", "пудов"]),
            "carat": (0.0002, "карат", 8, ["карат", "карата", "каратов", "ct"]),
        },
    },
    "volume": {
        "title": "🧪 Объём и кулинарные меры",
        "base": "l",
        "units": {
            "ml": (0.001, "мл (миллилитров)", 1, ["мл", "миллилитр", "миллилитра", "миллилитров", "ml"]),
            "l": (1.0, "л (литров)", 2, ["л", "литр", "литра", "литров", "l", "liter", "liters"]),
            "glass": (0.25, "стаканов (250 мл)", 3, ["стакан", "стакана", "стаканов", "cup", "cups"]),
            "shot": (0.05, "рюмок / шотов (50 мл)", 4, ["рюмка", "рюмки", "рюмок", "шот", "шота", "шотов"]),
            "tbsp": (0.015, "столовых ложек (15 мл)", 5, ["ст.л", "столовая ложка", "столовых ложек", "tbsp"]),
            "tsp": (0.005, "чайных ложек (5 мл)", 6, ["ч.л", "чайная ложка", "чайных ложек", "tsp"]),
            "gal": (3.78541178, "галлонов США (gal)", 7, ["галлон", "галлона", "галлонов", "gal", "gallon"]),
            "pint": (0.473176, "пинт (pt)", 8, ["пинта", "пинты", "пинт", "pt", "pint"]),
            "m3": (1000.0, "кубометров (м³)", 9, ["м3", "м³", "кубометр", "кубометров", "кубов"]),
        },
    },
    "speed": {
        "title": "🏎 Скорость",
        "base": "mps",
        "units": {
            "kmh": (1.0 / 3.6, "км/ч", 1, ["км/ч", "кмч", "км в час", "km/h", "kmh", "kph"]),
            "mps": (1.0, "м/с", 2, ["м/с", "мс", "метров в секунду", "m/s", "mps"]),
            "mph": (0.44704, "миль/ч (mph)", 3, ["миль в час", "миль/ч", "mph"]),
            "kn": (0.514444, "узлов (морских)", 4, ["узел", "узла", "узлов", "kn", "knot", "knots"]),
            "mach": (343.0, "чисел Маха (звук)", 5, ["мах", "маха", "махов", "mach"]),
        },
    },
    "data": {
        "title": "💾 Цифровые данные",
        "base": "B",
        "units": {
            "MB": (1024.0**2, "МБ (мегабайт)", 1, ["мб", "мегабайт", "мегабайта", "mb"]),
            "GB": (1024.0**3, "ГБ (гигабайт)", 2, ["гб", "гигабайт", "гигабайта", "гигов", "gb"]),
            "KB": (1024.0, "КБ (килобайт)", 3, ["кб", "килобайт", "kb"]),
            "TB": (1024.0**4, "ТБ (терабайт)", 4, ["тб", "терабайт", "tb"]),
            "Mbit": (1000.0**2 / 8.0, "Мбит (мегабит)", 5, ["мбит", "мегабит", "mbit", "mbps"]),
            "B": (1.0, "байт (B)", 6, ["байт", "байта", "b", "bytes"]),
        },
    },
    "area": {
        "title": "🗺 Площадь участка и помещений",
        "base": "sqm",
        "units": {
            "sqm": (1.0, "м² (кв. метров)", 1, ["м2", "м²", "кв м", "кв.м", "квадратов", "sqm"]),
            "sotka": (100.0, "соток (ар)", 2, ["сотка", "сотки", "соток"]),
            "ha": (10000.0, "га (гектаров)", 3, ["га", "гектар", "гектара", "гектаров", "ha"]),
            "sqkm": (1000000.0, "км²", 4, ["км2", "км²", "кв км", "sqkm"]),
            "sqft": (0.092903, "кв. футов (sq ft)", 5, ["кв фут", "кв футов", "sqft", "sq ft"]),
            "acre": (4046.856, "акров (acre)", 6, ["акр", "акра", "акров", "acre", "acres"]),
        },
    },
    "power": {
        "title": "⚡ Мощность (авто и электро)",
        "base": "w",
        "units": {
            "kw": (1000.0, "кВт (киловатт)", 1, ["квт", "киловатт", "kw"]),
            "hp": (735.49875, "л.с. (метрических)", 2, ["л.с.", "л.с", "лс", "лошадиных сил", "лошадей", "hp"]),
            "w": (1.0, "Вт (ватт)", 3, ["вт", "ватт", "w", "watt"]),
        },
    },
    "pressure": {
        "title": "🌡 Давление",
        "base": "pa",
        "units": {
            "bar": (100000.0, "бар (bar)", 1, ["бар", "бара", "bar"]),
            "atm": (101325.0, "атм (атмосфер)", 2, ["атм", "атмосфера", "атмосфер", "atm"]),
            "mmhg": (133.322, "мм рт. ст.", 3, ["мм рт ст", "мм рт. ст.", "торр", "mmhg"]),
            "psi": (6894.757, "PSI (фунт/кв.дюйм)", 4, ["psi", "пси"]),
            "kpa": (1000.0, "кПа (килопаскалей)", 5, ["кпа", "килопаскаль", "kpa"]),
        },
    },
    "energy": {
        "title": "🔥 Энергия и калории",
        "base": "j",
        "units": {
            "kcal": (4184.0, "ккал (килокалорий)", 1, ["ккал", "калорий", "килокалорий", "kcal"]),
            "kj": (1000.0, "кДж (килоджоулей)", 2, ["кдж", "килоджоулей", "kj"]),
            "wh": (3600.0, "Вт·ч", 3, ["втч", "вт·ч", "wh"]),
            "kwh": (3600000.0, "кВт·ч", 4, ["квтч", "квт·ч", "kwh"]),
            "j": (1.0, "Дж (джоулей)", 5, ["дж", "джоуль", "джоулей", "j"]),
        },
    },
}


def _fmt_num(val: float) -> str:
    if val == 0:
        return "0"
    abs_v = abs(val)
    if abs_v >= 10000:
        return f"{val:,.2f}".replace(",", " ").rstrip("0").rstrip(".")
    if abs_v >= 1:
        return f"{val:.4f}".rstrip("0").rstrip(".")
    if abs_v >= 0.001:
        return f"{val:.6f}".rstrip("0").rstrip(".")
    return f"{val:.3e}"


def _length_hint(meters: float) -> str:
    if meters < 0.03:
        return "≈ Диаметр монеты или фаланга пальца"
    if meters < 0.22:
        return "≈ Диагональ смартфона или ладонь взрослого человека"
    if meters < 1.0:
        return "≈ Ширина монитора или шаг человека"
    if meters < 2.3:
        return "≈ Рост человека или высота дверного проёма"
    if meters < 35:
        return "≈ Высота многоэтажного дома или синий кит"
    if meters < 500:
        return "≈ Длина футбольного поля / небоскрёб"
    return "≈ Междугородняя дистанция"


def _weight_hint(kg: float) -> str:
    if kg < 0.25:
        return "≈ Вес смартфона или яблока"
    if kg < 5:
        return "≈ Вес домашнего кота или ноутбука"
    if kg < 35:
        return "≈ Чемодан в аэропорт или гантель"
    if kg < 110:
        return "≈ Вес взрослого человека"
    if kg < 2500:
        return "≈ Вес легкового автомобиля"
    return "≈ Вес грузовика или кита"


def smart_parse_and_convert(query: str) -> dict[str, Any]:
    raw = (query or "").strip()
    if not raw:
        raise ValueError("Введите величину, например: 6 дюймов, 180 фунтов, 5 футов 11 дюймов, 450 фаренгейт")

    low = raw.lower().replace(",", ".")

    # 1. Special support for compound feet + inches ("5 футов 11 дюймов" or "5'11" or "6 ft 2 in")
    ft_in_match = re.match(
        r"^\s*(\d+(?:\.\d+)?)\s*(?:фут\w*|ft|feet|')\s*(\d+(?:\.\d+)?)\s*(?:дюйм\w*|in|inch\w*|\"|″)?\s*$",
        low,
    )
    if ft_in_match:
        ft_val = float(ft_in_match.group(1))
        in_val = float(ft_in_match.group(2))
        meters = ft_val * 0.3048 + in_val * 0.0254
        cat = SMART_UNIT_CATEGORIES["length"]
        items = []
        for code, (factor, label, rank, _) in sorted(cat["units"].items(), key=lambda x: x[1][2]):
            v = meters / factor
            items.append({
                "unit": code,
                "value": round(v, 6),
                "formatted": _fmt_num(v),
                "raw": v,
                "label": label,
                "rank": rank,
                "popular": len(items) < 3,
            })
        rec = f"{ft_val:g} фт {in_val:g} дюйм."
        return {
            "category": "length",
            "recognized_input": rec,
            "parsed_display": rec,
            "category_title": cat["title"],
            "conversions": items,
            "top_popular": items[:3],
            "secondary": items[3:],
            "real_world_hint": _length_hint(meters),
        }

    # 2. Temperature check (non-linear scale: C, F, K)
    temp_match = re.match(
        r"^\s*([+-]?\d+(?:\.\d+)?)\s*°?\s*(c|f|k|цельс\w*|фаренгейт\w*|кельвин\w*|celsius|fahrenheit|kelvin)\s*$",
        low,
    )
    if temp_match:
        val = float(temp_match.group(1))
        u_tok = temp_match.group(2)
        if u_tok.startswith(("f", "фар")):
            c = (val - 32.0) * 5.0 / 9.0
            src_code = "F"
            src_name = f"{val:g} °F"
        elif u_tok.startswith(("k", "кел")):
            c = val - 273.15
            src_code = "K"
            src_name = f"{val:g} K"
        else:
            c = val
            src_code = "C"
            src_name = f"{val:g} °C"

        f_val = c * 9.0 / 5.0 + 32.0
        k_val = c + 273.15
        all_t = [
            {"unit": "C", "value": round(c, 4), "formatted": _fmt_num(c), "label": "°C (Цельсия)", "rank": 1, "popular": True},
            {"unit": "F", "value": round(f_val, 4), "formatted": _fmt_num(f_val), "label": "°F (Фаренгейта)", "rank": 2, "popular": True},
            {"unit": "K", "value": round(k_val, 4), "formatted": _fmt_num(k_val), "label": "K (Кельвина)", "rank": 3, "popular": False},
        ]
        others = [x for x in all_t if x["unit"] != src_code]
        hint = "❄️ Мороз (ниже точки замерзания воды)" if c < 0 else ("🔥 Комнатная / тёплая температура" if c < 45 else "♨️ Горячая среда / духовка")
        return {
            "category": "temperature",
            "recognized_input": src_name,
            "parsed_display": src_name,
            "category_title": "🌡 Температура",
            "conversions": others,
            "top_popular": others,
            "secondary": [],
            "real_world_hint": hint,
        }

    # 3. General number + unit phrase parser
    m = re.match(r"^\s*([+-]?\d+(?:\.\d+)?)\s*(.+?)\s*$", low)
    if not m:
        raise ValueError("Не удалось распознать число и единицу. Пример: «6 дюймов», «75 фунтов», «100 миль в час»")

    num = float(m.group(1))
    unit_phrase = m.group(2).strip().rstrip(".")
    # Strip optional trailing "в ..." if user only wrote source unit, or check target
    unit_clean = re.sub(r"\s+", " ", unit_phrase)

    matched_cat_key: str | None = None
    matched_unit_code: str | None = None

    for cat_key, cat_data in SMART_UNIT_CATEGORIES.items():
        for u_code, (_, _, _, aliases) in cat_data["units"].items():
            if unit_clean in aliases or unit_phrase in aliases:
                matched_cat_key = cat_key
                matched_unit_code = u_code
                break
        if matched_cat_key:
            break

    # Prefix fallback for Russian declensions ("дюймах", "километрах", "гигабайтах")
    if not matched_cat_key and len(unit_clean) >= 3:
        stem = unit_clean[:4]
        for cat_key, cat_data in SMART_UNIT_CATEGORIES.items():
            for u_code, (_, _, _, aliases) in cat_data["units"].items():
                if any(a.startswith(stem) and len(a) >= 3 for a in aliases):
                    matched_cat_key = cat_key
                    matched_unit_code = u_code
                    break
            if matched_cat_key:
                break

    if not matched_cat_key or not matched_unit_code:
        raise ValueError(f"Единица «{unit_phrase}» пока не распознана. Попробуйте: дюймов, футов, миль, фунтов, унций, галлонов, л.с., ккал, бар, гб, соток")

    cat = SMART_UNIT_CATEGORIES[matched_cat_key]
    src_factor, src_label, _, _ = cat["units"][matched_unit_code]
    base_val = num * src_factor

    conversions = []
    for code, (factor, label, rank, _) in sorted(cat["units"].items(), key=lambda x: x[1][2]):
        if code == matched_unit_code:
            continue
        conv_v = base_val / factor
        conversions.append(
            {
                "unit": code,
                "value": round(conv_v, 6),
                "formatted": _fmt_num(conv_v),
                "raw": conv_v,
                "label": label,
                "rank": rank,
                "popular": len(conversions) < 3,
            }
        )

    hint = "⚡ Результаты отсортированы по бытовой популярности"
    if matched_cat_key == "length":
        hint = _length_hint(abs(base_val))
    elif matched_cat_key == "weight":
        hint = _weight_hint(abs(base_val))

    rec_str = f"{_fmt_num(num)} {src_label}"
    return {
        "category": matched_cat_key,
        "recognized_input": rec_str,
        "parsed_display": rec_str,
        "category_title": cat["title"],
        "conversions": conversions,
        "top_popular": conversions[:3],
        "secondary": conversions[3:],
        "real_world_hint": hint,
    }
