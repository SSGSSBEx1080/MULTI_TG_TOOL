from __future__ import annotations

import base64
import codecs
import csv
import html
import io
import json
import os
import re
import time
import urllib.parse
import uuid
from datetime import datetime, timezone
from typing import Any

import yaml
from croniter import croniter

B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

MORSE_MAP: dict[str, str] = {
    "A": ".-", "B": "-...", "C": "-.-.", "D": "-..", "E": ".", "F": "..-.",
    "G": "--.", "H": "....", "I": "..", "J": ".---", "K": "-.-", "L": ".-..",
    "M": "--", "N": "-.", "O": "---", "P": ".--.", "Q": "--.-", "R": ".-.",
    "S": "...", "T": "-", "U": "..-", "V": "...-", "W": ".--", "X": "-..-",
    "Y": "-.--", "Z": "--..",
    "А": ".-", "Б": "-...", "В": ".--", "Г": "--.", "Д": "-..", "Е": ".", "Ё": ".",
    "Ж": "...-", "З": "--..", "И": "..", "Й": ".---", "К": "-.-", "Л": ".-..",
    "М": "--", "Н": "-.", "О": "---", "П": ".--.", "Р": ".-.", "С": "...",
    "Т": "-", "У": "..-", "Ф": "..-.", "Х": "....", "Ц": "-.-.", "Ч": "---.",
    "Ш": "----", "Щ": "--.-", "Ъ": "--.--", "Ы": "-.--", "Ь": "-..-", "Э": "..-..",
    "Ю": "..--", "Я": ".-.-",
    "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-",
    "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
    ".": ".-.-.-", ",": "--..--", "?": "..--..", "!": "-.-.--", "-": "-....-",
    "/": "-..-.", "@": ".--.-.", " ": "/",
}
MORSE_REV_RU: dict[str, str] = {
    v: k for k, v in MORSE_MAP.items() if ("А" <= k <= "Я") or k.isdigit() or k in ".,?!-/@ "
}
MORSE_REV_EN: dict[str, str] = {
    v: k for k, v in MORSE_MAP.items() if ("A" <= k <= "Z") or k.isdigit() or k in ".,?!-/@ "
}


def b58encode(data: bytes) -> str:
    num = int.from_bytes(data, "big")
    res = []
    while num > 0:
        num, rem = divmod(num, 58)
        res.append(B58_ALPHABET[rem])
    leading_zeros = len(data) - len(data.lstrip(b"\x00"))
    return "1" * leading_zeros + "".join(reversed(res))


def b58decode(encoded: str) -> bytes:
    num = 0
    for ch in encoded.strip():
        idx = B58_ALPHABET.find(ch)
        if idx == -1:
            raise ValueError(f"Недопустимый символ Base58: {ch}")
        num = num * 58 + idx
    byte_len = (num.bit_length() + 7) // 8
    raw = num.to_bytes(byte_len, "big") if byte_len else b""
    leading_ones = len(encoded) - len(encoded.lstrip("1"))
    return b"\x00" * leading_ones + raw


def format_convert_data(
    raw_text: str,
    source_fmt: str = "auto",
    target_fmt: str = "json_pretty",
) -> dict[str, Any]:
    text = (raw_text or "").strip()
    if not text:
        raise ValueError("Пустые входные данные")

    parsed: Any = None
    detected = source_fmt
    if source_fmt in ("auto", "json"):
        try:
            parsed = json.loads(text)
            detected = "json"
        except Exception:
            if source_fmt == "json":
                raise ValueError("Невалидный JSON синтаксис")

    if parsed is None and source_fmt in ("auto", "csv") and "," in text and "\n" in text and not text.startswith(("{", "[", "---")):
        try:
            reader = csv.DictReader(io.StringIO(text))
            rows = list(reader)
            if rows and reader.fieldnames and len(reader.fieldnames) >= 2:
                parsed = rows
                detected = "csv"
        except Exception:
            pass

    if parsed is None:
        try:
            parsed = yaml.safe_load(text)
            detected = "yaml"
        except Exception as exc:
            raise ValueError(f"Не удалось разобрать JSON/YAML/CSV: {exc}") from exc

    if target_fmt == "json_min":
        output = json.dumps(parsed, ensure_ascii=False, separators=(",", ":"))
    elif target_fmt == "yaml":
        output = yaml.safe_dump(parsed, allow_unicode=True, sort_keys=False).strip()
    elif target_fmt == "csv":
        if isinstance(parsed, list) and parsed and isinstance(parsed[0], dict):
            buf = io.StringIO()
            keys = list(parsed[0].keys())
            writer = csv.DictWriter(buf, fieldnames=keys)
            writer.writeheader()
            for item in parsed:
                writer.writerow({k: item.get(k, "") for k in keys})
            output = buf.getvalue().strip()
        else:
            raise ValueError("Конвертация в CSV требует список объектов (массив словарей)")
    else:
        output = json.dumps(parsed, ensure_ascii=False, indent=2)

    summary = {
        "detected_format": detected.upper(),
        "root_type": type(parsed).__name__,
        "items_count": len(parsed) if isinstance(parsed, (list, dict)) else 1,
        "output_chars": len(output),
    }
    return {"output": output, "summary": summary}


