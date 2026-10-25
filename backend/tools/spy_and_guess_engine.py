from __future__ import annotations

import secrets
import time
from typing import Any

# ==============================================================================
# 1. ЛОКАЦИИ И РОЛИ ДЛЯ ИГРЫ «🕵️ ШПИОН» (ОНЛАЙН-ЛОББИ И НА ОДНОМ УСТРОЙСТВЕ)
# ==============================================================================
SPY_LOCATIONS_DB: list[dict[str, Any]] = [
    # --- КЛАССИКА ---
    {"name": "Аэропорт (Терминал вылета)", "pack": "classic", "roles": ["Командир воздушного судна", "Бортпроводник", "Сотрудник таможни", "Опаздывающий пассажир", "Диспетчер вышки", "Работник Duty Free", "Авиамеханик"]},
    {"name": "Подводная лодка", "pack": "classic", "roles": ["Капитан подлодки", "Акустик-гидролокаторщик", "Кок на камбузе", "Штурман", "Инженер реакторного отсека", "Радист", "Судовой врач"]},
    {"name": "Больница (Приёмное отделение)", "pack": "classic", "roles": ["Главврач", "Хирург", "Дежурная медсестра", "Пациент с гипсом", "Анестезиолог", "Фельдшер скорой", "Рентгенолог"]},
    {"name": "Поезд дальнего следования", "pack": "classic", "roles": ["Проводник вагона", "Машинист электровоза", "Пассажир с верхней полки", "Повар вагона-ресторана", "Начальник поезда", "Попутчик с курицей в фольге"]},
    {"name": "Банк (Хранилище)", "pack": "classic", "roles": ["Управляющий отделением", "Инкассатор", "Старший кассир", "Начальник охраны", "VIP-вкладчик", "Кредитный аналитик"]},
    {"name": "Отель 5 звёзд", "pack": "classic", "roles": ["Консьерж на ресепшене", "Шеф-повар ресторана", "Портье", "Горничная", "Постоялец пентхауса", "Спасатель у бассейна"]},
    {"name": "Театр за кулисами", "pack": "classic", "roles": ["Главный режиссёр", "Прима-актриса", "Гримёр", "Осветитель софитов", "Суфлёр", "Дирижёр оркестровой ямы", "Гардеробщик"]},
    {"name": "Университет на экзамене", "pack": "classic", "roles": ["Строгий профессор", "Декан факультета", "Отличник с первой парты", "Студент со шпаргалкой", "Лаборант кафедры", "Староста группы"]},
    {"name": "Супермаркет перед закрытием", "pack": "classic", "roles": ["Кассир", "Охранник у камер", "Мерчандайзер", "Пекарь горячего цеха", "Покупатель с полной тележкой", "Администратор зала"]},
    {"name": "Автосервис / Шиномонтаж", "pack": "classic", "roles": ["Мастер-приёмщик", "Автоэлектрик", "Моторист в смотровой яме", "Владелец старой иномарки", "Специалист по сход-развалу"]},

    # --- ВОКРУГ СВЕТА ---
    {"name": "Полярная станция в Антарктиде", "pack": "world", "roles": ["Начальник зимовки", "Метеоролог", "Гляциолог-бурильщик льда", "Системный инженер связи", "Повар станции", "Биолог, считающий пингвинов"]},
    {"name": "Круизный лайнер в океане", "pack": "world", "roles": ["Капитан лайнера", "Бармен на верхней палубе", "Аниматор вечернего шоу", "Рулевой", "Турист с фотоаппаратом", "Стюард кают"]},
    {"name": "Горнолыжный курорт в Альпах", "pack": "world", "roles": ["Инструктор по сноуборду", "Спасатель горного патруля", "Оператор канатной дороги", "Новичок на чёрной трассе", "Мастер проката лыж"]},
    {"name": "Археологические раскопки в Египте", "pack": "world", "roles": ["Профессор-египтолог", "Реставратор папирусов", "Фотограф экспедиции", "Местный проводник", "Охранник гробницы", "Георадарный специалист"]},
    {"name": "Ночной рынок в Токио", "pack": "world", "roles": ["Мастер суши и рамэна", "Турист-блогер", "Торговец редкими пластинками", "Патрульный кобана", "Переводчик", "Курьер на скутере"]},
    {"name": "Венецианский карнавал", "pack": "world", "roles": ["Гондольер", "Мастер венецианских масок", "Гость в плаще и треуголке", "Уличный скрипач", "Владелец кофейни на площади"]},

    # --- КОСМОС И НАУКА ---
    {"name": "Орбитальная станция МКС", "pack": "science", "roles": ["Командир экипажа МКС", "Бортинженер выхода в открытый космос", "Специалист по оранжерее в невесомости", "Оператор руки-манипулятора", "Врач-исследователь"]},
    {"name": "Большой адронный коллайдер (ЦЕРН)", "pack": "science", "roles": ["Физик элементарных частиц", "Инженер криогенных магнитов", "Оператор пучка протонов", "Аналитик детектора ATLAS", "Аспирант на ночной смене"]},
    {"name": "Дата-центр и серверный бункер", "pack": "science", "roles": ["Главный SRE-архитектор", "Инженер систем охлаждения", "Специалист по кибербезопасности", "Дежурный сетевик с патч-кордами", "Аудитор доступа"]},
    {"name": "Киностудия на съёмках блокбастера", "pack": "cinema", "roles": ["Режиссёр-постановщик", "Каскадёр в костюме захвата движений", "Оператор-стедикамщик", "Мастер пиротехники", "Продюсер площадки", "Звукорежиссёр с удочкой-микрофоном"]},
    {"name": "Киберспортивный финал на арене", "pack": "cinema", "roles": ["Капитан команды в кабинке", "Комментатор-кастер", "Главный судья сцены", "Тренер с блокнотом драфтов", "Режиссёр прямой трансляции", "Болельщик в первом ряду"]},
    {"name": "Средневековая таверна", "pack": "cinema", "roles": ["Трактирщик с кружкой эля", "Бард с лютней", "Странствующий рыцарь", "Алхимик в капюшоне", "Стражник короля", "Кузнец после смены"]},
]

