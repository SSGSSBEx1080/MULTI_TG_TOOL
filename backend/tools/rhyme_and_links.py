from __future__ import annotations

import io
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from PIL import Image, ImageOps

VOWELS = set("аеёиоуыэюя")

# Богатый поэтический и разговорный корпус русских слов для точного и ассонансного подбора рифм
RUSSIAN_POETIC_CORPUS: list[str] = [
    # Любовь / чувства / лирика
    "любовь", "кровь", "вновь", "бровь", "морковь", "свекровь", "готовь", "прекословь",
    "мечта", "красота", "высота", "пустота", "чистота", "теплота", "доброта", "темнота", "суета", "маята", "немота", "простота", "нагота",
    "сердце", "дверца", "перцем", "согреться", "одеться", "увидеться", "надеяться",
    "душа", "спеша", "дыша", "хороша", "малыша", "тиша", "гроша", "камыша", "не спеша",
    "ночь", "дочь", "прочь", "помочь", "превозмочь", "точь-в-точь",
    "свет", "рассвет", "ответ", "привет", "секрет", "сюжет", "силуэт", "портрет", "запрет", "билет", "поэт", "куплет", "комет", "планет", "монет", "совет", "обет", "букет", "паркет", "интернет",
    "день", "тень", "лень", "сирень", "ступень", "мишень", "олень", "кремень", "бюллетень",
    "мир", "пир", "эфир", "кумир", "ориентир", "командир", "пассажир", "сувенир", "турнир", "зефир", "кассир", "банкир", "вампир", "сапфир",
    "друг", "круг", "вдруг", "испуг", "недуг", "досуг", "вокруг", "супруг", "вьюг", "заслуг", "подруг",
    "враг", "шаг", "флаг", "овраг", "аншлаг", "рычаг", "очаг", "зигзаг", "архипелаг", "благ", "бумаг", "отваг",
    "путь", "суть", "чуть-чуть", "грудь", "ртуть", "муть", "уснуть", "взглянуть", "шагнуть", "рискнуть", "вернуть", "обмануть", "вздохнуть", "перевернуть",
    "взгляд", "ряд", "яд", "заряд", "наряд", "парад", "звездопад", "водопад", "листопад", "невпопад", "назад", "сад", "клад", "шоколад", "маскарад", "ленинград",
    "огонь", "ладонь", "гармонь", "конь", "бронь", "не тронь", "оборонь", "погонь",
    "вода", "года", "звезда", "навсегда", "никогда", "иногда", "города", "поезда", "холода", "провода", "ерунда", "череда", "слобода", "лебеда", "беда", "среда", "туда", "сюда",
    "ветер", "вечер", "пепел", "светел", "встретил", "заметил", "ответил", "беспечен", "бесконечен", "вечен",
    "дождь", "вождь", "дрожь", "ложь", "молодёжь", "не трожь", "похож", "нож",
    "снег", "бег", "век", "человек", "ковчег", "разбег", "ночлег", "оберег", "стратег", "побег", "аптек", "библиотек",
    "дом", "гром", "альбом", "перелом", "фантом", "паром", "аэродром", "космодром", "синдром", "потом", "кругом", "пешком", "тайком", "целиком", "огнём", "вдвоём",
    "море", "горе", "вскоре", "на просторе", "в споре", "априори", "коридоре", "светофоре", "мониторе",
    "небо", "не был", "хлеба", "слепо", "нелепо", "свирепо",
    "время", "бремя", "племя", "семя", "стремя", "темя",
    "жизнь", "каприз", "сюрприз", "карниз", "круиз", "девиз", "анализ", "парадиз", "держись", "вернись", "улыбнись", "проснись",
    "голос", "колос", "волос", "полюс", "хворост", "скорость", "молодость", "гордость", "пропасть", "новость",
    "глаза", "гроза", "слеза", "тормоза", "нельзя", "паруса", "чудеса", "небеса", "голоса", "полоса",
    "руки", "звуки", "муки", "разлуки", "науки", "скуки", "трюки", "перестуки",
    "слово", "снова", "готово", "сурово", "основа", "окова", "подкова", "обнова", "бестолково",
    # Город / киберпанк / код / современность / рэп
    "код", "вход", "ход", "год", "лёд", "мёд", "полёт", "пилот", "восход", "небосвод", "горизонт", "патриот", "идиот", "оборот", "эпизод", "кислород", "водород", "пароход", "хоровод",
    "сеть", "медь", "плеть", "петь", "лететь", "гореть", "смотреть", "терпеть", "успеть", "стереть", "умереть", "взлететь", "одеревенеть",
    "экран", "туман", "обман", "океан", "ураган", "капитан", "караван", "талисман", "капкан", "вулкан", "стакан", "карман", "роман", "хулиган", "партизан", "меломан", "титан",
    "бит", "щит", "магнит", "зенит", "гранит", "динамит", "метеорит", "фаворит", "алгоритм", "монолит", "спутник", "болит", "летит", "молчит", "звучит", "горит",
    "стиль", "пыль", "быль", "штиль", "миль", "автомобиль", "утиль", "ваниль", "текстиль",
    "игра", "искра", "жара", "пора", "утра", "серебра", "костра", "ветра", "мастера", "вечера", "номера", "сервера",
    "деньги", "ступеньки", "оттенки", "коленки", "оценки", "стенки",
    "успех", "смех", "грех", "всех", "орех", "доспех", "помех", "утех", "мех", "наверх",
    "сила", "крылья", "светила", "могила", "стихия", "манила", "хранила", "любила", "простила", "забыла", "накрыла",
    "правда", "завтра", "награда", "преграда", "прохлада", "баллада", "эстрада", "засада", "торнадо", "не надо",
    "свобода", "природа", "погода", "порода", "восхода", "народа", "периода", "небосвода",
    "тишина", "глубина", "вышина", "волна", "луна", "весна", "война", "струна", "стена", "сторона", "пелена", "седина", "вина", "одна", "сполна", "до дна",
    "память", "пламя", "знамя", "камни", "ставни", "недавний", "главный", "славный", "плавный",
    "разум", "сразу", "фразу", "алмазом", "экстазом", "приказом", "рассказом", "зараза",
    "момент", "фрагмент", "элемент", "аргумент", "эксперимент", "комплимент", "инструмент", "континент", "абонент", "монумент", "документ", "президент", "конкурент",
    "система", "проблема", "теорема", "дилемма", "поэма", "эмблема", "схема", "тема", "богема",
    "машина", "вершина", "лавина", "картина", "витрина", "рутина", "причина", "мужчина", "половина", "паутина", "чужбина", "гардина",
    "улица", "хмурится", "сбудется", "забудется", "умница", "бессонница", "путница",
    "весна", "сна", "красна", "ясна", "тесна", "сосна", "новизна", "белизна",
    "осень", "просим", "бросим", "восемь", "проседь", "уносит", "спросит",
    "лето", "где-то", "рассвета", "комета", "планета", "кассета", "газета", "монета", "примета", "ракета", "конфета", "котлета", "ответа", "сюжета",
    "зима", "тьма", "ума", "дома", "терема", "кутерьма", "тюрьма", "весьма", "сама", "письма",
    # Дополнительные частые окончания (-ция, -ость, -ение, -ать, -ить, -ой, -ий)
    "станция", "дистанция", "гравитация", "ситуация", "информация", "мотивация", "интонация", "комбинация", "революция", "иллюстрация", "навигация", "сенсация",
    "радость", "сладость", "младость", "слабость", "храбрость", "мудрость", "дерзость", "скорость", "вечность", "бесконечность", "беспечность", "человечность", "нежность", "верность",
    "движение", "притяжение", "отражение", "воображение", "напряжение", "сражение", "кружение", "продолжение", "вдохновение", "мгновение", "сомнение", "забвение", "терпение", "спасение",
    "герой", "покой", "прибой", "живой", "чужой", "родной", "земной", "ночной", "стеной", "весной", "домой", "прямой", "немой", "золотой", "молодой", "заводной", "выходной",
    "синий", "иней", "линий", "алюминий", "гений", "мнений", "течений", "приключений",
    "красный", "ясный", "опасный", "прекрасный", "напрасный", "страстный", "властный", "бесстрашный",
    "белый", "смелый", "целый", "умелый", "спелый", "озверелый", "загорелый", "пределы", "стрелы",
    "чёрный", "упорный", "просторный", "проворный", "иллюзорный", "бесспорный", "горный",
    "писать", "искать", "дышать", "молчать", "кричать", "мечтать", "летать", "бежать", "держать", "терять", "прощать", "обещать", "встречать", "начинать", "забывать", "понимать", "обнимать", "побеждать", "создавать",
    "любить", "жить", "быть", "плыть", "забыть", "открыть", "простить", "хранить", "ценить", "творить", "говорить", "подарить", "повторить", "остановить", "изменить",
    "знаю", "мечтаю", "скучаю", "летаю", "сгораю", "таю", "прощаю", "обещаю", "вспоминаю", "начинаю", "понимаю", "обнимаю", "краю", "раю",
    "кошка", "окошко", "немножко", "дорожка", "ладошка", "гармошка", "матрёшка", "картошка", "серёжка", "обложка",
    "чай", "край", "рай", "май", "трамвай", "урожай", "невзначай", "прощай", "встречай", "обещай", "выручай", "не скучай", "отвечай", "замечай",
    "роза", "гроза", "мороза", "проза", "поза", "заноза", "мимоза", "угроза", "гипноза", "прогноза", "метаморфоза", "виртуоза",
    "звёзды", "поздно", "грозно", "серьёзно", "морозно", "слёзно", "вёсны", "сосны",
]