def evaluate_regex(
    pattern: str,
    test_text: str,
    flags_str: str = "im",
    replace_with: str | None = None,
) -> dict[str, Any]:
    if not pattern:
        raise ValueError("Регулярное выражение пусто")
    flags = 0
    if "i" in flags_str.lower():
        flags |= re.IGNORECASE
    if "m" in flags_str.lower():
        flags |= re.MULTILINE
    if "s" in flags_str.lower():
        flags |= re.DOTALL

    try:
        compiled = re.compile(pattern, flags)
    except re.error as exc:
        raise ValueError(f"Ошибка в регулярном выражении: {exc}") from exc

    matches = []
    for idx, m in enumerate(compiled.finditer(test_text or ""), start=1):
        if idx > 50:
            break
        matches.append(
            {
                "index": idx,
                "match": m.group(0),
                "span": [m.start(), m.end()],
                "groups": list(m.groups()),
                "named_groups": m.groupdict(),
            }
        )

    replaced = compiled.sub(replace_with, test_text or "") if replace_with is not None else None
    return {
        "count": len(matches),
        "matches": matches,
        "replaced": replaced,
    }


def transform_codec(text: str, codec_name: str = "base64", direction: str = "encode") -> str:
    val = text or ""
    c = codec_name.lower().strip()
    enc = direction.lower().strip() != "decode"

    if c == "base64":
        if enc:
            return base64.b64encode(val.encode("utf-8")).decode("ascii")
        pad = "=" * ((4 - len(val.strip()) % 4) % 4)
        return base64.b64decode(val.strip() + pad).decode("utf-8", errors="replace")

    if c == "base58":
        if enc:
            return b58encode(val.encode("utf-8"))
        return b58decode(val).decode("utf-8", errors="replace")

    if c == "hex":
        if enc:
            return val.encode("utf-8").hex(" ")
        cleaned = re.sub(r"[^0-9a-fA-F]", "", val)
        return bytes.fromhex(cleaned).decode("utf-8", errors="replace")

    if c == "url":
        return urllib.parse.quote(val, safe="") if enc else urllib.parse.unquote(val)

    if c == "html":
        return html.escape(val) if enc else html.unescape(val)

    if c == "binary":
        if enc:
            return " ".join(f"{b:08b}" for b in val.encode("utf-8"))
        bits = re.sub(r"[^01]", "", val)
        if len(bits) % 8 != 0:
            raise ValueError("Длина бинарной строки должна быть кратна 8 битам")
        raw = bytes(int(bits[i : i + 8], 2) for i in range(0, len(bits), 8))
        return raw.decode("utf-8", errors="replace")

    if c in ("morse", "morse_ru", "morse_en"):
        if enc:
            return " ".join(MORSE_MAP.get(ch.upper(), "?") for ch in val)
        rev = MORSE_REV_EN if c == "morse_en" else MORSE_REV_RU
        tokens = val.strip().split()
        return "".join(" " if t == "/" else rev.get(t, MORSE_REV_EN.get(t, "?")) for t in tokens)

    if c == "rot13":
        return codecs.encode(val, "rot_13")

    raise ValueError(f"Неизвестный кодек: {codec_name}")


