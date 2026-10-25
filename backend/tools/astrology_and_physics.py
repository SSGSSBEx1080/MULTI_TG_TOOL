from __future__ import annotations

import datetime as dt
import hashlib
import math
import re
from typing import Any

# ==============================================================================
# 1. ЗНАКИ ЗОДИАКА, ГОРОСКОПЫ И СОВМЕСТИМОСТЬ ПО ДАТАМ
# ==============================================================================

ZODIAC_SIGNS: list[dict[str, Any]] = [
    {
        "id": "aries",
        "name": "Овен",
        "emoji": "♈",
        "dates": "21 марта — 19 апреля",
        "element": "Огонь",
        "planet": "Марс",
        "quality": "Кардинальный",
        "strengths": "Решительность, прямота, инициативность, быстрый старт в новых делах",
        "weaknesses": "Нетерпеливость, импульсивность, резкость в спорах",
        "summary": "Энергичный и прямолинейный знак. Предпочитает действовать сразу, легко берёт на себя лидерство и не боится конкуренции.",
        "best_match": ["Лев", "Стрелец", "Близнецы", "Водолей"],
    },
    {
        "id": "taurus",
        "name": "Телец",
        "emoji": "♉",
        "dates": "20 апреля — 20 мая",
        "element": "Земля",
        "planet": "Венера",
        "quality": "Фиксированный",
        "strengths": "Надёжность, практичность, терпение, умение обращаться с ресурсами",
        "weaknesses": "Упрямство, нелюбовь к резким переменам",
        "summary": "Спокойный и основательный знак. Ценит стабильность, комфорт, конкретный результат и проверенных людей.",
        "best_match": ["Дева", "Козерог", "Рак", "Рыбы"],
    },
    {
        "id": "gemini",
        "name": "Близнецы",
        "emoji": "♊",
        "dates": "21 мая — 20 июня",
        "element": "Воздух",
        "planet": "Меркурий",
        "quality": "Мутабельный",
        "strengths": "Общительность, гибкость ума, быстрая обучаемость, чувство юмора",
        "weaknesses": "Распыление внимания, переменчивость настроения",
        "summary": "Подвижный интеллектуальный знак. Легко находит общий язык с разными людьми, быстро обрабатывает информацию и любит смену впечатлений.",
        "best_match": ["Весы", "Водолей", "Овен", "Лев"],
    },
    {
        "id": "cancer",
        "name": "Рак",
        "emoji": "♋",
        "dates": "21 июня — 22 июля",
        "element": "Вода",
        "planet": "Луна",
        "quality": "Кардинальный",
        "strengths": "Эмпатия, заботливость, сильная интуиция, верность близким",
        "weaknesses": "Ранимость, закрытость при недоверии, склонность переживать внутри",
        "summary": "Глубокий и внимательный к деталям знак. Тонко чувствует атмосферу, бережёт личные границы и умеет создавать надёжный тыл.",
        "best_match": ["Скорпион", "Рыбы", "Телец", "Дева"],
    },
    {
        "id": "leo",
        "name": "Лев",
        "emoji": "♌",
        "dates": "23 июля — 22 августа",
        "element": "Огонь",
        "planet": "Солнце",
        "quality": "Фиксированный",
        "strengths": "Уверенность, великодушие, харизма, организаторские способности",
        "weaknesses": "Гордость, чувствительность к критике",
        "summary": "Яркий и целеустремлённый знак. Умеет вдохновлять окружающих, держит слово и стремится к высокому качеству во всём, за что берётся.",
        "best_match": ["Овен", "Стрелец", "Близнецы", "Весы"],
    },
    {
        "id": "virgo",
        "name": "Дева",
        "emoji": "♍",
        "dates": "23 августа — 22 сентября",
        "element": "Земля",
        "planet": "Меркурий",
        "quality": "Мутабельный",
        "strengths": "Аналитический склад ума, аккуратность, системность, ответственность",
        "weaknesses": "Самокритичность, перфекционизм, излишняя требовательность",
        "summary": "Рациональный и внимательный знак. Замечает то, что упускают другие, умеет наводить порядок в сложных задачах и процессах.",
        "best_match": ["Телец", "Козерог", "Рак", "Скорпион"],
    },
    {
        "id": "libra",
        "name": "Весы",
        "emoji": "♎",
        "dates": "23 сентября — 22 октября",
        "element": "Воздух",
        "planet": "Венера",
        "quality": "Кардинальный",
        "strengths": "Дипломатичность, объективность, чувство меры и стиля",
        "weaknesses": "Долгие колебания при выборе, стремление сгладить острые углы любой ценой",
        "summary": "Уравновешенный и тактичный знак. Умеет видеть ситуацию с разных сторон, договариваться и находить справедливые решения.",
        "best_match": ["Близнецы", "Водолей", "Лев", "Стрелец"],
    },
    {
        "id": "scorpio",
        "name": "Скорпион",
        "emoji": "♏",
        "dates": "23 октября — 21 ноября",
        "element": "Вода",
        "planet": "Плутон и Марс",
        "quality": "Фиксированный",
        "strengths": "Проницательность, стойкость, концентрация, преданность делу",
        "weaknesses": "Подозрительность, ревность, категоричность",
        "summary": "Сильный и собранный знак. Не любит поверхностности, умеет действовать в кризисных условиях и всегда докапывается до сути.",
        "best_match": ["Рак", "Рыбы", "Дева", "Козерог"],
    },
    {
        "id": "sagittarius",
        "name": "Стрелец",
        "emoji": "♐",
        "dates": "22 ноября — 21 декабря",
        "element": "Огонь",
        "planet": "Юпитер",
        "quality": "Мутабельный",
        "strengths": "Оптимизм, широта взглядов, честность, тяга к знаниям и движению",
        "weaknesses": "Прямолинейность без фильтров, нелюбовь к рутине",
        "summary": "Открытый и свободолюбивый знак. Смотрит на задачи масштабно, легко загорается новыми проектами и ценит независимость.",
        "best_match": ["Овен", "Лев", "Весы", "Водолей"],
    },
    {
        "id": "capricorn",
        "name": "Козерог",
        "emoji": "♑",
        "dates": "22 декабря — 19 января",
        "element": "Земля",
        "planet": "Сатурн",
        "quality": "Кардинальный",
        "strengths": "Дисциплина, стратегическое мышление, выдержка, надёжность",
        "weaknesses": "Сдержанность в эмоциях, трудоголизм",
        "summary": "Целеустремлённый и прагматичный знак. Умеет планировать вдолгую, спокойно преодолевает трудности и опирается на факты.",
        "best_match": ["Телец", "Дева", "Скорпион", "Рыбы"],
    },
    {
        "id": "aquarius",
        "name": "Водолей",
        "emoji": "♒",
        "dates": "20 января — 18 февраля",
        "element": "Воздух",
        "planet": "Уран и Сатурн",
        "quality": "Фиксированный",
        "strengths": "Оригинальность мышления, независимость, дружелюбие, изобретательность",
        "weaknesses": "Отстранённость, непредсказуемость, сопротивление жёстким рамкам",
        "summary": "Самостоятельный и нестандартно мыслящий знак. Ценит свободу, идеи и технологичный подход к решению привычных задач.",
        "best_match": ["Близнецы", "Весы", "Овен", "Стрелец"],
    },
    {
        "id": "pisces",
        "name": "Рыбы",
        "emoji": "♓",
        "dates": "19 февраля — 20 марта",
        "element": "Вода",
        "planet": "Нептун и Юпитер",
        "quality": "Мутабельный",
        "strengths": "Воображение, чуткость, адаптивность, творческий взгляд",
        "weaknesses": "Рассеянность в быту, идеализация людей",
        "summary": "Интуитивный и восприимчивый знак. Хорошо понимает мотивы людей, обладает развитым воображением и гибко подстраивается под обстоятельства.",
        "best_match": ["Рак", "Скорпион", "Телец", "Козерог"],
    },
]

