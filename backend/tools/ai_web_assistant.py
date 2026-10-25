from __future__ import annotations

import asyncio
import html
import os
import re
from datetime import datetime
from typing import Any
from urllib.parse import quote

import httpx

from backend.tools.smart_calc import evaluate_math

CURRENT_DATE_STR = "25.10.2026"

# ==============================================================================
# 1. COGNITIVE DISTORTIONS & CBT PSYCHOTHERAPY ENGINE
# ==============================================================================

CBT_DISTORTIONS: list[dict[str, str]] = [
    {
        "id": "catastrophizing",
        "title": "Катастрофизация",
        "markers": "кошмар,ужас,всё пропало,конец,никогда не справлюсь,точно уволят,провал,умру,разрушено",
        "desc": "Предсказание наихудшего сценария как единственно неизбежного без учёта реальных вероятностей.",
        "reframe": "Отделите худший сценарий от наиболее вероятного: какова реальная статистическая вероятность катастрофы и какой план действий есть даже на случай неудачи?",
    },
    {
        "id": "dichotomous",
        "title": "Чёрно-белое (дихотомическое) мышление",
        "markers": "всегда,никогда,идеально,полный ноль,всё или ничего,либо,бесполезно,абсолютно все,никто",
        "desc": "Оценка себя, людей и событий только в двух крайних полюсах без промежуточных оттенков.",
        "reframe": "Оцените ситуацию по шкале от 0 до 100%, а не 0 или 1: частичный результат не равен провалу.",
    },
    {
        "id": "mind_reading",
        "title": "Чтение мыслей",
        "markers": "они думают,наверняка считают,презирают,смеются надо мной,он точно решил,все видят что я",
        "desc": "Уверенность в том, что вы знаете негативные мысли других людей без прямых фактов.",
        "reframe": "Чужие мысли недоступны напрямую: проверьте гипотезу вопросом или вспомните, насколько люди обычно заняты собственными заботами.",
    },
    {
        "id": "should_statements",
        "title": "Долженствование («Я обязан / Они должны»)",
        "markers": "должен,обязан,не имею права,обязана,должны были,недопустимо ошибаться",
        "desc": "Жёсткие внутренние требования к себе и миру, вызывающие вину, стыд или гнев при любом отклонении.",
        "reframe": "Замените жёсткое «я обязан» на гибкое предпочтение: «мне бы хотелось / мне полезнее, но я живой человек и имею право на шаг за шагом».",
    },
    {
        "id": "overgeneralization",
        "title": "Сверхобобщение",
        "markers": "вечно у меня,опять как всегда,каждый раз одно и то же,вся жизнь такая,сплошные неудачи",
        "desc": "Вывод глобального правила из одного или нескольких неприятных эпизодов.",
        "reframe": "Один эпизод — это точка данных, а не приговор на будущее. Назовите хотя бы 2–3 случая, когда вы справлялись иначе.",
    },
    {
        "id": "personalization",
        "title": "Персонализация и самообвинение",
        "markers": "из-за меня,моя вина,я всё испортил,я виноват,я виновата,я подвёл всех",
        "desc": "Принятие на себя 100% ответственности за события, зависящие от множества внешних факторов и других людей.",
        "reframe": "Разделите круги ответственности: какие факторы реально зависели от вас, а какие — от обстоятельств и решений других людей?",
    },
    {
        "id": "devaluation",
        "title": "Обесценивание позитивного",
        "markers": "просто повезло,это мелочь,любой бы смог,не считается,случайно вышло",
        "desc": "Игнорирование собственных успехов и сильных сторон как «случайности».",
        "reframe": "Если бы точно такого же результата добился ваш близкий друг, назвали бы вы это пустяком?",
    },
    {
        "id": "emotional_reasoning",
        "title": "Эмоциональное обоснование",
        "markers": "чувствую себя ничтожеством,мне тревожно значит,чувствую что беда,ощущение что я тупой",
        "desc": "Принятие сильной эмоции за доказательство объективного факта («раз мне страшно — значит, опасность реальна»).",
        "reframe": "Эмоция — это сигнал нервной системы, а не юридический факт. Тревога и усталость искажают оптику восприятия.",
    },
]


