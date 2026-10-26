from __future__ import annotations

import io
import pytest
from httpx import ASGITransport, AsyncClient
from PIL import Image

from backend.api.app import create_app
from backend.bot.factory import bot_manager
from backend.database import DEFAULT_AUTHOR_INFO, db
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


def test_author_links_are_pinned_to_official_destinations() -> None:
    normalized = db._normalize_author({"title": "Project", "links": [{"label": "Injected", "url": "https://example.invalid"}]})
    assert [link["url"] for link in normalized["links"]] == [link["url"] for link in DEFAULT_AUTHOR_INFO["links"]]
    assert len(normalized["links"]) == 4


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

    # 4. Evidence-based population reference (never falsely predicts an individual from unrelated traits)
    p_res = calculate_pencil_index(height_cm=185, shoe_size_eu=44, linux_user=True, gym_pushups=60)
    assert p_res["result_kind"] == "population_reference_not_individual_estimate"
    assert p_res["estimated_cm"] == pytest.approx(13.12)
    assert p_res["factors"] == [] and p_res["percentile"] is None

    # 5. Knowledge Hub (Constitutions, JoJo Stands, EGE Formulas, Population)
    jp = search_constitutions("Япония")
    assert len(jp) == 1 and jp[0]["year"] == 1947
    st = roll_random_stand("Jotaro")
    assert "name" in st
    phys = search_formulas("Физика", "Ома")
    assert len(phys) >= 1
    pop = query_population("Оймякон")
    assert pop["places"][0]["pop"] == 502
    assert pop["places"][0]["formatted_pop"].startswith("~")
    assert pop["live_earth_population"] is None
    unknown_pop = query_population("Несуществующий населённый пункт")
    assert unknown_pop["count"] == 0 and unknown_pop["places"] == []
    earth = query_population("Планета Земля")
    assert earth["places"][0]["pop"] is None

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
        # 1. Health & Catalog (17 factual categories, 81 tools)
        r = await client.get("/api/health")
        assert r.status_code == 200
        cat_res = await client.get("/api/tools/catalog")
        categories = cat_res.json()["categories"]
        assert len(categories) >= 32
        assert sum(len(c["tools"]) for c in categories) >= 188

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

        # 5. Test Bot commands: /horoscope, /compat, /physics, /marvel, /dc, /zitraks, /habits, /bored, "6 дюймов"
        for cmd_text, expected_substr in [
            ("/horoscope лев", "Лев"),
            ("/compat 15.05.2002 21.09.2003", "Совместимость"),
            ("/physics", "Формула"),
            ("/marvel", "Чек-лист Marvel"),
            ("/dc", "Чек-лист DC"),
            ("/zitraks", "ZitraksMode"),
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


@pytest.mark.asyncio
async def test_universes_marvel_dc_and_zitraksmode_sync_and_zmsave(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(db, "db_path", tmp_path / "test_universes.db")
    await db.init()

    test_bot_token = "111222333:AAH_TEST_UNIVERSES_HMAC_SECRET_TOKEN"
    await db.set_setting("bot_token", test_bot_token)
    user_a = {"X-Telegram-Init-Data": _make_signed_init_data(test_bot_token, 7001001, "user_a", "Арсений")}
    user_b = {"X-Telegram-Init-Data": _make_signed_init_data(test_bot_token, 7001002, "user_b", "Максим")}

    app = create_app()
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            cat_r = await client.get("/api/v2/universes/catalog")
            assert cat_r.status_code == 200
            cat = cat_r.json()

            # Verify exact dataset counts from reference repositories
            marvel_total = (
                sum(len(p["items"]) for p in cat["marvel"]["mcu_phases"])
                + sum(len(g["items"]) for g in cat["marvel"]["other_groups"])
                + len(cat["marvel"]["upcoming"])
            )
            assert marvel_total == 99
            assert len(cat["dc"]["projects"]) == 19
            assert len(cat["zitraks"]["points"]) == 29
            assert len(cat["zitraks"]["guest_points"]) == 4
            all_adv_uids = [
                a["uid"]
                for br in cat["zitraks"]["branches"]
                for a in br["advancements"]
            ]
            assert len(all_adv_uids) == 169

            # Toggle Marvel item & DC item
            first_marvel_id = cat["marvel"]["mcu_phases"][0]["items"][0]["id"]
            m_tog = await client.post(
                "/api/v2/universes/toggle",
                headers=user_a,
                json={"scope": "marvel", "item_id": first_marvel_id},
            )
            assert m_tog.status_code == 200
            assert m_tog.json()["checked_now"] is True
            assert m_tog.json()["summary"]["mcu_done"] == 1

            first_dc = cat["dc"]["projects"][0]
            dc_tog = await client.post(
                "/api/v2/universes/toggle",
                headers=user_a,
                json={"scope": "dc", "item_id": first_dc["id"]},
            )
            assert dc_tog.status_code == 200
            assert dc_tog.json()["summary"]["done"] == 1
            assert dc_tog.json()["summary"]["watched_minutes"] == first_dc["minutes"]

            # Mark 25 ZitraksMode advancements on user_a, export ZM1. code, and import into user_b
            sample_uids = all_adv_uids[:25]
            zm_bulk = await client.post(
                "/api/v2/universes/bulk",
                headers=user_a,
                json={"scope": "zitraks", "item_ids": sample_uids, "mode": "add"},
            )
            assert zm_bulk.status_code == 200
            zm_data = zm_bulk.json()
            assert zm_data["summary"]["got"] == 25
            assert zm_data["summary"]["xp"] > 0
            assert zm_data["zmsave_code"].startswith("ZM1.")

            # Import exported ZM1. code into user_b and verify 1:1 restoration
            imp_res = await client.post(
                "/api/v2/universes/zmsave/import",
                headers=user_b,
                json={"code": zm_data["zmsave_code"], "merge": False},
            )
            assert imp_res.status_code == 200
            assert imp_res.json()["imported_count"] == 25
            assert set(imp_res.json()["checked"]) == set(sample_uids)
    finally:
        await db.close()


@pytest.mark.asyncio
async def test_earth_webcams_bilingual_search_spy_lobby_and_realistic_biometrics(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(db, "db_path", tmp_path / "test_v4_features.db")
    await db.init()

    test_bot_token = "111222333:AAH_TEST_V4_FEATURES_HMAC_SECRET_TOKEN"
    await db.set_setting("bot_token", test_bot_token)
    p1 = {"X-Telegram-Init-Data": _make_signed_init_data(test_bot_token, 8100001, "host_p1", "Артём")}
    p2 = {"X-Telegram-Init-Data": _make_signed_init_data(test_bot_token, 8100002, "player_p2", "Илья")}
    p3 = {"X-Telegram-Init-Data": _make_signed_init_data(test_bot_token, 8100003, "player_p3", "Даша")}
    p4 = {"X-Telegram-Init-Data": _make_signed_init_data(test_bot_token, 8100004, "player_p4", "Макс")}

    app = create_app()
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Intuitive Omni-Search on slang/profanity ("хуйня") -> surfaces Islam & bilingual encyclopedia articles
            slang_r = await client.get("/api/v2/search/intuitive", params={"q": "хуйня"})
            assert slang_r.status_code == 200
            slang_data = slang_r.json()
            assert len(slang_data["articles"]) >= 2
            titles_joined = " ".join(a["title"] for a in slang_data["articles"])
            assert "Ислам" in titles_joined
            islam_art = next(a for a in slang_data["articles"] if "Ислам" in a["title"])
            assert len(islam_art["ru_text"]) > 200
            assert len(islam_art["orig_text"]) > 40

            # 2. Bilingual Constitutions & Religions full texts (Russian + Original language)
            const_r = await client.get("/api/v2/knowledge/constitutions", params={"q": "германия"})
            assert const_r.status_code == 200
            de_item = const_r.json()["items"][0]
            assert "Неприкосновенность" in de_item["ru_full"] or "достоинство" in de_item["ru_full"].lower()
            assert "Die Würde des Menschen" in de_item["orig_full"]
            assert "Deutsch" in de_item["orig_lang"]

            rel_r = await client.get("/api/v2/knowledge/religions", params={"q": "ислам"})
            assert rel_r.status_code == 200
            rel_item = rel_r.json()["items"][0]
            assert len(rel_item["ru_full"]) > 300
            assert len(rel_item["orig_full"]) > 40

            # 3. Earth 3D Live Public Webcams endpoint
            cams_r = await client.get("/api/v2/knowledge/webcams", params={"q": ""})
            assert cams_r.status_code == 200
            assert len(cams_r.json()["items"]) >= 10

            # 4. Calibrated 10-slider deadpan Penis Length Calculator (realistic cm, no 18-20+ inflation)
            avg_pen = await client.post(
                "/api/v2/party/pencil",
                headers=p1,
                json={
                    "height_cm": 178,
                    "shoe_size": 42.5,
                    "age": 22,
                    "clash_royale_trophies": 5200,
                    "arm_girth_cm": 33.5,
                    "wrist_cm": 17.5,
                    "index_finger_cm": 7.4,
                    "dota_mmr": 2800,
                    "sleep_hours": 7.5,
                    "room_temp_c": 22.0,
                },
            )
            assert avg_pen.status_code == 200
            pdata = avg_pen.json()
            assert pdata["length_cm"] == pytest.approx(13.12)
            assert pdata["result_kind"] == "population_reference_not_individual_estimate"
            assert pdata["comparisons"] == []
            assert pdata["factors"] == []

            extreme_pen = await client.post(
                "/api/v2/party/pencil",
                headers=p1,
                json={
                    "height_cm": 205,
                    "shoe_size": 48,
                    "age": 26,
                    "clash_royale_trophies": 9000,
                    "arm_girth_cm": 48,
                    "wrist_cm": 21,
                    "index_finger_cm": 9.2,
                    "dota_mmr": 9000,
                    "sleep_hours": 8.5,
                    "room_temp_c": 24.5,
                },
            )
            assert extreme_pen.status_code == 200
            assert extreme_pen.json()["length_cm"] <= 17.8

            # 5. Spy ("Шпион") Multiplayer Lobby Flow (create -> join x3 -> start -> state -> vote -> spy guess)
            c_res = await client.post(
                "/api/v2/spy/create",
                headers=p1,
                json={"host_name": "Артём", "pack": "all", "spy_count": 1, "round_minutes": 6},
            )
            assert c_res.status_code == 200
            room_code = c_res.json()["code"]
            assert len(room_code) == 5
            tokens = [c_res.json()["my_card"]["token"]]

            for hdr, pname in [(p2, "Илья"), (p3, "Даша"), (p4, "Макс")]:
                j_res = await client.post("/api/v2/spy/join", headers=hdr, json={"code": room_code, "player_name": pname})
                assert j_res.status_code == 200
                tokens.append(j_res.json()["my_card"]["token"])

            st_res = await client.post("/api/v2/spy/start", headers=p1, json={"code": room_code, "player_token": tokens[0]})
            assert st_res.status_code == 200
            assert st_res.json()["status"] == "playing"

            views = []
            for hdr, tok in zip((p1, p2, p3, p4), tokens):
                v = await client.get("/api/v2/spy/state", headers=hdr, params={"code": room_code, "token": tok})
                assert v.status_code == 200
                views.append(v.json())

            spies = [v for v in views if v["my_card"]["is_spy"]]
            civilians = [v for v in views if not v["my_card"]["is_spy"]]
            assert len(spies) == 1
            assert len(civilians) == 3
            assert "СЕКРЕТНО" in spies[0]["my_card"]["location"]
            secret_loc = civilians[0]["my_card"]["location"]
            assert secret_loc and "СЕКРЕТНО" not in secret_loc
            assert civilians[0]["my_card"]["role"]

            # Spy makes an all-in location guess
            spy_tok = spies[0]["my_card"]["token"]
            g_res = await client.post(
                "/api/v2/spy/guess",
                headers=p1,
                json={"code": room_code, "player_token": spy_tok, "guessed_location": secret_loc},
            )
            assert g_res.status_code == 200
            assert g_res.json()["status"] == "finished"
            assert g_res.json()["winner"] == "spies"

            # 6. Workspace category_usage telemetry + Bot new commands (/earth, /chess, /spy, /guess & slang)
            ws_p1 = await client.get("/api/workspace/state", headers=p1)
            assert ws_p1.status_code == 200
            assert "category_usage" in ws_p1.json()
            assert ws_p1.json()["category_usage"].get("party", 0) >= 2

            for bot_cmd, exp_sub in [
                ("/earth", "земля"),
                ("/chess", "шахмат"),
                ("/spy", "шпион"),
                ("/guess", "guess size"),
                ("хуйня", "ислам"),
            ]:
                sim_r = await client.post("/api/sim/send-text", json={"text": bot_cmd})
                assert sim_r.status_code == 200
                assert exp_sub in sim_r.json()["messages"][-1]["text"].lower()
    finally:
        await db.close()


@pytest.mark.asyncio
async def test_timbrica_activities_api_search_and_bot(tmp_path, monkeypatch) -> None:
    """Verify all newly ported Timbrica activities: EGE stress, Yoficator, Translit, Croco, Lie Detector, Omni-Search & Bot."""
    monkeypatch.setattr(db, "db_path", tmp_path / "test_timbrica.db")
    bot_manager.sim_session.chats.clear()
    await db.init()
    try:
        await bot_manager.init_simulator()
        app = create_app()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. FIPI EGE Stress Trainer
            st_r = await client.get("/api/v2/timbrica/ege-stress?count=12")
            assert st_r.status_code == 200
            st_data = st_r.json()
            assert st_data["total_corpus"] >= 60
            assert len(st_data["items"]) == 12
            assert all(it["correct"] in it["options"] for it in st_data["items"])

            st_search = await client.get("/api/v2/timbrica/ege-stress?q=звонит")
            assert st_search.status_code == 200
            assert any(it["base"] == "звонит" and "звони́т" in it["correct"] for it in st_search.json()["items"])

            # 2. Yoficator
            yo_r = await client.post(
                "/api/v2/timbrica/yoficate",
                json={"text": "Еще теплый звездный вечер: режиссер ведет серьезный расчет съемок."},
            )
            assert yo_r.status_code == 200
            yo_out = yo_r.json()
            assert yo_out["replacements_count"] >= 5
            assert "Ещё" in yo_out["output"]
            assert "тёплый" in yo_out["output"]
            assert "съёмок" in yo_out["output"]

            # 3. Multi-standard Transliteration (ICAO/MVD, GOST, ISO-9, URL Slug)
            tr_r = await client.post("/api/v2/timbrica/translit", json={"text": "Щеглов Артём Юрьевич"})
            assert tr_r.status_code == 200
            standards = {s["id"]: s["value"] for s in tr_r.json()["standards"]}
            assert standards["icao_mvd"].startswith("SHCHEGLOV")
            assert "shcheglov" in standards["url_slug"]

            # 4. Crocodile / Hat Words & Lie Detector Party Questions
            cr_r = await client.get("/api/v2/timbrica/croco?level=actions&count=8")
            assert cr_r.status_code == 200
            assert len(cr_r.json()["words"]) == 8

            lie_r = await client.get("/api/v2/timbrica/lie-questions?category=spicy")
            assert lie_r.status_code == 200
            assert len(lie_r.json()["questions"]) >= 4

            # 5. Intuitive Omni-Search routes for all Timbrica categories
            for query_txt, expected_tool in [
                ("чистка динамика от воды 165 гц", "speaker_cleaner"),
                ("бинауральные ритмы розовый шум", "binaural_noise"),
                ("ударения егэ ёфикатор", "russian_ege_ortho"),
                ("падающий песок лава", "sand_physics"),
                ("таблицы шульте струпа", "schulte_stroop"),
                ("детектор лжи полиграф", "lie_detector_fun"),
            ]:
                om_r = await client.get("/api/v2/search/intuitive", params={"q": query_txt})
                assert om_r.status_code == 200
                found_ids = [t["id"] for t in om_r.json()["tools"]]
                assert expected_tool in found_ids, f"Expected {expected_tool} for '{query_txt}', got {found_ids}"

            # 6. Telegram Bot commands for Timbrica tools + inline button callback
            for cmd, substr in [
                ("/udareniya", "ударен"),
                ("/yo Еще теплый вечер", "ещё тёплый"),
                ("/croco", "крокодил"),
                ("/lie", "детектор лжи"),
                ("/speaker", "165"),
                ("/binaural", "бинаурал"),
                ("/reaction", "реакц"),
                ("/aim", "аим"),
                ("/schulte", "шульте"),
                ("/sand", "песочниц"),
            ]:
                b_r = await client.post("/api/sim/send-text", json={"text": cmd})
                assert b_r.status_code == 200
                assert substr in b_r.json()["messages"][-1]["text"].lower()

            # 7. Verify Omni-Router inline buttons (including "📚 Справочники" -> nav:cat:knowledge) & /help
            omni_msg_r = await client.post("/api/sim/send-text", json={"text": "ислам и пупырка"})
            assert omni_msg_r.status_code == 200
            omni_last = omni_msg_r.json()["messages"][-1]
            omni_mid = omni_last["message_id"]
            all_cb_btns = [
                btn
                for row in omni_last["inline_keyboard"]
                for btn in row
                if btn.get("callback_data")
            ]
            assert any(b["callback_data"] == "nav:cat:knowledge" for b in all_cb_btns)
            for btn in all_cb_btns:
                click_r = await client.post(
                    "/api/sim/callback",
                    json={"message_id": omni_mid, "callback_data": btn["callback_data"]},
                )
                assert click_r.status_code == 200
                cur_last = click_r.json()["messages"][-1]
                omni_mid = cur_last["message_id"]
                assert cur_last["text"] != omni_last["text"], f"Dead button detected: {btn}"

            help_r = await client.post("/api/sim/send-text", json={"text": "/help"})
            assert help_r.status_code == 200
            help_txt = help_r.json()["messages"][-1]["text"]
            for must_have in ("/earth", "/chess", "/spy", "/speaker", "/binaural", "/sand", "/udareniya"):
                assert must_have in help_txt

            # 8. Verify all self-hosted animated GIF visuals (/art/*.gif) are served with GIF89a magic bytes
            for gif_name in (
                "speaker_eject.gif",
                "binaural_sync.gif",
                "polygraph_scan.gif",
                "sand_reactions.gif",
                "breathing_calm.gif",
                "fipi_stress.gif",
                "persona_ksyusha.gif",
                "persona_alisa.gif",
                "persona_milana.gif",
                "persona_rita.gif",
            ):
                gif_r = await client.get(f"/art/{gif_name}")
                assert gif_r.status_code == 200, f"Missing static GIF /art/{gif_name}"
                assert gif_r.content[:6] in (b"GIF89a", b"GIF87a")
    finally:
        await db.close()


@pytest.mark.asyncio
async def test_v5_fixes_qr_roundtrip_and_all_tools_bot_wiring() -> None:
    from urllib.parse import quote
    from PIL import ImageOps
    from backend.tools import TOOL_CATEGORIES, TOOLS_BY_ID

    assert len(TOOL_CATEGORIES) >= 32
    assert len(TOOLS_BY_ID) >= 188

    await db.init()
    await bot_manager.init_simulator()
    app = create_app()
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Regression check: intuitive search never raises KeyError: 'form' and resolves instant formulas/regions
            for q in ("хуйня", "россия", "закон", "ip", "ислам", "10 миль в км", "H2SO4", "регион 116"):
                sr = await client.get(f"/api/v2/search/intuitive?q={quote(q)}")
                assert sr.status_code == 200, f"Intuitive search failed on {q}: {sr.text}"
                body = sr.json()
                assert isinstance(body["articles"], list)

            h2so4 = (await client.get("/api/v2/search/intuitive?q=H2SO4")).json()
            assert "98.07" in h2so4["instant"]["output"]

            reg116 = (await client.get(f"/api/v2/search/intuitive?q={quote('регион 116')}")).json()
            assert "Татарстан" in reg116["instant"]["title"]

            # 2. Mixed hex + decimal power in calculator + URI-encoded Cyrillic initData header
            cyr_hdr = {"X-Telegram-Init-Data": quote("user=%7B%22id%22%3A123%2C%22first_name%22%3A%22Сеня%22%7D&hash=bad")}
            calc_r = await client.post(
                "/api/tools/calc/eval",
                json={"expression": "sqrt(2048 * 2) + (0xFF & 0x3C) + 2^10"},
                headers=cyr_hdr,
            )
            assert calc_r.status_code == 200
            assert calc_r.json()["result"] == 1148

            # 3. All 8 QR builder modes + SVG output + dense vCard & inverted QR round-trip decode
            for mode in ("text", "wifi", "vcard", "telegram", "whatsapp", "email", "geo", "crypto"):
                qr_r = await client.post(
                    "/api/tools/qr",
                    json={
                        "mode": mode,
                        "data": "https://t.me/multi_tg_bot",
                        "vcard_name": "Арсений Разработчик",
                        "vcard_phone": "+79991234567",
                        "vcard_telegram": "@QLSCENR",
                        "theme": "cyber",
                        "shape": "dots",
                        "badge_text": "TG",
                    },
                )
                assert qr_r.status_code == 200, f"QR failed on mode={mode}: {qr_r.text}"
                qj = qr_r.json()
                assert qj["svg_data_url"].startswith("data:image/svg+xml;base64,")
                assert qj["contrast"]["safe"] is True

                # Round-trip decode via /api/v2/qr/decode
                import base64

                png_raw = base64.b64decode(qj["image_data_url"].split(",", 1)[1])
                dec_r = await client.post("/api/v2/qr/decode", files={"file": ("qr.png", png_raw, "image/png")})
                assert dec_r.status_code == 200
                dj = dec_r.json()
                assert dj["found"] is True
                assert dj["primary"].strip() == qj["payload"].strip()

            # Adversarial inverted QR image decode
            inv_im = ImageOps.invert(Image.open(io.BytesIO(png_raw)).convert("RGB"))
            inv_buf = io.BytesIO()
            inv_im.save(inv_buf, format="PNG")
            inv_dec = await client.post("/api/v2/qr/decode", files={"file": ("inv.png", inv_buf.getvalue(), "image/png")})
            assert inv_dec.status_code == 200 and inv_dec.json()["found"] is True

            # 4. All v5 domain endpoints (Health, Auto/Travel, Finance, Periodic, Design, Dev)
            assert (await client.post("/api/v2/v5/bmi-macros", json={"sex": "m", "age": 25, "height_cm": 180, "weight_kg": 76})).status_code == 200
            assert (await client.post("/api/v2/v5/sleep-cycles", json={"mode": "wakeup", "time_hhmm": "07:30"})).status_code == 200
            assert (await client.post("/api/v2/v5/workout-1rm", json={"weight_kg": 100, "reps": 5})).status_code == 200
            assert (await client.post("/api/v2/v5/running-pace", json={"distance_km": 10, "time_minutes": 48})).status_code == 200
            assert (await client.post("/api/v2/v5/fuel-trip", json={"distance_km": 500, "consumption_l_100": 8.0, "fuel_price": 62})).status_code == 200
            assert (await client.post("/api/v2/v5/tires-compare", json={"old_spec": "205/55 R16", "new_spec": "215/60 R16"})).status_code == 200
            assert (await client.get("/api/v2/v5/plate-codes?q=777")).json()["count"] >= 1
            assert len((await client.get("/api/v2/v5/world-time?msk_hour=14")).json()["cities"]) >= 10
            assert (await client.post("/api/v2/v5/finance-pro", json={"mode": "loan", "principal": 2000000, "annual_rate_pct": 16, "months": 36})).status_code == 200
            assert (await client.post("/api/v2/v5/bill-split", json={"entries": [{"name": "A", "paid": 2000}, {"name": "B", "paid": 0}]})).json()["transfers"][0]["amount"] == 1000.0
            assert (await client.get("/api/v2/v5/periodic-table?formula=C6H12O6")).json()["molar"]["molar_mass_g_mol"] == pytest.approx(180.156, rel=1e-2)
            assert (await client.post("/api/v2/v5/color-harmony", json={"hex_color": "#0ea5e9"})).status_code == 200
            assert (await client.get("/api/v2/v5/http-chmod?octal=750&q=404")).json()["chmod_symbolic"] == "-rwxr-x---"

            # Optional demo fallback when file upload is omitted
            assert (await client.post("/api/tools/image/exif")).status_code == 200
            assert (await client.post("/api/tools/pdf/inspect")).status_code == 200

            # 4b. Catalog expansion, JoJo Parts 3–9, reference tools, PC builder and dated statistics
            assert len(TOOL_CATEGORIES) >= 28
            assert len(TOOLS_BY_ID) >= 141
            assert "карандаш" not in TOOLS_BY_ID["pencil_calc"]["title"].lower()
            assert "карандаш" not in TOOLS_BY_ID["pencil_calc"]["desc"].lower()

            breast_r = await client.post(
                "/api/v6/party/breast-calc",
                json={"height_cm": 168, "underbust_cm": 74, "matcha_latte_per_week": 6},
            )
            assert breast_r.status_code == 200
            assert breast_r.json()["result_kind"] == "measurements_required"

            cbt_r = await client.post(
                "/api/v6/ai/cbt",
                json={"situation": "Экзамен", "automatic_thought": "Я точно всё провалю навсегда", "intensity_before": 82},
            )
            assert cbt_r.status_code == 200 and len(cbt_r.json()["distortions"]) >= 1

            ai_r = await client.post("/api/v6/ai/chat", json={"message": "Что такое фотосинтез", "use_web": False})
            assert ai_r.status_code == 200 and ai_r.json()["answer"]

            for part_num in range(3, 10):
                jr = await client.get(f"/api/v6/jojo/stands?part={part_num}")
                assert jr.status_code == 200 and jr.json()["matched"] >= 2, f"Missing JoJo Part {part_num} Stands"
            assert (await client.post("/api/v6/jojo/awaken", json={"name": "Jotaro"})).status_code == 200

            act_r = await client.get("/api/v6/adult/actresses?cup=D")
            assert act_r.status_code == 200 and act_r.json()["matched"] >= 3
            ht_r = await client.get("/api/v6/adult/hentai-tags?q=vanilla")
            assert ht_r.status_code == 200 and ht_r.json()["matched"] >= 1

            pc_catalog_r = await client.get("/api/v6/pc/catalog")
            assert pc_catalog_r.status_code == 200
            pc_catalog = pc_catalog_r.json()
            assert len(pc_catalog["cpus"]) >= 25 and len(pc_catalog["gpus"]) >= 20
            assert {"DDR3", "DDR4", "DDR5"} <= {item["ram_type"] for item in pc_catalog["rams"]}
            assert len(pc_catalog["hdds"]) >= 4 and len(pc_catalog["ssds"]) >= 8
            pc_default = await client.post("/api/v6/pc/evaluate", json={})
            assert pc_default.status_code == 200 and pc_default.json()["compatible"] is True
            assert pc_default.json()["selected"]["cpu"]["id"] == "i5_6500"
            assert pc_default.json()["price_note"] and pc_default.json()["performance_note"]
            pc_apu = await client.post("/api/v6/pc/evaluate", json={"cpu_id": "r5_5600g", "gpu_id": "gpu_none", "mb_id": "b550_tuf", "ram_id": "ddr4_16_3200", "cooler_id": "stock_am4", "ssd_id": "sata_480", "hdd_id": "hdd_1tb", "psu_id": "psu_450", "case_id": "budget_mini"})
            assert pc_apu.status_code == 200 and pc_apu.json()["compatible"] is True
            assert pc_apu.json()["storage_capacity_gb"] == 1480
            pc_unsupported_igpu = await client.post("/api/v6/pc/evaluate", json={"cpu_id": "r5_5600", "gpu_id": "gpu_none"})
            assert pc_unsupported_igpu.status_code == 200 and pc_unsupported_igpu.json()["compatible"] is False
            pc_unknown_part = await client.post("/api/v6/pc/evaluate", json={"cpu_id": "made_up_cpu"})
            assert pc_unknown_part.status_code == 200 and any("Неизвестный идентификатор детали" in item for item in pc_unknown_part.json()["errors"])
            pc_platform_mismatch = await client.post("/api/v6/pc/evaluate", json={"cpu_id": "i5_9400f", "mb_id": "h110_lga1151"})
            assert pc_platform_mismatch.status_code == 200 and pc_platform_mismatch.json()["compatible"] is False
            pc_m2_mismatch = await client.post("/api/v6/pc/evaluate", json={"cpu_id": "i5_6500", "mb_id": "h110_lga1151", "ram_id": "ddr4_16_2133", "ssd_id": "nvme_500"})
            assert pc_m2_mismatch.status_code == 200 and pc_m2_mismatch.json()["compatible"] is False
            pc_ram_speed = await client.post("/api/v6/pc/evaluate", json={"cpu_id": "i5_6500", "mb_id": "h110_lga1151", "ram_id": "ddr4_16_3200"})
            assert pc_ram_speed.status_code == 200 and any("фактическая частота может быть снижена" in item for item in pc_ram_speed.json()["warnings"])
            pc_ok = await client.post("/api/v6/pc/evaluate", json={"cpu_id": "r7_9800x3d", "gpu_id": "rtx_5070ti", "mb_id": "b650_aorus", "ram_id": "ddr5_32_6000", "cooler_id": "ak620", "psu_id": "psu_850", "case_id": "lancool_216"})
            assert pc_ok.status_code == 200 and pc_ok.json()["compatible"] is True
            pc_bad = await client.post("/api/v6/pc/evaluate", json={"cpu_id": "r7_9800x3d", "mb_id": "b760m_d4", "ram_id": "ddr5_32_6000"})
            assert pc_bad.status_code == 200 and pc_bad.json()["compatible"] is False

            assert (await client.get("/api/v6/cars/catalog?q=Porsche")).json()["matched"] >= 1
            assert (await client.get("/api/v6/materials/catalog")).status_code == 200
            assert (await client.get("/api/v6/style/looksmax")).status_code == 200
            assert len((await client.get("/api/v6/gaming/wikis")).json()["games"]) >= 5
            assert (await client.post("/api/v6/nealfun/craft", json={"item_a": "Вода", "item_b": "Огонь"})).json()["result"] == "Пар"
            assert len((await client.get("/api/v6/nealfun/billionaire")).json()["items"]) >= 12
            route = await client.post("/api/v6/route/plan", json={"origin": "Москва", "destination": "Казань", "via": "Самара", "transport": "car"})
            assert route.status_code == 200 and route.json()["route_distance_km"] > 600
            assert len(route.json()["waypoints"]) == 3 and "без дорожного/железнодорожного роутера" in route.json()["estimate_note"]
            rounded_duration = (await client.post("/api/v6/route/plan", json={"origin": "0,0", "destination": "0,1.25", "transport": "car"})).json()["duration_formatted"]
            assert rounded_duration.endswith("00 мин") and "60 мин" not in rounded_duration
            assert (await client.post("/api/v6/route/plan", json={"origin": "x", "destination": "Казань"})).status_code == 400
            assert (await client.post("/api/v6/route/plan", json={"origin": "Москва", "destination": "Казань", "transport": "rocket"})).status_code == 422
            assert (await client.post("/api/v6/route/plan", json={"origin": "Москва", "destination": "Казань", "fuel_l_per_100km": "NaN"})).status_code == 422
            conv_csv = await client.post(
                "/api/v6/files/convert",
                files={"file": ("items.json", b'[{"a": 1, "b": 2}]', "application/json")},
                data={"target_format": "csv"},
            )
            assert conv_csv.status_code == 200 and b"a,b" in conv_csv.content

            assert len((await client.get("/api/v6/science/solar-system")).json()["bodies"]) >= 10
            ecl = (await client.get("/api/v6/science/eclipses-comets")).json()
            assert "2026-10-25" in ecl["reference_utc"] and len(ecl["events"]) >= 4
            assert (await client.get("/api/v6/science/cell-atom-quarks")).status_code == 200
            irr = (await client.get("/api/v6/math/irrational?constant=pi&digits=1200&search=14159")).json()
            assert irr["found_at_decimal_place"] == 1 and len(irr["fractional_digits"]) == 1200
            bab = (await client.post("/api/v6/babel/search", json={"phrase": "библиотека вечности"})).json()
            assert "библиотека вечности" in bab["text"]
            bab_b = (await client.get(f"/api/v6/babel/browse?hex_id={bab['hex_id']}&wall={bab['wall']}&shelf={bab['shelf']}&volume={bab['volume']}&page={bab['page']}")).json()
            assert "библиотека вечности" in bab_b["text"]

            gl = (await client.get("/api/v6/culture/genres-lore")).json()
            assert "music" in gl["genres"] and len(gl["lore"]) >= 3
            estats = (await client.get("/api/v6/stats/earth-2026?x_metric=penis_length_cm&y_metric=penis_girth_cm")).json()
            assert estats["as_of_date"] == "25.10.2026" and estats["pearson_r"] > 0.5
            assert len((await client.get("/api/v6/tests/iq-eq")).json()["iq_questions"]) >= 8
            assert len((await client.get("/api/v2/knowledge/webcams?q=")).json()["items"]) >= 18

            # 5. Verify EVERY registered category & tool opens cleanly in the Telegram Bot Simulator!
            start_r = await client.post("/api/sim/send-text", json={"text": "/start"})
            assert start_r.status_code == 200
            mid = start_r.json()["messages"][-1]["message_id"]

            for cat in TOOL_CATEGORIES:
                cat_r = await client.post("/api/sim/callback", json={"message_id": mid, "callback_data": f"nav:cat:{cat['id']}"})
                assert cat_r.status_code == 200, f"Category nav failed: {cat['id']}"
                mid = cat_r.json()["messages"][-1]["message_id"]

            for tid in TOOLS_BY_ID:
                t_r = await client.post("/api/sim/callback", json={"message_id": mid, "callback_data": f"tool:open:{tid}"})
                assert t_r.status_code == 200, f"Bot callback tool:open:{tid} failed: {t_r.text}"
                msgs = t_r.json()["messages"]
                assert len(msgs) >= 1 and msgs[-1]["text"], f"Empty bot response on tool:open:{tid}"
                mid = msgs[-1]["message_id"]
    finally:
        await db.close()


@pytest.mark.asyncio
async def test_3d_earth_orientation_and_graceful_bot_shutdown(caplog) -> None:
    import math
    from pathlib import Path
    from backend.bot.factory import bot_manager
    from backend.tools import TOOL_CATEGORIES, TOOLS_BY_ID

    # 1. Catalog growth guard: strictly >= 28 categories & >= 148 tools
    assert len(TOOL_CATEGORIES) >= 28
    assert len(TOOLS_BY_ID) >= 148

    # 2. Source & mathematical verification that 3D Earth is strictly North-UP (never upside down)
    repo_root = Path(__file__).resolve().parent.parent
    earth_src = (repo_root / "frontend" / "src" / "components" / "tools" / "EarthWebcams3D.tsx").read_text(encoding="utf-8")
    engine_src = (repo_root / "frontend" / "src" / "lib" / "engine3d.ts").read_text(encoding="utf-8")
    cosmos_src = (repo_root / "frontend" / "src" / "components" / "tools" / "CosmosMicroMathHub.tsx").read_text(encoding="utf-8")

    assert "-radius * Math.sin(lat)" not in earth_src, "EarthWebcams3D must never invert latitude Y!"
    assert "latLonToVec3" in earth_src
    assert "y: radius * Math.sin(lat)" in engine_src
    assert "y: -z * 0.28" not in cosmos_src, "3D surface Z peaks must point UP (+Y), not down!"

    def lat_lon_to_screen_sy(lat_deg: float, lon_deg: float, rx: float = 0.0, ry: float = 0.0) -> float:
        lat = math.radians(lat_deg)
        lon = math.radians(lon_deg)
        x = math.cos(lat) * math.sin(lon)
        y = math.sin(lat)
        z = math.cos(lat) * math.cos(lon)
        # rotY(ry)
        x1 = x * math.cos(ry) + z * math.sin(ry)
        y1 = y
        z1 = -x * math.sin(ry) + z * math.cos(ry)
        # rotX(rx)
        y2 = y1 * math.cos(rx) - z1 * math.sin(rx)
        z2 = y1 * math.sin(rx) + z1 * math.cos(rx)
        scale = 320.0 / (3.55 - z2)
        return 180.0 - y2 * scale

    sy_north = lat_lon_to_screen_sy(89.0, 0.0)
    sy_moscow = lat_lon_to_screen_sy(55.75, 0.0)
    sy_eq = lat_lon_to_screen_sy(0.0, 0.0)
    sy_sydney = lat_lon_to_screen_sy(-33.86, 0.0)
    sy_south = lat_lon_to_screen_sy(-89.0, 0.0)
    assert sy_north < sy_moscow < sy_eq < sy_sydney < sy_south

    # Centered Moscow fly-to check: rx = +lat, ry = -lon places Moscow at exact screen center & North Pole above it!
    moscow_rx = math.radians(55.75)
    moscow_ry = math.radians(-37.54)
    assert abs(lat_lon_to_screen_sy(55.75, 37.54, moscow_rx, moscow_ry) - 180.0) < 1e-6
    assert lat_lon_to_screen_sy(89.9, 0.0, moscow_rx, moscow_ry) < 180.0

    # 3. Graceful Telegram polling stop check (no ServerDisconnectedError or unhandled exceptions)
    await bot_manager.stop_live_polling()
    assert bot_manager.live_status["running"] is False
    assert "ServerDisconnectedError" not in caplog.text