# In-memory store bounded to <= 200 rooms (4h TTL) -> ultra-fast, zero disk wear on Amvera PVC
_SPY_LOBBIES: dict[str, dict[str, Any]] = {}
_LOBBY_TTL_SEC = 4 * 3600


def _cleanup_lobbies() -> None:
    now = time.time()
    expired = [code for code, room in _SPY_LOBBIES.items() if now - room["updated_at"] > _LOBBY_TTL_SEC]
    for code in expired:
        _SPY_LOBBIES.pop(code, None)
    if len(_SPY_LOBBIES) > 200:
        oldest = sorted(_SPY_LOBBIES.items(), key=lambda kv: kv[1]["updated_at"])[:40]
        for code, _ in oldest:
            _SPY_LOBBIES.pop(code, None)


def _gen_room_code() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    for _ in range(20):
        code = "".join(secrets.choice(alphabet) for _ in range(5))
        if code not in _SPY_LOBBIES:
            return code
    return secrets.token_hex(3).upper()[:5]


def get_spy_locations_list(pack: str = "all") -> list[dict[str, Any]]:
    p = (pack or "all").strip().lower()
    if p in ("all", ""):
        return SPY_LOCATIONS_DB
    filtered = [loc for loc in SPY_LOCATIONS_DB if loc["pack"] == p]
    return filtered or SPY_LOCATIONS_DB


def create_spy_lobby(
    host_user_id: int,
    host_name: str,
    pack: str = "all",
    spy_count: int = 1,
    round_minutes: int = 6,
) -> dict[str, Any]:
    _cleanup_lobbies()
    code = _gen_room_code()
    token = secrets.token_urlsafe(12)
    clean_name = (host_name or "Игрок 1").strip()[:28] or "Игрок 1"
    now = time.time()

    room: dict[str, Any] = {
        "code": code,
        "pack": pack if pack in ("all", "classic", "world", "science", "cinema") else "all",
        "spy_count": max(1, min(3, int(spy_count))),
        "round_minutes": max(2, min(12, int(round_minutes))),
        "status": "waiting",  # waiting | playing | finished
        "round_num": 0,
        "started_at": 0.0,
        "ends_at": 0.0,
        "location": None,
        "winner": None,
        "win_reason": "",
        "updated_at": now,
        "players": [
            {
                "slot_id": "p1",
                "user_id": host_user_id,
                "name": clean_name,
                "token": token,
                "is_host": True,
                "is_spy": False,
                "role": "",
                "voted_for": None,
                "joined_at": now,
            }
        ],
    }
    _SPY_LOBBIES[code] = room
    return get_spy_lobby_view(code, token)


