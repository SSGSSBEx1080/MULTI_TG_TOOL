from __future__ import annotations

import html
import io
import math
import re
from typing import Any
from urllib.parse import parse_qs, quote, unquote, urlparse

import barcode
from barcode.writer import ImageWriter
from PIL import Image, ImageDraw, ImageFont
import qrcode

# All built-in QR themes strictly maintain dark-on-light polarity inside the QR matrix + quiet zone
# (WCAG contrast >= 7.5:1) so every iOS/Android camera decodes instantly, while applying rich studio
# accents to finder eyes, center badges, captions, and optional decorative outer frames.
QR_THEMES: dict[str, dict[str, Any]] = {
    "cyber": {
        "fg": (10, 26, 47),
        "eye": (0, 118, 182),
        "bg": (246, 252, 255),
        "frame": (8, 17, 32),
        "accent": (0, 212, 255),
        "label": "Кибер-Индиго",
    },
    "classic": {
        "fg": (12, 16, 24),
        "eye": (12, 16, 24),
        "bg": (255, 255, 255),
        "frame": (241, 245, 249),
        "accent": (37, 99, 235),
        "label": "Классика ISO",
    },
    "ocean": {
        "fg": (11, 37, 89),
        "eye": (29, 78, 216),
        "bg": (245, 250, 255),
        "frame": (15, 35, 76),
        "accent": (56, 189, 248),
        "label": "Океан",
    },
    "emerald": {
        "fg": (6, 46, 34),
        "eye": (5, 122, 85),
        "bg": (244, 253, 249),
        "frame": (6, 36, 27),
        "accent": (16, 185, 129),
        "label": "Изумруд",
    },
    "sunset": {
        "fg": (88, 20, 42),
        "eye": (190, 24, 93),
        "bg": (255, 249, 246),
        "frame": (67, 20, 40),
        "accent": (249, 115, 22),
        "label": "Закат",
    },
    "royal": {
        "fg": (44, 16, 92),
        "eye": (109, 40, 217),
        "bg": (250, 247, 255),
        "frame": (33, 14, 68),
        "accent": (168, 85, 247),
        "label": "Аметист",
    },
    "crimson": {
        "fg": (76, 12, 24),
        "eye": (185, 28, 28),
        "bg": (255, 248, 248),
        "frame": (59, 10, 20),
        "accent": (239, 68, 68),
        "label": "Рубин",
    },
    "amber": {
        "fg": (58, 32, 6),
        "eye": (180, 83, 9),
        "bg": (255, 252, 242),
        "frame": (45, 26, 8),
        "accent": (245, 158, 11),
        "label": "Графит & Золото",
    },
}

FONT_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def _load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for p in FONT_PATHS:
        try:
            return ImageFont.truetype(p, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def _parse_hex_color(value: str | None, fallback: tuple[int, int, int]) -> tuple[int, int, int]:
    if not value:
        return fallback
    v = value.strip().lstrip("#")
    if len(v) == 3 and all(c in "0123456789abcdefABCDEF" for c in v):
        v = "".join(c * 2 for c in v)
    if len(v) == 6:
        try:
            return int(v[0:2], 16), int(v[2:4], 16), int(v[4:6], 16)
        except ValueError:
            return fallback
    return fallback


def _rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"


def _rel_luminance(rgb: tuple[int, int, int]) -> float:
    def _chan(c: int) -> float:
        s = c / 255.0
        return s / 12.92 if s <= 0.03928 else ((s + 0.055) / 1.055) ** 2.4

    r, g, b = _chan(rgb[0]), _chan(rgb[1]), _chan(rgb[2])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def compute_qr_contrast(fg: tuple[int, int, int], bg: tuple[int, int, int]) -> dict[str, Any]:
    lum_fg = _rel_luminance(fg)
    lum_bg = _rel_luminance(bg)
    lighter = max(lum_fg, lum_bg)
    darker = min(lum_fg, lum_bg)
    ratio = round((lighter + 0.05) / (darker + 0.05), 2)
    inverted = lum_fg > lum_bg
    grade = "Отличный (ISO)" if ratio >= 7.0 and not inverted else (
        "Хороший" if ratio >= 4.5 and not inverted else (
            "Инвертированный (читают не все камеры)" if inverted and ratio >= 4.0 else "Низкий контраст — риск сбоя сканера"
        )
    )
    return {
        "ratio": ratio,
        "inverted": inverted,
        "safe": ratio >= 4.2 and not inverted,
        "grade": grade,
    }


def _escape_wifi(val: str) -> str:
    out = val or ""
    for ch in ("\\", ";", ",", '"', ":"):
        out = out.replace(ch, "\\" + ch)
    return out


def build_wifi_payload(ssid: str, password: str = "", security: str = "WPA", hidden: bool = False) -> str:
    sec = security.upper() if security.upper() in {"WPA", "WEP", "nopass", "NOPASS"} else "WPA"
    if sec == "NOPASS" or not password:
        sec_str = "nopass"
        pwd_part = ""
    else:
        sec_str = sec
        pwd_part = f"P:{_escape_wifi(password)};"
    h_flag = "true" if hidden else "false"
    return f"WIFI:T:{sec_str};S:{_escape_wifi(ssid)};{pwd_part}H:{h_flag};;"


def build_vcard_payload(
    full_name: str,
    phone: str = "",
    email: str = "",
    org: str = "",
    title: str = "",
    url: str = "",
    telegram: str = "",
) -> str:
    clean_name = (full_name or "Контакт").strip()
    parts = clean_name.split(None, 1)
    n_field = f"{parts[1]};{parts[0]};;;" if len(parts) == 2 else f"{clean_name};;;;"
    lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        f"N:{n_field}",
        f"FN:{clean_name}",
    ]
    if org:
        lines.append(f"ORG:{org.strip()}")
    if title:
        lines.append(f"TITLE:{title.strip()}")
    if phone:
        lines.append(f"TEL;TYPE=CELL:{phone.strip()}")
    if email:
        lines.append(f"EMAIL:{email.strip()}")
    if url:
        lines.append(f"URL:{url.strip()}")
    if telegram:
        tg_handle = telegram.strip().lstrip("@")
        if tg_handle.startswith(("http://", "https://")):
            lines.append(f"URL:{tg_handle}")
        elif tg_handle:
            lines.append(f"URL:https://t.me/{tg_handle}")
    lines.append("END:VCARD")
    return "\n".join(lines)


