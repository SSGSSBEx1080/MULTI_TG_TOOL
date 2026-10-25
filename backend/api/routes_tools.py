from __future__ import annotations

import asyncio
import base64
import json
import secrets
import time
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel

from backend.api.tg_auth import resolve_api_user
from backend.config import DEFAULT_DEMO_USER_ID, GENERATED_DIR
from backend.database import db
from backend.tools import TOOL_CATEGORIES
from backend.tools.dev_tools import (
    evaluate_regex,
    explain_cron,
    format_convert_data,
    generate_ids_and_timestamps,
    transform_codec,
)
from backend.tools.image_lab import (
    CODE_THEMES,
    inspect_and_clean_image,
    render_code_card,
    stego_decode_png,
    stego_encode_png,
    transform_image,
)
from backend.tools.omni_detector import smart_omni_detect
from backend.tools.pdf_forge import (
    images_to_pdf,
    inspect_pdf,
    render_text_to_pdf,
    transform_pdf,
)
from backend.tools.qr_studio import (
    QR_THEMES,
    build_vcard_payload,
    build_wifi_payload,
    generate_barcode_png,
    generate_styled_qr,
    inspect_qr_payload,
)
from backend.tools.security_lab import (
    compute_hashes,
    decrypt_nx1,
    encrypt_nx1,
    generate_passwords,
    generate_totp_info,
    identify_hash,
    inspect_jwt,
    sign_jwt,
)
from backend.tools.smart_calc import (
    UNIT_TABLES,
    calculate_finance,
    calculate_subnet,
    convert_units,
    evaluate_math,
)
from backend.tools.text_studio import (
    analyze_and_diff_text,
    fix_keyboard_layout,
    run_randomizer,
    stylize_text,
)

router = APIRouter(prefix="/api/tools", tags=["tools"])

MAX_UPLOAD_BYTES = 15 * 1024 * 1024  # 15 MiB safety cap for 512 MB RAM containers
_CLEANUP_COUNTER = 0


async def _read_upload_safe(file: UploadFile, max_bytes: int = MAX_UPLOAD_BYTES) -> bytes:
    raw = await file.read(max_bytes + 1)
    if len(raw) > max_bytes:
        raise HTTPException(status_code=413, detail="Файл слишком большой (максимум 15 МБ)")
    return raw


def _persist_generated_sync(raw: bytes, ext: str, prefix: str = "mt") -> str:
    global _CLEANUP_COUNTER
    fname = f"{prefix}_{int(time.time() * 1000)}_{secrets.token_hex(4)}.{ext.lstrip('.')}"
    (GENERATED_DIR / fname).write_bytes(raw)
    _CLEANUP_COUNTER += 1
    if _CLEANUP_COUNTER % 50 == 0:
        cutoff = time.time() - 3600
        try:
            for item in GENERATED_DIR.iterdir():
                if item.is_file() and item.stat().st_mtime < cutoff:
                    item.unlink(missing_ok=True)
        except Exception:
            pass
    return f"/media/generated/{fname}"


def _b64_data_uri(raw: bytes, mime: str = "image/png") -> str:
    return f"data:{mime};base64,{base64.b64encode(raw).decode('ascii')}"


@router.get("/catalog")
async def get_catalog() -> dict[str, Any]:
    return {
        "categories": TOOL_CATEGORIES,
        "qr_themes": {k: v["label"] for k, v in QR_THEMES.items()},
        "code_themes": {k: v["label"] for k, v in CODE_THEMES.items()},
        "unit_categories": {k: list(v.keys()) for k, v in UNIT_TABLES.items()} | {"temperature": ["C", "F", "K"]},
    }


class OmniReq(BaseModel):
    text: str
    user_id: int = DEFAULT_DEMO_USER_ID