def explain_cron(expr: str) -> dict[str, Any]:
    clean = " ".join((expr or "").strip().split())
    parts = clean.split(" ")
    if len(parts) != 5:
        raise ValueError("Cron-выражение должно состоять из 5 полей: мин часы день месяц день_недели")

    now = datetime.now(timezone.utc)
    try:
        it = croniter(clean, now)
        next_runs = [it.get_next(datetime).strftime("%Y-%m-%d %H:%M UTC") for _ in range(5)]
    except Exception as exc:
        raise ValueError(f"Некорректное Cron-выражение: {exc}") from exc

    minute, hour, dom, month, dow = parts
    pieces: list[str] = []
    if minute == "*":
        pieces.append("каждую минуту")
    elif minute.startswith("*/"):
        pieces.append(f"каждые {minute[2:]} мин.")
    else:
        pieces.append(f"в {minute} мин.")

    if hour == "*":
        pieces.append("каждого часа")
    elif hour.startswith("*/"):
        pieces.append(f"каждые {hour[2:]} ч.")
    elif "-" in hour:
        pieces.append(f"с {hour.split('-')[0]}:00 до {hour.split('-')[1]}:59")
    else:
        pieces.append(f"в {hour} ч.")

    dow_names = {
        "0": "Вс", "7": "Вс", "1": "Пн", "2": "Вт", "3": "Ср",
        "4": "Чт", "5": "Пт", "6": "Сб", "1-5": "по будням (Пн–Пт)", "6,0": "по выходным",
    }
    if dow != "*":
        pieces.append(dow_names.get(dow, f"дни недели: {dow}"))
    if dom != "*":
        pieces.append(f"числа месяца: {dom}")
    if month != "*":
        pieces.append(f"месяцы: {month}")

    return {
        "expression": clean,
        "human_ru": "Запуск " + ", ".join(pieces),
        "fields": {"minute": minute, "hour": hour, "day_of_month": dom, "month": month, "day_of_week": dow},
        "next_runs": next_runs,
    }


def _uuid7() -> str:
    ms = int(time.time() * 1000) & ((1 << 48) - 1)
    rand_a = int.from_bytes(os.urandom(2), "big") & 0x0FFF
    rand_b = int.from_bytes(os.urandom(8), "big") & ((1 << 62) - 1)
    val = (ms << 80) | (0x7 << 76) | (rand_a << 64) | (0b10 << 62) | rand_b
    hx = f"{val:032x}"
    return f"{hx[:8]}-{hx[8:12]}-{hx[12:16]}-{hx[16:20]}-{hx[20:]}"


def _ulid() -> str:
    alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
    ms = int(time.time() * 1000) & ((1 << 48) - 1)
    rnd = int.from_bytes(os.urandom(10), "big")
    combined = (ms << 80) | rnd
    chars = []
    for _ in range(26):
        chars.append(alphabet[combined & 31])
        combined >>= 5
    return "".join(reversed(chars))


def generate_ids_and_timestamps(kind: str = "uuid4", count: int = 5, ts_input: str = "") -> dict[str, Any]:
    count = max(1, min(count, 25))
    k = kind.lower().strip()
    if k == "uuid7":
        items = [_uuid7() for _ in range(count)]
    elif k == "ulid":
        items = [_ulid() for _ in range(count)]
    elif k == "uuid1":
        items = [str(uuid.uuid1()) for _ in range(count)]
    else:
        items = [str(uuid.uuid4()) for _ in range(count)]

    now_ts = int(time.time())
    parsed_time: dict[str, Any] = {
        "unix_sec": now_ts,
        "unix_ms": now_ts * 1000,
        "iso_utc": datetime.fromtimestamp(now_ts, tz=timezone.utc).isoformat(),
    }
    if ts_input.strip():
        raw_t = ts_input.strip()
        if raw_t.lstrip("-").isdigit():
            val = int(raw_t)
            if abs(val) > 10_000_000_000:
                val = val // 1000
            dt = datetime.fromtimestamp(val, tz=timezone.utc)
            parsed_time = {
                "unix_sec": val,
                "unix_ms": val * 1000,
                "iso_utc": dt.isoformat(),
                "human": dt.strftime("%d.%m.%Y %H:%M:%S UTC"),
            }
        else:
            dt = datetime.fromisoformat(raw_t.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            sec = int(dt.timestamp())
            parsed_time = {
                "unix_sec": sec,
                "unix_ms": sec * 1000,
                "iso_utc": dt.astimezone(timezone.utc).isoformat(),
                "human": dt.astimezone(timezone.utc).strftime("%d.%m.%Y %H:%M:%S UTC"),
            }

    return {"kind": k, "ids": items, "time_info": parsed_time}
