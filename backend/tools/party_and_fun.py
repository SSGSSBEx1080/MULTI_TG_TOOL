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
    ring_finger_cm: float = 7.6,
    body_fat_pct: float = 16.0,
    **_ignored: Any,
) -> dict[str, Any]:
    """Return published population reference values, never an individual prediction.

    The anthropometric covariates are retained only for API compatibility: available
    population correlations are too weak to infer an individual's genital dimensions.
    Veale et al. (2015) report clinician-measured means from up to 15,521 participants.
    """
    return {
        "result_kind": "population_reference_not_individual_estimate",
        "length_cm": 13.12,
        "bpel_cm": 13.12,
        "estimated_cm": 13.12,
        "population_mean_cm": 13.12,
        "population_sd_cm": 1.66,
        "ci95_low_cm": 9.87,
        "ci95_high_cm": 16.37,
        "flaccid_cm": 9.16,
        "flaccid_sd_cm": 1.57,
        "girth_est_cm": 11.66,
        "girth_sd_cm": 1.10,
        "length_inches": round(13.12 / 2.54, 2),
        "percentile": None,
        "rank_title": "Среднее значение клинической выборки — не индивидуальный прогноз",
        "comparisons": [],
        "factors": [],
        "methodology": (
            "Veale D. et al. BJU International (2015), систематический обзор и номограммы измерений "
            "до 15 521 мужчин: средняя длина в эрекции 13.12 см (SD 1.66), средний обхват 11.66 см (SD 1.10). "
            "Это популяционные описательные статистики, а не формула расчёта по росту, стопе, возрасту или игровому рейтингу."
        ),
        "measurement": (
            "Для ориентировочного самостоятельного измерения длины в эрекции измеряют по верхней поверхности "
            "от лобковой кости до кончика головки; клиницист может стандартизировать метод. Температура, "
            "состояние эрекции и техника влияют на результат. При вопросах о развитии, боли или функции обратитесь к урологу."
        ),
        "scientific_refs": [
            "Veale D. et al. (2015), Am I normal? A systematic review and construction of nomograms for flaccid and erect penis length and circumference in up to 15,521 men, BJU International 115(6):978–986.",
        ],
        "disclaimer": "Параметры тела и увлечения не позволяют достоверно предсказать индивидуальный размер. Показанное среднее нельзя считать вашим результатом.",
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
    body_fat_pct: float = 24.0,
    standing_bust_cm: float = 0.0,
    leaning_bust_cm: float = 0.0,
    **_ignored: Any,
) -> dict[str, Any]:
    """Estimate bra-size starting point only from actual tape measurements.

    Cosmetic/lifestyle inputs are ignored. Cup sizing differs by manufacturer and
    national system; this offers an approximate EU starting size, not a diagnosis.
    """
    under = max(50.0, min(140.0, float(underbust_cm)))
    bust = max(0.0, min(180.0, float(standing_bust_cm)))
    if bust < under + 4:
        return {
            "result_kind": "measurements_required",
            "eu_size": None,
            "underbust_cm": round(under, 1),
            "bust_cm": None,
            "cup_difference_cm": None,
            "note": "Для ориентировочного размера измерьте обхват груди стоя по наиболее выступающим точкам, без сдавливания, и обхват под грудью на спокойном выдохе. Рост, возраст, бёдра, волосы и образ жизни размер чашки не предсказывают.",
            "methodology": "Начальная оценка по разнице обхвата груди и под грудью; посадка зависит от бренда, кроя, формы и эластичности изделия.",
            "disclaimer": "Размер белья — не медицинская характеристика и не оценка тела. Подбор по примерке/профессиональной консультации надёжнее онлайн-конверсии.",
        }

    # Approximate EU band convention. Brands and national standards vary.
    band = max(60, min(120, int(round(under / 5.0) * 5)))
    difference = max(0.0, bust - under)
    # Broad EU cup intervals (roughly 2 cm steps), shown as a starting point only.
    cup_table = [(10.0, "AA"), (12.0, "A"), (14.0, "B"), (16.0, "C"), (18.0, "D"), (20.0, "E"), (22.0, "F"), (24.0, "G"), (26.0, "H"), (99.0, "I+")]
    cup = next(letter for ceiling, letter in cup_table if difference < ceiling)
    return {
        "result_kind": "approximate_measurement_based_size",
        "eu_size": f"{band}{cup}",
        "eu_band": band,
        "eu_cup": cup,
        "underbust_cm": round(under, 1),
        "bust_cm": round(bust, 1),
        "cup_difference_cm": round(difference, 1),
        "sister_sizes": [f"{band-5}{cup} (возможен более плотный пояс)", f"{band+5}{cup} (возможен более свободный пояс)"] if 65 <= band <= 110 else [],
        "methodology": "Приблизительный стартовый размер по фактически введённым обхватам; таблицы и посадка отличаются по брендам и странам. Нужна примерка.",
        "disclaimer": "Не существует научно надёжной формулы вывода размера груди по возрасту, росту, рациону или увлечениям. Онлайн-оценка не является медицинским заключением.",
        "scientific_refs": ["EN 13402 — система обозначения размеров одежды; конкретная реализация размеров бюстгальтеров может отличаться по рынку и изготовителю."],
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
