from __future__ import annotations

import io
import pytest
from httpx import ASGITransport, AsyncClient
from PIL import Image

from backend.api.app import create_app
from backend.bot.factory import bot_manager
from backend.database import db
from backend.tools.dev_tools import evaluate_regex, explain_cron, format_convert_data, transform_codec
from backend.tools.image_lab import (
    inspect_and_clean_image,
    render_code_card,
    stego_decode_png,
    stego_encode_png,
    transform_image,
)
from backend.tools.knowledge_hub import (
    query_population,
    roll_random_stand,
    search_constitutions,
    search_formulas,
)
from backend.tools.omni_detector import smart_omni_detect
from backend.tools.party_and_fun import (
    LIGURIA_TEXT,
    calculate_pencil_index,
    calculate_vodka_party,
    get_boredom_ideas,
)
from backend.tools.pdf_forge import inspect_pdf, render_text_to_pdf, transform_pdf
from backend.tools.qr_studio import build_vcard_payload, build_wifi_payload, generate_barcode_png, generate_styled_qr
from backend.tools.rhyme_and_links import decode_qr_from_bytes, generate_russian_rhymes, inspect_and_clean_url
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
from backend.tools.smart_calc import calculate_finance, calculate_subnet, convert_units, evaluate_math
from backend.tools.smart_units_nlp import smart_parse_and_convert
from backend.tools.social_and_dating import altushka_chat_reply, check_turing_guess, get_turing_round
from backend.tools.text_studio import analyze_and_diff_text, fix_keyboard_layout, run_randomizer, stylize_text


def test_qr_and_barcode_engine() -> None:
    wifi = build_wifi_payload("CyberCafe", "secret123")
    assert "WIFI:T:WPA;S:CyberCafe;P:secret123" in wifi
    vcard = build_vcard_payload("Иван Петров", phone="+79001112233", telegram="@ivan")
    assert "BEGIN:VCARD" in vcard
    png = generate_styled_qr(wifi, theme="emerald", shape="dots", badge_text="WiFi")
    assert png[:8] == b"\x89PNG\r\n\x1a\n"
    bc = generate_barcode_png("NEXUS-777", "code128")
    assert bc[:8] == b"\x89PNG\r\n\x1a\n"


def test_steganography_and_image_lab() -> None:
    secret = "Координаты бункера: 55.7558, 37.6173 — Код Омега!"
    png, meta = stego_encode_png(secret, password="vault_key_99")
    assert meta["encrypted"] is True
    with pytest.raises(ValueError):
        stego_decode_png(png, password="wrong_password")
    decoded = stego_decode_png(png, password="vault_key_99")
    assert decoded["secret_text"] == secret

    clean_bytes, info = inspect_and_clean_image(png)
    assert info["width"] > 100
    assert len(info["palette"]) >= 1

    sticker_bytes, s_meta = transform_image(png, action="sticker")
    assert s_meta["format"] == "WEBP"
    sticker_img = Image.open(io.BytesIO(sticker_bytes))
    assert max(sticker_img.size) == 512

    card = render_code_card("def add(a, b):\n    return a + b", "python", "math.py", "dracula")
    assert card[:8] == b"\x89PNG\r\n\x1a\n"


def test_pdf_forge() -> None:
    pdf = render_text_to_pdf("Тестовый документ", "# Раздел 1\nПривет из NEXUS!\n- Пункт А\n- Пункт Б")
    info = inspect_pdf(pdf)
    assert info["page_count"] == 1
    assert "Привет" in info["extracted_text"]

    enc_pdf, meta = transform_pdf(pdf, rotate_deg=90, password="pdf_secret")
    assert meta["encrypted"] is True
    enc_info = inspect_pdf(enc_pdf)
    assert enc_info["is_encrypted"] is True


def test_security_and_crypto() -> None:
    pw = generate_passwords(length=24, count=3, mode="chars")
    assert len(pw["passwords"]) == 3
    assert all(len(x) == 24 for x in pw["passwords"])

    env = encrypt_nx1("Сверхсекретно", "pass123")
    assert env.startswith("NX1.")
    assert decrypt_nx1(env, "pass123") == "Сверхсекретно"

    h = compute_hashes("nexus")
    assert "SHA-256" in identify_hash(h["SHA-256"])

    tok = sign_jwt({"user": "alex"}, "s3cr3t", expires_minutes=30)
    jwt_info = inspect_jwt(tok, "s3cr3t")
    assert "Подпись подтверждена" in (jwt_info["signature_verified"] or "")

    totp = generate_totp_info()
    assert len(totp["code"]) == 6