def build_telegram_payload(username_or_link: str, start_param: str = "", message_text: str = "") -> str:
    raw = (username_or_link or "multi_tg_bot").strip()
    if raw.startswith(("http://", "https://", "tg://")):
        base = raw
    else:
        handle = raw.lstrip("@").split("/")[0].strip() or "multi_tg_bot"
        base = f"https://t.me/{handle}"
    params = []
    if start_param.strip():
        params.append(f"start={quote(start_param.strip())}")
    if message_text.strip():
        params.append(f"text={quote(message_text.strip())}")
    if params:
        sep = "&" if "?" in base else "?"
        return f"{base}{sep}{'&'.join(params)}"
    return base


def build_whatsapp_payload(phone: str, message_text: str = "") -> str:
    digits = re.sub(r"\D+", "", phone or "")
    if digits.startswith("8") and len(digits) == 11:
        digits = "7" + digits[1:]
    if not digits:
        digits = "79990000000"
    if message_text.strip():
        return f"https://wa.me/{digits}?text={quote(message_text.strip())}"
    return f"https://wa.me/{digits}"


def build_email_payload(email: str, subject: str = "", body: str = "") -> str:
    addr = (email or "hello@example.com").strip()
    q = []
    if subject.strip():
        q.append(f"subject={quote(subject.strip())}")
    if body.strip():
        q.append(f"body={quote(body.strip())}")
    return f"mailto:{addr}{'?' + '&'.join(q) if q else ''}"


def build_geo_payload(lat: float | str, lon: float | str, label: str = "") -> str:
    try:
        la = round(float(str(lat).replace(",", ".")), 6)
        lo = round(float(str(lon).replace(",", ".")), 6)
    except ValueError:
        la, lo = 55.7558, 37.6173
    if label.strip():
        return f"geo:{la},{lo}?q={la},{lo}({quote(label.strip())})"
    return f"geo:{la},{lo}"


def build_crypto_payload(network: str, address: str, amount: str = "", comment: str = "") -> str:
    net = (network or "ton").strip().lower()
    addr = (address or "").strip()
    amt = (amount or "").strip().replace(",", ".")
    memo = (comment or "").strip()
    if net == "ton":
        addr = addr or "UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ"
        q = []
        if amt:
            try:
                nanoton = int(round(float(amt) * 1_000_000_000))
                if nanoton > 0:
                    q.append(f"amount={nanoton}")
            except ValueError:
                pass
        if memo:
            q.append(f"text={quote(memo)}")
        return f"ton://transfer/{addr}{'?' + '&'.join(q) if q else ''}"
    if net in {"btc", "bitcoin"}:
        addr = addr or "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
        q = []
        if amt:
            q.append(f"amount={quote(amt)}")
        if memo:
            q.append(f"message={quote(memo)}")
        return f"bitcoin:{addr}{'?' + '&'.join(q) if q else ''}"
    if net in {"eth", "ethereum"}:
        return f"ethereum:{addr or '0x0000000000000000000000000000000000000000'}"
    if net in {"trx", "tron", "usdt_trc20"}:
        return f"tron:{addr or 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb'}"
    return addr or "ton://transfer/"


