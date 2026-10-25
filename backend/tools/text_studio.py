from __future__ import annotations

import collections
import difflib
import re
import secrets
from typing import Any

EN_CHARS = (
    "`qwertyuiop[]asdfghjkl;'zxcvbnm,./"
    "~QWERTYUIOP{}ASDFGHJKL:\"ZXCVBNM<>?@#$^&"
)
RU_CHARS = (
    "ёйцукенгшщзхъфывапролджэячсмитьбю."
    "ЁЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮ,\"№;:?"
)

EN_TO_RU = str.maketrans(EN_CHARS, RU_CHARS)
RU_TO_EN = str.maketrans(RU_CHARS, EN_CHARS)

TRANSLIT_TABLE: dict[str, str] = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "yo",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}


def fix_keyboard_layout(text: str, direction: str = "auto") -> dict[str, str]:
    src = text or ""
    en_to_ru = src.translate(EN_TO_RU)
    ru_to_en = src.translate(RU_TO_EN)

    if direction == "en_to_ru":
        primary = en_to_ru
    elif direction == "ru_to_en":
        primary = ru_to_en
    else:
        latin_cnt = sum(1 for c in src if "a" <= c.lower() <= "z")
        cyr_cnt = sum(1 for c in src if "а" <= c.lower() <= "я" or c.lower() == "ё")
        primary = en_to_ru if latin_cnt >= cyr_cnt else ru_to_en

    # Transliteration + URL slug
    translit_chars: list[str] = []
    for ch in src:
        low = ch.lower()
        if low in TRANSLIT_TABLE:
            rep = TRANSLIT_TABLE[low]
            translit_chars.append(rep.capitalize() if ch.isupper() and rep else rep)
        else:
            translit_chars.append(ch)
    translit = "".join(translit_chars)
    slug = re.sub(r"[^a-z0-9]+", "-", translit.lower()).strip("-")

    return {
        "primary": primary,
        "en_to_ru": en_to_ru,
        "ru_to_en": ru_to_en,
        "translit": translit,
        "slug": slug,
    }


def _map_ascii(text: str, upper_start: int, lower_start: int, digit_start: int | None = None) -> str:
    out: list[str] = []
    for ch in text:
        o = ord(ch)
        if 65 <= o <= 90:
            out.append(chr(upper_start + (o - 65)))
        elif 97 <= o <= 122:
            out.append(chr(lower_start + (o - 97)))
        elif digit_start is not None and 48 <= o <= 57:
            out.append(chr(digit_start + (o - 48)))
        else:
            out.append(ch)
    return "".join(out)


SMALL_CAPS_MAP = str.maketrans(
    "abcdefghijklmnopqrstuvwxyzабвгдежзийклмнопрстуфхцчшщыэюя",
    "ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢᴀбʙгᴅᴇжзᴜйклмнопᴘᴄᴛуфхцчшщыэюя",
)


def stylize_text(text: str) -> dict[str, Any]:
    val = (text or "").strip()
    if not val:
        raise ValueError("Введите текст для стилизации")

    words = re.findall(r"[A-Za-zА-Яа-яЁё0-9]+", val)
    snake = "_".join(w.lower() for w in words)
    kebab = "-".join(w.lower() for w in words)
    pascal = "".join(w.capitalize() for w in words)
    camel = (words[0].lower() + "".join(w.capitalize() for w in words[1:])) if words else ""

    styles = {
        "Monospace": _map_ascii(val, 0x1D670, 0x1D68A, 0x1D7F6),
        "Bold Sans": _map_ascii(val, 0x1D5D4, 0x1D5EE, 0x1D7EC),
        "Italic Serif": _map_ascii(val, 0x1D434, 0x1D44E),
        "Script": _map_ascii(val, 0x1D49C, 0x1D4B6),
        "Small Caps (RU/EN)": val.lower().translate(SMALL_CAPS_MAP),
        "Bubble": _map_ascii(val, 0x24B6, 0x24D0),
        "Spaced Vapor": " ".join(list(val)),
        "Strikethrough": "".join(ch + "\u0336" if ch != " " else " " for ch in val),
        "TG Spoiler": f"||{val}||",
    }
    cases = {
        "snake_case": snake,
        "kebab-case": kebab,
        "camelCase": camel,
        "PascalCase": pascal,
        "SCREAMING_SNAKE": snake.upper(),
    }
    return {"styles": styles, "cases": cases}


