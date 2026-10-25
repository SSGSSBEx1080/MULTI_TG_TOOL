from __future__ import annotations

import io
from typing import Any
from urllib.parse import urlparse, parse_qs

import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers import (
    CircleModuleDrawer,
    GappedSquareModuleDrawer,
    HorizontalBarsDrawer,
    RoundedModuleDrawer,
    SquareModuleDrawer,
    VerticalBarsDrawer,
)
from qrcode.image.styles.colormasks import (
    HorizontalGradiantColorMask,
    RadialGradiantColorMask,
    SolidFillColorMask,
    VerticalGradiantColorMask,
)
from PIL import Image, ImageDraw, ImageFont
import barcode
from barcode.writer import ImageWriter

from backend.config import FONT_BOLD, FONT_REGULAR

QR_THEMES: dict[str, dict[str, Any]] = {
    "cyber": {
        "label": "Кибер Неон",
        "mode": "radial",
        "bg": (12, 16, 30),
        "c1": (56, 189, 248),
        "c2": (168, 85, 247),
    },
    "telegram": {
        "label": "Telegram Blue",
        "mode": "vertical",
        "bg": (255, 255, 255),
        "c1": (0, 136, 204),
        "c2": (36, 161, 222),
    },
    "emerald": {
        "label": "Изумруд",
        "mode": "horizontal",
        "bg": (10, 24, 20),
        "c1": (16, 185, 129),
        "c2": (56, 189, 248),
    },
    "sunset": {
        "label": "Закат",
        "mode": "vertical",
        "bg": (255, 252, 248),
        "c1": (244, 63, 94),
        "c2": (245, 158, 11),
    },
    "classic": {
        "label": "Классика Ч/Б",
        "mode": "solid",
        "bg": (255, 255, 255),
        "c1": (17, 24, 39),
        "c2": (17, 24, 39),
    },
    "royal": {
        "label": "Индиго Люкс",
        "mode": "radial",
        "bg": (248, 250, 252),
        "c1": (79, 70, 229),
        "c2": (219, 39, 119),
    },
}

QR_SHAPES = {
    "rounded": RoundedModuleDrawer,
    "dots": CircleModuleDrawer,
    "gapped": GappedSquareModuleDrawer,
    "square": SquareModuleDrawer,
    "vbars": VerticalBarsDrawer,
    "hbars": HorizontalBarsDrawer,
}


def _hex_to_rgb(value: str, fallback: tuple[int, int, int]) -> tuple[int, int, int]:
    val = (value or "").strip().lstrip("#")
    if len(val) == 3:
        val = "".join(ch * 2 for ch in val)
    if len(val) == 6:
        try:
            return (int(val[0:2], 16), int(val[2:4], 16), int(val[4:6], 16))
        except ValueError:
            pass
    return fallback


def generate_styled_qr(
    data: str,
    theme: str = "cyber",
    shape: str = "rounded",
    badge_text: str = "",
    caption: str = "",
    fg_hex: str = "",
    bg_hex: str = "",
    box_size: int = 12,
) -> bytes:
    payload = (data or "").strip()
    if not payload:
        raise ValueError("Данные для QR-кода не могут быть пустыми")

    preset = QR_THEMES.get(theme, QR_THEMES["cyber"])
    bg = _hex_to_rgb(bg_hex, preset["bg"]) if bg_hex else preset["bg"]
    c1 = _hex_to_rgb(fg_hex, preset["c1"]) if fg_hex else preset["c1"]
    c2 = _hex_to_rgb(fg_hex, preset["c2"]) if fg_hex else preset["c2"]

    # Avoid identical foreground and background
    if c1 == bg:
        bg = (255, 255, 255) if sum(c1) < 380 else (15, 23, 42)

    drawer_cls = QR_SHAPES.get(shape, RoundedModuleDrawer)
    mode = "solid" if fg_hex else preset["mode"]
    if mode == "radial":
        color_mask = RadialGradiantColorMask(back_color=bg, center_color=c1, edge_color=c2)
    elif mode == "vertical":
        color_mask = VerticalGradiantColorMask(back_color=bg, top_color=c1, bottom_color=c2)
    elif mode == "horizontal":
        color_mask = HorizontalGradiantColorMask(back_color=bg, left_color=c1, right_color=c2)
    else:
        color_mask = SolidFillColorMask(back_color=bg, front_color=c1)

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=max(8, min(box_size, 20)),
        border=3,
    )
    qr.add_data(payload)
    qr.make(fit=True)

    qr_img = qr.make_image(
        image_factory=StyledPilImage,
        module_drawer=drawer_cls(),
        color_mask=color_mask,
    ).convert("RGBA")

    w, h = qr_img.size

    # Optional center badge pill (safe with ERROR_CORRECT_H up to ~18% area)
    clean_badge = badge_text.strip()[:8]
    if clean_badge:
        draw = ImageDraw.Draw(qr_img)
        badge_size = int(min(w, h) * 0.21)
        x0 = (w - badge_size) // 2
        y0 = (h - badge_size) // 2
        x1 = x0 + badge_size
        y1 = y0 + badge_size
        draw.rounded_rectangle([x0 - 5, y0 - 5, x1 + 5, y1 + 5], radius=18, fill=bg)
        draw.rounded_rectangle([x0, y0, x1, y1], radius=14, fill=c1)

        font_size = max(14, int(badge_size * 0.34))
        try:
            font = ImageFont.truetype(FONT_BOLD, font_size)
        except OSError:
            font = ImageFont.load_default()
        bbox = draw.textbbox((0, 0), clean_badge, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        text_color = (255, 255, 255) if sum(c1) < 440 else (15, 23, 42)
        draw.text(
            (x0 + (badge_size - tw) / 2 - bbox[0], y0 + (badge_size - th) / 2 - bbox[1]),
            clean_badge,
            font=font,
            fill=text_color,
        )

    # Frame card with rounded padding & optional caption
    pad = 28
    cap_clean = caption.strip()[:64]
    extra_bottom = 52 if cap_clean else 0
    card_w = w + pad * 2
    card_h = h + pad * 2 + extra_bottom

    card = Image.new("RGBA", (card_w, card_h), bg + (255,))
    card.paste(qr_img, (pad, pad), qr_img)

    if cap_clean:
        draw_c = ImageDraw.Draw(card)
        try:
            cap_font = ImageFont.truetype(FONT_REGULAR, 18)
        except OSError:
            cap_font = ImageFont.load_default()
        bbox = draw_c.textbbox((0, 0), cap_clean, font=cap_font)
        tw = bbox[2] - bbox[0]
        cap_color = (226, 232, 240) if sum(bg) < 380 else (51, 65, 85)
        draw_c.text(((card_w - tw) / 2, h + pad + 10), cap_clean, font=cap_font, fill=cap_color)

    buf = io.BytesIO()
    card.convert("RGB").save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def build_wifi_payload(ssid: str, password: str = "", security: str = "WPA", hidden: bool = False) -> str:
    sec = security.upper() if security.upper() in ("WPA", "WEP", "nopass", "NOPASS") else "WPA"
    if not password:
        sec = "nopass"
    esc_ssid = ssid.replace("\\", "\\\\").replace(";", r"\;").replace(",", r"\,").replace(":", r"\:")
    esc_pwd = password.replace("\\", "\\\\").replace(";", r"\;").replace(",", r"\,").replace(":", r"\:")
    hidden_str = "true" if hidden else "false"
    return f"WIFI:T:{sec};S:{esc_ssid};P:{esc_pwd};H:{hidden_str};;"


def build_vcard_payload(
    full_name: str,
    phone: str = "",
    email: str = "",
    org: str = "",
    title: str = "",
    url: str = "",
    telegram: str = "",
) -> str:
    lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        f"FN:{full_name.strip()}",
        f"N:{full_name.strip()};;;;",
    ]
    if org.strip():
        lines.append(f"ORG:{org.strip()}")
    if title.strip():
        lines.append(f"TITLE:{title.strip()}")
    if phone.strip():
        lines.append(f"TEL;TYPE=CELL:{phone.strip()}")
    if email.strip():
        lines.append(f"EMAIL:{email.strip()}")
    if url.strip():
        lines.append(f"URL:{url.strip()}")
    if telegram.strip():
        tg_handle = telegram.strip().lstrip("@")
        lines.append(f"URL:https://t.me/{tg_handle}")
    lines.append("END:VCARD")
    return "\n".join(lines)