for _z in ZODIAC_SIGNS:
    _z["symbol"] = _z["emoji"]
    _z["ruler"] = _z["planet"]
    _z["best_matches"] = _z["best_match"]

ZODIAC_BY_ID = {z["id"]: z for z in ZODIAC_SIGNS}
ZODIAC_BY_RU = {z["name"].lower(): z for z in ZODIAC_SIGNS}

CHINESE_ANIMALS = [
    ("Обезьяна", "🐒"),
    ("Петух", "🐓"),
    ("Собака", "🐕"),
    ("Кабан", "🐗"),
    ("Крыса", "🐀"),
    ("Бык", "🐂"),
    ("Тигр", "🐅"),
    ("Кролик", "🐇"),
    ("Дракон", "🐉"),
    ("Змея", "🐍"),
    ("Лошадь", "🐎"),
    ("Коза", "🐐"),
]

LIFE_PATH_MEANINGS = {
    1: "Лидерство, самостоятельность, опора на собственные решения.",
    2: "Партнёрство, дипломатия, умение договариваться и слышать других.",
    3: "Творчество, самовыражение, лёгкость в общении и подаче идей.",
    4: "Практичность, порядок, системная работа и надёжный фундамент.",
    5: "Динамика, перемены, интерес к новому опыту и свободе действий.",
    6: "Ответственность, забота о близких, стремление к гармонии и уюту.",
    7: "Аналитика, наблюдательность, интерес к глубоким знаниям и деталям.",
    8: "Управление, финансы, амбиции и ориентация на крупный результат.",
    9: "Широкий кругозор, гуманизм, умение завершать сложные этапы.",
    11: "Развитая интуиция, идейность и нестандартное видение.",
    22: "Созидание крупных проектов, сочетание мечты и точного расчёта.",
}

_GENERAL_POOL = [
    "Хороший момент, чтобы закрыть отложенные мелкие вопросы и разгрузить график.",
    "День располагает к спокойному расчёту: не спешите с первым импульсом, перепроверьте детали.",
    "Удачное время для инициативы и прямого разговора — вас услышат правильно.",
    "Сфокусируйтесь на одной главной задаче вместо пяти второстепенных — отдача будет заметно выше.",
    "Возможны неожиданные новости или смена планов во второй половине дня; оставьте небольшой запас времени.",
    "Полезно навести порядок в документах, заметках и текущих договорённостях.",
    "Интуиция сегодня работает точно в паре со здравым смыслом — доверяйте проверенным фактам.",
    "Спокойный рабочий ритм принесёт больше результата, чем попытка ускорить события силой.",
    "День подходит для обучения, поиска новой информации и планирования следующих шагов.",
    "Удачно складываются поездки, встречи и короткие деловые созвоны.",
]

_WORK_POOL = [
    "В рабочих вопросах выручит конкретика: фиксируйте договорённости письменно и избегайте размытых сроков.",
    "Подходящий период для обсуждения бюджета, покупок или оптимизации регулярных расходов.",
    "Командная работа пройдёт продуктивно, если заранее распределить зоны ответственности.",
    "Не лучший момент для спонтанных трат — крупные покупки разумнее отложить на пару дней.",
    "Хорошо пойдут задачи, требующие концентрации, расчётов и работы с цифрами.",
    "Свежий взгляд на старую задачу поможет сэкономить несколько часов работы.",
    "Спокойно отстаивайте свою позицию аргументами — сегодня факты убедительнее эмоций.",
    "Удачный день для завершения начатого проекта и подведения промежуточных итогов.",
]

_LOVE_POOL = [
    "В общении с близкими ценится прямота без колкостей: скажите прямо, чего ждёте.",
    "Хорошее время для спокойной встречи, прогулки или совместного отдыха без лишней суеты.",
    "Если назрел спорный вопрос, лучше обсудить его лично, а не в переписке.",
    "День благоприятствует новым знакомствам и восстановлению старых дружеских контактов.",
    "Проявите немного внимания к мелочам — это снимет лишнее напряжение в диалоге.",
    "Не принимайте близко к сердцу чужую усталость: дайте себе и партнёру немного личного пространства.",
    "Лёгкий юмор и самоирония помогут быстро разрядить любую неловкую паузу.",
]

_ADVICE_POOL = [
    "Следите за режимом сна и воды — физический тонус напрямую повлияет на концентрацию.",
    "Сделайте короткую паузу без телефона в середине дня, чтобы освежить голову.",
    "Лучшая стратегия — делать шаг за шагом и не распыляться на чужую суету.",
    "Не откладывайте короткий отдых на потом: ровный темп сбережёт силы до вечера.",
    "Полезны умеренная физическая нагрузка, прогулка или разминка.",
    "Доверяйте собственному опыту и не подстраивайтесь под чужую спешку.",
]


def parse_flexible_date(raw: str) -> tuple[int, int, int | None]:
    """Parses DD.MM.YYYY, YYYY-MM-DD, DD/MM/YYYY, or DD.MM."""
    s = (raw or "").strip()
    if not s:
        raise ValueError("Введите дату рождения (например, 15.05.2003)")

    m_iso = re.match(r"^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$", s)
    if m_iso:
        year, month, day = int(m_iso.group(1)), int(m_iso.group(2)), int(m_iso.group(3))
        dt.date(year, month, day)  # validate calendar date
        return day, month, year

    m_ru = re.match(r"^(\d{1,2})[-./](\d{1,2})(?:[-./](\d{2,4}))?$", s)
    if m_ru:
        day, month = int(m_ru.group(1)), int(m_ru.group(2))
        yr_str = m_ru.group(3)
        year: int | None = None
        if yr_str:
            year = int(yr_str)
            if year < 100:
                year += 2000 if year < 35 else 1900
        dt.date(year or 2000, month, day)  # validate month/day (leap safe if no year)
        return day, month, year

    raise ValueError("Неверный формат даты. Используйте ДД.ММ.ГГГГ (например, 15.05.2003) или ГГГГ-ММ-ДД.")