def join_spy_lobby(
    code: str,
    user_id: int,
    player_name: str,
    existing_token: str = "",
) -> dict[str, Any]:
    _cleanup_lobbies()
    clean_code = (code or "").strip().upper()
    room = _SPY_LOBBIES.get(clean_code)
    if not room:
        raise ValueError("Комната с таким кодом не найдена или уже закрыта")

    # Rejoin if same token already inside
    for p in room["players"]:
        if existing_token and p["token"] == existing_token:
            if player_name.strip():
                p["name"] = player_name.strip()[:28]
            room["updated_at"] = time.time()
            return get_spy_lobby_view(clean_code, p["token"])

    if room["status"] == "playing":
        raise ValueError("Раунд в этой комнате уже идёт — дождитесь окончания раунда, чтобы войти")
    if len(room["players"]) >= 16:
        raise ValueError("В комнате уже максимум игроков (16)")

    clean_name = (player_name or f"Игрок {len(room['players']) + 1}").strip()[:28]
    existing_names = {p["name"].lower() for p in room["players"]}
    if clean_name.lower() in existing_names:
        clean_name = f"{clean_name} #{len(room['players']) + 1}"

    token = secrets.token_urlsafe(12)
    slot_id = f"p{len(room['players']) + 1}_{secrets.token_hex(2)}"
    room["players"].append(
        {
            "slot_id": slot_id,
            "user_id": user_id,
            "name": clean_name,
            "token": token,
            "is_host": False,
            "is_spy": False,
            "role": "",
            "voted_for": None,
            "joined_at": time.time(),
        }
    )
    room["updated_at"] = time.time()
    return get_spy_lobby_view(clean_code, token)


