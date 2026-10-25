from __future__ import annotations

import hashlib
import io
import math
import struct
import zlib
from typing import Any

from PIL import ExifTags, Image, ImageDraw, ImageFilter, ImageFont, ImageOps
from pygments import lex
from pygments.lexers import get_lexer_by_name, guess_lexer
from pygments.token import Comment, Keyword, Literal, Name, Number, Operator, Punctuation, String

from backend.config import FONT_BOLD, FONT_MONO, FONT_REGULAR
from backend.tools.security_lab import decrypt_nx1, encrypt_nx1

STEGO_MAGIC = b"NXSG1"

CODE_THEMES: dict[str, dict[str, Any]] = {
    "tokyo": {
        "label": "Tokyo Night",
        "backdrop_a": (15, 23, 42),
        "backdrop_b": (49, 46, 129),
        "window_bg": (22, 22, 30),
        "header_bg": (26, 27, 38),
        "text": (192, 202, 245),
        "muted": (86, 95, 137),
        "keyword": (187, 154, 247),
        "string": (158, 206, 106),
        "number": (255, 158, 100),
        "func": (122, 162, 247),
        "comment": (99, 109, 156),
        "op": (137, 221, 255),
    },
    "dracula": {
        "label": "Dracula",
        "backdrop_a": (40, 20, 60),
        "backdrop_b": (17, 24, 39),
        "window_bg": (40, 42, 54),
        "header_bg": (33, 34, 44),
        "text": (248, 248, 242),
        "muted": (98, 114, 164),
        "keyword": (255, 121, 198),
        "string": (241, 250, 140),
        "number": (189, 147, 249),
        "func": (80, 250, 123),
        "comment": (98, 114, 164),
        "op": (139, 233, 253),
    },
    "emerald": {
        "label": "Matrix Emerald",
        "backdrop_a": (6, 32, 26),
        "backdrop_b": (15, 23, 42),
        "window_bg": (11, 21, 20),
        "header_bg": (16, 30, 28),
        "text": (209, 250, 229),
        "muted": (75, 115, 100),
        "keyword": (52, 211, 153),
        "string": (167, 243, 208),
        "number": (251, 191, 36),
        "func": (56, 189, 248),
        "comment": (75, 115, 100),
        "op": (110, 231, 183),
    },
}


def generate_cover_art(width: int = 640, height: int = 420, title: str = "NEXUS VAULT") -> Image.Image:
    img = Image.new("RGB", (width, height), (14, 19, 34))
    draw = ImageDraw.Draw(img)
    for y in range(height):
        t = y / max(1, height - 1)
        r = int(14 + 38 * t)
        g = int(20 + 25 * (1 - t))
        b = int(42 + 68 * t)
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    # Subtle cyber grid & rings
    for x in range(0, width, 40):
        draw.line([(x, 0), (x, height)], fill=(30, 45, 78), width=1)
    for y in range(0, height, 40):
        draw.line([(0, y), (width, y)], fill=(30, 45, 78), width=1)

    cx, cy = width // 2, height // 2
    for radius, color in [(135, (56, 189, 248)), (95, (168, 85, 247)), (55, (16, 185, 129))]:
        draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], outline=color, width=2)

    try:
        font_b = ImageFont.truetype(FONT_BOLD, 24)
        font_s = ImageFont.truetype(FONT_REGULAR, 14)
    except OSError:
        font_b = ImageFont.load_default()
        font_s = font_b

    bbox = draw.textbbox((0, 0), title, font=font_b)
    tw = bbox[2] - bbox[0]
    draw.text(((width - tw) / 2, height - 64), title, font=font_b, fill=(226, 232, 240))
    sub = "LSB Encrypted Carrier • Lossless PNG"
    bbox2 = draw.textbbox((0, 0), sub, font=font_s)
    tw2 = bbox2[2] - bbox2[0]
    draw.text(((width - tw2) / 2, height - 34), sub, font=font_s, fill=(148, 163, 184))
    return img