def zodiac_id_for_month_day(day: int, month: int) -> str:
    if (month == 3 and day >= 21) or (month == 4 and day <= 19):
        return "aries"
    if (month == 4 and day >= 20) or (month == 5 and day <= 20):
        return "taurus"
    if (month == 5 and day >= 21) or (month == 6 and day <= 20):
        return "gemini"
    if (month == 6 and day >= 21) or (month == 7 and day <= 22):
        return "cancer"
    if (month == 7 and day >= 23) or (month == 8 and day <= 22):
        return "leo"
    if (month == 8 and day >= 23) or (month == 9 and day <= 22):
        return "virgo"
    if (month == 9 and day >= 23) or (month == 10 and day <= 22):
        return "libra"
    if (month == 10 and day >= 23) or (month == 11 and day <= 21):
        return "scorpio"
    if (month == 11 and day >= 22) or (month == 12 and day <= 21):
        return "sagittarius"
    if (month == 12 and day >= 22) or (month == 1 and day <= 19):
        return "capricorn"
    if (month == 1 and day >= 20) or (month == 2 and day <= 18):
        return "aquarius"
    return "pisces"


def compute_life_path_number(day: int, month: int, year: int | None) -> int:
    digits = f"{day:02d}{month:02d}{year or 2000}"
    total = sum(int(ch) for ch in digits if ch.isdigit())
    while total > 9 and total not in (11, 22):
        total = sum(int(ch) for ch in str(total))
    return total


def analyze_birth_date(date_str: str) -> dict[str, Any]:
    day, month, year = parse_flexible_date(date_str)
    zid = zodiac_id_for_month_day(day, month)
    sign = ZODIAC_BY_ID[zid]
    life_num = compute_life_path_number(day, month, year)

    chinese = None
    age = None
    today = dt.date.today()
    if year:
        anim, emo = CHINESE_ANIMALS[year % 12]
        chinese = {"animal": anim, "emoji": emo, "year": year}
        age = today.year - year - ((today.month, today.day) < (month, day))

    # Next birthday countdown
    next_bday_year = today.year
    try:
        next_bday = dt.date(next_bday_year, month, day)
    except ValueError:
        next_bday = dt.date(next_bday_year, 3, 1)
    if next_bday < today:
        try:
            next_bday = dt.date(next_bday_year + 1, month, day)
        except ValueError:
            next_bday = dt.date(next_bday_year + 1, 3, 1)
    days_until_birthday = (next_bday - today).days

    east_elements = ["Металл", "Металл", "Вода", "Вода", "Дерево", "Дерево", "Огонь", "Огонь", "Земля", "Земля"]
    east_el = east_elements[year % 10] if year else None
    fmt_date = f"{day:02d}.{month:02d}" + (f".{year}" if year else "")

    return {
        "input_date": fmt_date,
        "formatted_date": fmt_date,
        "sign": sign,
        "chinese_zodiac": chinese,
        "eastern_animal": f"{chinese['emoji']} {chinese['animal']}" if chinese else None,
        "eastern_element": east_el,
        "age": age,
        "days_until_birthday": days_until_birthday,
        "life_path_number": life_num,
        "life_path_meaning": LIFE_PATH_MEANINGS.get(life_num, LIFE_PATH_MEANINGS[1]),
    }


def resolve_sign(sign_or_query: str) -> dict[str, Any]:
    key = (sign_or_query or "").strip().lower()
    if key in ZODIAC_BY_ID:
        return ZODIAC_BY_ID[key]
    if key in ZODIAC_BY_RU:
        return ZODIAC_BY_RU[key]
    # Try parsing as date
    try:
        d, m, _ = parse_flexible_date(key)
        return ZODIAC_BY_ID[zodiac_id_for_month_day(d, m)]
    except Exception:
        pass
    return ZODIAC_SIGNS[0]


def get_horoscope(sign_query: str, period: str = "today") -> dict[str, Any]:
    sign = resolve_sign(sign_query)
    today = dt.date.today()
    if period == "tomorrow":
        target_dt = today + dt.timedelta(days=1)
        target_str = target_dt.strftime("%d.%m.%Y")
        period_label = "На завтра"
        seed_key = f"{sign['id']}:day:{target_dt.isoformat()}"
    elif period == "week":
        iso_year, iso_week, _ = today.isocalendar()
        end_dt = today + dt.timedelta(days=6)
        target_str = f"{today.strftime('%d.%m')} — {end_dt.strftime('%d.%m.%Y')}"
        period_label = "На неделю"
        seed_key = f"{sign['id']}:week:{iso_year}-{iso_week}"
    else:
        target_dt = today
        target_str = target_dt.strftime("%d.%m.%Y")
        period_label = "На сегодня"
        seed_key = f"{sign['id']}:day:{target_dt.isoformat()}"

    digest = hashlib.sha256(seed_key.encode("utf-8")).digest()
    g_idx = digest[0] % len(_GENERAL_POOL)
    w_idx = digest[1] % len(_WORK_POOL)
    l_idx = digest[2] % len(_LOVE_POOL)
    a_idx = digest[3] % len(_ADVICE_POOL)

    energy_pct = 68 + (digest[4] % 29)
    overall_pct = 70 + (digest[5] % 27)
    love_pct = 66 + (digest[6] % 31)
    career_pct = 69 + (digest[7] % 28)

    lucky_numbers = sorted({1 + (digest[8] % 9), 10 + (digest[9] % 20), 30 + (digest[10] % 49)})
    start_hour = 9 + (digest[11] % 9)
    lucky_hours = f"{start_hour:02d}:00 — {start_hour + 3:02d}:00"

    return {
        "sign": sign,
        "period": period,
        "period_label": period_label,
        "target_date": target_str,
        "general": _GENERAL_POOL[g_idx],
        "work": _WORK_POOL[w_idx],
        "career": _WORK_POOL[w_idx],
        "love": _LOVE_POOL[l_idx],
        "advice": _ADVICE_POOL[a_idx],
        "scores": {
            "overall": overall_pct,
            "energy": energy_pct,
            "work": career_pct,
            "career": career_pct,
            "love": love_pct,
            "luck": overall_pct,
        },
        "lucky_number": lucky_numbers[0],
        "lucky_numbers": lucky_numbers,
        "lucky_time": lucky_hours,
        "lucky_hours": lucky_hours,
    }