def count_syllables(word: str) -> int:
    return sum(1 for ch in word.lower() if ch in VOWELS)


def phonetic_tail(word: str) -> str:
    """Нормализует фонетическое окончание русского слова (оглушение конца, мягкие гласные, ться/тся)."""
    w = word.strip().lower().replace("ё", "о")
    w = "".join(ch for ch in w if ch.isalpha() or ch == "-")
    w = w.replace("-", "")
    if not w:
        return ""
    if w.endswith("ться") or w.endswith("тся"):
        w = w[:-4] + "ца"
    # Финальное оглушение звонких согласных в русском языке
    devoice = {"б": "п", "в": "ф", "г": "к", "д": "т", "ж": "ш", "з": "с"}
    if w[-1] in devoice:
        w = w[:-1] + devoice[w[-1]]
    elif len(w) >= 2 and w[-1] == "ь" and w[-2] in devoice:
        w = w[:-2] + devoice[w[-2]] + "ь"
    # Сближение йотированных гласных после согласных для рифмы
    soft_vowels = {"я": "а", "ю": "у", "е": "э", "ы": "и"}
    chars = list(w)
    for i in range(max(0, len(chars) - 4), len(chars)):
        if chars[i] in soft_vowels and i > 0 and chars[i - 1] not in VOWELS:
            chars[i] = soft_vowels[chars[i]]
    return "".join(chars)