def stego_encode_png(
    secret_text: str,
    password: str = "",
    cover_bytes: bytes | None = None,
) -> tuple[bytes, dict[str, Any]]:
    if not secret_text:
        raise ValueError("Секретное сообщение не может быть пустым")

    is_encrypted = bool(password.strip())
    if is_encrypted:
        body_str = encrypt_nx1(secret_text, password.strip())
    else:
        body_str = secret_text
    payload_bytes = body_str.encode("utf-8")
    crc = zlib.crc32(payload_bytes) & 0xFFFFFFFF
    flag = 1 if is_encrypted else 0
    packet = STEGO_MAGIC + struct.pack(">BII", flag, len(payload_bytes), crc) + payload_bytes

    if cover_bytes:
        img = Image.open(io.BytesIO(cover_bytes)).convert("RGB")
    else:
        img = generate_cover_art()

    raw = bytearray(img.tobytes())
    required_channels = len(packet) * 8
    if required_channels > len(raw):
        # Automatically upscale image if secret text needs more pixel capacity
        scale = math.ceil(math.sqrt(required_channels / len(raw))) + 1
        img = img.resize((img.width * scale, img.height * scale), Image.Resampling.LANCZOS)
        raw = bytearray(img.tobytes())

    bit_idx = 0
    for byte_val in packet:
        for shift in range(7, -1, -1):
            bit = (byte_val >> shift) & 1
            raw[bit_idx] = (raw[bit_idx] & 0xFE) | bit
            bit_idx += 1

    stego_img = Image.frombytes("RGB", img.size, bytes(raw))
    out = io.BytesIO()
    stego_img.save(out, format="PNG", optimize=True)
    png_bytes = out.getvalue()

    capacity_bytes = len(raw) // 8
    return png_bytes, {
        "width": stego_img.width,
        "height": stego_img.height,
        "encrypted": is_encrypted,
        "payload_bytes": len(payload_bytes),
        "capacity_bytes": capacity_bytes,
        "usage_pct": round((len(packet) / max(1, capacity_bytes)) * 100, 2),
    }


def stego_decode_png(image_bytes: bytes, password: str = "") -> dict[str, Any]:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    raw = img.tobytes()

    header_len = len(STEGO_MAGIC) + 9  # 5 + 1 + 4 + 4 = 14 bytes
    if len(raw) < header_len * 8:
        raise ValueError("Изображение слишком мало и не содержит скрытого контейнера")

    def extract_bytes(start_bit: int, num_bytes: int) -> bytes:
        out = bytearray(num_bytes)
        pos = start_bit
        for i in range(num_bytes):
            val = 0
            for _ in range(8):
                val = (val << 1) | (raw[pos] & 1)
                pos += 1
            out[i] = val
        return bytes(out)

    header = extract_bytes(0, header_len)
    if header[:5] != STEGO_MAGIC:
        raise ValueError("В этом изображении не найдено скрытое сообщение NEXUS Stego")

    flag, payload_len, expected_crc = struct.unpack(">BII", header[5:14])
    total_bits = (header_len + payload_len) * 8
    if payload_len > 5_000_000 or total_bits > len(raw):
        raise ValueError("Повреждённый заголовок стего-контейнера")

    payload_bytes = extract_bytes(header_len * 8, payload_len)
    actual_crc = zlib.crc32(payload_bytes) & 0xFFFFFFFF
    if actual_crc != expected_crc:
        raise ValueError("Контрольная сумма не совпала (изображение было пережато в JPEG)")

    decoded_str = payload_bytes.decode("utf-8")
    if flag == 1:
        if not password.strip():
            raise ValueError("Сообщение защищено паролем AES-256 — введите пароль для расшифровки")
        plaintext = decrypt_nx1(decoded_str, password.strip())
    else:
        plaintext = decoded_str

    return {
        "secret_text": plaintext,
        "encrypted": bool(flag == 1),
        "payload_bytes": payload_len,
        "dimensions": f"{img.width}×{img.height}",
    }


def inspect_and_clean_image(image_bytes: bytes) -> tuple[bytes, dict[str, Any]]:
    src = Image.open(io.BytesIO(image_bytes))
    orig_format = src.format or "PNG"
    exif_dict: dict[str, str] = {}
    try:
        raw_exif = src.getexif()
        if raw_exif:
            for tag_id, val in raw_exif.items():
                tag_name = str(ExifTags.TAGS.get(tag_id, tag_id))
                val_str = str(val)
                if len(val_str) <= 120:
                    exif_dict[tag_name] = val_str
    except Exception:
        pass

    # Extract dominant color palette
    rgb_small = src.convert("RGB").resize((120, 120))
    quantized = rgb_small.quantize(colors=6)
    palette_raw = quantized.getpalette() or []
    counts = sorted(quantized.getcolors() or [], reverse=True)
    palette_hex: list[str] = []
    for _, idx in counts[:6]:
        base = idx * 3
        if base + 2 < len(palette_raw):
            r, g, b = palette_raw[base], palette_raw[base + 1], palette_raw[base + 2]
            hx = f"#{r:02x}{g:02x}{b:02x}"
            if hx not in palette_hex:
                palette_hex.append(hx)

    # Create clean EXIF-free image
    clean_mode = "RGBA" if src.mode in ("RGBA", "LA") else "RGB"
    clean_img = Image.new(clean_mode, src.size)
    clean_img.paste(src.convert(clean_mode))
    out = io.BytesIO()
    out_fmt = "PNG" if clean_mode == "RGBA" else "JPEG"
    save_kwargs = {"optimize": True}
    if out_fmt == "JPEG":
        save_kwargs["quality"] = 92
    clean_img.save(out, format=out_fmt, **save_kwargs)
    clean_bytes = out.getvalue()

    return clean_bytes, {
        "original_format": orig_format,
        "output_format": out_fmt,
        "width": src.width,
        "height": src.height,
        "megapixels": round((src.width * src.height) / 1_000_000, 2),
        "original_size_kb": round(len(image_bytes) / 1024, 1),
        "clean_size_kb": round(len(clean_bytes) / 1024, 1),
        "sha256": hashlib.sha256(image_bytes).hexdigest()[:24] + "…",
        "exif_found_count": len(exif_dict),
        "exif_tags": exif_dict,
        "palette": palette_hex,
    }