@router.post("/omni")
async def api_omni(req: OmniReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    res = smart_omni_detect(req.text)
    if res["kind"] != "empty":
        await db.record_tool_use(uid, res.get("tool_id", "omni"), "omni", "miniapp", res["kind"], xp_gain=6)
    return res


# --- 1. QR & Barcodes ---
class QrReq(BaseModel):
    mode: str = "text"  # text | wifi | vcard
    data: str = ""
    theme: str = "cyber"
    shape: str = "rounded"
    badge_text: str = ""
    caption: str = ""
    fg_hex: str = ""
    bg_hex: str = ""
    wifi_ssid: str = ""
    wifi_password: str = ""
    wifi_security: str = "WPA"
    vcard_name: str = ""
    vcard_phone: str = ""
    vcard_email: str = ""
    vcard_org: str = ""
    vcard_telegram: str = ""
    user_id: int = DEFAULT_DEMO_USER_ID


@router.post("/qr")
async def api_qr(req: QrReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        if req.mode == "wifi":
            payload = build_wifi_payload(req.wifi_ssid or "HOME_5G", req.wifi_password, req.wifi_security)
        elif req.mode == "vcard":
            payload = build_vcard_payload(
                req.vcard_name or "Контакт",
                phone=req.vcard_phone,
                email=req.vcard_email,
                org=req.vcard_org,
                telegram=req.vcard_telegram,
            )
        else:
            payload = req.data or "https://t.me/multi_tg_bot"

        png = await asyncio.to_thread(
            generate_styled_qr,
            payload,
            theme=req.theme,
            shape=req.shape,
            badge_text=req.badge_text,
            caption=req.caption,
            fg_hex=req.fg_hex,
            bg_hex=req.bg_hex,
        )
        url = await asyncio.to_thread(_persist_generated_sync, png, "png", "qr")
        await db.record_tool_use(uid, "qr_studio", "qr", "miniapp", req.mode)
        return {
            "payload": payload,
            "inspection": inspect_qr_payload(payload),
            "image_data_url": _b64_data_uri(png, "image/png"),
            "download_url": url,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


class BarcodeReq(BaseModel):
    value: str
    kind: str = "code128"
    user_id: int = DEFAULT_DEMO_USER_ID


@router.post("/barcode")
async def api_barcode(req: BarcodeReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        png = await asyncio.to_thread(generate_barcode_png, req.value, req.kind)
        url = await asyncio.to_thread(_persist_generated_sync, png, "png", "barcode")
        await db.record_tool_use(uid, "barcode_gen", "qr", "miniapp", f"{req.kind}:{req.value[:20]}")
        return {
            "image_data_url": _b64_data_uri(png, "image/png"),
            "download_url": url,
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# --- 2. Image Lab, Carbon Code & Steganography ---
class CodeCardReq(BaseModel):
    code: str
    language: str = "python"
    title: str = "snippet.py"
    theme: str = "tokyo"
    user_id: int = DEFAULT_DEMO_USER_ID


@router.post("/code-card")
async def api_code_card(req: CodeCardReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        png = await asyncio.to_thread(render_code_card, req.code, req.language, req.title, req.theme)
        url = await asyncio.to_thread(_persist_generated_sync, png, "png", "codecard")
        await db.record_tool_use(uid, "code_card", "image", "miniapp", req.language)
        return {
            "image_data_url": _b64_data_uri(png, "image/png"),
            "download_url": url,
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/stego/encode")
async def api_stego_encode(
    request: Request,
    secret_text: str = Form(...),
    password: str = Form(""),
    user_id: int = Form(DEFAULT_DEMO_USER_ID),
    file: UploadFile | None = File(None),
) -> dict[str, Any]:
    uid = await resolve_api_user(request, user_id)
    try:
        cover_bytes = await _read_upload_safe(file) if file is not None else None
        png, meta = await asyncio.to_thread(stego_encode_png, secret_text, password=password, cover_bytes=cover_bytes)
        url = await asyncio.to_thread(_persist_generated_sync, png, "png", "stego_carrier")
        await db.record_tool_use(uid, "stego_lab", "image", "miniapp", "LSB Encode")
        return {
            "meta": meta,
            "image_data_url": _b64_data_uri(png, "image/png"),
            "download_url": url,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/stego/decode")
async def api_stego_decode(
    request: Request,
    file: UploadFile = File(...),
    password: str = Form(""),
    user_id: int = Form(DEFAULT_DEMO_USER_ID),
) -> dict[str, Any]:
    uid = await resolve_api_user(request, user_id)
    try:
        raw = await _read_upload_safe(file)
        res = await asyncio.to_thread(stego_decode_png, raw, password=password)
        await db.record_tool_use(uid, "stego_lab", "image", "miniapp", "LSB Decode")
        return res
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/image/exif")
async def api_image_exif(
    request: Request,
    file: UploadFile = File(...),
    user_id: int = Form(DEFAULT_DEMO_USER_ID),
) -> dict[str, Any]:
    uid = await resolve_api_user(request, user_id)
    try:
        raw = await _read_upload_safe(file)
        clean_bytes, info = await asyncio.to_thread(inspect_and_clean_image, raw)
        ext = info["output_format"].lower()
        mime = "image/png" if ext == "png" else "image/jpeg"
        url = await asyncio.to_thread(_persist_generated_sync, clean_bytes, ext, "clean_exif")
        await db.record_tool_use(uid, "exif_clean", "image", "miniapp", "EXIF Clean")
        return {
            "info": info,
            "clean_image_data_url": _b64_data_uri(clean_bytes, mime),
            "download_url": url,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/image/transform")
async def api_image_transform(
    request: Request,
    file: UploadFile = File(...),
    action: str = Form("sticker"),
    target_format: str = Form("WEBP"),
    quality: int = Form(85),
    user_id: int = Form(DEFAULT_DEMO_USER_ID),
) -> dict[str, Any]:
    uid = await resolve_api_user(request, user_id)
    try:
        raw = await _read_upload_safe(file)
        out_bytes, meta = await asyncio.to_thread(
            transform_image, raw, action=action, target_format=target_format, quality=quality
        )
        ext = meta["format"].lower()
        mime = f"image/{ext}"
        url = await asyncio.to_thread(_persist_generated_sync, out_bytes, ext, f"img_{action}")
        await db.record_tool_use(uid, "img_transform", "image", "miniapp", action)
        return {
            "meta": meta,
            "image_data_url": _b64_data_uri(out_bytes, mime),
            "download_url": url,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# --- 3. PDF Forge ---
class TextPdfReq(BaseModel):
    title: str = "Документ MULTI_TG_TOOL"
    content: str
    user_id: int = DEFAULT_DEMO_USER_ID


@router.post("/pdf/from-text")
async def api_pdf_from_text(req: TextPdfReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        pdf_bytes = await asyncio.to_thread(render_text_to_pdf, req.title, req.content)
        url = await asyncio.to_thread(_persist_generated_sync, pdf_bytes, "pdf", "doc")
        await db.record_tool_use(uid, "text_to_pdf", "pdf", "miniapp", req.title[:30])
        return {
            "size_kb": round(len(pdf_bytes) / 1024, 1),
            "download_url": url,
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/pdf/from-images")
async def api_pdf_from_images(
    request: Request,
    files: list[UploadFile] = File(...),
    user_id: int = Form(DEFAULT_DEMO_USER_ID),
) -> dict[str, Any]:
    uid = await resolve_api_user(request, user_id)
    try:
        if len(files) > 25:
            raise HTTPException(status_code=400, detail="Максимум 25 изображений за раз")
        blobs = [await _read_upload_safe(f, max_bytes=8 * 1024 * 1024) for f in files]
        pdf_bytes = await asyncio.to_thread(images_to_pdf, blobs)
        url = await asyncio.to_thread(_persist_generated_sync, pdf_bytes, "pdf", "photos")
        await db.record_tool_use(uid, "img_to_pdf", "pdf", "miniapp", f"{len(blobs)} imgs")
        return {
            "pages": len(blobs),
            "size_kb": round(len(pdf_bytes) / 1024, 1),
            "download_url": url,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/pdf/inspect")
async def api_pdf_inspect(
    request: Request,
    file: UploadFile = File(...),
    user_id: int = Form(DEFAULT_DEMO_USER_ID),
) -> dict[str, Any]:
    uid = await resolve_api_user(request, user_id)
    try:
        raw = await _read_upload_safe(file)
        info = await asyncio.to_thread(inspect_pdf, raw)
        await db.record_tool_use(uid, "pdf_inspect", "pdf", "miniapp", f"{info['page_count']}p")
        return info
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/pdf/transform")
async def api_pdf_transform(
    request: Request,
    file: UploadFile = File(...),
    pages_spec: str = Form(""),
    rotate_deg: int = Form(0),
    password: str = Form(""),
    user_id: int = Form(DEFAULT_DEMO_USER_ID),
) -> dict[str, Any]:
    uid = await resolve_api_user(request, user_id)
    try:
        raw = await _read_upload_safe(file)
        out_bytes, meta = await asyncio.to_thread(
            transform_pdf, raw, pages_spec=pages_spec, rotate_deg=rotate_deg, password=password
        )
        url = await asyncio.to_thread(_persist_generated_sync, out_bytes, "pdf", "transformed")
        await db.record_tool_use(uid, "pdf_protect", "pdf", "miniapp", "Transform PDF")
        return {
            "meta": meta,
            "download_url": url,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# --- 4. Security Lab ---
class PassReq(BaseModel):
    length: int = 20
    count: int = 6
    use_upper: bool = True
    use_lower: bool = True
    use_digits: bool = True
    use_symbols: bool = True
    mode: str = "chars"
    words_count: int = 4
    user_id: int = DEFAULT_DEMO_USER_ID


@router.post("/security/passwords")
async def api_passwords(req: PassReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    res = generate_passwords(
        length=req.length,
        count=req.count,
        use_upper=req.use_upper,
        use_lower=req.use_lower,
        use_digits=req.use_digits,
        use_symbols=req.use_symbols,
        mode=req.mode,
        words_count=req.words_count,
    )
    await db.record_tool_use(uid, "pass_forge", "security", "miniapp", f"{req.mode}:{req.length}")
    return res


class AesReq(BaseModel):
    action: str = "encrypt"
    text: str
    password: str
    user_id: int = DEFAULT_DEMO_USER_ID


@router.post("/security/aes")
async def api_aes(req: AesReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        if req.action == "decrypt":
            out = await asyncio.to_thread(decrypt_nx1, req.text, req.password)
        else:
            out = await asyncio.to_thread(encrypt_nx1, req.text, req.password)
        await db.record_tool_use(uid, "aes_cipher", "security", "miniapp", req.action)
        return {"action": req.action, "output": out}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


class HashReq(BaseModel):
    text: str
    hmac_key: str = ""
    user_id: int = DEFAULT_DEMO_USER_ID


@router.post("/security/hash")
async def api_hash(req: HashReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    hashes_res = compute_hashes(req.text, req.hmac_key)
    identified = identify_hash(req.text)
    await db.record_tool_use(uid, "hash_lab", "security", "miniapp", hashes_res["mode"])
    return {"hashes": hashes_res, "identified_as": identified}


class JwtReq(BaseModel):
    mode: str = "inspect"  # inspect | sign
    token: str = ""
    secret: str = ""
    payload_json: str = '{"sub": "1001", "role": "user"}'
    expires_minutes: int = 60
    user_id: int = DEFAULT_DEMO_USER_ID


@router.post("/security/jwt")
async def api_jwt(req: JwtReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        if req.mode == "sign":
            pld = json.loads(req.payload_json)
            secret_str = req.secret or "multi-tg-tool-hmac-secret-key-256bit"
            tok = sign_jwt(pld, secret_str, expires_minutes=req.expires_minutes)
            info = inspect_jwt(tok, secret_str)
            await db.record_tool_use(uid, "jwt_totp", "security", "miniapp", "JWT Sign")
            return {"token": tok, **info}
        info = inspect_jwt(req.token, req.secret)
        await db.record_tool_use(uid, "jwt_totp", "security", "miniapp", "JWT Inspect")
        return info
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


class TotpReq(BaseModel):
    secret: str = ""
    account: str = "user@multi_tg_tool"
    user_id: int = DEFAULT_DEMO_USER_ID


@router.post("/security/totp")
async def api_totp(req: TotpReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        res = generate_totp_info(req.secret, account=req.account)
        await db.record_tool_use(uid, "jwt_totp", "security", "miniapp", "TOTP")
        return res
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# --- 5. Dev Swiss Knife ---
class FormatReq(BaseModel):
    raw_text: str
    source_fmt: str = "auto"
    target_fmt: str = "json_pretty"
    user_id: int = DEFAULT_DEMO_USER_ID


@router.post("/dev/format")
async def api_dev_format(req: FormatReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        res = format_convert_data(req.raw_text, req.source_fmt, req.target_fmt)
        await db.record_tool_use(uid, "json_yaml", "dev", "miniapp", req.target_fmt)
        return res
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


class RegexReq(BaseModel):
    pattern: str
    test_text: str
    flags_str: str = "im"
    replace_with: str | None = None
    user_id: int = DEFAULT_DEMO_USER_ID


@router.post("/dev/regex")
async def api_dev_regex(req: RegexReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        res = evaluate_regex(req.pattern, req.test_text, req.flags_str, req.replace_with)
        await db.record_tool_use(uid, "regex_lab", "dev", "miniapp", f"Matches:{res['count']}")
        return res
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


class CodecReq(BaseModel):
    text: str
    codec_name: str = "base64"
    direction: str = "encode"
    user_id: int = DEFAULT_DEMO_USER_ID


@router.post("/dev/codec")
async def api_dev_codec(req: CodecReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        out = transform_codec(req.text, req.codec_name, req.direction)
        await db.record_tool_use(uid, "encoders", "dev", "miniapp", f"{req.codec_name}:{req.direction}")
        return {"output": out}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


class CronUuidReq(BaseModel):
    cron_expr: str = "*/15 9-18 * * 1-5"
    id_kind: str = "uuid4"
    id_count: int = 5
    ts_input: str = ""
    user_id: int = DEFAULT_DEMO_USER_ID


@router.post("/dev/cron-uuid")
async def api_dev_cron_uuid(req: CronUuidReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        cron_res = explain_cron(req.cron_expr) if req.cron_expr.strip() else None
        ids_res = generate_ids_and_timestamps(req.id_kind, req.id_count, req.ts_input)
        await db.record_tool_use(uid, "cron_uuid", "dev", "miniapp", req.id_kind)
        return {"cron": cron_res, **ids_res}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# --- 6. Smart Calc, Units, Finance & Subnet ---
class CalcReq(BaseModel):
    expression: str
    user_id: int = DEFAULT_DEMO_USER_ID


@router.post("/calc/eval")
async def api_calc_eval(req: CalcReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        res = evaluate_math(req.expression)
        await db.record_tool_use(uid, "smart_calc", "calc", "miniapp", req.expression[:30])
        return res
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


class UnitReq(BaseModel):
    value: float
    category: str
    from_unit: str
    to_unit: str = ""
    user_id: int = DEFAULT_DEMO_USER_ID


@router.post("/calc/units")
async def api_calc_units(req: UnitReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        res = convert_units(req.value, req.category, req.from_unit, req.to_unit)
        await db.record_tool_use(uid, "unit_conv", "calc", "miniapp", req.category)
        return res
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


class FinanceReq(BaseModel):
    mode: str = "compound"
    principal: float = 500_000
    rate_annual_pct: float = 17.5
    months: int = 12
    monthly_topup: float = 20_000
    people_count: int = 4
    tip_pct: float = 10.0
    user_id: int = DEFAULT_DEMO_USER_ID


@router.post("/calc/finance")
async def api_calc_finance(req: FinanceReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    res = calculate_finance(
        mode=req.mode,
        principal=req.principal,
        rate_annual_pct=req.rate_annual_pct,
        months=req.months,
        monthly_topup=req.monthly_topup,
        people_count=req.people_count,
        tip_pct=req.tip_pct,
    )
    await db.record_tool_use(uid, "finance_calc", "calc", "miniapp", req.mode)
    return res


class SubnetReq(BaseModel):
    cidr: str
    user_id: int = DEFAULT_DEMO_USER_ID


@router.post("/calc/subnet")
async def api_calc_subnet(req: SubnetReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        res = calculate_subnet(req.cidr)
        await db.record_tool_use(uid, "subnet_calc", "calc", "miniapp", res["cidr"])
        return res
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# --- 7. Text Studio & Randomizer ---
class LayoutReq(BaseModel):
    text: str
    direction: str = "auto"
    user_id: int = DEFAULT_DEMO_USER_ID


@router.post("/text/layout")
async def api_text_layout(req: LayoutReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    res = fix_keyboard_layout(req.text, req.direction)
    await db.record_tool_use(uid, "layout_fixer", "text", "miniapp", req.direction)
    return res


class FontReq(BaseModel):
    text: str
    user_id: int = DEFAULT_DEMO_USER_ID


@router.post("/text/fonts")
async def api_text_fonts(req: FontReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        res = stylize_text(req.text)
        await db.record_tool_use(uid, "font_styler", "text", "miniapp", "Fonts")
        return res
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


class DiffReq(BaseModel):
    text_a: str
    text_b: str = ""
    user_id: int = DEFAULT_DEMO_USER_ID


@router.post("/text/diff")
async def api_text_diff(req: DiffReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    res = analyze_and_diff_text(req.text_a, req.text_b)
    await db.record_tool_use(uid, "text_diff", "text", "miniapp", "Analytics/Diff")
    return res


class RandomReq(BaseModel):
    mode: str = "dice"
    dice_expr: str = "2d20+5"
    items_raw: str = ""
    teams_count: int = 2
    user_id: int = DEFAULT_DEMO_USER_ID


@router.post("/text/random")
async def api_text_random(req: RandomReq, request: Request) -> dict[str, Any]:
    uid = await resolve_api_user(request, req.user_id)
    try:
        res = run_randomizer(req.mode, req.dice_expr, req.items_raw, req.teams_count)
        await db.record_tool_use(uid, "randomizer", "text", "miniapp", req.mode)
        return res
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