def test_dev_calc_and_text_engines() -> None:
    conv = format_convert_data('{"name": "NEXUS", "tools": 32}', "auto", "yaml")
    assert "NEXUS" in conv["output"]

    rgx = evaluate_regex(r"(\d+)", "Порт 8000 и 443")
    assert rgx["count"] == 2

    morse = transform_codec("ПРИВЕТ", "morse", "encode")
    assert transform_codec(morse, "morse_ru", "decode") == "ПРИВЕТ"

    cron = explain_cron("*/15 9-18 * * 1-5")
    assert len(cron["next_runs"]) == 5

    calc = evaluate_math("sqrt(144) + (0xFF & 0x0F)")
    assert calc["result"] == 27

    units = convert_units(2, "data", "GB", "MB")
    assert units["target_value"] == 2048.0

    sub = calculate_subnet("192.168.1.0/26")
    assert sub["usable_hosts"] == 62

    fin = calculate_finance("split", 5000, people_count=4, tip_pct=10)
    assert fin["per_person"] == 1375.0

    fixed = fix_keyboard_layout("Ghbdtn? rfr ltkf&")
    assert fixed["primary"] == "Привет, как дела?"

    styled = stylize_text("Nexus Pro Tool")
    assert styled["cases"]["snake_case"] == "nexus_pro_tool"

    diff = analyze_and_diff_text("line1\nline2", "line1\nline3")
    assert diff["diff"]["added_lines"] == 1

    dice = run_randomizer("dice", "3d6+2")
    assert 5 <= dice["total"] <= 20

    assert smart_omni_detect("Ghbdtn vbh")["kind"] == "layout_fix"
    assert smart_omni_detect("10.0.0.1/24")["kind"] == "subnet"


def test_v2_mega_engines() -> None:
    # 1. Alcohol 0..40 scale
    sober = calculate_vodka_party(people_count=4, target_level=0)
    assert sober["bottles_05"] == 0
    party = calculate_vodka_party(people_count=5, target_level=22, reserve_no_run=True)
    assert party["bottles_05"] >= 2
    assert party["snacks_kg"] > 0

    # 2. Smart natural-language unit converter ("6 дюймов")
    inch6 = smart_parse_and_convert("6 дюймов")
    assert inch6["category"] == "length"
    assert inch6["conversions"][0]["unit"] == "cm"
    assert inch6["conversions"][0]["value"] == pytest.approx(15.24, rel=1e-2)
    assert smart_omni_detect("6 дюймов")["kind"] == "smart_unit"

    feet_inch = smart_parse_and_convert("5 футов 11 дюймов")
    assert feet_inch["conversions"][0]["value"] == pytest.approx(180.34, rel=1e-2)

    # 3. Boredom 105+ advisor + Liguria + spicy toggle
    ideas_clean = get_boredom_ideas(include_spicy=False, count=110)
    assert ideas_clean["total_in_vault"] >= 100
    assert not any(i.get("spicy") for i in ideas_clean["items"])
    ideas_all = get_boredom_ideas(include_spicy=True, count=120)
    assert ideas_all["total_in_vault"] >= 105
    assert any("QLS СЕНЯ" in i["title"] for i in ideas_all["items"])
    assert any("Sekiro" in i["title"] for i in ideas_all["items"])
    assert "Лигурии" in LIGURIA_TEXT

    # 4. Humorous Pencil Index
    p_res = calculate_pencil_index(height_cm=185, shoe_size_eu=44, linux_user=True, gym_pushups=60)
    assert 8.0 <= p_res["estimated_cm"] <= 26.0

    # 5. Knowledge Hub (Constitutions, JoJo Stands, EGE Formulas, Population)
    jp = search_constitutions("Япония")
    assert len(jp) == 1 and jp[0]["year"] == 1947
    st = roll_random_stand("Jotaro")
    assert "name" in st
    phys = search_formulas("Физика", "Ома")
    assert len(phys) >= 1
    pop = query_population("Оймякон")
    assert pop["places"][0]["pop"] == 502

    # 6. Rhyme Generator & QR Image Decoder & URL Cleaner
    rh = generate_russian_rhymes("любовь")
    assert "кровь" in rh["exact_rhymes"] or "вновь" in rh["exact_rhymes"]

    qr_png = generate_styled_qr("https://t.me/qls_senya", theme="classic", shape="square")
    qr_dec = decode_qr_from_bytes(qr_png)
    assert qr_dec["found"] is True
    assert qr_dec["primary"] == "https://t.me/qls_senya"

    cleaned = inspect_and_clean_url("https://example.com/page?utm_source=tg&id=42&fbclid=abc")
    assert cleaned["cleaned_url"] == "https://example.com/page?id=42"

    # 7. Turing & Altushka 18+
    rnd = get_turing_round()
    chk = check_turing_guess(rnd["id"], "human")
    assert chk["actual_author"] in ("human", "ai")
    alt = altushka_chat_reply("ksyusha", "Принёс тебе вишнёвый энергетик и плед!", 35)
    assert alt["affection"] > 35