_ELEMENT_MATRIX: dict[tuple[str, str], int] = {
    ("Огонь", "Огонь"): 82,
    ("Огонь", "Воздух"): 91,
    ("Воздух", "Огонь"): 91,
    ("Земля", "Земля"): 85,
    ("Земля", "Вода"): 90,
    ("Вода", "Земля"): 90,
    ("Воздух", "Воздух"): 83,
    ("Вода", "Вода"): 86,
    ("Огонь", "Земля"): 68,
    ("Земля", "Огонь"): 68,
    ("Огонь", "Вода"): 64,
    ("Вода", "Огонь"): 64,
    ("Воздух", "Земля"): 70,
    ("Земля", "Воздух"): 70,
    ("Воздух", "Вода"): 72,
    ("Вода", "Воздух"): 72,
}


def calculate_compatibility(
    first_input: str,
    second_input: str,
    name1: str = "",
    name2: str = "",
) -> dict[str, Any]:
    """Calculates compatibility from two birth dates (DD.MM.YYYY) or two zodiac sign names/IDs."""
    info1: dict[str, Any] | None = None
    info2: dict[str, Any] | None = None

    try:
        info1 = analyze_birth_date(first_input)
        sign1 = info1["sign"]
    except Exception:
        sign1 = resolve_sign(first_input)

    try:
        info2 = analyze_birth_date(second_input)
        sign2 = info2["sign"]
    except Exception:
        sign2 = resolve_sign(second_input)

    el_pair = (sign1["element"], sign2["element"])
    base_score = _ELEMENT_MATRIX.get(el_pair, 75)

    if sign2["name"] in sign1["best_match"] or sign1["name"] in sign2["best_match"]:
        base_score = max(base_score, 88)

    # Numerology harmony if birth dates provided
    num_bonus = 0
    lp1 = info1["life_path_number"] if info1 else None
    lp2 = info2["life_path_number"] if info2 else None
    if lp1 and lp2:
        diff = abs((lp1 % 9) - (lp2 % 9))
        if lp1 == lp2 or diff in (2, 4, 6):
            num_bonus = 5
        elif diff in (1, 3):
            num_bonus = 2
        else:
            num_bonus = -2

    # Deterministic pair nuance
    pair_seed = hashlib.sha256(":".join(sorted([first_input.strip().lower(), second_input.strip().lower()])).encode()).digest()
    nuance = (pair_seed[0] % 7) - 3

    overall = max(48, min(98, base_score + num_bonus + nuance))
    love_pct = max(45, min(99, overall + ((pair_seed[1] % 11) - 5)))
    comm_pct = max(45, min(99, overall + ((pair_seed[2] % 11) - 4)))
    trust_pct = max(50, min(99, overall + ((pair_seed[3] % 9) - 3)))
    goals_pct = max(48, min(99, overall + ((pair_seed[4] % 11) - 4)))

    if overall >= 85:
        verdict = "Высокая совместимость"
        comment = (
            f"Стихии «{sign1['element']}» ({sign1['name']}) и «{sign2['element']}» ({sign2['name']}) естественно усиливают друг друга. "
            "В паре легко выстраивается взаимопонимание, общий темп и поддержка инициатив."
        )
    elif overall >= 72:
        verdict = "Хорошая сбалансированная совместимость"
        comment = (
            f"Союз {sign1['name']} и {sign2['name']} строится на дополнении разных сильных качеств. "
            "При открытом диалоге и уважении личного ритма отношения и совместные дела складываются устойчиво."
        )
    else:
        verdict = "Контрастный союз (требует договорённостей)"
        comment = (
            f"У знаков {sign1['name']} ({sign1['element']}) и {sign2['name']} ({sign2['element']}) разный темперамент и подход к решениям. "
            "Сильное притяжение возможно, если заранее договариваться о бытовых и финансовых правилах."
        )

    p1_name = name1.strip() or sign1["name"]
    p2_name = name2.strip() or sign2["name"]
    return {
        "person1": {
            "name": p1_name,
            "label": p1_name,
            "input": first_input,
            "sign": sign1,
            "life_path": lp1,
            "chinese": info1["chinese_zodiac"] if info1 else None,
        },
        "person2": {
            "name": p2_name,
            "label": p2_name,
            "input": second_input,
            "sign": sign2,
            "life_path": lp2,
            "chinese": info2["chinese_zodiac"] if info2 else None,
        },
        "overall_pct": overall,
        "verdict": verdict,
        "level": verdict,
        "comment": comment,
        "summary": comment,
        "scores": {
            "emotional": love_pct,
            "communication": comm_pct,
            "goals_and_daily": trust_pct,
            "biorhythm_or_numbers": goals_pct,
        },
        "breakdown": [
            {"label": "Любовь и притяжение", "pct": love_pct},
            {"label": "Общение и понимание", "pct": comm_pct},
            {"label": "Быт и доверие", "pct": trust_pct},
            {"label": "Общие цели и дела", "pct": goals_pct},
        ],
    }


# ==============================================================================
# 2. ИНТЕРАКТИВНЫЕ ФИЗИЧЕСКИЕ РАСЧЁТЫ (ВРЕМЯ, СИЛА, МОЩНОСТЬ, КПД, ТОК, НАГРЕВ)
# ==============================================================================

G_STD = 9.80665

SPECIFIC_HEATS: dict[str, tuple[str, float]] = {
    "water": ("Вода", 4200.0),
    "ice": ("Лёд", 2100.0),
    "air": ("Воздух", 1005.0),
    "aluminum": ("Алюминий", 900.0),
    "iron": ("Железо / Сталь", 460.0),
    "copper": ("Медь", 385.0),
}

