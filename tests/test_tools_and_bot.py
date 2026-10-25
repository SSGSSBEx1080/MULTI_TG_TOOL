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
        # 1. Health & Catalog (14 factual categories)
        r = await client.get("/api/health")
        assert r.status_code == 200
        cat_res = await client.get("/api/tools/catalog")
        categories = cat_res.json()["categories"]
        assert len(categories) == 14

        # 2. Verify NO fake/demo users exist in Leaderboard initially
        top_initial = await client.get("/api/v2/social/leaderboard?sort_by=xp")
        assert top_initial.status_code == 200
        assert top_initial.json()["users"] == []

        # Register 2 real Telegram users and verify only real users appear in Top
        await db.ensure_user(123456789, "ivan_tg", "Иван", is_real=True)
        await db.record_tool_use(123456789, "daily_horoscope", "horoscope", "bot", "aries", xp_gain=25)
        await db.ensure_user(987654321, "maria_tg", "Мария", is_real=True)
        await db.record_tool_use(987654321, "phys_power", "physics", "miniapp", "eta", xp_gain=15)

        top_real = await client.get("/api/v2/social/leaderboard?sort_by=xp")
        leaders = top_real.json()["users"]
        assert len(leaders) == 2
        assert leaders[0]["user_id"] == 123456789
        assert leaders[0]["first_name"] == "Иван"

        # 3. Simulator bootstrap (/start)
        sim_init = await client.get("/api/sim/state")
        assert sim_init.status_code == 200
        msgs = sim_init.json()["messages"]
        bot_welcome = msgs[-1]
        assert "MULTI_TG_TOOL" in bot_welcome["text"]
        msg_id = bot_welcome["message_id"]

        # 4. EXHAUSTIVE CHECK: Every single category button AND every single tool:open:* button MUST respond!
        for cat_obj in categories:
            c_res = await client.post(
                "/api/sim/callback",
                json={"message_id": msg_id, "callback_data": f"nav:cat:{cat_obj['id']}"},
            )
            assert c_res.status_code == 200
            last_msg = c_res.json()["messages"][-1]
            msg_id = last_msg["message_id"]
            assert cat_obj["title"] in last_msg["text"]

            for tool_obj in cat_obj["tools"]:
                before_snapshot = (len(c_res.json()["messages"]), last_msg["text"])
                t_res = await client.post(
                    "/api/sim/callback",
                    json={"message_id": msg_id, "callback_data": f"tool:open:{tool_obj['id']}"},
                )
                assert t_res.status_code == 200
                t_msgs = t_res.json()["messages"]
                new_last = t_msgs[-1]
                msg_id = new_last["message_id"]
                after_snapshot = (len(t_msgs), new_last["text"])
                assert after_snapshot != before_snapshot, f"Button tool:open:{tool_obj['id']} produced ZERO reaction!"

        # 5. Test new Bot commands: /horoscope, /compat, /physics, /habits, /bored, "6 дюймов"
        for cmd_text, expected_substr in [
            ("/horoscope лев", "Лев"),
            ("/compat 15.05.2002 21.09.2003", "Совместимость"),
            ("/physics", "Формула"),
            ("/habits", "Трекер привычек"),
            ("/bored", "скучно"),
            ("6 дюймов", "15.24"),
            ("Ghbdtn vbh!", "Привет мир!"),
        ]:
            cmd_r = await client.post("/api/sim/send-text", json={"text": cmd_text})
            assert cmd_r.status_code == 200
            assert expected_substr.lower() in cmd_r.json()["messages"][-1]["text"].lower()

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

        # 7. Test New API Endpoints: Astrology, Compatibility, Physics Solver, Habit Tracker & Attachment Download
        horo_api = await client.get("/api/v2/astrology/horoscope?sign=scorpio&period=week")
        assert horo_api.status_code == 200
        assert horo_api.json()["sign"]["name"] == "Скорпион"

        birth_api = await client.post("/api/v2/astrology/birth", json={"date": "15.05.2002"})
        assert birth_api.status_code == 200
        assert birth_api.json()["sign"]["name"] == "Телец"
        assert birth_api.json()["life_path_number"] >= 1

        compat_api = await client.post(
            "/api/v2/astrology/compatibility",
            json={"first": "2002-05-15", "second": "2003-09-21", "name1": "Алексей", "name2": "Алина"},
        )
        assert compat_api.status_code == 200
        assert 40 <= compat_api.json()["overall_pct"] <= 99

        phys_api = await client.post(
            "/api/v2/physics/solve",
            json={"calc_id": "work_power_efficiency", "target_var": "t", "params": {"A": 360000, "P": 2000, "eta": 90}},
        )
        assert phys_api.status_code == 200
        assert phys_api.json()["numeric_si"] == 200.0

        # Habit Tracker CRUD
        hab_create = await client.post(
            "/api/workspace/habits",
            headers={"X-Guest-Id": "900000123456"},
            json={"title": "Чтение 30 минут", "icon": "📚", "target_per_week": 7},
        )
        assert hab_create.status_code == 200
        hid = hab_create.json()["habits"][0]["id"]

        hab_toggle = await client.post(
            f"/api/workspace/habits/{hid}/toggle",
            headers={"X-Guest-Id": "900000123456"},
            json={},
        )
        assert hab_toggle.status_code == 200
        assert hab_toggle.json()["completed"] is True
        assert hab_toggle.json()["habits"][0]["streak"] == 1

        hab_del = await client.delete(
            f"/api/workspace/habits/{hid}",
            headers={"X-Guest-Id": "900000123456"},
        )
        assert hab_del.status_code == 200
        assert hab_del.json()["habits"] == []

        # QR + Attachment download header check (critical for Telegram WebView)
        qr_gen = await client.post("/api/tools/qr", json={"mode": "text", "data": "https://t.me/multi_tg_bot"})
        assert qr_gen.status_code == 200
        dl_url = qr_gen.json()["download_url"]
        att_res = await client.get(f"/api/v2/files/download?url={dl_url}&name=qr.png")
        assert att_res.status_code == 200
        assert "attachment" in att_res.headers.get("content-disposition", "")

        # 8. Short & Long URL redirects + Profile Views + Author 4 links
        lnk = await client.post("/api/v2/links/create", json={"url": "https://www.youtube.com/@qls8571?utm_source=test"})
        assert lnk.status_code == 200
        short_path = lnk.json()["short_path"]
        redir = await client.get(short_path, follow_redirects=False)
        assert redir.status_code == 307
        assert redir.headers["location"] == "https://www.youtube.com/@qls8571"

        prof_open = await client.get("/api/v2/social/profile/123456789?viewer_id=987654321")
        assert prof_open.json()["profile_views"] == 1

        auth = await client.get("/api/v2/author")
        assert "MULTI_TG_TOOL" in auth.json()["title"]
        assert len(auth.json()["links"]) == 4