def transform_image(
    image_bytes: bytes,
    action: str = "sticker",
    target_format: str = "WEBP",
    quality: int = 84,
) -> tuple[bytes, dict[str, Any]]:
    src = Image.open(io.BytesIO(image_bytes))
    orig_len = len(image_bytes)

    if action == "sticker":
        rgba = src.convert("RGBA")
        rgba.thumbnail((512, 512), Image.Resampling.LANCZOS)
        # Ensure at least one side is exactly 512px per Telegram Sticker standard
        scale = 512.0 / max(rgba.width, rgba.height)
        new_w = max(1, min(512, int(round(rgba.width * scale))))
        new_h = max(1, min(512, int(round(rgba.height * scale))))
        rgba = rgba.resize((new_w, new_h), Image.Resampling.LANCZOS)

        # Rounded corner mask
        mask = Image.new("L", (new_w, new_h), 0)
        m_draw = ImageDraw.Draw(mask)
        m_draw.rounded_rectangle([0, 0, new_w - 1, new_h - 1], radius=36, fill=255)
        out_img = Image.new("RGBA", (new_w, new_h), (0, 0, 0, 0))
        out_img.paste(rgba, (0, 0), mask)
        buf = io.BytesIO()
        out_img.save(buf, format="WEBP", quality=90)
        res = buf.getvalue()
        return res, {
            "action": "Telegram Стикер 512px",
            "format": "WEBP",
            "dimensions": f"{new_w}×{new_h}",
            "before_kb": round(orig_len / 1024, 1),
            "after_kb": round(len(res) / 1024, 1),
        }

    rgb = src.convert("RGB")
    if action == "cyberpunk":
        gray = ImageOps.grayscale(rgb)
        rgb = ImageOps.colorize(gray, black="#0f172a", mid="#a855f7", white="#38bdf8")
    elif action == "grayscale":
        rgb = ImageOps.grayscale(rgb).convert("RGB")
    elif action == "pixelate":
        small_w = max(16, rgb.width // 10)
        small_h = max(16, rgb.height // 10)
        rgb = rgb.resize((small_w, small_h), Image.Resampling.NEAREST).resize(rgb.size, Image.Resampling.NEAREST)
    elif action == "edges":
        rgb = ImageOps.autocontrast(rgb.filter(ImageFilter.FIND_EDGES))
    elif action == "blur":
        rgb = rgb.filter(ImageFilter.GaussianBlur(radius=4))
    elif action == "sharpen":
        rgb = rgb.filter(ImageFilter.SHARPEN)

    fmt = target_format.upper()
    if fmt not in ("WEBP", "PNG", "JPEG"):
        fmt = "WEBP"

    buf = io.BytesIO()
    if fmt in ("WEBP", "JPEG"):
        rgb.save(buf, format=fmt, quality=max(20, min(quality, 98)), optimize=True)
    else:
        rgb.save(buf, format="PNG", optimize=True)
    res = buf.getvalue()
    saved_pct = round((1 - len(res) / max(1, orig_len)) * 100, 1)
    return res, {
        "action": action,
        "format": fmt,
        "dimensions": f"{rgb.width}×{rgb.height}",
        "before_kb": round(orig_len / 1024, 1),
        "after_kb": round(len(res) / 1024, 1),
        "saved_pct": saved_pct,
    }


def _token_color(tok_type: Any, palette: dict[str, Any]) -> tuple[int, int, int]:
    if tok_type in Comment:
        return palette["comment"]
    if tok_type in Keyword:
        return palette["keyword"]
    if tok_type in String:
        return palette["string"]
    if tok_type in Number or tok_type in Literal:
        return palette["number"]
    if tok_type in Name.Function or tok_type in Name.Class or tok_type in Name.Builtin:
        return palette["func"]
    if tok_type in Operator or tok_type in Punctuation:
        return palette["op"]
    return palette["text"]


def render_code_card(
    code: str,
    language: str = "python",
    title: str = "nexus_snippet.py",
    theme: str = "tokyo",
) -> bytes:
    clean_code = (code or "").strip("\n")
    if not clean_code.strip():
        raise ValueError("Код для генерации карточки пуст")

    lines_raw = clean_code.expandtabs(4).splitlines()[:45]
    lines = [ln[:96] for ln in lines_raw]
    clipped_code = "\n".join(lines)

    pal = CODE_THEMES.get(theme, CODE_THEMES["tokyo"])
    try:
        lexer = get_lexer_by_name(language.strip().lower()) if language.strip() else guess_lexer(clipped_code)
    except Exception:
        lexer = get_lexer_by_name("python")

    try:
        font_code = ImageFont.truetype(FONT_MONO, 16)
        font_title = ImageFont.truetype(FONT_REGULAR, 14)
    except OSError:
        font_code = ImageFont.load_default()
        font_title = font_code

    probe = Image.new("RGB", (10, 10))
    p_draw = ImageDraw.Draw(probe)
    char_bbox = p_draw.textbbox((0, 0), "M", font=font_code)
    char_w = max(9, char_bbox[2] - char_bbox[0])
    line_h = 26

    max_chars = max((len(ln) for ln in lines), default=20)
    gutter_w = 54
    win_w = max(480, gutter_w + max_chars * char_w + 56)
    header_h = 46
    win_h = header_h + len(lines) * line_h + 38

    margin = 44
    canvas_w = win_w + margin * 2
    canvas_h = win_h + margin * 2

    canvas = Image.new("RGB", (canvas_w, canvas_h), pal["backdrop_a"])
    draw = ImageDraw.Draw(canvas)
    for y in range(canvas_h):
        t = y / max(1, canvas_h - 1)
        r = int(pal["backdrop_a"][0] * (1 - t) + pal["backdrop_b"][0] * t)
        g = int(pal["backdrop_a"][1] * (1 - t) + pal["backdrop_b"][1] * t)
        b = int(pal["backdrop_a"][2] * (1 - t) + pal["backdrop_b"][2] * t)
        draw.line([(0, y), (canvas_w, y)], fill=(r, g, b))

    # Drop shadow
    draw.rounded_rectangle(
        [margin + 6, margin + 10, margin + win_w + 6, margin + win_h + 10],
        radius=18,
        fill=(6, 8, 16),
    )
    # Window frame
    draw.rounded_rectangle(
        [margin, margin, margin + win_w, margin + win_h],
        radius=16,
        fill=pal["window_bg"],
        outline=(65, 72, 104),
        width=1,
    )
    # Header bar
    draw.rounded_rectangle(
        [margin, margin, margin + win_w, margin + header_h],
        radius=16,
        fill=pal["header_bg"],
    )
    draw.rectangle(
        [margin, margin + header_h - 16, margin + win_w, margin + header_h],
        fill=pal["header_bg"],
    )

    # Traffic lights
    dots = [((255, 95, 86), 22), ((255, 189, 46), 44), ((39, 201, 63), 66)]
    for col, dx in dots:
        draw.ellipse([margin + dx - 6, margin + 17, margin + dx + 6, margin + 29], fill=col)

    title_str = (title or "snippet").strip()[:48]
    tb = draw.textbbox((0, 0), title_str, font=font_title)
    tw = tb[2] - tb[0]
    draw.text(
        (margin + (win_w - tw) / 2, margin + 14),
        title_str,
        font=font_title,
        fill=pal["muted"],
    )

    # Render line numbers
    base_y = margin + header_h + 16
    for idx in range(len(lines)):
        ln_str = f"{idx + 1:>2}"
        draw.text((margin + 18, base_y + idx * line_h), ln_str, font=font_code, fill=pal["muted"])

    # Tokenize and draw syntax-highlighted code
    cur_line = 0
    cur_col = 0
    for tok_type, tok_val in lex(clipped_code, lexer):
        color = _token_color(tok_type, pal)
        parts = tok_val.split("\n")
        for p_idx, part in enumerate(parts):
            if p_idx > 0:
                cur_line += 1
                cur_col = 0
            if cur_line >= len(lines):
                break
            if part:
                x = margin + gutter_w + cur_col * char_w
                y = base_y + cur_line * line_h
                draw.text((x, y), part, font=font_code, fill=color)
                cur_col += len(part)

    out = io.BytesIO()
    canvas.save(out, format="PNG", optimize=True)
    return out.getvalue()
