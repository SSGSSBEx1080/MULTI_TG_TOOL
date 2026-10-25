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

    jwt_key = "multi-tg-tool-test-hmac-secret-key-32b"
    tok = sign_jwt({"user": "alex"}, jwt_key, expires_minutes=30)
    jwt_info = inspect_jwt(tok, jwt_key)
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

        # 9. Regression check for Knowledge Hub endpoints (including /api/v2/knowledge/formulas?subject=...&q=...)
        form_all = await client.get("/api/v2/knowledge/formulas?subject=all&q=")
        assert form_all.status_code == 200
        assert form_all.json()["count"] >= 15

        form_filtered = await client.get("/api/v2/knowledge/formulas?subject=Алгебра&q=синус")
        assert form_filtered.status_code == 200
        assert form_filtered.json()["count"] >= 1

        for kb_url in [
            "/api/v2/knowledge/constitutions?q=россия",
            "/api/v2/knowledge/religions?q=",
            "/api/v2/knowledge/wiki?section=all&q=python",
            "/api/v2/knowledge/population?q=москва",
        ]:
            kb_res = await client.get(kb_url)
            assert kb_res.status_code == 200

        # 10. Fast vectorized gradient QR across all modes + OpenCV round-trip decode
        import base64
        import time as _time

        for qr_theme in ("cyber", "telegram", "emerald", "classic"):
            t0 = _time.perf_counter()
            q_res = await client.post(
                "/api/tools/qr",
                json={"mode": "text", "data": f"https://t.me/multi_tg_bot?t={qr_theme}", "theme": qr_theme, "shape": "rounded"},
            )
            elapsed_ms = (_time.perf_counter() - t0) * 1000
            assert q_res.status_code == 200
            assert elapsed_ms < 500, f"QR theme {qr_theme} took {elapsed_ms:.1f}ms"
            b64_png = q_res.json()["image_data_url"].split(",", 1)[1]
            scan_res = await client.post(
                "/api/v2/qr/decode",
                files={"file": ("qr.png", base64.b64decode(b64_png), "image/png")},
            )
            assert scan_res.status_code == 200
            assert scan_res.json()["found"] is True
            assert scan_res.json()["primary"] == f"https://t.me/multi_tg_bot?t={qr_theme}"

        # 11. Workspace state bundle + Static caching headers
        ws_res = await client.get("/api/workspace/state", headers={"X-Guest-Id": "900000123456"})
        assert ws_res.status_code == 200
        assert "profile" in ws_res.json() and "habits" in ws_res.json()

        av_res = await client.get("/avatar.png")
        assert av_res.status_code == 200
        assert "max-age=" in av_res.headers.get("cache-control", "")

    await db.close()