def generate_barcode_png(code_value: str, kind: str = "code128") -> bytes:
    val = (code_value or "").strip()
    if not val:
        raise ValueError("Значение штрихкода не задано")

    kind_norm = kind.lower().strip()
    if kind_norm == "ean13":
        digits = "".join(ch for ch in val if ch.isdigit())
        if len(digits) < 12:
            raise ValueError("Для EAN-13 требуется минимум 12 цифр")
        val = digits[:12]
        cls = barcode.get_barcode_class("ean13")
    else:
        if not all(32 <= ord(c) <= 126 for c in val):
            raise ValueError("Code128 поддерживает латиницу, цифры и ASCII-символы")
        cls = barcode.get_barcode_class("code128")

    writer = ImageWriter()
    instance = cls(val, writer=writer)
    buf = io.BytesIO()
    instance.write(
        buf,
        options={
            "module_width": 0.35,
            "module_height": 16.0,
            "quiet_zone": 6.0,
            "font_path": FONT_REGULAR,
            "font_size": 12,
            "text_distance": 5.0,
            "background": "white",
            "foreground": "#0f172a",
        },
    )
    return buf.getvalue()


def inspect_qr_payload(raw: str) -> dict[str, Any]:
    text = (raw or "").strip()
    if text.upper().startswith("WIFI:"):
        fields: dict[str, str] = {}
        body = text[5:].rstrip(";")
        for part in body.split(";"):
            if ":" in part:
                k, v = part.split(":", 1)
                fields[k.upper()] = v
        return {
            "type": "Wi-Fi сеть",
            "details": {
                "SSID": fields.get("S", ""),
                "Защита": fields.get("T", "WPA"),
                "Пароль": fields.get("P", "(открытая сеть)"),
                "Скрытая": fields.get("H", "false"),
            },
        }
    if text.upper().startswith("BEGIN:VCARD"):
        info: dict[str, str] = {}
        for line in text.splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                if k not in ("BEGIN", "END", "VERSION"):
                    info[k.split(";")[0]] = v
        return {"type": "Визитка vCard", "details": info}
    if text.lower().startswith("otpauth://"):
        parsed = urlparse(text)
        qs = {k: v[0] for k, v in parse_qs(parsed.query).items()}
        return {
            "type": "2FA TOTP Ключ",
            "details": {"Аккаунт": parsed.path.lstrip("/"), **qs},
        }
    if text.lower().startswith(("http://", "https://", "tg://")):
        parsed = urlparse(text)
        return {
            "type": "Веб-ссылка / Deep Link",
            "details": {
                "Протокол": parsed.scheme,
                "Домен": parsed.netloc,
                "Путь": parsed.path or "/",
            },
        }
    return {"type": "Текстовые данные", "details": {"Длина": f"{len(text)} симв.", "Текст": text[:200]}}
