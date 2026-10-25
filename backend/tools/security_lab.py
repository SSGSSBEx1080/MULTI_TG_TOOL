from __future__ import annotations

import base64
import hashlib
import hmac
import json
import math
import os
import re
import secrets
import string
import time
import zlib
from typing import Any

import jwt
import pyotp
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

PASSPHRASE_WORDS_RU_EN = [
    "aurora", "cobalt", "matrix", "nebula", "photon", "quartz", "vortex", "zephyr",
    "cipher", "falcon", "galaxy", "horizon", "impulse", "krypton", "mirage", "neutron",
    "orbit", "plasma", "pulsar", "quantum", "reactor", "shadow", "solaris", "titan",
    "vector", "velvet", "zenith", "arctic", "beacon", "cosmos", "dynamo", "eclipse",
    "fusion", "glacier", "helium", "indigo", "javelin", "keystone", "lumen", "magnet",
    "nimbus", "obsidian", "paradox", "phoenix", "prism", "quasar", "radium", "saffron",
    "spectrum", "tempest", "thunder", "tungsten", "ultima", "valkyrie", "whisper", "xenon",
]


def _human_crack_time(entropy_bits: float) -> str:
    # Assume 100 billion guesses/sec (10^11 H/s) modern GPU rig
    guesses = 2.0 ** min(entropy_bits, 200.0)
    seconds = guesses / 2e11
    if seconds < 1:
        return "мгновенно (< 1 сек)"
    if seconds < 60:
        return f"~{int(seconds)} сек"
    if seconds < 3600:
        return f"~{int(seconds // 60)} мин"
    if seconds < 86400:
        return f"~{int(seconds // 3600)} ч"
    if seconds < 86400 * 365:
        return f"~{int(seconds // 86400)} дн"
    years = seconds / (86400 * 365.25)
    if years < 1_000:
        return f"~{int(years)} лет"
    if years < 1_000_000:
        return f"~{int(years // 1000)} тыс. лет"
    if years < 1_000_000_000:
        return f"~{int(years // 1_000_000)} млн лет"
    return "миллиарды лет (несокрушимо)"


def _strength_grade(entropy_bits: float) -> str:
    if entropy_bits < 45:
        return "Слабый ⚠️"
    if entropy_bits < 65:
        return "Средний 🟡"
    if entropy_bits < 90:
        return "Надёжный 🟢"
    return "Военный уровень 🛡️"


def generate_passwords(
    length: int = 20,
    count: int = 5,
    use_upper: bool = True,
    use_lower: bool = True,
    use_digits: bool = True,
    use_symbols: bool = True,
    mode: str = "chars",
    words_count: int = 4,
    separator: str = "-",
) -> dict[str, Any]:
    count = max(1, min(count, 20))
    if mode == "passphrase":
        w_cnt = max(3, min(words_count, 8))
        results = []
        for _ in range(count):
            picked = [secrets.choice(PASSPHRASE_WORDS_RU_EN) for _ in range(w_cnt)]
            picked[0] = picked[0].capitalize()
            suffix = str(secrets.randbelow(900) + 100)
            results.append(separator.join(picked) + separator + suffix)
        entropy = w_cnt * math.log2(len(PASSPHRASE_WORDS_RU_EN)) + math.log2(900)
        return {
            "mode": "passphrase",
            "passwords": results,
            "entropy_bits": round(entropy, 1),
            "crack_time": _human_crack_time(entropy),
            "grade": _strength_grade(entropy),
        }

    length = max(6, min(length, 128))
    pools: list[str] = []
    if use_lower:
        pools.append("abcdefghijkmnopqrstuvwxyz")
    if use_upper:
        pools.append("ABCDEFGHJKLMNPQRSTUVWXYZ")
    if use_digits:
        pools.append("23456789")
    if use_symbols:
        pools.append("!@#$%^&*_-+=?")

    if not pools:
        pools = [string.ascii_letters + string.digits]

    alphabet = "".join(pools)
    passwords: list[str] = []
    for _ in range(count):
        # Guarantee at least one char from each active pool
        chars = [secrets.choice(pool) for pool in pools[:length]]
        while len(chars) < length:
            chars.append(secrets.choice(alphabet))
        secrets.SystemRandom().shuffle(chars)
        passwords.append("".join(chars))

    entropy = length * math.log2(len(set(alphabet)))
    return {
        "mode": "chars",
        "length": length,
        "passwords": passwords,
        "entropy_bits": round(entropy, 1),
        "crack_time": _human_crack_time(entropy),
        "grade": _strength_grade(entropy),
    }


def _derive_aes_key(password: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=120_000,
    )
    return kdf.derive(password.encode("utf-8"))


def encrypt_nx1(plaintext: str, password: str) -> str:
    if not plaintext:
        raise ValueError("Текст для шифрования пуст")
    if not password:
        raise ValueError("Укажите пароль шифрования")
    salt = os.urandom(16)
    nonce = os.urandom(12)
    key = _derive_aes_key(password, salt)
    aes = AESGCM(key)
    ciphertext = aes.encrypt(nonce, plaintext.encode("utf-8"), b"NX1")
    blob = salt + nonce + ciphertext
    encoded = base64.urlsafe_b64encode(blob).decode("ascii").rstrip("=")
    return f"NX1.{encoded}"