def start_spy_round(code: str, player_token: str) -> dict[str, Any]:
    clean_code = (code or "").strip().upper()
    room = _SPY_LOBBIES.get(clean_code)
    if not room:
        raise ValueError("Комната не найдена")

    caller = next((p for p in room["players"] if p["token"] == player_token), None)
    if not caller or not caller["is_host"]:
        raise ValueError("Запустить новый раунд может только создатель лобби")
    if len(room["players"]) < 3:
        raise ValueError("Для старта игры нужно минимум 3 участника в лобби (или используйте режим на 1 устройстве)")

    pool = get_spy_locations_list(room["pack"])
    chosen_loc = secrets.choice(pool)
    n_players = len(room["players"])
    actual_spies = min(room["spy_count"], max(1, (n_players - 1) // 2))

    indices = list(range(n_players))
    spy_indices: set[int] = set()
    while len(spy_indices) < actual_spies:
        spy_indices.add(secrets.choice(indices))

    roles_pool = list(chosen_loc["roles"])
    now = time.time()
    room["round_num"] += 1
    room["status"] = "playing"
    room["started_at"] = now
    room["ends_at"] = now + room["round_minutes"] * 60
    room["location"] = chosen_loc["name"]
    room["winner"] = None
    room["win_reason"] = ""
    room["updated_at"] = now

    for idx, p in enumerate(room["players"]):
        p["voted_for"] = None
        if idx in spy_indices:
            p["is_spy"] = True
            p["role"] = "ШПИОН"
        else:
            p["is_spy"] = False
            p["role"] = roles_pool[idx % len(roles_pool)]

    return get_spy_lobby_view(clean_code, player_token)


def vote_spy_player(code: str, player_token: str, suspect_slot_id: str) -> dict[str, Any]:
    clean_code = (code or "").strip().upper()
    room = _SPY_LOBBIES.get(clean_code)
    if not room:
        raise ValueError("Комната не найдена")
    if room["status"] != "playing":
        raise ValueError("Сейчас голосование недоступно")

    caller = next((p for p in room["players"] if p["token"] == player_token), None)
    if not caller:
        raise ValueError("Вы не состоите в этой комнате")
    if not any(p["slot_id"] == suspect_slot_id for p in room["players"]):
        raise ValueError("Участник не найден")

    caller["voted_for"] = suspect_slot_id
    room["updated_at"] = time.time()

    # If all players voted, automatically resolve round!
    if all(p["voted_for"] for p in room["players"]):
        tally: dict[str, int] = {}
        for p in room["players"]:
            tally[p["voted_for"]] = tally.get(p["voted_for"], 0) + 1
        top_slot, _ = max(tally.items(), key=lambda kv: kv[1])
        accused = next(p for p in room["players"] if p["slot_id"] == top_slot)
        room["status"] = "finished"
        if accused["is_spy"]:
            room["winner"] = "locals"
            room["win_reason"] = f"Мирные вычислили шпиона ({accused['name']}) общим голосованием!"
        else:
            room["winner"] = "spies"
            room["win_reason"] = f"Ошибка голосования: обвинили мирного игрока ({accused['name']}). Победа шпиона!"

    return get_spy_lobby_view(clean_code, player_token)


def spy_guess_location(code: str, player_token: str, guessed_location: str) -> dict[str, Any]:
    clean_code = (code or "").strip().upper()
    room = _SPY_LOBBIES.get(clean_code)
    if not room or room["status"] != "playing":
        raise ValueError("Раунд не активен")

    caller = next((p for p in room["players"] if p["token"] == player_token), None)
    if not caller or not caller["is_spy"]:
        raise ValueError("Назвать локацию ва-банк может только Шпион")

    room["status"] = "finished"
    room["updated_at"] = time.time()
    if guessed_location.strip().lower() == (room["location"] or "").strip().lower():
        room["winner"] = "spies"
        room["win_reason"] = f"Шпион {caller['name']} раскрылся и точно угадал локацию «{room['location']}»!"
    else:
        room["winner"] = "locals"
        room["win_reason"] = (
            f"Шпион {caller['name']} ошибся с локацией («{guessed_location}» вместо «{room['location']}»). Победа мирных!"
        )
    return get_spy_lobby_view(clean_code, player_token)


def finish_spy_round_by_host(code: str, player_token: str) -> dict[str, Any]:
    clean_code = (code or "").strip().upper()
    room = _SPY_LOBBIES.get(clean_code)
    if not room:
        raise ValueError("Комната не найдена")
    caller = next((p for p in room["players"] if p["token"] == player_token), None)
    if not caller or not caller["is_host"]:
        raise ValueError("Завершить раунд может только хост лобби")
    room["status"] = "finished"
    room["winner"] = room["winner"] or "draw"
    room["win_reason"] = room["win_reason"] or "Раунд завершён ведущим — карты всех игроков вскрыты."
    room["updated_at"] = time.time()
    return get_spy_lobby_view(clean_code, player_token)


def get_spy_lobby_view(code: str, player_token: str = "") -> dict[str, Any]:
    clean_code = (code or "").strip().upper()
    room = _SPY_LOBBIES.get(clean_code)
    if not room:
        raise ValueError("Лобби не найдено")

    now = time.time()
    if room["status"] == "playing" and room["ends_at"] > 0 and now >= room["ends_at"]:
        room["status"] = "finished"
        room["winner"] = "spies"
        room["win_reason"] = "Время раунда истекло, а шпион так и не был пойман!"

    me = next((p for p in room["players"] if p["token"] == player_token), None)
    reveal_all = room["status"] == "finished"

    # Vote counts visible during round
    vote_counts: dict[str, int] = {}
    for p in room["players"]:
        if p["voted_for"]:
            vote_counts[p["voted_for"]] = vote_counts.get(p["voted_for"], 0) + 1

    public_players = [
        {
            "slot_id": p["slot_id"],
            "name": p["name"],
            "is_host": p["is_host"],
            "has_voted": bool(p["voted_for"]),
            "votes_against": vote_counts.get(p["slot_id"], 0),
            # Only reveal spy/role after round finishes!
            "revealed_is_spy": p["is_spy"] if reveal_all else None,
            "revealed_role": p["role"] if reveal_all else None,
        }
        for p in room["players"]
    ]

    my_secret = None
    if me:
        my_secret = {
            "slot_id": me["slot_id"],
            "name": me["name"],
            "token": me["token"],
            "is_host": me["is_host"],
            "voted_for": me["voted_for"],
            "is_spy": me["is_spy"] if room["status"] in ("playing", "finished") else None,
            "location": ("СЕКРЕТНО — ВЫЧИСЛИ ПО ВОПРОСАМ" if me["is_spy"] else room["location"])
            if room["status"] in ("playing", "finished")
            else None,
            "role": me["role"] if room["status"] in ("playing", "finished") else None,
        }

    all_locations = [loc["name"] for loc in get_spy_locations_list(room["pack"])]

    return {
        "code": room["code"],
        "pack": room["pack"],
        "spy_count": room["spy_count"],
        "round_minutes": room["round_minutes"],
        "status": room["status"],
        "round_num": room["round_num"],
        "seconds_left": max(0, int(room["ends_at"] - now)) if room["status"] == "playing" else 0,
        "players": public_players,
        "my_card": my_secret,
        "revealed_location": room["location"] if reveal_all else None,
        "winner": room["winner"],
        "win_reason": room["win_reason"],
        "possible_locations": all_locations,
    }