def _is_finder_module(r: int, c: int, n: int) -> bool:
    return (r < 7 and c < 7) or (r < 7 and c >= n - 7) or (r >= n - 7 and c < 7)


def _alignment_centers(version: int, n: int) -> list[int]:
    if version <= 1:
        return []
    num_align = version // 7 + 2
    first = 6
    last = n - 7
    if num_align == 2:
        return [first, last]
    step = ((last - first) * 2 + (num_align - 2)) // (2 * (num_align - 1))
    if step % 2 == 1:
        step += 1
    coords = [first]
    pos = last
    for _ in range(num_align - 2):
        coords.insert(1, pos)
        pos -= step
    coords.append(last)
    # Deduplicate preserving order
    out: list[int] = []
    for x in coords:
        if x not in out:
            out.append(x)
    return out


def _is_alignment_module(r: int, c: int, version: int, n: int) -> bool:
    centers = _alignment_centers(version, n)
    if not centers:
        return False
    for ar in centers:
        for ac in centers:
            if (ar == 6 and ac == 6) or (ar == 6 and ac == n - 7) or (ar == n - 7 and ac == 6):
                continue
            if abs(r - ar) <= 2 and abs(c - ac) <= 2:
                return True
    return False


def _draw_finder_eye_pil(
    draw: ImageDraw.ImageDraw,
    ox: int,
    oy: int,
    box_size: int,
    eye_color: tuple[int, int, int],
    bg_color: tuple[int, int, int],
    finder_style: str,
) -> None:
    outer = 7 * box_size
    inner_gap = box_size
    core_gap = 2 * box_size
    style = (finder_style or "rounded").lower()
    if style == "circle":
        # Soft-chamfered square preserves strict 1:1:3:1:1 diagonal ratio required by ISO/OpenCV/Android scanners
        r_out = max(2, int(box_size * 0.55))
        r_mid = max(2, int(box_size * 0.40))
        r_in = max(2, int(box_size * 0.45))
        draw.rounded_rectangle([ox, oy, ox + outer - 1, oy + outer - 1], radius=r_out, fill=eye_color)
        draw.rounded_rectangle(
            [ox + inner_gap, oy + inner_gap, ox + outer - inner_gap - 1, oy + outer - inner_gap - 1],
            radius=r_mid,
            fill=bg_color,
        )
        draw.rounded_rectangle(
            [ox + core_gap, oy + core_gap, ox + outer - core_gap - 1, oy + outer - core_gap - 1],
            radius=r_in,
            fill=eye_color,
        )
    elif style == "rounded":
        r_out = max(2, int(box_size * 0.38))
        r_mid = max(1, int(box_size * 0.28))
        r_in = max(1, int(box_size * 0.25))
        draw.rounded_rectangle([ox, oy, ox + outer - 1, oy + outer - 1], radius=r_out, fill=eye_color)
        draw.rounded_rectangle(
            [ox + inner_gap, oy + inner_gap, ox + outer - inner_gap - 1, oy + outer - inner_gap - 1],
            radius=r_mid,
            fill=bg_color,
        )
        draw.rounded_rectangle(
            [ox + core_gap, oy + core_gap, ox + outer - core_gap - 1, oy + outer - core_gap - 1],
            radius=r_in,
            fill=eye_color,
        )
    else:
        draw.rectangle([ox, oy, ox + outer - 1, oy + outer - 1], fill=eye_color)
        draw.rectangle(
            [ox + inner_gap, oy + inner_gap, ox + outer - inner_gap - 1, oy + outer - inner_gap - 1],
            fill=bg_color,
        )
        draw.rectangle(
            [ox + core_gap, oy + core_gap, ox + outer - core_gap - 1, oy + outer - core_gap - 1],
            fill=eye_color,
        )