def vowel_skeleton(word: str) -> str:
    norm = phonetic_tail(word)
    return "".join(ch for ch in norm if ch in set("аоуэиыеёюя"))


def generate_russian_rhymes(word: str) -> dict[str, Any]:
    target = (word or "").strip().lower()
    clean_target = "".join(ch for ch in target if ch.isalpha() or ch == "-")
    if not clean_target:
        raise ValueError("Введите русское слово для подбора рифм (например: любовь, рассвет, звезда, код).")

    t_phon = phonetic_tail(clean_target)
    t_vowels = vowel_skeleton(clean_target)
    t_syll = max(1, count_syllables(clean_target))

    exact_rhymes: list[str] = []
    assonance_rhymes: list[str] = []
    verb_morph_rhymes: list[str] = []
    seen = {clean_target}

    verb_endings = ("ть", "ться", "тся", "ал", "ала", "али", "ил", "ила", "или", "ую", "аю", "яю")

    for cand in RUSSIAN_POETIC_CORPUS:
        c_clean = cand.lower()
        if c_clean in seen:
            continue
        c_phon = phonetic_tail(c_clean)
        c_vowels = vowel_skeleton(c_clean)
        c_syll = max(1, count_syllables(c_clean))

        is_verbish = c_clean.endswith(verb_endings)

        # 1. Точное совпадение 3+ финальных фонем (или всего слова, если оно короткое)
        min_exact = 3 if len(t_phon) >= 3 else len(t_phon)
        if len(c_phon) >= min_exact and c_phon[-min_exact:] == t_phon[-min_exact:]:
            seen.add(c_clean)
            if is_verbish and not clean_target.endswith(verb_endings):
                verb_morph_rhymes.append(cand)
            else:
                exact_rhymes.append(cand)
            continue

        # 2. Созвучие 2 финальных фонем + совпадение последней ударной/заударной гласной
        if len(t_phon) >= 2 and len(c_phon) >= 2 and c_phon[-2:] == t_phon[-2:]:
            seen.add(c_clean)
            if is_verbish:
                verb_morph_rhymes.append(cand)
            else:
                assonance_rhymes.append(cand)
            continue

        # 3. Ассонанс по гласному скелету последних 2 слогов и близкой длине
        if len(t_vowels) >= 2 and len(c_vowels) >= 2 and c_vowels[-2:] == t_vowels[-2:] and abs(c_syll - t_syll) <= 1:
            if t_phon[-1] == c_phon[-1] or (t_phon[-1] in VOWELS and c_phon[-1] in VOWELS):
                seen.add(c_clean)
                assonance_rhymes.append(cand)

    # Сортируем каждую группу так, чтобы слова с близким числом слогов шли первыми!
    exact_rhymes.sort(key=lambda x: (abs(count_syllables(x) - t_syll), len(x)))
    assonance_rhymes.sort(key=lambda x: (abs(count_syllables(x) - t_syll), len(x)))
    verb_morph_rhymes.sort(key=lambda x: (abs(count_syllables(x) - t_syll), len(x)))

    # Если слово редкое и точных рифм мало, генерируем продуктивные русские словоформы-созвучия
    if len(exact_rhymes) < 4 and len(t_phon) >= 2:
        tail2 = clean_target[-2:]
        synthetic_roots = ["пере", "недо", "полу", "сверх", "анти"]
        for pref in synthetic_roots[:2]:
            if not clean_target.startswith(pref):
                assonance_rhymes.append(f"{pref}{clean_target}")

    # Генерируем двойные панч-рифмы и мини-четверостишие для вдохновения
    best_rhyme = (exact_rhymes or assonance_rhymes or verb_morph_rhymes or ["вновь"])[0]
    second_rhyme = (exact_rhymes[1:2] or assonance_rhymes[:1] or ["тишина"])[0]
    double_rhymes = [
        f"мой {clean_target} — сквозь {best_rhyme}",
        f"вечный {clean_target} — яркий {second_rhyme}",
        f"тихий {clean_target} — новый {best_rhyme}",
    ]

    sample_quatrain = (
        f"Сквозь шум ночной звучит «{clean_target}»,\n"
        f"Меняя ритмы наших дней,\n"
        f"И отзывается «{best_rhyme}»\n"
        f"В сиянии городских огней."
    )

    return {
        "word": clean_target,
        "syllables": t_syll,
        "phonetic_ending": f"-{t_phon[-3:]}" if len(t_phon) >= 3 else f"-{t_phon}",
        "exact_rhymes": exact_rhymes[:24],
        "assonance_rhymes": assonance_rhymes[:24],
        "verb_rhymes": verb_morph_rhymes[:18],
        "double_punch_rhymes": double_rhymes,
        "sample_quatrain": sample_quatrain,
        "total_found": len(exact_rhymes) + len(assonance_rhymes) + len(verb_morph_rhymes),
    }