def analyze_and_diff_text(text_a: str, text_b: str = "") -> dict[str, Any]:
    src = text_a or ""
    words = re.findall(r"[A-Za-zА-Яа-яЁё0-9-]+", src)
    sentences = [s for s in re.split(r"[.!?]+", src) if s.strip()]
    paragraphs = [p for p in src.split("\n\n") if p.strip()]

    freq = collections.Counter(w.lower() for w in words if len(w) > 2).most_common(8)
    unique_ratio = round((len(set(w.lower() for w in words)) / max(1, len(words))) * 100, 1)

    stats = {
        "chars_total": len(src),
        "chars_no_spaces": len(re.sub(r"\s+", "", src)),
        "words": len(words),
        "lines": len(src.splitlines()) or (1 if src else 0),
        "sentences": len(sentences),
        "paragraphs": len(paragraphs),
        "reading_time_sec": max(1, int(round((len(words) / 200.0) * 60))) if words else 0,
        "speaking_time_sec": max(1, int(round((len(words) / 130.0) * 60))) if words else 0,
        "lexical_diversity_pct": unique_ratio,
        "top_words": [{"word": w, "count": c} for w, c in freq],
    }

    diff_result: dict[str, Any] | None = None
    if text_b:
        a_lines = src.splitlines()
        b_lines = text_b.splitlines()
        unified = list(
            difflib.unified_diff(a_lines, b_lines, fromfile="До", tofile="После", lineterm="")
        )
        added = sum(1 for ln in unified if ln.startswith("+") and not ln.startswith("+++"))
        removed = sum(1 for ln in unified if ln.startswith("-") and not ln.startswith("---"))
        ratio = round(difflib.SequenceMatcher(None, src, text_b).ratio() * 100, 1)
        diff_result = {
            "similarity_pct": ratio,
            "added_lines": added,
            "removed_lines": removed,
            "unified_diff": "\n".join(unified[:120]),
        }

    return {"stats": stats, "diff": diff_result}


def run_randomizer(
    mode: str = "dice",
    dice_expr: str = "2d20+5",
    items_raw: str = "",
    teams_count: int = 2,
) -> dict[str, Any]:
    m = mode.lower().strip()
    if m == "coin":
        side = secrets.choice(["Орёл 🦅", "Решка 🪙"])
        return {"mode": "coin", "result": side}

    if m == "dice":
        clean = (dice_expr or "1d6").strip().lower().replace(" ", "")
        match = re.fullmatch(r"(\d*)d(\d+)([+-]\d+)?", clean)
        if not match:
            raise ValueError("Формат броска: NdM+K (например: 2d20+5, d100, 4d6-1)")
        cnt = int(match.group(1) or "1")
        sides = int(match.group(2))
        mod = int(match.group(3) or "0")
        cnt = max(1, min(cnt, 50))
        sides = max(2, min(sides, 10000))
        rolls = [secrets.randbelow(sides) + 1 for _ in range(cnt)]
        total = sum(rolls) + mod
        return {
            "mode": "dice",
            "expression": f"{cnt}d{sides}{f'{mod:+d}' if mod else ''}",
            "rolls": rolls,
            "modifier": mod,
            "total": total,
        }

    items = [
        x.strip()
        for x in re.split(r"[\n,;]+", items_raw or "")
        if x.strip()
    ]
    if not items:
        raise ValueError("Передайте список элементов через запятую или с новой строки")

    if m == "pick":
        winner = secrets.choice(items)
        return {"mode": "pick", "total_candidates": len(items), "winner": winner}

    if m == "teams":
        k = max(2, min(int(teams_count), len(items)))
        shuffled = list(items)
        secrets.SystemRandom().shuffle(shuffled)
        teams: list[list[str]] = [[] for _ in range(k)]
        for idx, person in enumerate(shuffled):
            teams[idx % k].append(person)
        return {"mode": "teams", "teams_count": k, "teams": teams}

    raise ValueError(f"Неизвестный режим рандомайзера: {mode}")
