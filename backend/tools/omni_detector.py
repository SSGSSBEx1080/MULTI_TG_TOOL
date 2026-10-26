from __future__ import annotations

import json
import re
from typing import Any

from backend.tools.dev_tools import explain_cron
from backend.tools.knowledge_hub import query_population
from backend.tools.qr_studio import inspect_qr_payload
from backend.tools.rhyme_and_links import generate_russian_rhymes
from backend.tools.security_lab import identify_hash, inspect_jwt
from backend.tools.smart_calc import calculate_subnet, evaluate_math
from backend.tools.smart_units_nlp import smart_parse_and_convert
from backend.tools.text_studio import analyze_and_diff_text, fix_keyboard_layout

RU_VOWELS = set("аеёиоуыэюя")
COMMON_RU_BIGRAMS = {
    "пр", "ри", "ив", "ве", "ет", "ст", "то", "на", "ка", "ко", "не", "по",
    "ра", "ов", "ни", "го", "ро", "де", "ел", "ла", "ак", "ен", "но", "ва",
    "ли", "ре", "ос", "от", "ми", "ир", "бр", "зд", "др", "спа", "си", "бо",
}


def _looks_like_wrong_layout(text: str) -> str | None:
    if len(text) < 4 or "://" in text or text.startswith("/"):
        return None
    latin_letters = [c for c in text if "a" <= c.lower() <= "z"]
    if len(latin_letters) < 4:
        return None
    converted = fix_keyboard_layout(text, "en_to_ru")["en_to_ru"]
    low = converted.lower()
    cyr_letters = [c for c in low if "а" <= c <= "я" or c == "ё"]
    if len(cyr_letters) < 4:
        return None

    vowels = sum(1 for c in cyr_letters if c in RU_VOWELS)
    vowel_ratio = vowels / len(cyr_letters)
    if not (0.20 <= vowel_ratio <= 0.72):
        return None

    en_vowels = sum(1 for c in latin_letters if c.lower() in "aeiouy")
    bigram_hits = sum(1 for i in range(len(low) - 1) if low[i : i + 2] in COMMON_RU_BIGRAMS)

    if en_vowels == 0 or bigram_hits >= max(1, len(cyr_letters) // 5):
        return converted
    return None


def _summarize_omni_output(payload: dict[str, Any]) -> dict[str, Any]:
    kind = payload.get("kind", "")
    res = payload.get("result") or {}
    out = ""
    if kind == "math":
        bases = res.get("bases") or {}
        extra = f" ({bases['hex']})" if bases.get("hex") else ""
        out = f"= {res.get('formatted', res.get('result', ''))}{extra}"
    elif kind == "smart_unit":
        convs = res.get("conversions") or []
        out = " • ".join(f"{c['formatted']} {c['unit']}" for c in convs[:3])
    elif kind == "subnet":
        out = f"Сеть {res.get('network_address', '')} • Хостов: {res.get('usable_hosts', '')} ({res.get('first_host', '')} — {res.get('last_host', '')})"
    elif kind == "layout_fix":
        out = f"→ {res.get('fixed', '')}"
    elif kind == "rhyme":
        all_rh = (res.get("exact") or []) + (res.get("assonance") or [])
        out = ", ".join(all_rh[:8])
    elif kind == "population":
        places = res.get("places") or []
        if places:
            place = places[0]
            if place.get("pop") is None:
                out = f"{place['name']}: проверенное актуальное значение отсутствует в офлайн-справочнике."
            else:
                out = f"{place['name']}: {place['formatted_pop']} чел. (ориентир, год данных не указан)."
        else:
            out = "В офлайн-справочнике нет совпадения; значение населения не оценивалось."
    elif kind == "cron":
        out = str(res.get("human_ru") or res.get("description") or "")
    elif kind == "hash":
        out = ", ".join(res.get("algorithms") or [])
    elif kind == "jwt":
        hdr = res.get("header") or {}
        out = f"alg={hdr.get('alg', '?')} • valid_json={res.get('valid_structure', True)}"
    elif kind == "json":
        out = f"Элементов верхнего уровня: {res.get('items', 1)}"
    elif kind == "url_payload":
        out = str(res.get("summary") or res.get("raw") or "")
    elif kind == "nx1_cipher":
        out = str(payload.get("hint") or "AES-256-GCM контейнер")
    elif kind == "text":
        out = f"Символов: {res.get('chars', 0)} • Слов: {res.get('words', 0)}"
    payload["output"] = out
    return payload


def smart_omni_detect(text: str) -> dict[str, Any]:
    return _summarize_omni_output(_smart_omni_detect_inner(text))


def _smart_omni_detect_inner(text: str) -> dict[str, Any]:
    raw = (text or "").strip()
    if not raw:
        return {"kind": "empty", "title": "Пустой ввод", "result": {}}

    # 1. NX1 Encrypted Container
    if raw.startswith("NX1.") and len(raw) > 30:
        return {
            "kind": "nx1_cipher",
            "title": "🧬 Зашифрованный контейнер NX1 (AES-256-GCM)",
            "tool_id": "aes_cipher",
            "hint": "Для расшифровки откройте AES-шифратор и укажите пароль",
            "result": {"envelope_length": len(raw)},
        }

    # 2. JWT Token
    if re.fullmatch(r"eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*", raw):
        try:
            jwt_info = inspect_jwt(raw)
            return {
                "kind": "jwt",
                "title": "⏱️ Распознан JWT Токен",
                "tool_id": "jwt_totp",
                "result": jwt_info,
            }
        except Exception:
            pass

    # 3. IPv4 CIDR Subnet
    if re.fullmatch(r"(?:\d{1,3}\.){3}\d{1,3}(?:/\d{1,2})?", raw):
        try:
            sub = calculate_subnet(raw)
            return {
                "kind": "subnet",
                "title": f"🌐 IPv4 Подсеть {sub['cidr']}",
                "tool_id": "subnet_calc",
                "result": sub,
            }
        except Exception:
            pass

    # 4. JSON Object / Array
    if (raw.startswith("{") and raw.endswith("}")) or (raw.startswith("[") and raw.endswith("]")):
        try:
            parsed = json.loads(raw)
            pretty = json.dumps(parsed, ensure_ascii=False, indent=2)
            return {
                "kind": "json",
                "title": "🧩 Валидный JSON отформатирован",
                "tool_id": "json_yaml",
                "result": {"pretty": pretty[:2500], "items": len(parsed) if isinstance(parsed, (dict, list)) else 1},
            }
        except Exception:
            pass

    # 5. Cron expression
    parts = raw.split()
    if len(parts) == 5 and all(re.fullmatch(r"[\d\*,/\-]+", p) for p in parts):
        try:
            cron_info = explain_cron(raw)
            return {
                "kind": "cron",
                "title": "⚙️ Расписание Cron",
                "tool_id": "cron_uuid",
                "result": cron_info,
            }
        except Exception:
            pass

    # 5b. Smart Natural-Language Unit Conversion ("6 дюймов", "5 футов 11 дюймов", "100 миль в час")
    if re.search(r"\d", raw) and re.search(r"[A-Za-zА-Яа-яЁё°'\"]", raw) and "://" not in raw:
        try:
            unit_conv = smart_parse_and_convert(raw)
            return {
                "kind": "smart_unit",
                "title": f"📏 Умный конвертер: {unit_conv['parsed_display']}",
                "tool_id": "unit_converter",
                "result": unit_conv,
            }
        except Exception:
            pass

    # 5c. Natural-Language Rhyme Query ("рифма к любовь" / "рифма рассвет")
    m_rhyme = re.match(r"^(?:рифм[аыу]\s+(?:к\s+(?:слову\s+)?)?)([а-яёА-ЯЁ\-]+)$", raw, flags=re.IGNORECASE)
    if m_rhyme:
        try:
            rhyme_res = generate_russian_rhymes(m_rhyme.group(1))
            return {
                "kind": "rhyme",
                "title": f"🎤 Рифмы к слову «{rhyme_res['word']}»",
                "tool_id": "rhyme_gen",
                "result": rhyme_res,
            }
        except Exception:
            pass

    # 5d. Natural-Language Population Query ("население Токио" / "население Оймякон")
    m_pop = re.match(r"^население\s+(.+)$", raw, flags=re.IGNORECASE)
    if m_pop:
        pop_res = query_population(m_pop.group(1))
        return {
            "kind": "population",
            "title": f"🌍 Численность населения: {m_pop.group(1).strip()}",
            "tool_id": "population_hub",
            "result": pop_res,
        }

    # 6. Math Expression
    if re.search(r"[\d]", raw) and (
        re.search(r"[\+\-\*/\^%&\|<>]", raw)
        or any(fn in raw.lower() for fn in ("sqrt(", "sin(", "cos(", "log(", "fact(", "0x", "0b"))
    ):
        try:
            calc = evaluate_math(raw)
            return {
                "kind": "math",
                "title": f"📐 Вычисление: {calc['formatted']}",
                "tool_id": "smart_calc",
                "result": calc,
            }
        except Exception:
            pass

    # 7. Hex Hash digest
    if re.fullmatch(r"[0-9a-fA-F]{32,128}", raw):
        algos = identify_hash(raw)
        return {
            "kind": "hash",
            "title": f"#️⃣ Вероятный хеш: {', '.join(algos)}",
            "tool_id": "hash_lab",
            "result": {"algorithms": algos, "length": len(raw)},
        }

    # 8. URL / Wi-Fi / OTPAuth QR candidate
    if raw.lower().startswith(("http://", "https://", "wifi:", "otpauth://", "tg://")):
        info = inspect_qr_payload(raw)
        return {
            "kind": "url_payload",
            "title": f"🔗 {info['type']} — готов к генерации QR или сокращению",
            "tool_id": "qr_studio",
            "result": {**info, "raw": raw},
        }

    # 9. Wrong Keyboard Layout (Ghbdtn -> Привет)
    fixed_ru = _looks_like_wrong_layout(raw)
    if fixed_ru:
        return {
            "kind": "layout_fix",
            "title": "⌨️ Исправлена раскладка клавиатуры!",
            "tool_id": "layout_fixer",
            "result": {"original": raw, "fixed": fixed_ru},
        }

    # 10. General Text Stats + Quick Actions
    stats = analyze_and_diff_text(raw)["stats"]
    return {
        "kind": "text",
        "title": "✍️ Анализ текста и быстрые действия",
        "tool_id": "text_diff",
        "result": stats,
    }