# ==============================================================================
# 2. Декодер QR-кодов по Изображению (OpenCV + многоступенчатый препроцессинг)
# ==============================================================================
def decode_qr_from_bytes(image_bytes: bytes) -> dict[str, Any]:
    if not image_bytes:
        raise ValueError("Файл изображения пуст.")

    import cv2
    import numpy as np

    cv2.setNumThreads(1)

    pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    orig_w, orig_h = pil_img.size
    if max(orig_w, orig_h) > 1600:
        pil_img.thumbnail((1600, 1600), Image.Resampling.BILINEAR)

    rgb_np = np.array(pil_img)
    bgr_np = cv2.cvtColor(rgb_np, cv2.COLOR_RGB2BGR)
    gray_np = cv2.cvtColor(bgr_np, cv2.COLOR_BGR2GRAY)

    detector = cv2.QRCodeDetector()

    def _iter_candidates():
        yield "original", bgr_np
        yield "grayscale_autocontrast", np.array(ImageOps.autocontrast(pil_img.convert("L")))
        yield "inverted", cv2.bitwise_not(gray_np)
        yield "otsu_threshold", cv2.threshold(gray_np, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
        if max(gray_np.shape) <= 900:
            yield "upscaled_2x", cv2.resize(gray_np, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)

    decoded_items: list[str] = []
    used_method = "original"

    for method_name, mat in _iter_candidates():
        try:
            ok, texts, _, _ = detector.detectAndDecodeMulti(mat)
            if ok and texts:
                valid = [t.strip() for t in texts if t and t.strip()]
                if valid:
                    decoded_items = valid
                    used_method = method_name
                    break
        except Exception:
            pass

        try:
            single_text, _, _ = detector.detectAndDecode(mat)
            if single_text and single_text.strip():
                decoded_items = [single_text.strip()]
                used_method = method_name
                break
        except Exception:
            pass

    if not decoded_items:
        return {
            "found": False,
            "count": 0,
            "results": [],
            "image_size": f"{orig_w}×{orig_h}",
            "message": "QR-код на изображении не обнаружен. Проверьте чёткость и контрастность картинки.",
        }

    primary = decoded_items[0]
    kind = "Ссылка (URL)" if primary.startswith(("http://", "https://")) else (
        "Wi-Fi профиль" if primary.startswith("WIFI:") else (
            "Визитка vCard" if "BEGIN:VCARD" in primary else "Текст / Данные"
        )
    )
    return {
        "found": True,
        "count": len(decoded_items),
        "primary": primary,
        "results": decoded_items,
        "content_type": kind,
        "method": used_method,
        "image_size": f"{orig_w}×{orig_h}",
    }


# ==============================================================================
# 3. Очистка, Инспекция и Трансформация Ссылок (URL Cleaner & Formatter)
# ==============================================================================
TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "utm_id", "fbclid", "gclid", "yclid", "ymclid", "mc_cid", "mc_eid",
    "igshid", "si", "_openstat", "spm", "ref_src", "ref_url",
}


def inspect_and_clean_url(raw_url: str) -> dict[str, Any]:
    u = (raw_url or "").strip()
    if not u:
        raise ValueError("Введите ссылку (например: https://youtube.com/...)")
    if not u.startswith(("http://", "https://")):
        u = "https://" + u

    parsed = urlparse(u)
    if not parsed.netloc or "." not in parsed.netloc and "localhost" not in parsed.netloc:
        raise ValueError("Некорректный формат URL-адреса.")

    orig_params = parse_qsl(parsed.query, keep_blank_values=True)
    removed: list[str] = []
    kept: list[tuple[str, str]] = []
    for k, v in orig_params:
        if k.lower() in TRACKING_PARAMS or k.lower().startswith("utm_"):
            removed.append(k)
        else:
            kept.append((k, v))

    clean_query = urlencode(kept, doseq=True)
    cleaned_url = urlunparse((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        clean_query,
        parsed.fragment,
    ))

    return {
        "original_url": u,
        "cleaned_url": cleaned_url,
        "domain": parsed.netloc,
        "scheme": parsed.scheme,
        "path": parsed.path or "/",
        "removed_trackers": removed,
        "saved_chars": len(u) - len(cleaned_url),
        "is_https": parsed.scheme == "https",
    }