def decrypt_nx1(envelope: str, password: str) -> str:
    raw = (envelope or "").strip()
    if raw.startswith("NX1."):
        raw = raw[4:]
    pad = "=" * ((4 - len(raw) % 4) % 4)
    try:
        blob = base64.urlsafe_b64decode(raw + pad)
    except Exception as exc:
        raise ValueError("Повреждённый формат контейнера NX1") from exc
    if len(blob) < 44:
        raise ValueError("Контейнер NX1 слишком короткий")
    salt = blob[:16]
    nonce = blob[16:28]
    ciphertext = blob[28:]
    key = _derive_aes_key(password or "", salt)
    aes = AESGCM(key)
    try:
        plain = aes.decrypt(nonce, ciphertext, b"NX1")
    except InvalidTag as exc:
        raise ValueError("Неверный пароль или нарушена целостность сообщения") from exc
    return plain.decode("utf-8")


def compute_hashes(text: str, hmac_key: str = "") -> dict[str, Any]:
    data = (text or "").encode("utf-8")
    if hmac_key:
        key_b = hmac_key.encode("utf-8")
        return {
            "mode": "HMAC",
            "HMAC-MD5": hmac.new(key_b, data, hashlib.md5).hexdigest(),
            "HMAC-SHA1": hmac.new(key_b, data, hashlib.sha1).hexdigest(),
            "HMAC-SHA256": hmac.new(key_b, data, hashlib.sha256).hexdigest(),
            "HMAC-SHA512": hmac.new(key_b, data, hashlib.sha512).hexdigest(),
        }
    return {
        "mode": "HASH",
        "CRC32": f"{zlib.crc32(data) & 0xFFFFFFFF:08x}",
        "MD5": hashlib.md5(data).hexdigest(),
        "SHA-1": hashlib.sha1(data).hexdigest(),
        "SHA-256": hashlib.sha256(data).hexdigest(),
        "SHA-512": hashlib.sha512(data).hexdigest(),
        "SHA3-256": hashlib.sha3_256(data).hexdigest(),
        "BLAKE2b-256": hashlib.blake2b(data, digest_size=32).hexdigest(),
    }


def identify_hash(candidate: str) -> list[str]:
    h = (candidate or "").strip()
    if h.startswith(("$2a$", "$2b$", "$2y$")):
        return ["bcrypt"]
    if h.startswith("$argon2"):
        return ["Argon2id / Argon2i"]
    if re.fullmatch(r"[0-9a-fA-F]+", h):
        mapping = {
            8: ["CRC32", "Adler-32"],
            32: ["MD5", "NTLM", "MD4"],
            40: ["SHA-1", "RIPEMD-160"],
            56: ["SHA-224", "SHA3-224"],
            64: ["SHA-256", "SHA3-256", "BLAKE2s-256"],
            96: ["SHA-384", "SHA3-384"],
            128: ["SHA-512", "SHA3-512", "BLAKE2b-512"],
        }
        return mapping.get(len(h), [f"Hex-дайджест ({len(h) * 4} бит)"])
    return ["Неизвестный формат (не стандартный hex-хеш)"]


def inspect_jwt(token: str, secret: str = "") -> dict[str, Any]:
    tok = (token or "").strip()
    parts = tok.split(".")
    if len(parts) != 3:
        raise ValueError("Некорректный JWT: ожидается 3 сегмента header.payload.signature")

    header = jwt.get_unverified_header(tok)
    payload = jwt.decode(tok, options={"verify_signature": False})

    now = int(time.time())
    exp_status = "Не задан (бессрочный)"
    if "exp" in payload and isinstance(payload["exp"], (int, float)):
        diff = int(payload["exp"] - now)
        if diff > 0:
            exp_status = f"Активен (осталось {diff // 60} мин {diff % 60} сек)"
        else:
            exp_status = f"Истёк ({abs(diff) // 60} мин назад)"

    sig_verified: str | None = None
    if secret:
        alg = header.get("alg", "HS256")
        try:
            jwt.decode(tok, secret, algorithms=[alg], options={"verify_exp": False})
            sig_verified = "Подпись подтверждена ✅"
        except Exception as exc:
            sig_verified = f"Подпись недействительна ❌ ({exc})"

    return {
        "header": header,
        "payload": payload,
        "exp_status": exp_status,
        "signature_verified": sig_verified,
    }


def sign_jwt(
    payload: dict[str, Any],
    secret: str,
    algorithm: str = "HS256",
    expires_minutes: int = 60,
) -> str:
    now = int(time.time())
    claims = {"iat": now, **payload}
    if expires_minutes > 0 and "exp" not in claims:
        claims["exp"] = now + expires_minutes * 60
    return jwt.encode(claims, secret or "nexus-secret", algorithm=algorithm)


def generate_totp_info(
    secret: str = "",
    account: str = "user@nexus.app",
    issuer: str = "NEXUS",
) -> dict[str, Any]:
    clean = re.sub(r"\s+", "", (secret or "")).upper()
    if not clean:
        clean = pyotp.random_base32()
    try:
        totp = pyotp.TOTP(clean)
        now = int(time.time())
        current_code = totp.at(now)
        next_code = totp.at(now + 30)
    except Exception as exc:
        raise ValueError("Невалидный Base32-ключ 2FA (допустимы символы A–Z и 2–7)") from exc

    remaining = 30 - (now % 30)
    uri = totp.provisioning_uri(name=account, issuer_name=issuer)
    return {
        "secret": clean,
        "code": current_code,
        "next_code": next_code,
        "remaining_seconds": remaining,
        "otpauth_uri": uri,
    }