@pytest.mark.asyncio
async def test_fastapi_and_bot_simulator_end_to_end(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(db, "db_path", tmp_path / "test_nexus.db")
    bot_manager.sim_session.chats.clear()
    await db.init()
    await bot_manager.init_simulator()
    app = create_app()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Health & Catalog (12 categories in v2!)
        r = await client.get("/api/health")
        assert r.status_code == 200
        cat = await client.get("/api/tools/catalog")
        assert len(cat.json()["categories"]) == 12

        # 2. Simulator bootstrap (/start)
        sim_init = await client.get("/api/sim/state")
        assert sim_init.status_code == 200
        msgs = sim_init.json()["messages"]
        bot_welcome = msgs[-1]
        assert "NEXUS" in bot_welcome["text"]

        # 3. Tap Inline Callback Button (Single-Message HUD Edit in-place!)
        cb_res = await client.post(
            "/api/sim/callback",
            json={"message_id": bot_welcome["message_id"], "callback_data": "nav:cat:security"},
        )
        assert cb_res.status_code == 200
        assert "Кибербезопасность" in cb_res.json()["messages"][-1]["text"]

        # 4. Send /bored and "6 дюймов" in Simulator
        bored_res = await client.post("/api/sim/send-text", json={"text": "/bored"})
        assert bored_res.status_code == 200
        assert "скучно" in bored_res.json()["messages"][-1]["text"]

        unit_msg = await client.post("/api/sim/send-text", json={"text": "6 дюймов"})
        assert unit_msg.status_code == 200
        assert "15.24" in unit_msg.json()["messages"][-1]["text"]

        # 5. Send Smart Omni-Input wrong layout text
        omni_res = await client.post("/api/sim/send-text", json={"text": "Ghbdtn vbh!"})
        assert omni_res.status_code == 200
        assert "Привет мир!" in omni_res.json()["messages"][-1]["text"]

        # 6. Upload Stego PNG into Simulator & verify decode
        stego_png, _ = stego_encode_png("Тайна Агента 007")
        up_res = await client.post(
            "/api/sim/upload",
            files={"file": ("secret_carrier.png", stego_png, "image/png")},
            data={"mode": "document"},
        )
        drop_msg = up_res.json()["messages"][-1]
        stego_btn = next(
            btn
            for row in drop_msg["inline_keyboard"]
            for btn in row
            if "stego_read" in (btn.get("callback_data") or "")
        )
        read_res = await client.post(
            "/api/sim/callback",
            json={"message_id": drop_msg["message_id"], "callback_data": stego_btn["callback_data"]},
        )
        assert "Тайна Агента 007" in read_res.json()["messages"][-1]["text"]

        # 7. Test v2 Short & Long URL redirects + Profile Views tracking + Arcade Score + Author
        lnk = await client.post("/api/v2/links/create", json={"url": "https://youtube.com/@qls_senya?utm_source=test"})
        assert lnk.status_code == 200
        short_path = lnk.json()["short_path"]
        redir = await client.get(short_path, follow_redirects=False)
        assert redir.status_code == 307
        assert redir.headers["location"] == "https://youtube.com/@qls_senya"

        top = await client.get("/api/v2/social/leaderboard?sort_by=xp")
        assert len(top.json()["users"]) >= 4
        target_uid = top.json()["users"][0]["user_id"]
        views_before = top.json()["users"][0]["profile_views"]
        prof_open = await client.get(f"/api/v2/social/profile/{target_uid}?viewer_id=999999")
        assert prof_open.json()["profile_views"] == views_before + 1

        game_sc = await client.post("/api/v2/games/score", json={"game_id": "arcade_wolf", "score": 450})
        assert game_sc.status_code == 200
        assert game_sc.json()["xp_earned"] >= 5

        auth = await client.get("/api/v2/author")
        assert "QLS СЕНЯ" in auth.json()["title"]