def detect_cbt_distortions(text: str) -> list[dict[str, str]]:
    low = (text or "").lower()
    found: list[dict[str, str]] = []
    for item in CBT_DISTORTIONS:
        markers = [m.strip() for m in item["markers"].split(",") if m.strip()]
        if any(m in low for m in markers):
            found.append(
                {
                    "id": item["id"],
                    "title": item["title"],
                    "desc": item["desc"],
                    "reframe": item["reframe"],
                }
            )
    if not found and len(low.strip()) > 12:
        found.append(
            {
                "id": "stress_tunnel",
                "title": "Туннельное внимание на проблеме",
                "desc": "В состоянии напряжения фокус сужается вокруг источника тревоги, вытесняя точки опоры.",
                "reframe": "Сделайте выдох длиннее вдоха (4 сек вдох — 7 сек пауза — 8 сек выдох) и выпишите 3 конкретных действия под вашим контролем сегодня.",
            }
        )
    return found


# ==============================================================================
# 2. LIVE INTERNET GROUNDING (WIKIPEDIA RU/EN + DUCKDUCKGO + WEATHER)
# ==============================================================================

async def _search_wikipedia(client: httpx.AsyncClient, query: str, lang: str = "ru") -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    try:
        api_url = f"https://{lang}.wikipedia.org/w/api.php"
        r = await client.get(
            api_url,
            params={
                "action": "query",
                "generator": "search",
                "gsrsearch": query,
                "gsrlimit": 3,
                "prop": "extracts|pageimages|info",
                "exintro": 1,
                "explaintext": 1,
                "exchars": 650,
                "piprop": "thumbnail",
                "pithumbsize": 600,
                "inprop": "url",
                "format": "json",
            },
        )
        if r.status_code == 200:
            pages = (r.json().get("query") or {}).get("pages") or {}
            ordered = sorted(pages.values(), key=lambda p: p.get("index", 99))
            for p in ordered:
                extract = (p.get("extract") or "").strip()
                if not extract:
                    continue
                thumb = (p.get("thumbnail") or {}).get("source")
                results.append(
                    {
                        "source": f"Wikipedia ({lang.upper()})",
                        "title": p.get("title", ""),
                        "snippet": extract,
                        "url": p.get("fullurl") or f"https://{lang}.wikipedia.org/wiki/{quote(str(p.get('title', '')))}",
                        "image": thumb,
                    }
                )
    except Exception:
        pass
    return results