PHYSICS_CALCULATORS: list[dict[str, Any]] = [
    {
        "id": "kinematics_uniform",
        "title": "Путь, скорость и время движения",
        "formula_display": "s = v · t",
        "targets": [
            {
                "var": "t",
                "label": "Найти время (t)",
                "fields": [
                    {"name": "s", "label": "Расстояние s (м)", "default": 1500},
                    {"name": "v", "label": "Скорость v (м/с)", "default": 12.5},
                ],
            },
            {
                "var": "s",
                "label": "Найти путь (s)",
                "fields": [
                    {"name": "v", "label": "Скорость v (м/с)", "default": 20},
                    {"name": "t", "label": "Время t (сек)", "default": 180},
                ],
            },
            {
                "var": "v",
                "label": "Найти скорость (v)",
                "fields": [
                    {"name": "s", "label": "Расстояние s (м)", "default": 1000},
                    {"name": "t", "label": "Время t (сек)", "default": 80},
                ],
            },
        ],
    },
    {
        "id": "kinematics_accel",
        "title": "Разгон, ускорение и время",
        "formula_display": "v = v₀ + a·t,   s = v₀·t + a·t²/2",
        "targets": [
            {
                "var": "t",
                "label": "Найти время разгона (t)",
                "fields": [
                    {"name": "v0", "label": "Начальная скорость v₀ (м/с)", "default": 0},
                    {"name": "v", "label": "Конечная скорость v (м/с)", "default": 27.78},
                    {"name": "a", "label": "Ускорение a (м/с²)", "default": 3.5},
                ],
            },
            {
                "var": "a",
                "label": "Найти ускорение (a) и путь (s)",
                "fields": [
                    {"name": "v0", "label": "Начальная скорость v₀ (м/с)", "default": 0},
                    {"name": "v", "label": "Конечная скорость v (м/с)", "default": 25},
                    {"name": "t", "label": "Время t (сек)", "default": 5},
                ],
            },
            {
                "var": "s",
                "label": "Найти пройденный путь (s)",
                "fields": [
                    {"name": "v0", "label": "Начальная скорость v₀ (м/с)", "default": 10},
                    {"name": "a", "label": "Ускорение a (м/с²)", "default": 2},
                    {"name": "t", "label": "Время t (сек)", "default": 6},
                ],
            },
        ],
    },
    {
        "id": "free_fall",
        "title": "Свободное падение тела с высоты",
        "formula_display": "t = √(2h / g),   v = g · t",
        "targets": [
            {
                "var": "t",
                "label": "Найти время падения и скорость по высоте h",
                "fields": [
                    {"name": "h", "label": "Высота h (м)", "default": 45},
                    {"name": "g", "label": "Ускорение g (м/с²)", "default": 9.81},
                ],
            },
            {
                "var": "h",
                "label": "Найти высоту по времени падения t",
                "fields": [
                    {"name": "t", "label": "Время падения t (сек)", "default": 3},
                    {"name": "g", "label": "Ускорение g (м/с²)", "default": 9.81},
                ],
            },
        ],
    },
    {
        "id": "newton_force",
        "title": "Сила, масса, ускорение и трение",
        "formula_display": "F = m · a,   F_тр = μ · m · g",
        "targets": [
            {
                "var": "F",
                "label": "Найти силу (F)",
                "fields": [
                    {"name": "m", "label": "Масса m (кг)", "default": 1200},
                    {"name": "a", "label": "Ускорение a (м/с²)", "default": 2.5},
                    {"name": "mu", "label": "Коэфф. трения μ (опц.)", "default": 0.05},
                ],
            },
            {
                "var": "a",
                "label": "Найти ускорение (a)",
                "fields": [
                    {"name": "F", "label": "Сила F (Н)", "default": 3000},
                    {"name": "m", "label": "Масса m (кг)", "default": 1200},
                ],
            },
            {
                "var": "m",
                "label": "Найти массу (m)",
                "fields": [
                    {"name": "F", "label": "Сила F (Н)", "default": 500},
                    {"name": "a", "label": "Ускорение a (м/с²)", "default": 4},
                ],
            },
        ],
    },
    {
        "id": "work_power_eff",
        "title": "Работа, мощность, время и КПД",
        "formula_display": "P = A / t,   η = (A_полезн / A_затрач) · 100%",
        "targets": [
            {
                "var": "eta",
                "label": "Найти КПД (η, %)",
                "fields": [
                    {"name": "useful", "label": "Полезная работа / мощность", "default": 850},
                    {"name": "total", "label": "Затраченная работа / мощность", "default": 1000},
                ],
            },
            {
                "var": "P",
                "label": "Найти мощность (P)",
                "fields": [
                    {"name": "A", "label": "Работа A (Дж)", "default": 150000},
                    {"name": "t", "label": "Время t (сек)", "default": 60},
                ],
            },
            {
                "var": "A",
                "label": "Найти работу / энергию (A)",
                "fields": [
                    {"name": "P", "label": "Мощность P (Вт)", "default": 2000},
                    {"name": "t", "label": "Время t (сек)", "default": 120},
                ],
            },
            {
                "var": "t",
                "label": "Найти время выполнения работы (t)",
                "fields": [
                    {"name": "A", "label": "Работа A (Дж)", "default": 300000},
                    {"name": "P", "label": "Мощность P (Вт)", "default": 1500},
                ],
            },
        ],
    },
    {
        "id": "ohm_electric",
        "title": "Закон Ома, мощность тока и расход кВт·ч",
        "formula_display": "I = U / R,   P = U · I,   E = P · t",
        "targets": [
            {
                "var": "I",
                "label": "Найти силу тока (I) и мощность (P)",
                "fields": [
                    {"name": "U", "label": "Напряжение U (В)", "default": 220},
                    {"name": "R", "label": "Сопротивление R (Ом)", "default": 44},
                    {"name": "hours", "label": "Время работы (часов)", "default": 2},
                ],
            },
            {
                "var": "U",
                "label": "Найти напряжение (U)",
                "fields": [
                    {"name": "I", "label": "Сила тока I (А)", "default": 5},
                    {"name": "R", "label": "Сопротивление R (Ом)", "default": 44},
                ],
            },
            {
                "var": "R",
                "label": "Найти сопротивление (R)",
                "fields": [
                    {"name": "U", "label": "Напряжение U (В)", "default": 12},
                    {"name": "I", "label": "Сила тока I (А)", "default": 1.5},
                ],
            },
        ],
    },
    {
        "id": "heat_boiling",
        "title": "Нагрев вещества и время закипания (с КПД)",
        "formula_display": "Q = c·m·(T₂ − T₁),   t = Q / (P · η)",
        "targets": [
            {
                "var": "t_heat",
                "label": "Найти время нагрева и количество теплоты Q",
                "fields": [
                    {"name": "c", "label": "Теплоёмкость c (Дж/(кг·°C), вода=4200)", "default": 4200},
                    {"name": "m", "label": "Масса вещества m (кг)", "default": 1.5},
                    {"name": "t1", "label": "Начальная температура T₁ (°C)", "default": 20},
                    {"name": "t2", "label": "Конечная температура T₂ (°C)", "default": 100},
                    {"name": "P", "label": "Мощность нагревателя P (Вт)", "default": 2000},
                    {"name": "eta", "label": "КПД нагревателя η (%)", "default": 85},
                ],
            },
        ],
    },
    {
        "id": "energy_pressure",
        "title": "Кинетическая энергия и гидростатическое давление",
        "formula_display": "E_k = m·v²/2,   p = ρ·g·h",
        "targets": [
            {
                "var": "Ek",
                "label": "Кинетическая энергия и импульс тела",
                "fields": [
                    {"name": "m", "label": "Масса тела m (кг)", "default": 70},
                    {"name": "v", "label": "Скорость v (м/с)", "default": 10},
                ],
            },
            {
                "var": "p_hydro",
                "label": "Давление жидкости на глубине h",
                "fields": [
                    {"name": "rho", "label": "Плотность ρ (кг/м³, вода=1000)", "default": 1000},
                    {"name": "h", "label": "Глубина h (м)", "default": 10},
                ],
            },
        ],
    },
]


_CALC_EMOJIS = {
    "kinematics_uniform": "⏱️",
    "kinematics_accel": "🚗",
    "free_fall": "🪂",
    "newton_force": "🏋️",
    "work_power_eff": "⚙️",
    "ohm_electric": "🔌",
    "heat_boiling": "🌡️",
    "energy_pressure": "🌊",
}