def _make_signed_init_data(bot_token: str, user_id: int, username: str, first_name: str) -> str:
    import hashlib
    import hmac
    import json
    from urllib.parse import urlencode

    user_json = json.dumps(
        {"id": user_id, "first_name": first_name, "username": username, "language_code": "ru"},
        separators=(",", ":"),
        ensure_ascii=False,
    )
    fields = {"auth_date": "1761380000", "query_id": "AAHdF6IQAAAAAN0XohDhrOrc", "user": user_json}
    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()
    sig = hmac.new(secret_key, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()
    return urlencode({**fields, "hash": sig})


@pytest.mark.asyncio
async def test_exhaustive_nested_bot_callbacks_fsm_and_all_api_endpoints(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(db, "db_path", tmp_path / "test_exhaustive.db")
    bot_manager.sim_session.chats.clear()
    await db.init()
    await bot_manager.init_simulator()

    test_bot_token = "111222333:AAH_TEST_HMAC_VERIFICATION_SECRET_TOKEN"
    await db.set_setting("bot_token", test_bot_token)
    tg_headers = {
        "X-Telegram-Init-Data": _make_signed_init_data(test_bot_token, 555777999, "real_tester", "Дмитрий")
    }

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Verify HMAC-signed Telegram user gets XP from ALL routes_tools.py endpoints
        tool_post_matrix = [
            ("/api/tools/omni", {"text": "256 * 4"}),
            ("/api/tools/qr", {"mode": "wifi", "wifi_ssid": "TestNet", "wifi_password": "secretpassword"}),
            ("/api/tools/barcode", {"value": "MT-2026-777", "kind": "code128"}),
            ("/api/tools/code-card", {"code": "x = 42\nprint(x)", "language": "python", "title": "t.py"}),
            ("/api/tools/pdf/from-text", {"title": "Отчёт", "content": "# Заголовок\nТекст кириллицей"}),
            ("/api/tools/security/passwords", {"length": 18, "count": 3}),
            ("/api/tools/security/aes", {"action": "encrypt", "text": "Тайна", "password": "key"}),
            ("/api/tools/security/hash", {"text": "MULTI_TG_TOOL"}),
            ("/api/tools/security/jwt", {"mode": "sign", "payload_json": '{"sub":"555"}', "secret": "a" * 36}),
            ("/api/tools/security/totp", {"account": "dim@tg"}),
            ("/api/tools/dev/format", {"raw_text": '{"ok":true}', "target_fmt": "yaml"}),
            ("/api/tools/dev/regex", {"pattern": r"\d+", "test_text": "v1 and v2"}),
            ("/api/tools/dev/codec", {"text": "Привет", "codec_name": "base64", "direction": "encode"}),
            ("/api/tools/dev/cron-uuid", {"cron_expr": "0 9 * * 1-5", "id_kind": "uuid4", "id_count": 2}),
            ("/api/tools/calc/eval", {"expression": "(150 + 50) * 3"}),
            ("/api/tools/calc/units", {"value": 10, "category": "length", "from_unit": "km", "to_unit": "m"}),
            ("/api/tools/calc/finance", {"mode": "compound", "principal": 100000, "rate_annual_pct": 16, "months": 12}),
            ("/api/tools/calc/subnet", {"cidr": "192.168.1.0/24"}),
            ("/api/tools/text/layout", {"text": "Ghbdtn"}),
            ("/api/tools/text/fonts", {"text": "MULTI_TG"}),
            ("/api/tools/text/diff", {"text_a": "line1\nline2", "text_b": "line1\nline3"}),
            ("/api/tools/text/random", {"mode": "dice", "dice_expr": "2d6+2"}),
            ("/api/v2/party/alcohol", {"people_count": 4}),
            ("/api/v2/party/pencil", {"height_cm": 184, "shoe_size_eu": 44}),
            ("/api/v2/units/smart", {"query": "100 км/ч в м/с"}),
            ("/api/v2/rhyme", {"word": "рассвет"}),
            ("/api/v2/knowledge/roll-stand", {"name": "Дмитрий"}),
            ("/api/v2/games/score", {"game_id": "wolf", "score": 320}),
            ("/api/v2/social/altushka", {"persona_id": "ksyusha", "message": "Привет!", "affection": 30}),
            ("/api/v2/social/anon", {"text": "Всем привет в чате!", "room": "global"}),
        ]
        for url, payload in tool_post_matrix:
            resp = await client.post(url, json=payload, headers=tg_headers)
            assert resp.status_code == 200, f"POST {url} failed: {resp.status_code} {resp.text}"

        # Check real Telegram user accumulated XP and appears #1 in Leaderboard (and NO fake 777000 exists!)
        lb = (await client.get("/api/v2/social/leaderboard?sort_by=xp")).json()["users"]
        assert len(lb) == 1
        assert lb[0]["user_id"] == 555777999
        assert lb[0]["tools_used"] >= 25
        assert lb[0]["xp"] >= 250

        # 2. Security protection checks: unauthenticated admin endpoints MUST return 403, oversized upload -> 413
        forb_tok = await client.post("/api/admin/bot-token", json={"bot_token": "hacked"})
        assert forb_tok.status_code == 403
        forb_auth = await client.post(
            "/api/v2/author",
            json={"title": "x", "tagline": "x", "bio": "x", "links": [], "donation_note": "x"},
        )
        assert forb_auth.status_code == 403

        # Ensure SQLite DB and arbitrary files in DATA_DIR can NEVER be downloaded via /media or /api/v2/files/download
        db_leak_1 = await client.get("/media/nexus.db")
        assert db_leak_1.status_code == 404
        db_leak_2 = await client.get("/api/v2/files/download?url=/media/nexus.db")
        assert db_leak_2.status_code == 404
        db_leak_3 = await client.get("/api/v2/files/download?url=../config.py")
        assert db_leak_3.status_code == 404

        # Ensure forged X-Telegram-Init-Data without valid HMAC hash is rejected (cannot spoof real user)
        spoof_headers = {"X-Telegram-Init-Data": 'user={"id":999888777,"first_name":"Spoofer"}'}
        await client.post("/api/tools/calc/eval", json={"expression": "2+2"}, headers=spoof_headers)
        lb_after_spoof = (await client.get("/api/v2/social/leaderboard?sort_by=xp")).json()["users"]
        assert all(u["user_id"] != 999888777 for u in lb_after_spoof)

        admin_dash = await client.get("/api/admin/dashboard")
        assert admin_dash.status_code == 200
        assert admin_dash.json()["analytics"]["summary"]["total_users"] == 1

        # 3. Bot FSM auto-clear when user sends a slash command mid-flow + nested inline button sweep
        await client.get("/api/sim/state")
        # Enter compatibility FSM waiting state via command without args
        cmp_open = await client.post("/api/sim/send-text", json={"text": "/compat"})
        assert cmp_open.status_code == 200
        # Immediately send another command (/pass) instead of dates -> MUST NOT fail as invalid date!
        pass_override = await client.post("/api/sim/send-text", json={"text": "/pass"})
        assert pass_override.status_code == 200
        last_bot_text = pass_override.json()["messages"][-1]["text"]
        assert "парол" in last_bot_text.lower()

        # Crawl nested inline buttons inside bot tools (horoscope, physics, party, security, qr, social)
        cat_res = await client.get("/api/tools/catalog")
        visited_cbs: set[str] = set()
        sim_state = await client.post("/api/sim/reset", json={})
        cur_msg = sim_state.json()["messages"][-1]

        # Check every WebApp button points to real HTTPS Amvera domain (never nexus-tma.local)
        for row in cur_msg["inline_keyboard"]:
            for btn in row:
                if btn.get("web_app_url"):
                    assert btn["web_app_url"].startswith("https://")
                    assert "nexus-tma.local" not in btn["web_app_url"]

        for cat_obj in cat_res.json()["categories"]:
            for tool_obj in cat_obj["tools"]:
                r_open = await client.post(
                    "/api/sim/callback",
                    json={"message_id": cur_msg["message_id"], "callback_data": f"tool:open:{tool_obj['id']}"},
                )
                assert r_open.status_code == 200
                cur_msg = r_open.json()["messages"][-1]
                # Click up to 4 unique nested action buttons inside each tool screen
                nested_btns = [
                    btn["callback_data"]
                    for row in cur_msg.get("inline_keyboard", [])
                    for btn in row
                    if btn.get("callback_data")
                    and not btn["callback_data"].startswith(("nav:", "tool:open:", "fav:"))
                    and btn["callback_data"] not in visited_cbs
                ]
                for nested_cb in nested_btns[:4]:
                    visited_cbs.add(nested_cb)
                    r_nested = await client.post(
                        "/api/sim/callback",
                        json={"message_id": cur_msg["message_id"], "callback_data": nested_cb},
                    )
                    assert r_nested.status_code == 200, f"Nested callback {nested_cb} failed!"
                    cur_msg = r_nested.json()["messages"][-1]

        assert len(visited_cbs) >= 25

        # 4. Inline query mode check
        for iq in ("", "1024 / 16", "Ghbdtn"):
            iq_res = await client.post("/api/sim/inline", json={"query": iq})
            assert iq_res.status_code == 200
            assert len(iq_res.json()["results"]) >= 1

    await db.close()