async def _search_duckduckgo(client: httpx.AsyncClient, query: str) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    try:
        r = await client.get(
            "https://api.duckduckgo.com/",
            params={"q": query, "format": "json", "no_html": 1, "skip_disambig": 1, "kl": "ru-ru"},
        )
        if r.status_code == 200:
            data = r.json()
            if data.get("AbstractText"):
                results.append(
                    {
                        "source": data.get("AbstractSource") or "DuckDuckGo Instant",
                        "title": data.get("Heading") or query,
                        "snippet": data["AbstractText"][:700],
                        "url": data.get("AbstractURL") or f"https://duckduckgo.com/?q={quote(query)}",
                        "image": (f"https://duckduckgo.com{data['Image']}" if str(data.get("Image", "")).startswith("/") else data.get("Image")) or None,
                    }
                )
            for topic in (data.get("RelatedTopics") or [])[:3]:
                if isinstance(topic, dict) and topic.get("Text") and topic.get("FirstURL"):
                    results.append(
                        {
                            "source": "Web Search",
                            "title": topic["Text"][:80],
                            "snippet": topic["Text"][:420],
                            "url": topic["FirstURL"],
                            "image": None,
                        }
                    )
    except Exception:
        pass

    if len(results) < 2:
        try:
            hr = await client.post(
                "https://lite.duckduckgo.com/lite/",
                data={"q": query},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            if hr.status_code == 200:
                links = re.findall(
                    r'<a[^>]+rel="nofollow"[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
                    hr.text,
                    flags=re.IGNORECASE | re.DOTALL,
                )
                snippets = re.findall(
                    r"<td class=['\"]result-snippet['\"][^>]*>(.*?)</td>",
                    hr.text,
                    flags=re.IGNORECASE | re.DOTALL,
                )
                for idx, (href, raw_title) in enumerate(links[:4]):
                    clean_title = html.unescape(re.sub(r"<[^>]+>", "", raw_title)).strip()
                    clean_snip = html.unescape(re.sub(r"<[^>]+>", "", snippets[idx] if idx < len(snippets) else "")).strip()
                    if clean_title and href.startswith("http"):
                        results.append(
                            {
                                "source": "DuckDuckGo Web",
                                "title": clean_title[:110],
                                "snippet": clean_snip[:420],
                                "url": href,
                                "image": None,
                            }
                        )
        except Exception:
            pass
    return results


async def gather_live_web_context(query: str) -> list[dict[str, Any]]:
    clean_q = re.sub(
        r"^(кто такой|кто такая|что такое|расскажи про|найди в интернете|объясни|почему|как работает)\s+",
        "",
        (query or "").strip(),
        flags=re.IGNORECASE,
    ).strip(" ?!.")
    if not clean_q:
        return []

    headers = {"User-Agent": "MULTI_TG_TOOL/6.0 (Educational Knowledge Assistant)"}
    async with httpx.AsyncClient(timeout=5.2, follow_redirects=True, headers=headers) as client:
        ru_wiki_task = _search_wikipedia(client, clean_q, "ru")
        en_wiki_task = _search_wikipedia(client, clean_q, "en")
        ddg_task = _search_duckduckgo(client, query)
        ru_res, en_res, ddg_res = await asyncio.gather(ru_wiki_task, en_wiki_task, ddg_task, return_exceptions=True)

    merged: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    for batch in (ddg_res, ru_res, en_res):
        if isinstance(batch, list):
            for item in batch:
                u = item.get("url") or ""
                if u in seen_urls:
                    continue
                seen_urls.add(u)
                merged.append(item)
    return merged[:6]


# ==============================================================================
# 3. KEYLESS FREE LLM GATEWAY + ENV-KEY SUPPORT + RESILIENT LOCAL SYNTHESIS
# ==============================================================================

async def _call_llm_gateway(messages: list[dict[str, str]]) -> tuple[str | None, str]:
    """
    1) Uses explicit API key if configured (OpenAI / Groq / OpenRouter).
    2) Otherwise uses free keyless Pollinations OpenAI-compatible gateway (openai / mistral).
    """
    headers_base = {"User-Agent": "MULTI_TG_TOOL/6.0", "Content-Type": "application/json"}

    # Optional user/admin env keys
    env_providers = [
        ("GROQ_API_KEY", "https://api.groq.com/openai/v1/chat/completions", "llama-3.3-70b-versatile"),
        ("OPENAI_API_KEY", "https://api.openai.com/v1/chat/completions", "gpt-4o-mini"),
        ("OPENROUTER_API_KEY", "https://openrouter.ai/api/v1/chat/completions", "meta-llama/llama-3.3-70b-instruct:free"),
    ]
    async with httpx.AsyncClient(timeout=14.0, follow_redirects=True) as client:
        for env_name, endpoint, model_id in env_providers:
            key = os.getenv(env_name, "").strip()
            if not key:
                continue
            try:
                r = await client.post(
                    endpoint,
                    headers={**headers_base, "Authorization": f"Bearer {key}"},
                    json={"model": model_id, "messages": messages, "temperature": 0.45, "max_tokens": 1100},
                )
                if r.status_code == 200:
                    txt = (((r.json().get("choices") or [{}])[0].get("message") or {}).get("content") or "").strip()
                    if txt:
                        return txt, model_id
            except Exception:
                continue

        # Keyless Free Multi-Model Gateway (Pollinations OpenAI-compatible endpoint)
        for model_name in ("openai", "mistral"):
            try:
                r = await client.post(
                    "https://text.pollinations.ai/openai",
                    headers=headers_base,
                    json={
                        "model": model_name,
                        "messages": messages,
                        "temperature": 0.45,
                        "private": True,
                    },
                )
                if r.status_code == 200:
                    data = r.json()
                    txt = (((data.get("choices") or [{}])[0].get("message") or {}).get("content") or "").strip()
                    if txt:
                        return txt, f"Pollinations Free LLM ({model_name})"
            except Exception:
                continue

        # Secondary GET fallback on Pollinations
        try:
            last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
            sys_hint = next((m["content"] for m in messages if m["role"] == "system"), "")[:450]
            prompt_blob = f"{sys_hint}\n\nВопрос: {last_user}\nОтвет на русском языке:"
            r = await client.get(f"https://text.pollinations.ai/{quote(prompt_blob[:1600])}", params={"model": "openai"})
            if r.status_code == 200 and len(r.text.strip()) > 8 and "<html" not in r.text[:120].lower():
                return r.text.strip(), "Pollinations Direct LLM"
        except Exception:
            pass

    return None, "MULTI_TG_TOOL Local Knowledge Engine"


def _local_smart_fallback(
    message: str,
    mode: str,
    sources: list[dict[str, Any]],
    page_context: str = "",
) -> str:
    q = (message or "").strip()

    # 1. Exact math calculation if query contains arithmetic/functions
    math_candidate = re.sub(r"^(посчитай|вычисли|сколько будет|реши)\s+", "", q, flags=re.IGNORECASE).strip(" =?")
    if re.search(r"\d", math_candidate) and re.search(r"[\+\-\*\/\^\%]|sqrt|sin|cos|log|ln", math_candidate):
        try:
            m = evaluate_math(math_candidate)
            return (
                f"📐 **Точный расчёт:** `{m['expression']} = {m['formatted']}`\n\n"
                + (
                    f"Представления: HEX `{m['representations'].get('hex', '—')}`, BIN `{m['representations'].get('bin', '—')}`."
                    if m.get("representations")
                    else "Вычислено математическим ядром повышенной точности."
                )
            )
        except Exception:
            pass

    # 2. If web sources were retrieved, synthesize a structured answer from them
    if sources:
        lines = [f"По данным найденных источников (актуальность {CURRENT_DATE_STR}):\n"]
        for idx, s in enumerate(sources[:3], start=1):
            lines.append(f"**{idx}. {s['title']}** ({s['source']})\n{s['snippet']}\n")
        return "\n".join(lines).strip()

    # 3. Try internal MULTI_TG_TOOL encyclopedia search
    try:
        from backend.tools.knowledge_hub import intuitive_omni_search

        omni = intuitive_omni_search(q)
        parts: list[str] = []
        if omni.get("instant") and omni["instant"].get("output"):
            parts.append(f"**{omni['instant'].get('title', 'Результат')}:** {omni['instant']['output']}")
        for art in (omni.get("articles") or [])[:2]:
            txt = (art.get("ru_text") or "")[:550]
            parts.append(f"**{art.get('title', '')}**\n{txt}")
        if omni.get("tools"):
            t_names = ", ".join(f"{t['emoji']} {t['title']}" for t in omni["tools"][:4])
            parts.append(f"Релевантные инструменты платформы: {t_names}.")
        if parts:
            return "\n\n".join(parts)
    except Exception:
        pass

    if mode == "cbt":
        dist = detect_cbt_distortions(q)
        d_lines = "\n".join(f"• **{d['title']}**: {d['reframe']}" for d in dist[:3])
        return (
            "Давайте разберём эту ситуацию спокойно по протоколу когнитивно-поведенческой терапии (КПТ):\n\n"
            f"{d_lines}\n\n"
            "**Следующий микрошаг:** оцените интенсивность эмоции от 0 до 10 баллов сейчас, сформулируйте один проверяемый факт в свою пользу и одно маленькое действие на ближайшие 15 минут."
        )

    ctx_note = f" (раздел: {page_context})" if page_context else ""
    return (
        f"Запрос принят{ctx_note} (дата системы: {CURRENT_DATE_STR}). "
        f"Для глубокого ответа уточните ключевой термин, формулу, код или задачу — я проверю энциклопедическую базу и выполню расчёт."
    )


async def ask_ai_with_internet(
    message: str,
    history: list[dict[str, str]] | None = None,
    use_web: bool = True,
    mode: str = "general",  # general | deep | code | study | cbt
    page_context: str = "",
) -> dict[str, Any]:
    clean_msg = (message or "").strip()
    if not clean_msg:
        raise ValueError("Введите сообщение для ИИ-ассистента")

    sources: list[dict[str, Any]] = []
    if use_web and mode != "cbt":
        sources = await gather_live_web_context(clean_msg)

    role_prompts = {
        "general": "Давай точные, содержательные, хорошо структурированные ответы без воды и без неуместных шуток.",
        "deep": "Проводи глубокий аналитический разбор по пунктам с фактами, цифрами, причинно-следственными связями и выводами.",
        "code": "Ты ведущий системный архитектор и разработчик. Пиши чистый, рабочий, современный код с пояснением сложности и крайних случаев.",
        "study": "Ты университетский преподаватель. Объясняй наглядно, шаг за шагом, с формулами и примерами.",
        "cbt": (
            "Ты бережный, профессиональный когнитивно-поведенческий психотерапевт (КПТ / АСТ). "
            "Не ставь медицинских диагнозов, поддержи человека без обесценивания, помоги заметить автоматические мысли, "
            "когнитивные искажения и сформулировать реалистичный поддерживающий ответ."
        ),
    }

    web_block = ""
    if sources:
        formatted_sources = "\n".join(
            f"[{i}] {s['title']} ({s['source']} — {s['url']}): {s['snippet']}"
            for i, s in enumerate(sources, start=1)
        )
        web_block = f"\n\nАктуальные данные из Интернета по запросу:\n{formatted_sources}\nОпирайся на проверенные факты из этих источников."

    ctx_block = f"\nПользователь сейчас находится в разделе приложения: {page_context}." if page_context else ""

    system_prompt = (
        f"Ты встроенный интеллектуальный ассистент платформы MULTI_TG_TOOL с доступом в Интернет. "
        f"Сегодняшняя дата: {CURRENT_DATE_STR}. Отвечай на языке пользователя (по умолчанию на грамотном русском языке). "
        f"{role_prompts.get(mode, role_prompts['general'])}{ctx_block}{web_block}"
    )

    llm_messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for h in (history or [])[-8:]:
        r_role = h.get("role", "user")
        r_content = str(h.get("content", "")).strip()
        if r_role in ("user", "assistant") and r_content:
            llm_messages.append({"role": r_role, "content": r_content[:1800]})
    llm_messages.append({"role": "user", "content": clean_msg[:3000]})

    answer, model_used = await _call_llm_gateway(llm_messages)
    used_offline_fallback = False
    if not answer:
        used_offline_fallback = True
        answer = _local_smart_fallback(clean_msg, mode=mode, sources=sources, page_context=page_context)

    images = [s["image"] for s in sources if s.get("image")]
    cbt_distortions = detect_cbt_distortions(clean_msg) if mode == "cbt" else []

    return {
        "answer": answer,
        "model": model_used,
        "date": CURRENT_DATE_STR,
        "web_enabled": use_web,
        "offline_fallback": used_offline_fallback,
        "sources": sources,
        "images": images[:3],
        "cbt_distortions": cbt_distortions,
    }


async def run_cbt_thought_record(
    situation: str,
    automatic_thought: str,
    emotion: str = "Тревога",
    intensity_before: int = 75,
) -> dict[str, Any]:
    sit = (situation or "").strip()
    thought = (automatic_thought or "").strip()
    if not sit and not thought:
        raise ValueError("Опишите ситуацию или автоматическую мысль")

    combined = f"Ситуация: {sit}\nАвтоматическая мысль: {thought}\nЭмоция: {emotion} ({intensity_before}/100)"
    distortions = detect_cbt_distortions(f"{sit} {thought}")
    ai_res = await ask_ai_with_internet(
        message=(
            f"Помоги разобрать запись дневника мыслей СМЭР (КПТ).\n{combined}\n"
            "Сформулируй: 1) какие когнитивные искажения здесь возможны; "
            "2) аргументы «за» и «против» автоматической мысли; "
            "3) спокойный адаптивный рациональный ответ; "
            "4) одно небольшое бережное действие."
        ),
        use_web=False,
        mode="cbt",
    )
    est_after = max(15, int(round(max(0, min(100, int(intensity_before))) * 0.52)))
    return {
        "situation": sit,
        "automatic_thought": thought,
        "emotion": emotion,
        "intensity_before": max(0, min(100, int(intensity_before))),
        "estimated_intensity_after": est_after,
        "distortions": distortions,
        "therapist_response": ai_res["answer"],
        "model": ai_res["model"],
        "grounding_54321": [
            "👀 Назовите 5 предметов вокруг себя и их цвет",
            "✋ Прикоснитесь к 4 разным текстурам (ткань, стол, ладонь, прохладный предмет)",
            "👂 Прислушайтесь к 3 звукам в комнате или за окном",
            "🌿 Отметьте 2 запаха в пространстве",
            "💧 Сделайте 1 медленный глоток воды и расправьте плечи",
        ],
    }