def build_qr_bundle(
    data: str,
    theme: str = "cyber",
    shape: str = "rounded",
    finder_style: str = "rounded",
    badge_text: str = "",
    caption: str = "",
    fg_hex: str | None = None,
    bg_hex: str | None = None,
    error_level: str = "H",
    framed: bool = True,
) -> dict[str, Any]:
    payload = (data or "").strip()
    if not payload:
        raise ValueError("Пустые данные для QR-кода")
    if len(payload.encode("utf-8")) > 2600:
        raise ValueError("Слишком большой объём данных для одного QR-кода (макс. ~2600 байт UTF-8)")

    palette = QR_THEMES.get(theme, QR_THEMES["cyber"])
    fg = _parse_hex_color(fg_hex, palette["fg"])
    bg = _parse_hex_color(bg_hex, palette["bg"])
    eye_col = _parse_hex_color(fg_hex, palette.get("eye", fg))
    accent_col = palette.get("accent", eye_col)
    frame_col = palette.get("frame", (15, 23, 42))

    # Force Level H whenever a center badge is present so Reed-Solomon has 30% parity recovery
    ec_map = {
        "L": qrcode.constants.ERROR_CORRECT_L,
        "M": qrcode.constants.ERROR_CORRECT_M,
        "Q": qrcode.constants.ERROR_CORRECT_Q,
        "H": qrcode.constants.ERROR_CORRECT_H,
    }
    ec_key = "H" if badge_text.strip() else (error_level or "H").upper()
    ec_const = ec_map.get(ec_key, qrcode.constants.ERROR_CORRECT_H)

    qr = qrcode.QRCode(
        version=None,
        error_correction=ec_const,
        box_size=18,
        border=4,
    )
    qr.add_data(payload)
    qr.make(fit=True)

    matrix = qr.get_matrix()  # includes quiet zone of 4 modules on each side
    total_n = len(matrix)
    border = 4
    core_n = total_n - 2 * border
    version = int(qr.version)

    # Dynamic box_size keeps crisp ~720-920px image regardless of QR version
    box_size = max(12, min(22, 820 // max(total_n, 25)))
    qr_px = total_n * box_size

    qr_img = Image.new("RGB", (qr_px, qr_px), bg)
    draw = ImageDraw.Draw(qr_img)

    norm_shape = (shape or "rounded").lower()
    # Safe center badge zone in module coordinates (<= 15.5% of core matrix width -> ~2.4% area, well under 30% Level H)
    clean_badge = badge_text.strip()[:4]
    badge_half_mods = 0.0
    center_mod = total_n / 2.0
    if clean_badge:
        badge_mods = max(5, min(int(core_n * 0.165), 11))
        if badge_mods % 2 == 0:
            badge_mods += 1
        badge_half_mods = badge_mods / 2.0 + 0.55

    # Draw standard 7x7 finder eyes cleanly as crisp geometric primitives
    eye_style = finder_style if norm_shape != "square" else (finder_style if finder_style != "rounded" else "square")
    for er, ec in ((border, border), (border, total_n - border - 7), (total_n - border - 7, border)):
        _draw_finder_eye_pil(
            draw,
            ec * box_size,
            er * box_size,
            box_size,
            eye_col,
            bg,
            eye_style,
        )

    # Draw remaining data + alignment + timing modules
    for r, row in enumerate(matrix):
        for c, val in enumerate(row):
            if not val:
                continue
            cr = r - border
            cc = c - border
            if 0 <= cr < core_n and 0 <= cc < core_n and _is_finder_module(cr, cc, core_n):
                continue
            if badge_half_mods > 0 and abs((r + 0.5) - center_mod) <= badge_half_mods and abs((c + 0.5) - center_mod) <= badge_half_mods:
                continue

            x0 = c * box_size
            y0 = r * box_size
            x1 = x0 + box_size - 1
            y1 = y0 + box_size - 1

            # Keep alignment patterns crisp so dense vCard / Wi-Fi QRs lock immediately
            is_align = 0 <= cr < core_n and 0 <= cc < core_n and _is_alignment_module(cr, cc, version, core_n)
            if is_align or norm_shape == "square":
                draw.rectangle([x0, y0, x1, y1], fill=fg)
            elif norm_shape == "dots":
                inset = max(1, int(box_size * 0.08))
                draw.ellipse([x0 + inset, y0 + inset, x1 - inset, y1 - inset], fill=fg)
            elif norm_shape == "gapped":
                pad = max(1, int(box_size * 0.10))
                draw.rounded_rectangle(
                    [x0 + pad, y0 + pad, x1 - pad, y1 - pad],
                    radius=max(2, box_size // 4),
                    fill=fg,
                )
            elif norm_shape == "diamond":
                cx = (x0 + x1) / 2.0
                cy = (y0 + y1) / 2.0
                rad = box_size * 0.48
                draw.polygon([(cx, cy - rad), (cx + rad, cy), (cx, cy + rad), (cx - rad, cy)], fill=fg)
            else:  # rounded
                pad = max(0, int(box_size * 0.05))
                draw.rounded_rectangle(
                    [x0 + pad, y0 + pad, x1 - pad, y1 - pad],
                    radius=max(3, int(box_size * 0.32)),
                    fill=fg,
                )

    # Crisp calibrated center badge
    if clean_badge:
        badge_px = int((badge_half_mods * 2 - 0.6) * box_size)
        bx0 = (qr_px - badge_px) // 2
        by0 = (qr_px - badge_px) // 2
        halo = max(3, box_size // 3)
        draw.rounded_rectangle(
            [bx0 - halo, by0 - halo, bx0 + badge_px + halo, by0 + badge_px + halo],
            radius=max(8, badge_px // 4),
            fill=bg,
        )
        draw.rounded_rectangle(
            [bx0, by0, bx0 + badge_px, by0 + badge_px],
            radius=max(6, badge_px // 4),
            fill=eye_col,
        )
        font_sz = max(14, int(badge_px * (0.46 if len(clean_badge) <= 2 else 0.34)))
        font = _load_font(font_sz)
        bbox = draw.textbbox((0, 0), clean_badge, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        tx = bx0 + (badge_px - tw) // 2 - bbox[0]
        ty = by0 + (badge_px - th) // 2 - bbox[1]
        draw.text((tx, ty), clean_badge, fill=bg, font=font)

    # Optional studio card frame AROUND the intact ISO quiet zone (never invades quiet zone!)
    clean_cap = caption.strip()[:56]
    use_frame = framed and (theme != "classic" or bool(clean_cap)) and not (fg_hex or bg_hex)
    if use_frame or clean_cap:
        pad_outer = 24 if use_frame else 0
        cap_h = 58 if clean_cap else 0
        canvas_w = qr_px + pad_outer * 2
        canvas_h = qr_px + pad_outer * 2 + cap_h
        outer_bg = frame_col if use_frame else bg
        canvas = Image.new("RGB", (canvas_w, canvas_h), outer_bg)
        cdraw = ImageDraw.Draw(canvas)
        if use_frame:
            cdraw.rounded_rectangle(
                [pad_outer - 4, pad_outer - 4, pad_outer + qr_px + 3, pad_outer + qr_px + 3],
                radius=18,
                outline=accent_col,
                width=2,
            )
        canvas.paste(qr_img, (pad_outer, pad_outer))
        if clean_cap:
            cfont = _load_font(22)
            cbbox = cdraw.textbbox((0, 0), clean_cap, font=cfont)
            cw = cbbox[2] - cbbox[0]
            cx = max(14, (canvas_w - cw) // 2)
            cy = pad_outer + qr_px + (cap_h + pad_outer - 24) // 2 - 4 if use_frame else qr_px + 14
            cap_color = (240, 249, 255) if use_frame and _rel_luminance(outer_bg) < 0.35 else fg
            cdraw.text((cx, cy), clean_cap, fill=cap_color, font=cfont)
        final_img = canvas
    else:
        final_img = qr_img

    buf = io.BytesIO()
    final_img.save(buf, format="PNG", optimize=True)
    png_bytes = buf.getvalue()

    svg_str = generate_qr_svg(
        matrix=matrix,
        version=version,
        fg_hex=_rgb_to_hex(fg),
        eye_hex=_rgb_to_hex(eye_col),
        bg_hex=_rgb_to_hex(bg),
        shape=norm_shape,
        finder_style=eye_style,
        badge_text=clean_badge,
        caption=clean_cap,
    )

    contrast = compute_qr_contrast(fg, bg)
    return {
        "png_bytes": png_bytes,
        "svg_text": svg_str,
        "version": version,
        "modules": core_n,
        "error_correction": ec_key,
        "contrast": contrast,
    }


def generate_qr_svg(
    matrix: list[list[bool]],
    version: int,
    fg_hex: str = "#0a1a2f",
    eye_hex: str = "#0076b6",
    bg_hex: str = "#f6fcff",
    shape: str = "rounded",
    finder_style: str = "rounded",
    badge_text: str = "",
    caption: str = "",
) -> str:
    total_n = len(matrix)
    border = 4
    core_n = total_n - 2 * border
    cell = 10
    qr_px = total_n * cell
    extra_h = 36 if caption else 0
    w = qr_px
    h = qr_px + extra_h

    clean_badge = badge_text.strip()[:4]
    badge_half_mods = 0.0
    center_mod = total_n / 2.0
    if clean_badge:
        badge_mods = max(5, min(int(core_n * 0.165), 11))
        if badge_mods % 2 == 0:
            badge_mods += 1
        badge_half_mods = badge_mods / 2.0 + 0.55

    parts: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" shape-rendering="geometricPrecision">',
        f'<rect width="{w}" height="{h}" fill="{bg_hex}"/>',
    ]

    # Finder eyes (preserve strict 1:1:3:1:1 diagonal ratio for universal camera lock)
    for er, ec in ((border, border), (border, total_n - border - 7), (total_n - border - 7, border)):
        ox, oy = ec * cell, er * cell
        outer = 7 * cell
        rx_o = 5 if finder_style == "circle" else (3.5 if finder_style == "rounded" else 0)
        rx_m = 4 if finder_style == "circle" else (2.5 if finder_style == "rounded" else 0)
        rx_i = 4 if finder_style == "circle" else (2.5 if finder_style == "rounded" else 0)
        parts.append(f'<rect x="{ox}" y="{oy}" width="{outer}" height="{outer}" rx="{rx_o}" fill="{eye_hex}"/>')
        parts.append(
            f'<rect x="{ox + cell}" y="{oy + cell}" width="{5 * cell}" height="{5 * cell}" rx="{rx_m}" fill="{bg_hex}"/>'
        )
        parts.append(
            f'<rect x="{ox + 2 * cell}" y="{oy + 2 * cell}" width="{3 * cell}" height="{3 * cell}" rx="{rx_i}" fill="{eye_hex}"/>'
        )

    # Modules
    for r, row in enumerate(matrix):
        for c, val in enumerate(row):
            if not val:
                continue
            cr, cc = r - border, c - border
            if 0 <= cr < core_n and 0 <= cc < core_n and _is_finder_module(cr, cc, core_n):
                continue
            if badge_half_mods > 0 and abs((r + 0.5) - center_mod) <= badge_half_mods and abs((c + 0.5) - center_mod) <= badge_half_mods:
                continue
            x, y = c * cell, r * cell
            is_align = 0 <= cr < core_n and 0 <= cc < core_n and _is_alignment_module(cr, cc, version, core_n)
            if is_align or shape == "square":
                parts.append(f'<rect x="{x}" y="{y}" width="{cell}" height="{cell}" fill="{fg_hex}"/>')
            elif shape == "dots":
                parts.append(f'<circle cx="{x + cell / 2}" cy="{y + cell / 2}" r="{cell * 0.43:.2f}" fill="{fg_hex}"/>')
            elif shape == "diamond":
                cx, cy = x + cell / 2, y + cell / 2
                rad = cell * 0.48
                parts.append(
                    f'<polygon points="{cx},{cy - rad:.1f} {cx + rad:.1f},{cy} {cx},{cy + rad:.1f} {cx - rad:.1f},{cy}" fill="{fg_hex}"/>'
                )
            elif shape == "gapped":
                parts.append(f'<rect x="{x + 1}" y="{y + 1}" width="{cell - 2}" height="{cell - 2}" rx="2.5" fill="{fg_hex}"/>')
            else:
                parts.append(f'<rect x="{x + 0.4}" y="{y + 0.4}" width="{cell - 0.8}" height="{cell - 0.8}" rx="3" fill="{fg_hex}"/>')

    if clean_badge:
        bpx = (badge_half_mods * 2 - 0.6) * cell
        bx = (qr_px - bpx) / 2
        by = (qr_px - bpx) / 2
        parts.append(f'<rect x="{bx - 3:.1f}" y="{by - 3:.1f}" width="{bpx + 6:.1f}" height="{bpx + 6:.1f}" rx="8" fill="{bg_hex}"/>')
        parts.append(f'<rect x="{bx:.1f}" y="{by:.1f}" width="{bpx:.1f}" height="{bpx:.1f}" rx="7" fill="{eye_hex}"/>')
        fsz = bpx * (0.46 if len(clean_badge) <= 2 else 0.34)
        parts.append(
            f'<text x="{qr_px / 2:.1f}" y="{by + bpx * 0.67:.1f}" text-anchor="middle" font-family="DejaVu Sans, system-ui, sans-serif" font-weight="700" font-size="{fsz:.1f}" fill="{bg_hex}">{html.escape(clean_badge)}</text>'
        )

    if caption:
        parts.append(
            f'<text x="{qr_px / 2:.1f}" y="{qr_px + 24}" text-anchor="middle" font-family="DejaVu Sans, system-ui, sans-serif" font-weight="700" font-size="14" fill="{fg_hex}">{html.escape(caption)}</text>'
        )

    parts.append("</svg>")
    return "".join(parts)


def generate_styled_qr(
    data: str,
    theme: str = "cyber",
    shape: str = "rounded",
    badge_text: str = "",
    caption: str = "",
    fg_hex: str | None = None,
    bg_hex: str | None = None,
    finder_style: str = "rounded",
    error_level: str = "H",
    framed: bool = True,
) -> bytes:
    bundle = build_qr_bundle(
        data=data,
        theme=theme,
        shape=shape,
        finder_style=finder_style,
        badge_text=badge_text,
        caption=caption,
        fg_hex=fg_hex,
        bg_hex=bg_hex,
        error_level=error_level,
        framed=framed,
    )
    return bundle["png_bytes"]


def generate_barcode_png(value: str, kind: str = "code128") -> bytes:
    clean = (value or "").strip()
    if not clean:
        raise ValueError("Пустое значение штрих-кода")

    kind_norm = kind.lower()
    if kind_norm == "ean13":
        digits = "".join(ch for ch in clean if ch.isdigit())
        if len(digits) < 12:
            raise ValueError("Для EAN-13 нужно минимум 12 цифр")
        clean = digits[:12]
        cls = barcode.get_barcode_class("ean13")
    elif kind_norm == "ean8":
        digits = "".join(ch for ch in clean if ch.isdigit())
        if len(digits) < 7:
            raise ValueError("Для EAN-8 нужно минимум 7 цифр")
        clean = digits[:7]
        cls = barcode.get_barcode_class("ean8")
    elif kind_norm == "upca":
        digits = "".join(ch for ch in clean if ch.isdigit())
        if len(digits) < 11:
            raise ValueError("Для UPC-A нужно минимум 11 цифр")
        clean = digits[:11]
        cls = barcode.get_barcode_class("upca")
    else:
        if any(ord(c) > 127 for c in clean):
            raise ValueError("Code-128 поддерживает только латиницу, цифры и ASCII-символы")
        cls = barcode.get_barcode_class("code128")

    writer = ImageWriter()
    bc = cls(clean, writer=writer)
    buf = io.BytesIO()
    bc.write(
        buf,
        options={
            "module_width": 0.42,
            "module_height": 18.0,
            "quiet_zone": 6.5,
            "font_size": 12,
            "text_distance": 5.0,
            "background": "white",
            "foreground": "#0f172a",
        },
    )
    return buf.getvalue()


def _parse_wifi_fields(raw: str) -> list[dict[str, str]]:
    body = raw[5:] if raw.upper().startswith("WIFI:") else raw
    fields: list[dict[str, str]] = []
    for key, label in (("S", "Сеть (SSID)"), ("P", "Пароль"), ("T", "Защита"), ("H", "Скрытая сеть")):
        m = re.search(rf"(?:^|;){key}:((?:\\.|[^;])*)", body)
        if m:
            val = re.sub(r"\\(.)", r"\1", m.group(1))
            if val:
                fields.append({"label": label, "value": val})
    return fields


def _parse_vcard_fields(raw: str) -> list[dict[str, str]]:
    fields: list[dict[str, str]] = []
    mapping = (
        ("FN:", "Имя"),
        ("ORG:", "Организация"),
        ("TITLE:", "Должность"),
        ("TEL", "Телефон"),
        ("EMAIL", "Email"),
        ("URL:", "Ссылка"),
    )
    for line in raw.splitlines():
        s = line.strip()
        for prefix, label in mapping:
            if s.upper().startswith(prefix):
                val = s.split(":", 1)[1].strip() if ":" in s else ""
                if val:
                    fields.append({"label": label, "value": val})
                break
    return fields


def inspect_qr_payload(text: str) -> dict[str, Any]:
    t = (text or "").strip()
    low = t.lower()
    fields: list[dict[str, str]] = []
    action_url: str | None = None
    action_label: str | None = None

    if low.startswith("wifi:"):
        fields = _parse_wifi_fields(t)
        ssid = next((f["value"] for f in fields if "SSID" in f["label"]), "Wi-Fi")
        return {
            "type": "Wi-Fi сеть",
            "icon": "📶",
            "summary": f"Подключение к Wi-Fi «{ssid}»",
            "fields": fields,
            "action_url": None,
            "action_label": None,
            "length": len(t),
            "bytes_utf8": len(t.encode("utf-8")),
        }

    if "begin:vcard" in low or low.startswith("mecard:"):
        fields = _parse_vcard_fields(t)
        fn = next((f["value"] for f in fields if f["label"] == "Имя"), "Контакт")
        return {
            "type": "Визитка vCard",
            "icon": "👤",
            "summary": f"Контакт: {fn}",
            "fields": fields,
            "action_url": None,
            "action_label": None,
            "length": len(t),
            "bytes_utf8": len(t.encode("utf-8")),
        }

    if low.startswith("otpauth://"):
        parsed = urlparse(t)
        qs = parse_qs(parsed.query)
        issuer = qs.get("issuer", [""])[0] or unquote(parsed.path.lstrip("/"))
        secret = qs.get("secret", [""])[0]
        if issuer:
            fields.append({"label": "Сервис", "value": issuer})
        if secret:
            fields.append({"label": "TOTP Secret", "value": secret})
        return {
            "type": "2FA TOTP Ключ",
            "icon": "🔐",
            "summary": f"Двухфакторный токен {issuer}".strip(),
            "fields": fields,
            "action_url": None,
            "action_label": None,
            "length": len(t),
            "bytes_utf8": len(t.encode("utf-8")),
        }

    if low.startswith(("https://t.me/", "http://t.me/", "tg://")):
        action_url = t
        action_label = "Открыть в Telegram"
        fields.append({"label": "Telegram ссылка", "value": t})
        return {
            "type": "Telegram Deep-Link",
            "icon": "✈️",
            "summary": t[:90],
            "fields": fields,
            "action_url": action_url,
            "action_label": action_label,
            "length": len(t),
            "bytes_utf8": len(t.encode("utf-8")),
        }

    if low.startswith(("https://wa.me/", "whatsapp://")):
        action_url = t
        action_label = "Открыть в WhatsApp"
        fields.append({"label": "WhatsApp", "value": t})
        return {
            "type": "WhatsApp Чат",
            "icon": "💬",
            "summary": t[:90],
            "fields": fields,
            "action_url": action_url,
            "action_label": action_label,
            "length": len(t),
            "bytes_utf8": len(t.encode("utf-8")),
        }

    if "qr.nspk.ru" in low:
        return {
            "type": "Платёж СБП (НСПК)",
            "icon": "💳",
            "summary": "Платёжная ссылка Системы быстрых платежей",
            "fields": [{"label": "СБП URL", "value": t}],
            "action_url": t,
            "action_label": "Открыть СБП",
            "length": len(t),
            "bytes_utf8": len(t.encode("utf-8")),
        }

    if re.search(r"(?:^|&)t=\d{8}T\d{4,6}", t) and "s=" in low and "fn=" in low:
        qs = parse_qs(t)
        summ = qs.get("s", ["?"])[0]
        dt = qs.get("t", ["?"])[0]
        fn = qs.get("fn", ["?"])[0]
        fields = [
            {"label": "Сумма чека", "value": f"{summ} ₽"},
            {"label": "Дата/время", "value": dt},
            {"label": "ФН кассы", "value": fn},
        ]
        return {
            "type": "Кассовый чек ФНС",
            "icon": "🧾",
            "summary": f"Чек на сумму {summ} ₽",
            "fields": fields,
            "action_url": None,
            "action_label": None,
            "length": len(t),
            "bytes_utf8": len(t.encode("utf-8")),
        }

    if low.startswith(("ton://", "bitcoin:", "ethereum:", "tron:")):
        scheme = t.split(":", 1)[0].upper()
        fields.append({"label": "Крипто-URI", "value": t})
        return {
            "type": f"Крипто-платёж ({scheme})",
            "icon": "🪙",
            "summary": t[:90],
            "fields": fields,
            "action_url": t,
            "action_label": f"Открыть {scheme}",
            "length": len(t),
            "bytes_utf8": len(t.encode("utf-8")),
        }

    if low.startswith(("http://", "https://")):
        parsed = urlparse(t)
        fields.append({"label": "Домен", "value": parsed.netloc})
        return {
            "type": "Веб-ссылка (URL)",
            "icon": "🌐",
            "summary": t[:90],
            "fields": fields,
            "action_url": t,
            "action_label": "Открыть сайт",
            "length": len(t),
            "bytes_utf8": len(t.encode("utf-8")),
        }

    if low.startswith("mailto:"):
        parsed = urlparse(t)
        qs = parse_qs(parsed.query)
        fields.append({"label": "Кому", "value": unquote(parsed.path)})
        if qs.get("subject"):
            fields.append({"label": "Тема", "value": qs["subject"][0]})
        return {
            "type": "Email письмо",
            "icon": "✉️",
            "summary": f"Письмо на {unquote(parsed.path)}",
            "fields": fields,
            "action_url": t,
            "action_label": "Написать письмо",
            "length": len(t),
            "bytes_utf8": len(t.encode("utf-8")),
        }

    if low.startswith(("tel:", "smsto:", "sms:")):
        return {
            "type": "Телефон / SMS",
            "icon": "📞",
            "summary": t,
            "fields": [{"label": "Контакт", "value": t}],
            "action_url": t if low.startswith("tel:") else None,
            "action_label": "Позвонить" if low.startswith("tel:") else None,
            "length": len(t),
            "bytes_utf8": len(t.encode("utf-8")),
        }

    if low.startswith("geo:"):
        coords = t[4:].split("?")[0]
        return {
            "type": "Геолокация",
            "icon": "📍",
            "summary": f"Координаты {coords}",
            "fields": [{"label": "Координаты", "value": coords}],
            "action_url": f"https://maps.google.com/?q={quote(coords)}",
            "action_label": "Открыть на карте",
            "length": len(t),
            "bytes_utf8": len(t.encode("utf-8")),
        }

    return {
        "type": "Текст / Данные",
        "icon": "📝",
        "summary": t[:90],
        "fields": [],
        "action_url": None,
        "action_label": None,
        "length": len(t),
        "bytes_utf8": len(t.encode("utf-8")),
    }