for _c in PHYSICS_CALCULATORS:
    _c["emoji"] = _CALC_EMOJIS.get(_c["id"], "⚛️")
    _c["formula"] = _c["formula_display"]


def _fmt_num(val: float) -> str:
    if abs(val) >= 1e6 or (0 < abs(val) < 1e-3):
        return f"{val:.4g}"
    rounded = round(val, 4)
    if rounded == int(rounded):
        return str(int(rounded))
    return f"{rounded}".rstrip("0").rstrip(".")


def _fmt_duration(seconds: float) -> str:
    if seconds < 0:
        return "—"
    if seconds < 60:
        return f"{_fmt_num(seconds)} сек"
    mins = int(seconds // 60)
    rem_s = round(seconds - mins * 60, 1)
    if mins < 60:
        return f"{mins} мин {_fmt_num(rem_s)} сек"
    hrs = mins // 60
    rem_m = mins % 60
    return f"{hrs} ч {rem_m} мин {_fmt_num(rem_s)} сек"


def solve_physics(calc_id: str, target_var: str, params: dict[str, float]) -> dict[str, Any]:
    alias_map = {
        "work_power_efficiency": "work_power_eff",
        "heat_energy": "heat_boiling",
    }
    norm_id = alias_map.get(calc_id, calc_id)
    res = _solve_physics_raw(norm_id, target_var, params)
    raw_si = res.get("numeric_si")
    if raw_si is None:
        m_num = re.search(r"[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?", str(res.get("si_value", "0")))
        raw_si = float(m_num.group(0)) if m_num else 0.0
    raw_steps = res.get("steps", "")
    steps_list = [raw_steps] if isinstance(raw_steps, str) else list(raw_steps)
    return {
        **res,
        "calc_id": norm_id,
        "target_var": target_var,
        "target_label": res["primary_label"],
        "formatted": res["primary_value"],
        "numeric_si": raw_si,
        "steps_list": steps_list,
        "extra": res.get("extras", []),
    }


def _solve_physics_raw(calc_id: str, target_var: str, params: dict[str, float]) -> dict[str, Any]:
    p = {k: float(v) for k, v in params.items()}

    if calc_id == "kinematics_uniform":
        if target_var == "t":
            s, v = p.get("s", 0.0), p.get("v", 0.0)
            if v == 0:
                raise ValueError("Скорость v не может быть равна 0 при расчёте времени.")
            t = s / v
            return {
                "primary_label": "Время движения (t)",
                "primary_value": _fmt_duration(t),
                "si_value": f"{_fmt_num(t)} с",
                "formula": "t = s / v",
                "steps": f"t = {_fmt_num(s)} м / {_fmt_num(v)} м/с = {_fmt_num(t)} с",
                "extras": [
                    {"label": "Скорость в км/ч", "value": f"{_fmt_num(v * 3.6)} км/ч"},
                    {"label": "Расстояние в км", "value": f"{_fmt_num(s / 1000)} км"},
                ],
            }
        if target_var == "s":
            v, t = p.get("v", 0.0), p.get("t", 0.0)
            s = v * t
            return {
                "primary_label": "Пройденный путь (s)",
                "primary_value": f"{_fmt_num(s)} м ({_fmt_num(s / 1000)} км)",
                "si_value": f"{_fmt_num(s)} м",
                "formula": "s = v · t",
                "steps": f"s = {_fmt_num(v)} м/с · {_fmt_num(t)} с = {_fmt_num(s)} м",
                "extras": [
                    {"label": "Скорость в км/ч", "value": f"{_fmt_num(v * 3.6)} км/ч"},
                    {"label": "Время", "value": _fmt_duration(t)},
                ],
            }
        s, t = p.get("s", 0.0), p.get("t", 0.0)
        if t == 0:
            raise ValueError("Время t не может быть равно 0.")
        v = s / t
        return {
            "primary_label": "Скорость (v)",
            "primary_value": f"{_fmt_num(v)} м/с ({_fmt_num(v * 3.6)} км/ч)",
            "si_value": f"{_fmt_num(v)} м/с",
            "formula": "v = s / t",
            "steps": f"v = {_fmt_num(s)} м / {_fmt_num(t)} с = {_fmt_num(v)} м/с",
            "extras": [{"label": "В км/ч", "value": f"{_fmt_num(v * 3.6)} км/ч"}],
        }

    if calc_id == "kinematics_accel":
        if target_var == "t":
            v0, v, a = p.get("v0", 0.0), p.get("v", 0.0), p.get("a", 0.0)
            if a == 0:
                raise ValueError("Ускорение a не должно быть равно 0.")
            t = (v - v0) / a
            s = v0 * t + 0.5 * a * t * t
            return {
                "primary_label": "Время разгона / торможения (t)",
                "primary_value": _fmt_duration(abs(t)),
                "si_value": f"{_fmt_num(t)} с",
                "formula": "t = (v − v₀) / a",
                "steps": f"t = ({_fmt_num(v)} − {_fmt_num(v0)}) / {_fmt_num(a)} = {_fmt_num(t)} с",
                "extras": [
                    {"label": "Пройденный путь за это время", "value": f"{_fmt_num(s)} м"},
                    {"label": "Конечная скорость", "value": f"{_fmt_num(v * 3.6)} км/ч"},
                ],
            }
        if target_var == "a":
            v0, v, t = p.get("v0", 0.0), p.get("v", 0.0), p.get("t", 0.0)
            if t == 0:
                raise ValueError("Время t не может быть равно 0.")
            a = (v - v0) / t
            s = v0 * t + 0.5 * a * t * t
            return {
                "primary_label": "Ускорение (a)",
                "primary_value": f"{_fmt_num(a)} м/с²",
                "si_value": f"{_fmt_num(a)} м/с²",
                "formula": "a = (v − v₀) / t",
                "steps": f"a = ({_fmt_num(v)} − {_fmt_num(v0)}) / {_fmt_num(t)} = {_fmt_num(a)} м/с²",
                "extras": [
                    {"label": "Пройденный путь s", "value": f"{_fmt_num(s)} м"},
                    {"label": "Перегрузка (в единицах g)", "value": f"{_fmt_num(abs(a) / G_STD)} g"},
                ],
            }
        v0, a, t = p.get("v0", 0.0), p.get("a", 0.0), p.get("t", 0.0)
        s = v0 * t + 0.5 * a * t * t
        v = v0 + a * t
        return {
            "primary_label": "Пройденный путь (s)",
            "primary_value": f"{_fmt_num(s)} м",
            "si_value": f"{_fmt_num(s)} м",
            "formula": "s = v₀·t + (a·t²)/2",
            "steps": f"s = {_fmt_num(v0)}·{_fmt_num(t)} + 0.5·{_fmt_num(a)}·{_fmt_num(t)}² = {_fmt_num(s)} м",
            "extras": [{"label": "Конечная скорость v", "value": f"{_fmt_num(v)} м/с ({_fmt_num(v * 3.6)} км/ч)"}],
        }

    if calc_id == "free_fall":
        g = p.get("g", 9.81)
        if g <= 0:
            raise ValueError("Ускорение g должно быть больше 0.")
        if target_var == "t":
            h = p.get("h", 0.0)
            if h < 0:
                raise ValueError("Высота h не может быть отрицательной.")
            t = math.sqrt(2 * h / g)
            v = g * t
            return {
                "primary_label": "Время падения (t)",
                "primary_value": f"{_fmt_num(t)} сек",
                "si_value": f"{_fmt_num(t)} с",
                "formula": "t = √(2h / g)",
                "steps": f"t = √(2 · {_fmt_num(h)} / {_fmt_num(g)}) = {_fmt_num(t)} с",
                "extras": [
                    {"label": "Скорость у земли", "value": f"{_fmt_num(v)} м/с ({_fmt_num(v * 3.6)} км/ч)"},
                ],
            }
        t = p.get("t", 0.0)
        if t < 0:
            raise ValueError("Время t не может быть отрицательным.")
        h = 0.5 * g * t * t
        v = g * t
        return {
            "primary_label": "Высота падения (h)",
            "primary_value": f"{_fmt_num(h)} м",
            "si_value": f"{_fmt_num(h)} м",
            "formula": "h = (g · t²) / 2",
            "steps": f"h = 0.5 · {_fmt_num(g)} · {_fmt_num(t)}² = {_fmt_num(h)} м",
            "extras": [
                {"label": "Конечная скорость", "value": f"{_fmt_num(v)} м/с ({_fmt_num(v * 3.6)} км/ч)"},
            ],
        }

    if calc_id == "newton_force":
        if target_var == "F":
            m, a, mu = p.get("m", 0.0), p.get("a", 0.0), p.get("mu", 0.0)
            f_net = m * a
            weight = m * G_STD
            f_fric = mu * weight
            return {
                "primary_label": "Равнодействующая сила (F)",
                "primary_value": f"{_fmt_num(f_net)} Н ({_fmt_num(f_net / 1000)} кН)",
                "si_value": f"{_fmt_num(f_net)} Н",
                "formula": "F = m · a",
                "steps": f"F = {_fmt_num(m)} кг · {_fmt_num(a)} м/с² = {_fmt_num(f_net)} Н",
                "extras": [
                    {"label": "Сила тяжести (m·g)", "value": f"{_fmt_num(weight)} Н"},
                    {"label": "Сила трения (μ·m·g)", "value": f"{_fmt_num(f_fric)} Н"},
                    {"label": "Полная сила тяги с учётом трения", "value": f"{_fmt_num(f_net + f_fric)} Н"},
                ],
            }
        if target_var == "a":
            f_val, m = p.get("F", 0.0), p.get("m", 0.0)
            if m <= 0:
                raise ValueError("Масса m должна быть больше 0.")
            a = f_val / m
            return {
                "primary_label": "Ускорение тела (a)",
                "primary_value": f"{_fmt_num(a)} м/с²",
                "si_value": f"{_fmt_num(a)} м/с²",
                "formula": "a = F / m",
                "steps": f"a = {_fmt_num(f_val)} Н / {_fmt_num(m)} кг = {_fmt_num(a)} м/с²",
                "extras": [{"label": "В долях g", "value": f"{_fmt_num(a / G_STD)} g"}],
            }
        f_val, a = p.get("F", 0.0), p.get("a", 0.0)
        if a == 0:
            raise ValueError("Ускорение a не должно быть равно 0.")
        m = f_val / a
        return {
            "primary_label": "Масса тела (m)",
            "primary_value": f"{_fmt_num(m)} кг",
            "si_value": f"{_fmt_num(m)} кг",
            "formula": "m = F / a",
            "steps": f"m = {_fmt_num(f_val)} Н / {_fmt_num(a)} м/с² = {_fmt_num(m)} кг",
            "extras": [{"label": "Вес тела в покое", "value": f"{_fmt_num(m * G_STD)} Н"}],
        }

    if calc_id == "work_power_eff":
        if target_var == "eta":
            useful, total = p.get("useful", 0.0), p.get("total", 0.0)
            if total <= 0:
                raise ValueError("Затраченная величина должна быть больше 0.")
            eta = (useful / total) * 100.0
            losses = total - useful
            return {
                "primary_label": "Коэффициент полезного действия (КПД)",
                "primary_value": f"{_fmt_num(eta)} %",
                "si_value": f"{_fmt_num(eta / 100)} (доля)",
                "formula": "η = (A_полезн / A_затрач) · 100%",
                "steps": f"η = ({_fmt_num(useful)} / {_fmt_num(total)}) · 100% = {_fmt_num(eta)}%",
                "extras": [
                    {"label": "Потери энергии / мощности", "value": f"{_fmt_num(losses)} ({_fmt_num(100 - eta)}%)"},
                ],
            }
        if target_var == "P":
            work_a, t = p.get("A", 0.0), p.get("t", 0.0)
            if t <= 0:
                raise ValueError("Время t должно быть больше 0.")
            power = work_a / t
            return {
                "primary_label": "Мощность (P)",
                "primary_value": f"{_fmt_num(power)} Вт ({_fmt_num(power / 1000)} кВт)",
                "si_value": f"{_fmt_num(power)} Вт",
                "formula": "P = A / t",
                "steps": f"P = {_fmt_num(work_a)} Дж / {_fmt_num(t)} с = {_fmt_num(power)} Вт",
                "extras": [
                    {"label": "В лошадиных силах (метрич.)", "value": f"{_fmt_num(power / 735.49875)} л.с."},
                ],
            }
        if target_var == "A":
            power, t = p.get("P", 0.0), p.get("t", 0.0)
            work_a = power * t
            kwh = work_a / 3_600_000.0
            return {
                "primary_label": "Совершённая работа / энергия (A)",
                "primary_value": f"{_fmt_num(work_a)} Дж ({_fmt_num(work_a / 1000)} кДж)",
                "si_value": f"{_fmt_num(work_a)} Дж",
                "formula": "A = P · t",
                "steps": f"A = {_fmt_num(power)} Вт · {_fmt_num(t)} с = {_fmt_num(work_a)} Дж",
                "extras": [
                    {"label": "В киловатт-часах", "value": f"{_fmt_num(kwh)} кВт·ч"},
                    {"label": "В килокалориях", "value": f"{_fmt_num(work_a / 4184)} ккал"},
                ],
            }
        work_a, power = p.get("A", 0.0), p.get("P", 0.0)
        eta = p.get("eta", 100.0)
        if power <= 0 or eta <= 0:
            raise ValueError("Мощность P и КПД η должны быть больше 0.")
        eff_p = power * (eta / 100.0)
        t = work_a / eff_p
        step_str = (
            f"t = {_fmt_num(work_a)} Дж / ({_fmt_num(power)} Вт · {_fmt_num(eta / 100)}) = {_fmt_num(t)} с"
            if eta != 100.0
            else f"t = {_fmt_num(work_a)} Дж / {_fmt_num(power)} Вт = {_fmt_num(t)} с"
        )
        return {
            "primary_label": "Время выполнения работы (t)",
            "primary_value": _fmt_duration(t),
            "si_value": f"{_fmt_num(t)} с",
            "numeric_si": round(t, 6),
            "formula": "t = A / (P · η)" if eta != 100.0 else "t = A / P",
            "steps": step_str,
            "extras": [{"label": "Полезная мощность", "value": f"{_fmt_num(eff_p)} Вт"}] if eta != 100.0 else [],
        }

    if calc_id == "ohm_electric":
        if target_var == "I":
            u_v, r_ohm, hrs = p.get("U", 0.0), p.get("R", 0.0), p.get("hours", 1.0)
            if r_ohm <= 0:
                raise ValueError("Сопротивление R должно быть больше 0.")
            curr = u_v / r_ohm
            power = u_v * curr
            kwh = (power / 1000.0) * max(0.0, hrs)
            return {
                "primary_label": "Сила тока (I)",
                "primary_value": f"{_fmt_num(curr)} А",
                "si_value": f"{_fmt_num(curr)} А",
                "formula": "I = U / R,   P = U · I",
                "steps": f"I = {_fmt_num(u_v)} В / {_fmt_num(r_ohm)} Ом = {_fmt_num(curr)} А",
                "extras": [
                    {"label": "Электрическая мощность P", "value": f"{_fmt_num(power)} Вт ({_fmt_num(power / 1000)} кВт)"},
                    {"label": f"Расход за {_fmt_num(hrs)} ч", "value": f"{_fmt_num(kwh)} кВт·ч ({_fmt_num(kwh * 3.6e6)} Дж)"},
                ],
            }
        if target_var == "U":
            curr, r_ohm = p.get("I", 0.0), p.get("R", 0.0)
            u_v = curr * r_ohm
            power = u_v * curr
            return {
                "primary_label": "Напряжение (U)",
                "primary_value": f"{_fmt_num(u_v)} В",
                "si_value": f"{_fmt_num(u_v)} В",
                "formula": "U = I · R",
                "steps": f"U = {_fmt_num(curr)} А · {_fmt_num(r_ohm)} Ом = {_fmt_num(u_v)} В",
                "extras": [{"label": "Мощность P", "value": f"{_fmt_num(power)} Вт"}],
            }
        u_v, curr = p.get("U", 0.0), p.get("I", 0.0)
        if curr == 0:
            raise ValueError("Сила тока I не может быть равна 0.")
        r_ohm = u_v / curr
        power = u_v * curr
        return {
            "primary_label": "Сопротивление (R)",
            "primary_value": f"{_fmt_num(r_ohm)} Ом",
            "si_value": f"{_fmt_num(r_ohm)} Ом",
            "formula": "R = U / I",
            "steps": f"R = {_fmt_num(u_v)} В / {_fmt_num(curr)} А = {_fmt_num(r_ohm)} Ом",
            "extras": [{"label": "Мощность P", "value": f"{_fmt_num(power)} Вт"}],
        }

    if calc_id == "heat_boiling":
        c_val = p.get("c", 4200.0)
        m = p.get("m", 1.0)
        t1 = p.get("t1", 20.0)
        t2 = p.get("t2", 100.0)
        power = p.get("P", 2000.0)
        eta = p.get("eta", 85.0)
        if power <= 0 or eta <= 0:
            raise ValueError("Мощность P и КПД η должны быть больше 0.")
        delta_t = t2 - t1
        q_joules = abs(c_val * m * delta_t)
        eff_power = power * (eta / 100.0)
        time_sec = q_joules / eff_power
        return {
            "primary_label": "Время нагрева (t)",
            "primary_value": _fmt_duration(time_sec),
            "si_value": f"{_fmt_num(time_sec)} с",
            "formula": "Q = c·m·ΔT,   t = Q / (P · η/100)",
            "steps": (
                f"Q = {_fmt_num(c_val)} · {_fmt_num(m)} · |{_fmt_num(t2)} − {_fmt_num(t1)}| = {_fmt_num(q_joules)} Дж;  "
                f"t = {_fmt_num(q_joules)} / ({_fmt_num(power)} · {_fmt_num(eta / 100)}) = {_fmt_num(time_sec)} с"
            ),
            "extras": [
                {"label": "Полезная теплота Q", "value": f"{_fmt_num(q_joules / 1000)} кДж"},
                {"label": "Полезная мощность (P·η)", "value": f"{_fmt_num(eff_power)} Вт"},
                {"label": "Затрачено электроэнергии", "value": f"{_fmt_num((power * time_sec) / 3_600_000)} кВт·ч"},
            ],
        }

    if calc_id == "energy_pressure":
        if target_var == "Ek":
            m, v = p.get("m", 0.0), p.get("v", 0.0)
            ek = 0.5 * m * v * v
            mom = m * v
            return {
                "primary_label": "Кинетическая энергия (E_k)",
                "primary_value": f"{_fmt_num(ek)} Дж ({_fmt_num(ek / 1000)} кДж)",
                "si_value": f"{_fmt_num(ek)} Дж",
                "formula": "E_k = (m · v²) / 2",
                "steps": f"E_k = 0.5 · {_fmt_num(m)} · {_fmt_num(v)}² = {_fmt_num(ek)} Дж",
                "extras": [
                    {"label": "Импульс тела (p = m·v)", "value": f"{_fmt_num(mom)} кг·м/с"},
                    {"label": "Эквивалентная высота падения", "value": f"{_fmt_num(ek / (max(m, 1e-9) * G_STD))} м"},
                ],
            }
        rho, h = p.get("rho", 1000.0), p.get("h", 0.0)
        p_pa = rho * G_STD * h
        atm_total = 101325.0 + p_pa
        return {
            "primary_label": "Гидростатическое давление (p)",
            "primary_value": f"{_fmt_num(p_pa / 1000)} кПа ({_fmt_num(p_pa)} Па)",
            "si_value": f"{_fmt_num(p_pa)} Па",
            "formula": "p = ρ · g · h",
            "steps": f"p = {_fmt_num(rho)} · 9.81 · {_fmt_num(h)} = {_fmt_num(p_pa)} Па",
            "extras": [
                {"label": "В атмосферах (избыточное)", "value": f"{_fmt_num(p_pa / 101325.0)} атм"},
                {"label": "Полное давление с учётом атмосферы", "value": f"{_fmt_num(atm_total / 1000)} кПа ({_fmt_num(atm_total / 101325.0)} атм)"},
            ],
        }

    raise ValueError(f"Неизвестный расчёт: {calc_id}")
