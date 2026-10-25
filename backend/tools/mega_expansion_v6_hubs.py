from __future__ import annotations

import csv
import hashlib
import io
import json
import math
from typing import Any

from PIL import Image

# ==============================================================================
# 1. FULL PC BUILDER & COMPATIBILITY / FPS / BOTTLENECK ENGINE (2026)
# ==============================================================================

PC_CPUS: list[dict[str, Any]] = [
    {"id": "r7_9800x3d", "name": "AMD Ryzen 7 9800X3D", "socket": "AM5", "ram_type": "DDR5", "cores": "8C / 16T (3D V-Cache)", "boost_ghz": 5.2, "tdp_w": 120, "score": 100, "price_rub": 54900},
    {"id": "r9_9950x", "name": "AMD Ryzen 9 9950X", "socket": "AM5", "ram_type": "DDR5", "cores": "16C / 32T", "boost_ghz": 5.7, "tdp_w": 170, "score": 97, "price_rub": 66500},
    {"id": "r7_7800x3d", "name": "AMD Ryzen 7 7800X3D", "socket": "AM5", "ram_type": "DDR5", "cores": "8C / 16T (3D V-Cache)", "boost_ghz": 5.0, "tdp_w": 120, "score": 92, "price_rub": 41900},
    {"id": "r5_7500f", "name": "AMD Ryzen 5 7500F", "socket": "AM5", "ram_type": "DDR5", "cores": "6C / 12T", "boost_ghz": 5.0, "tdp_w": 65, "score": 74, "price_rub": 15900},
    {"id": "r7_5700x3d", "name": "AMD Ryzen 7 5700X3D", "socket": "AM4", "ram_type": "DDR4", "cores": "8C / 16T", "boost_ghz": 4.1, "tdp_w": 105, "score": 76, "price_rub": 21500},
    {"id": "r5_5600", "name": "AMD Ryzen 5 5600", "socket": "AM4", "ram_type": "DDR4", "cores": "6C / 12T", "boost_ghz": 4.4, "tdp_w": 65, "score": 61, "price_rub": 10900},
    {"id": "u9_285k", "name": "Intel Core Ultra 9 285K", "socket": "LGA1851", "ram_type": "DDR5", "cores": "24C (8P+16E)", "boost_ghz": 5.7, "tdp_w": 250, "score": 94, "price_rub": 64900},
    {"id": "u7_265k", "name": "Intel Core Ultra 7 265K", "socket": "LGA1851", "ram_type": "DDR5", "cores": "20C (8P+12E)", "boost_ghz": 5.5, "tdp_w": 250, "score": 88, "price_rub": 43900},
    {"id": "i7_14700k", "name": "Intel Core i7-14700K", "socket": "LGA1700", "ram_type": "DDR5", "cores": "20C / 28T", "boost_ghz": 5.6, "tdp_w": 253, "score": 89, "price_rub": 39500},
    {"id": "i5_13400f", "name": "Intel Core i5-13400F", "socket": "LGA1700", "ram_type": "DDR4", "cores": "10C / 16T", "boost_ghz": 4.6, "tdp_w": 148, "score": 66, "price_rub": 16500},
]

PC_GPUS: list[dict[str, Any]] = [
    {"id": "rtx_5090", "name": "NVIDIA GeForce RTX 5090 32GB GDDR7", "vram_gb": 32, "length_mm": 336, "tdp_w": 575, "score": 135, "price_rub": 249000},
    {"id": "rtx_5080", "name": "NVIDIA GeForce RTX 5080 16GB GDDR7", "vram_gb": 16, "length_mm": 310, "tdp_w": 360, "score": 106, "price_rub": 129000},
    {"id": "rtx_5070ti", "name": "NVIDIA GeForce RTX 5070 Ti 16GB GDDR7", "vram_gb": 16, "length_mm": 300, "tdp_w": 300, "score": 93, "price_rub": 94000},
    {"id": "rx_9070xt", "name": "AMD Radeon RX 9070 XT 16GB", "vram_gb": 16, "length_mm": 295, "tdp_w": 304, "score": 90, "price_rub": 79000},
    {"id": "rtx_4070s", "name": "NVIDIA GeForce RTX 4070 SUPER 12GB", "vram_gb": 12, "length_mm": 267, "tdp_w": 220, "score": 76, "price_rub": 67000},
    {"id": "rx_7800xt", "name": "AMD Radeon RX 7800 XT 16GB", "vram_gb": 16, "length_mm": 280, "tdp_w": 263, "score": 73, "price_rub": 56000},
    {"id": "rtx_4060ti", "name": "NVIDIA GeForce RTX 4060 Ti 16GB", "vram_gb": 16, "length_mm": 245, "tdp_w": 165, "score": 58, "price_rub": 47000},
    {"id": "rtx_4060", "name": "NVIDIA GeForce RTX 4060 8GB", "vram_gb": 8, "length_mm": 240, "tdp_w": 115, "score": 47, "price_rub": 33500},
    {"id": "arc_b580", "name": "Intel Arc B580 12GB Battlemage", "vram_gb": 12, "length_mm": 272, "tdp_w": 190, "score": 50, "price_rub": 28900},
]

PC_MOTHERBOARDS: list[dict[str, Any]] = [
    {"id": "x870e_tomahawk", "name": "MSI MAG X870E TOMAHAWK WIFI", "socket": "AM5", "ram_type": "DDR5", "form_factor": "ATX", "pcie": "5.0", "price_rub": 34900},
    {"id": "b650_aorus", "name": "GIGABYTE B650 AORUS ELITE AX V2", "socket": "AM5", "ram_type": "DDR5", "form_factor": "ATX", "pcie": "4.0/5.0", "price_rub": 20900},
    {"id": "b550_tuf", "name": "ASUS TUF GAMING B550M-PLUS", "socket": "AM4", "ram_type": "DDR4", "form_factor": "mATX", "pcie": "4.0", "price_rub": 12900},
    {"id": "z890_pro", "name": "ASUS PRIME Z890-P WIFI", "socket": "LGA1851", "ram_type": "DDR5", "form_factor": "ATX", "pcie": "5.0", "price_rub": 28900},
    {"id": "z790_ud", "name": "GIGABYTE Z790 UD AX", "socket": "LGA1700", "ram_type": "DDR5", "form_factor": "ATX", "pcie": "5.0", "price_rub": 21500},
    {"id": "b760m_d4", "name": "MSI PRO B760M-A WIFI DDR4", "socket": "LGA1700", "ram_type": "DDR4", "form_factor": "mATX", "pcie": "4.0", "price_rub": 14500},
]

PC_RAMS: list[dict[str, Any]] = [
    {"id": "ddr5_32_6000", "name": "32GB (2×16) G.Skill Trident Z5 DDR5-6000 CL30", "ram_type": "DDR5", "capacity_gb": 32, "speed_mhz": 6000, "price_rub": 13500},
    {"id": "ddr5_64_6400", "name": "64GB (2×32) Kingston FURY Renegade DDR5-6400 CL32", "ram_type": "DDR5", "capacity_gb": 64, "speed_mhz": 6400, "price_rub": 25900},
    {"id": "ddr4_32_3600", "name": "32GB (2×16) Kingston FURY Beast DDR4-3600 CL16", "ram_type": "DDR4", "capacity_gb": 32, "speed_mhz": 3600, "price_rub": 7900},
    {"id": "ddr4_16_3200", "name": "16GB (2×8) Crucial Ballistix DDR4-3200 CL16", "ram_type": "DDR4", "capacity_gb": 16, "speed_mhz": 3200, "price_rub": 4500},
]

PC_COOLERS: list[dict[str, Any]] = [
    {"id": "aio_360", "name": "Arctic Liquid Freezer III 360 СЖО", "max_tdp_w": 320, "height_mm": 65, "is_aio_360": True, "price_rub": 11900},
    {"id": "ak620", "name": "DeepCool AK620 Dual-Tower (6 трубок)", "max_tdp_w": 260, "height_mm": 160, "is_aio_360": False, "price_rub": 6400},
    {"id": "se224xts", "name": "ID-COOLING SE-224-XTS (4 трубки)", "max_tdp_w": 180, "height_mm": 151, "is_aio_360": False, "price_rub": 2400},
]

PC_SSDS: list[dict[str, Any]] = [
    {"id": "990pro_2tb", "name": "Samsung 990 PRO 2TB NVMe PCIe 4.0 (7450 МБ/с)", "capacity_gb": 2000, "price_rub": 19900},
    {"id": "t705_2tb", "name": "Crucial T705 2TB NVMe PCIe 5.0 (14500 МБ/с)", "capacity_gb": 2000, "price_rub": 31500},
    {"id": "kc3000_1tb", "name": "Kingston KC3000 1TB NVMe PCIe 4.0 (7000 МБ/с)", "capacity_gb": 1000, "price_rub": 9800},
]

PC_PSUS: list[dict[str, Any]] = [
    {"id": "psu_1200", "name": " Seasonic VERTEX GX-1200W 80+ Gold ATX 3.1 (12V-2x6)", "watts": 1200, "price_rub": 24900},
    {"id": "psu_850", "name": "DeepCool PQ850M / PX850G 850W 80+ Gold ATX 3.0", "watts": 850, "price_rub": 12900},
    {"id": "psu_750", "name": "be quiet! Pure Power 12 M 750W 80+ Gold", "watts": 750, "price_rub": 11500},
    {"id": "psu_600", "name": "MONTECH GAMMA II 600W 80+ Gold", "watts": 600, "price_rub": 6200},
]

PC_CASES: list[dict[str, Any]] = [
    {"id": "lianli_o11", "name": "Lian Li O11 Dynamic EVO (ATX, закалённое стекло)", "max_gpu_mm": 422, "max_cooler_mm": 167, "supports_atx": True, "supports_aio360": True, "price_rub": 16900},
    {"id": "lancool_216", "name": "Lian Li LANCOOL 216 Mesh RGB (ATX)", "max_gpu_mm": 392, "max_cooler_mm": 180, "supports_atx": True, "supports_aio360": True, "price_rub": 10900},
    {"id": "matx_mini", "name": "ASUS Prime AP201 Mesh (компактный mATX)", "max_gpu_mm": 338, "max_cooler_mm": 170, "supports_atx": False, "supports_aio360": True, "price_rub": 8500},
    {"id": "compact_itx", "name": "Компактный Mini-Tower (до 285 мм GPU)", "max_gpu_mm": 285, "max_cooler_mm": 155, "supports_atx": False, "supports_aio360": False, "price_rub": 5200},
]


def get_pc_parts_catalog() -> dict[str, Any]:
    return {
        "cpus": PC_CPUS,
        "gpus": PC_GPUS,
        "motherboards": PC_MOTHERBOARDS,
        "rams": PC_RAMS,
        "coolers": PC_COOLERS,
        "ssds": PC_SSDS,
        "psus": PC_PSUS,
        "cases": PC_CASES,
    }


def evaluate_pc_build(
    cpu_id: str = "r7_9800x3d",
    gpu_id: str = "rtx_5070ti",
    mb_id: str = "b650_aorus",
    ram_id: str = "ddr5_32_6000",
    cooler_id: str = "ak620",
    ssd_id: str = "990pro_2tb",
    psu_id: str = "psu_850",
    case_id: str = "lancool_216",
) -> dict[str, Any]:
    cpu = next((x for x in PC_CPUS if x["id"] == cpu_id), PC_CPUS[0])
    gpu = next((x for x in PC_GPUS if x["id"] == gpu_id), PC_GPUS[2])
    mb = next((x for x in PC_MOTHERBOARDS if x["id"] == mb_id), PC_MOTHERBOARDS[1])
    ram = next((x for x in PC_RAMS if x["id"] == ram_id), PC_RAMS[0])
    cooler = next((x for x in PC_COOLERS if x["id"] == cooler_id), PC_COOLERS[1])
    ssd = next((x for x in PC_SSDS if x["id"] == ssd_id), PC_SSDS[0])
    psu = next((x for x in PC_PSUS if x["id"] == psu_id), PC_PSUS[1])
    case = next((x for x in PC_CASES if x["id"] == case_id), PC_CASES[1])

    errors: list[str] = []
    warnings: list[str] = []

    if cpu["socket"] != mb["socket"]:
        errors.append(f"Несовместимость сокета: процессор {cpu['socket']}, а материнская плата {mb['socket']}.")
    if mb["ram_type"] != ram["ram_type"]:
        errors.append(f"Несовместимость стандарта памяти: плата поддерживает {mb['ram_type']}, выбрана ОЗУ {ram['ram_type']}.")
    if mb["form_factor"] == "ATX" and not case["supports_atx"]:
        errors.append(f"Материнская плата формата ATX не поместится в корпус mATX ({case['name']}).")
    if gpu["length_mm"] > case["max_gpu_mm"]:
        errors.append(f"Видеокарта длиной {gpu['length_mm']} мм не войдёт в корпус (максимум {case['max_gpu_mm']} мм).")
    if cooler["is_aio_360"] and not case["supports_aio360"]:
        errors.append(f"Радиатор СЖО 360 мм не поддерживается выбранным корпусом ({case['name']}).")
    if not cooler["is_aio_360"] and cooler["height_mm"] > case["max_cooler_mm"]:
        errors.append(f"Башенный кулер {cooler['height_mm']} мм упрётся в крышку корпуса (лимит {case['max_cooler_mm']} мм).")
    if cooler["max_tdp_w"] < cpu["tdp_w"]:
        warnings.append(f"Теплопакет CPU ({cpu['tdp_w']} Вт) превышает паспортный отвод кулера ({cooler['max_tdp_w']} Вт) — возможен троттлинг.")

    est_peak_draw_w = int(cpu["tdp_w"] + gpu["tdp_w"] + 75)
    recommended_psu_w = int(math.ceil((est_peak_draw_w * 1.28) / 50.0) * 50)
    if psu["watts"] < est_peak_draw_w:
        errors.append(f"Мощности БП ({psu['watts']} Вт) недостаточно для пикового потребления системы (~{est_peak_draw_w} Вт).")
    elif psu["watts"] < recommended_psu_w:
        warnings.append(f"Блок питания {psu['watts']} Вт работает с малым запасом; рекомендуется от {recommended_psu_w} Вт.")

    # Bottleneck & FPS estimation across 1080p / 1440p / 4K
    ratio = gpu["score"] / max(1.0, cpu["score"])
    bottleneck_pct = round(min(45.0, abs(ratio - 1.02) * 28.0), 1)
    bottleneck_side = "Баланс оптимален"
    if ratio > 1.24:
        bottleneck_side = f"Упор в процессор в 1080p (~{bottleneck_pct}%)"
    elif ratio < 0.76:
        bottleneck_side = f"Упор в видеокарту (~{bottleneck_pct}%)"

    eff_1080 = min(cpu["score"] * 1.18, gpu["score"] * 1.0)
    eff_1440 = min(cpu["score"] * 1.32, gpu["score"] * 0.74)
    eff_4k = min(cpu["score"] * 1.55, gpu["score"] * 0.44)

    fps_benchmarks = [
        {
            "game": "Counter-Strike 2 (Competitive)",
            "fps_1080p": int(round(cpu["score"] * 4.9 + gpu["score"] * 1.2)),
            "fps_1440p": int(round(cpu["score"] * 4.1 + gpu["score"] * 1.0)),
            "fps_4k": int(round(eff_4k * 4.1)),
        },
        {
            "game": "Dota 2 (Ultra Teamfight)",
            "fps_1080p": int(round(cpu["score"] * 2.45 + gpu["score"] * 0.55)),
            "fps_1440p": int(round(cpu["score"] * 2.25 + gpu["score"] * 0.5)),
            "fps_4k": int(round(eff_4k * 3.1)),
        },
        {
            "game": "Cyberpunk 2077 (RT Ultra + DLSS/FSR Q)",
            "fps_1080p": int(round(eff_1080 * 1.28)),
            "fps_1440p": int(round(eff_1440 * 1.22)),
            "fps_4k": int(round(eff_4k * 1.25)),
        },
        {
            "game": "Elden Ring: Shadow of the Erdtree (Max)",
            "fps_1080p": int(min(120, round(eff_1080 * 1.45))),
            "fps_1440p": int(min(120, round(eff_1440 * 1.42))),
            "fps_4k": int(min(120, round(eff_4k * 1.48))),
        },
        {
            "game": "Fortnite (DirectX 12 Epic)",
            "fps_1080p": int(round(eff_1080 * 1.85)),
            "fps_1440p": int(round(eff_1440 * 1.78)),
            "fps_4k": int(round(eff_4k * 1.75)),
        },
    ]

    total_rub = sum(x["price_rub"] for x in (cpu, gpu, mb, ram, cooler, ssd, psu, case))
    return {
        "compatible": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "est_peak_draw_w": est_peak_draw_w,
        "recommended_psu_w": recommended_psu_w,
        "bottleneck_pct": bottleneck_pct,
        "bottleneck_verdict": bottleneck_side,
        "total_price_rub": total_rub,
        "fps_benchmarks": fps_benchmarks,
        "selected": {"cpu": cpu, "gpu": gpu, "mb": mb, "ram": ram, "cooler": cooler, "ssd": ssd, "psu": psu, "case": case},
    }


# ==============================================================================
# 2. CAR MAKES & MODELS SPECS CATALOG
# ==============================================================================

_RAW_CARS: list[tuple[str, str, str, str, str, int, int, float, int, str, int, str]] = [
    ("Porsche", "911 Turbo S (992)", "🇩🇪 Германия", "2020–2026", "3.7L Boxer-6 Twin-Turbo", 650, 800, 2.7, 330, "AWD (PDK-8)", 1640, "Купе / Суперкар"),
    ("BMW", "M3 Competition xDrive (G80)", "🇩🇪 Германия", "2021–2026", "3.0L I6 S58 Twin-Turbo", 530, 650, 3.5, 290, "AWD (M Steptronic 8)", 1780, "Спорт-седан"),
    ("BMW", "M5 CS (F90)", "🇩🇪 Германия", "2021–2023", "4.4L V8 S63 Twin-Turbo", 635, 750, 3.0, 305, "AWD / RWD", 1825, "Спорт-седан"),
    ("Mercedes-AMG", "G 63 (W465)", "🇩🇪 Германия", "2024–2026", "4.0L V8 Biturbo + 48V", 585, 850, 4.4, 240, "4MATIC (9G-Tronic)", 2555, "Внедорожник"),
    ("Mercedes-AMG", "GT 63 S E Performance", "🇩🇪 Германия", "2023–2026", "4.0L V8 PHEV", 843, 1470, 2.9, 316, "4MATIC+", 2380, "Лифтбек"),
    ("Audi", "RS6 Avant Performance (C8)", "🇩🇪 Германия", "2023–2026", "4.0L V8 TFSI Twin-Turbo", 630, 850, 3.4, 305, "quattro (Tiptronic 8)", 2090, "Универсал"),
    ("Toyota", "GR Supra 3.0 (A90)", "🇯🇵 Япония", "2020–2026", "3.0L I6 B58 Turbo", 387, 500, 4.1, 250, "RWD (6MT / 8AT)", 1520, "Купе"),
    ("Toyota", "Supra RZ (A80 2JZ-GTE)", "🇯🇵 Япония", "1993–2002", "3.0L I6 2JZ-GTE Twin-Turbo", 325, 451, 4.9, 250, "RWD (Getrag V160 6MT)", 1510, "Купе JDM"),
    ("Toyota", "Camry XV80 Hybrid", "🇯🇵 Япония", "2024–2026", "2.5L I4 THS-V Hybrid", 232, 221, 7.1, 210, "AWD (e-CVT)", 1620, "Бизнес-седан"),
    ("Toyota", "Land Cruiser 300 3.5 Twin-Turbo", "🇯🇵 Япония", "2021–2026", "3.4L V6 V35A-FTS", 415, 650, 6.8, 210, "4WD Full-Time (10AT)", 2560, "Рамный внедорожник"),
    ("Nissan", "GT-R NISMO (R35)", "🇯🇵 Япония", "2020–2025", "3.8L V6 VR38DETT", 600, 652, 2.7, 315, "ATTESA E-TS AWD", 1725, "Суперкар"),
    ("Nissan", "Skyline GT-R V-Spec II (R34)", "🇯🇵 Япония", "1999–2002", "2.6L I6 RB26DETT", 280, 392, 4.8, 250, "AWD (6MT)", 1560, "Купе JDM"),
    ("Mazda", "RX-7 Spirit R (FD3S)", "🇯🇵 Япония", "2002", "1.3L 13B-REW Twin-Rotor", 280, 314, 5.1, 255, "RWD (5MT)", 1270, "Роторное купе"),
    ("Honda", "Civic Type R (FL5)", "🇯🇵 Япония", "2023–2026", "2.0L I4 K20C1 VTEC Turbo", 330, 420, 5.4, 275, "FWD (6MT + LSD)", 1430, "Хот-хэтч"),
    ("Lexus", "LFA", "🇯🇵 Япония", "2010–2012", "4.8L V10 1LR-GUE (Yamaha)", 560, 480, 3.7, 325, "RWD (ASG-6)", 1480, "Суперкар"),
    ("Xiaomi", "SU7 Ultra / Max", "🇨🇳 Китай", "2024–2026", "Dual/Tri HyperEngine EV", 673, 838, 2.78, 265, "AWD Electric (800V)", 2205, "Электро-седан"),
    ("Zeekr", "001 FR", "🇨🇳 Китай", "2023–2026", "Quad-Motor Silicon Carbide EV", 1265, 1280, 2.07, 280, "AWD Torque Vectoring", 2525, "Шутинг-брейк EV"),
    ("Tesla", "Model S Plaid", "🇺🇸 США", "2021–2026", "Tri-Motor Carbon-Sleeved EV", 1020, 1420, 2.1, 322, "AWD Electric", 2162, "Электро-лифтбек"),
    ("Ford", "Mustang Dark Horse (S650)", "🇺🇸 США", "2024–2026", "5.0L V8 Coyote Gen-4 NA", 500, 567, 4.1, 267, "RWD (Tremec 6MT)", 1790, "Маслкар"),
    ("Dodge", "Challenger SRT Demon 170", "🇺🇸 США", "2023", "6.2L V8 HEMI Supercharged (E85)", 1025, 1281, 1.66, 325, "RWD (8AT)", 1940, "Дрэг-маслкар"),
    ("Ferrari", "SF90 Stradale", "🇮🇹 Италия", "2020–2025", "4.0L V8 Twin-Turbo + 3 e-Motors", 1000, 800, 2.5, 340, "AWD (8-DCT)", 1570, "Гиперкар"),
    ("Lamborghini", "Revuelto", "🇮🇹 Италия", "2023–2026", "6.5L V12 NA + 3 e-Motors", 1015, 1062, 2.5, 350, "AWD (8-DCT)", 1772, "Гиперкар"),
    ("Bugatti", "Tourbillon", "🇫🇷 Франция", "2026", "8.3L V16 Cosworth NA + 3 EV", 1800, 1750, 2.0, 445, "AWD (8-DCT)", 1995, "Гиперкар"),
    ("Koenigsegg", "Jesko Absolut", "🇸🇪 Швеция", "2022–2026", "5.0L V8 Twin-Turbo (E85)", 1600, 1500, 2.5, 500, "RWD (Light Speed 9-sp)", 1390, "Гиперкар"),
    ("LADA", "Vesta Sportline / NG 1.8 EVO", "🇷🇺 Россия", "2023–2026", "1.8L I4 ВАЗ-21179 EVO", 122, 170, 10.6, 187, "FWD (CVT / 5MT)", 1280, "Седан / Универсал"),
    ("LADA", "Niva Legend 4x4", "🇷🇺 Россия", "1977–2026", "1.7L I4 8v", 83, 129, 17.0, 142, "4WD Постоянный + Понижающая", 1285, "Внедорожник"),
    ("Volkswagen", "Golf R (Mk8.5)", "🇩🇪 Германия", "2024–2026", "2.0L I4 EA888 evo4 TSI", 333, 420, 4.6, 270, "4Motion AWD (DSG-7)", 1548, "Хот-хэтч"),
    ("Skoda", "Octavia RS (A8)", "🇨🇿 Чехия", "2021–2026", "2.0L TSI EA888", 265, 370, 6.4, 250, "FWD (DSG-7)", 1520, "Лифтбек"),
]

CAR_MODELS_CATALOG: list[dict[str, Any]] = [
    {
        "id": f"car_{idx + 1}",
        "make": mk,
        "model": md,
        "origin": orig,
        "years": yrs,
        "engine": eng,
        "hp": hp,
        "torque_nm": nm,
        "zero_to_100_s": z100,
        "top_speed_kmh": vmax,
        "drivetrain": drv,
        "weight_kg": wt,
        "power_to_weight": round(hp / (wt / 1000.0), 1),
        "body_class": cls,
    }
    for idx, (mk, md, orig, yrs, eng, hp, nm, z100, vmax, drv, wt, cls) in enumerate(_RAW_CARS)
]


def search_car_models(query: str = "", body_class: str = "") -> dict[str, Any]:
    q = (query or "").strip().lower()
    bc = (body_class or "").strip().lower()
    items = [
        c
        for c in CAR_MODELS_CATALOG
        if (not bc or bc == "all" or bc in c["body_class"].lower())
        and (
            not q
            or q in c["make"].lower()
            or q in c["model"].lower()
            or q in c["engine"].lower()
            or q in c["origin"].lower()
            or q in c["body_class"].lower()
        )
    ]
    return {"total": len(CAR_MODELS_CATALOG), "matched": len(items), "items": items}


# ==============================================================================
# 3. ENGINEERING CLASSIFICATION: NAILS/FASTENERS, METALS, PLASTICS & GLASS
# ==============================================================================

MATERIALS_FASTENERS_DB: dict[str, list[dict[str, str]]] = {
    "fasteners": [
        {"name": "Строительный гвоздь (ГОСТ 4028-63)", "spec": "Длина 12–250 мм, диаметр 1.2–6.0 мм", "material": "Низкоуглеродистая сталь Ст1–Ст3 (чёрный / оцинкованный)", "use": "Черновая сборка стропил, обрешётки, деревянной тары и опалубки."},
        {"name": "Винтовой гвоздь", "spec": "Витой квадратный стержень, длина 30–120 мм", "material": "Сталь холодной накатки / цинк", "use": "Европоддоны, полы, причалы: сопротивление выдёргиванию в 4 раза выше гладкого гвоздя."},
        {"name": "Ершёный (кольцевой) гвоздь", "spec": "Поперечная кольцевая накатка по стержню", "material": "Оцинкованная сталь", "use": "Неразъёмный монтаж OSB, фанеры и гибкой черепицы (не выходит при усушке древесины)."},
        {"name": "Финишный гвоздь (ГОСТ 4032)", "spec": "Узкая цилиндрическая утапливаемая шляпка", "material": "Латунированная, омеднённая или оцинкованная сталь", "use": "Скрытый монтаж вагонки, наличников, паркетной доски и плинтусов."},
        {"name": "Толевый / Кровельный гвоздь", "spec": "Увеличенная шляпка Ø 8–10 мм, насечка под головкой", "material": "Горячеоцинкованная сталь", "use": "Фиксация рубероида, мягких листовых материалов и жести без прорыва полотна."},
        {"name": "Дюбель-гвоздь по бетону (монтажный)", "spec": "Закалённый стержень HRC 52–56 + направляющая шайба", "material": "Высокоуглеродистая кованая сталь", "use": "Прямой пристрел газовым/пороховым пистолетом в тяжёлый бетон, кирпич и стальной двутавр."},
        {"name": "Саморез по дереву / ГКЛ (фосфатированный)", "spec": "Редкий шаг резьбы (крупный виток), Ø 3.5–4.8 мм", "material": "Закалённая сталь C1022 с чёрным фосфатным покрытием", "use": "Быстрое вкручивание в мягкую древесину и гипсокартон к деревянному брусу."},
        {"name": "Метрический болт классов прочности 5.8 / 8.8 / 10.9 / 12.9", "spec": "ISO 898-1: первая цифра ×100 = предел прочности МПа", "material": "8.8 — сталь 35; 10.9/12.9 — легированная 40Х / 30ХГСА", "use": "8.8 — машиностроение; 10.9 и 12.9 — подвеска автомобиля, ГБЦ, ответственные металлоконструкции."},
    ],
    "metals": [
        {"name": "Сталь конструкционная углеродистая (Ст3 / S235)", "spec": "ρ = 7.85 г/см³ • Tпл ≈ 1490 °C • σв ≈ 380–490 МПа", "material": "Fe + до 0.22% C", "use": "Балки, швеллеры, арматура, листовой прокат, сварные каркасы зданий."},
        {"name": "Нержавеющая аустенитная сталь AISI 304 / 316L", "spec": "ρ = 7.93 г/см³ • Tпл ≈ 1420 °C • Немагнитная", "material": "18% Cr + 10% Ni (+ 2.5% Mo в 316L против морской соли)", "use": "Пищевое оборудование, хирургия, химреакторы, морской такелаж и часовые корпуса."},
        {"name": "Серый и высокопрочный чугун (СЧ20 / ВЧ50)", "spec": "ρ = 7.20 г/см³ • Tпл ≈ 1180 °C • Гасит вибрации", "material": "Fe + 2.14–4.3% C (пластинчатый или шаровидный графит)", "use": "Станины металлорежущих станков, тормозные диски, блоки цилиндров, люки."},
        {"name": "Дюралюминий Д16Т (2024-T4) и АМг6", "spec": "ρ = 2.78 г/см³ • Tпл ≈ 640 °C • σв ≈ 440 МПа", "material": "Al + 4.4% Cu + 1.5% Mg + 0.6% Mn", "use": "Обшивка и лонжероны самолётов, рамы дронов, скоростные катера."},
        {"name": "Титановый сплав ВТ6 (Ti-6Al-4V Grade 5)", "spec": "ρ = 4.43 г/см³ • Tпл = 1660 °C • σв ≈ 950–1100 МПа", "material": "90% Ti + 6% Al + 4% V (биоинертен)", "use": "Лопатки турбин двигателей, костные эндопротезы, глубоководные батискафы и космос."},
        {"name": "Медь электротехническая М1 (99.9% Cu)", "spec": "ρ = 8.96 г/см³ • Tпл = 1085 °C • λ = 401 Вт/(м·К)", "material": "Чистая медь (уступает по электропроводности только серебру)", "use": "Силовые шины, обмотки электродвигателей, тепловые трубки кулеров ПК."},
        {"name": "Латунь (Л63 / ЛС59-1) и Бронза (БрАЖ9-4)", "spec": "ρ = 8.4–8.8 г/см³ • Tпл ≈ 900–980 °C • Низкое трение", "material": "Латунь = Cu+Zn; Бронза = Cu+Sn/Al/Be", "use": "Сантехническая арматура, гильзы, подшипники скольжения, гребные винты судов."},
        {"name": "Вольфрам (W)", "spec": "ρ = 19.25 г/см³ • Tпл = 3422 °C (рекорд среди металлов!)", "material": "Тугоплавкий металл 6-й группы", "use": "Неплавящиеся TIG-электроды, бронебойные сердечники, сопла ракет и карбид вольфрама ВК8."},
    ],
    "plastics": [
        {"name": "① PET / ПЭТФ (Полиэтилентерефталат)", "spec": "Код переработки 1 • Tразм ≈ 75 °C • Прозрачный барьер", "material": "Термопластичный полиэфир", "use": "Бутылки для воды и напитков, полиэстеровое волокно одежды (флис), нить PETG для 3D-печати."},
        {"name": "② HDPE / ПНД (Полиэтилен низкого давления)", "spec": "Код 2 • ρ = 0.95 г/см³ • Химостойкий до 110 °C", "material": "Высокомолекулярный линейный полиэтилен", "use": "Водопроводные и газовые трубы с синей/жёлтой полосой, канистры масел, флаконы шампуней."},
        {"name": "③ PVC / ПВХ (Поливинилхлорид)", "spec": "Код 3 • Самозатухающий • Жёсткий или пластифицированный", "material": "Хлорсодержащий термопласт", "use": "Оконные профили стеклопакетов, канализационные трубы, изоляция электропроводки, линолеум."},
        {"name": "⑤ PP / ПП (Полипропилен)", "spec": "Код 5 • Tпл ≈ 165 °C • Выдерживает кипяток и СВЧ!", "material": "Изотактический полиолефин (безопасен для горячей пищи)", "use": "Многоразовые ланчбоксы, медицинские шприцы, бамперы авто, трубы горячего водоснабжения."},
        {"name": "ABS-пластик (Акрилонитрилбутадиенстирол)", "spec": "Tстекл = 105 °C • Ударопрочный, растворим в ацетоне", "material": "Тройной сополимер", "use": "Кубики LEGO, корпуса электроинструментов, клавиши механических клавиатур (Keycaps) и 3D-печать."},
        {"name": "Поликарбонат (PC / Макролон)", "spec": "Ударная вязкость в 250 раз выше обычного стекла!", "material": "Линейный полиэфир угольной кислоты", "use": "Защитные визоры шлемов, фары автомобилей, теплицы, оптические диски и бронеостекление."},
        {"name": "PTFE / Фторопласт-4 (Тефлон)", "spec": "Рабочий диапазон от −269 °C до +260 °C • Трение μ = 0.04", "material": "Политетрафторэтилен (не смачивается ни водой, ни кислотами)", "use": "Глайды игровых мышей, химстойкие прокладки, высокочастотная изоляция, антипригарные покрытия."},
        {"name": "PEEK (Полиэфирэфиркетон)", "spec": "Tпл = 343 °C • σв ≈ 100 МПа • Космический суперпластик", "material": "Полукристаллический инженерный полимер", "use": "Замена алюминия в авиации, спинальные имплантаты позвоночника, детали вакуумных установок."},
    ],
    "glass": [
        {"name": "Натрий-кальций-силикатное (флоат-стекло М1)", "spec": "n = 1.52 • Твёрдость Мооса 5.5 • Tразм ≈ 720 °C", "material": "72% SiO₂ + 14% Na₂O + 9% CaO + 4% MgO", "use": "90% мирового стекла: оконные стеклопакеты, витрины, банки и зеркала."},
        {"name": "Боросиликатное стекло (Pyrex / Simax 3.3)", "spec": "Низкий КТР α = 3.3×10⁻⁶ К⁻¹ (не лопается от перепада 180 °C!)", "material": "80% SiO₂ + 13% B₂O₃ + 4% Na₂O + Al₂O₃", "use": "Химические колбы и пробирки, жаропрочные формы для духовки, зеркала телескопов."},
        {"name": "Кварцевое оптическое стекло (КУ-1)", "spec": "Tразм > 1650 °C • Пропускает глубокий УФ и ИК спектр", "material": "99.99% чистый плавленый диоксид кремния SiO₂", "use": "Оптоволоконные магистрали интернета, галогенные и бактерицидные УФ-лампы, иллюминаторы кораблей."},
        {"name": "Закалённое стекло (Сталинит)", "spec": "Прочность в 5–6 раз выше сырого • Безопасная крошка при бое", "material": "Нагрев до 680 °C с резким воздушным обдувом обеих граней", "use": "Боковые/задние стёкла авто, душевые перегородки, боковые панели корпусов ПК."},
        {"name": "Триплекс (многослойное ламинированное)", "spec": "Стекло + поливинилбутиральная (PVB) плёнка + стекло", "material": "Удерживает осколки на плёнке при сильном ударе", "use": "Лобовые стёкла всех современных автомобилей, стеклянные полы небоскрёбов и бронекапсулы."},
        {"name": "Алюмосиликатное химически упрочнённое (Gorilla Glass / Ceramic Shield)", "spec": "Ионный обмен Na⁺ ↔ K⁺ в расплаве солей при 400 °C", "material": "Щёлочно-алюмосиликатная матрица с нанокерамикой", "use": "Экраны смартфонов, смарт-часов и иллюминаторы скоростной авиации."},
    ],
}


# ==============================================================================
# 4. OUTFIT MATCHING BY AESTHETICS & ALL TYPES OF LOOKSMAXXING
# ==============================================================================

OUTFIT_STYLES_DB: list[dict[str, Any]] = [
    {"id": "old_money", "style": "Old Money / Quiet Luxury", "vibe": "Сдержанная аристократичность без видимых логотипов", "top": "Кашемировое поло или тонкий мериносовый джемпер молочного/тёмно-синего цвета", "bottom": "Прямые шерстяные брюки со стрелками или светлые чиносы со средней посадкой", "shoes": "Замшевые пенни-лоферы шоколадного оттенка", "acc": "Кожаный ремень в тон обуви, механические часы на кожаном ремешке (36–39 мм)", "palette": ["#F5F0E6", "#1E293B", "#6B4F3B", "#C8B69E"]},
    {"id": "streetwear", "style": "Modern Streetwear (Boxy Proportion)", "vibe": "Правило третей: укороченный плотный верх + свободный низ", "top": "Плотная футболка 280–320 г/м² или boxy-худи графитового цвета", "bottom": "Широкие джинсы 14 oz raw denim или брюки-карго прямого кроя", "shoes": "Массивные ретро-кеды / кроссовки (New Balance 990v6 / Adidas Samba / Asics Kayano 14)", "acc": "Серебряная цепь 3 мм, минималистичная сумка через плечо, шапка-бини", "palette": ["#18181B", "#71717A", "#E4E4E7", "#3B82F6"]},
    {"id": "gorpcore", "style": "Gorpcore (Outdoor Urban)", "vibe": "Технологичная горная экипировка в городской среде", "top": "Мембранная куртка 3L Gore-Tex с проклеенными молниями + флисовый мидлейер", "bottom": "Нейлоновые треккинговые брюки с артикулированными коленями и утяжками", "shoes": "Трейловые кроссовки на подошве Vibram (Salomon XT-6 / Hoka)", "acc": "Карабин с ключами, компактный рюкзак из рипстопа Cordura", "palette": ["#2D3A2E", "#D97706", "#334155", "#E2E8F0"]},
    {"id": "dark_academia", "style": "Dark Academia", "vibe": "Эстетика университетских библиотек Оксфорда и классической литературы", "top": "Твидовый блейзер в «ёлочку» поверх чёрной водолазки или оксфордской рубашки", "bottom": "Классические тёмно-коричневые или графитовые шерстяные брюки / плиссированная юбка", "shoes": "Кожаные дерби, броги или ботинки челси", "acc": "Портфель сэчел, очки в тонкой черепаховой оправе, шерстяной шарф", "palette": ["#271C19", "#4A3728", "#8C7355", "#D6CFC7"]},
    {"id": "techwear", "style": "Techwear / Avant-Cyber", "vibe": "Модульность, водозащита, анатомический крой и монохром", "top": "Асимметричный хардшелл со стропой-слингом внутри + термолонгслив", "bottom": "Зауженные книзу карго с магнитными пряжками Fidlock", "shoes": "Высокие тактические кроссовки с неопреновым носком", "acc": "Модульная нагрудная сумка MOLLE, водонепроницаемые часы", "palette": ["#09090B", "#27272A", "#52525B", "#22D3EE"]},
    {"id": "smart_casual", "style": "Smart Casual (Универсальный городской)", "vibe": "Золотая середина между деловым костюмом и комфортом выходного дня", "top": "Неструктурированный пиджак или рубашка поло / льняная рубашка с закатанными рукавами", "bottom": "Тёмно-синие джинсы без потёртостей или брюки слаксы", "shoes": "Белоснежные минималистичные кожаные кеды или замшевые челси", "acc": "Хронограф на стальном браслете, аккуратный картхолдер", "palette": ["#1E3A8A", "#F8FAFC", "#94A3B8", "#92400E"]},
    {"id": "minimal_scandi", "style": "Scandinavian Minimalism", "vibe": "Чистые архитектурные силуэты, фактура ткани вместо принтов", "top": "Пальто прямого кроя длины миди из смесовой шерсти + однотонный лонгслив", "bottom": "Свободные костюмные брюки со складками у пояса", "shoes": "Кожаные ботинки на массивной подошве", "acc": "Шоппер из плотного канваса или гладкой кожи", "palette": ["#111827", "#D1D5DB", "#9CA3AF", "#F9FAFB"]},
    {"id": "y2k_grunge", "style": "Y2K / Neo-Grunge", "vibe": "Контраст облегающего верха, винтажного денима и металлической фурнитуры", "top": "Винтажный зип-худи или облегающий рашгард/лонгслив со слоёным принтом", "bottom": "Мешковатые джинсы baggy с низкой/средней посадкой и винтажной варкой", "shoes": "Скейтерские кеды или массивные ботинки Dr. Martens", "acc": "Ремень с люверсами, узкие солнцезащитные очки, наушники-накладные", "palette": ["#1F2937", "#7F1D1D", "#A1A1AA", "#F3F4F6"]},
]

LOOKSMAXXING_ATLAS: list[dict[str, str]] = [
    {"category": "1. Дерматологический Softmaxxing (Кожа)", "science_level": "Доказательная медицина (Уровень A)", "protocol": "Три кита доказательной дерматологии: 1) Мягкое умывание по pH 5.5 вечером; 2) Утром — широкоспектральный SPF 30–50 (защищает 80% коллагена от фотостарения UVA); 3) Вечером — ретиноиды (адапален/ретинол/третиноин по показаниям врача) + ниацинамид 4–5% и церамидный увлажняющий крем."},
    {"category": "2. Композиция тела и Лицевой рельеф (Leanmaxxing)", "science_level": "Физиология и эндокринология", "protocol": "Чёткость линии нижней челюсти и скул на 75% определяется общим процентом подкожного жира (здоровая атлетичная зона: 11–15% у мужчин, 19–23% у женщин) и балансом натрия/калия и воды (снижение избытка соли на ночь и 30–35 мл воды/кг убирает утренние отёки лица)."},
    {"category": "3. Архитектура волос и подбор по форме лица (Hairmaxxing)", "science_level": "Визуальная геометрия и трихология", "protocol": "Круглое лицо — текстурный объём сверху и убранные виски (удлиняет пропорции); вытянутое/прямоугольное — средняя длина с боковым объёмом и чёлкой/шторками (балансирует высоту лба); квадратное/овальное — практически любая форма. При андрогенетическом поредении работают только доказанные трихологом схемы."},
    {"category": "4. Осанка, Шея и Плечевой пояс (Frame & Posture)", "science_level": "Биомеханика и ЛФК", "protocol": "Устранение компьютерной шеи (Forward Head Posture): укрепление глубоких сгибателей шеи (chin tucks), нижней/средней трапеции и задних дельт + растяжка грудных мышц мгновенно добавляет +2–3 см видимого роста и раскрывает ключицы."},
    {"category": "5. Стоматология и Гнатология (Smile & Ortho)", "science_level": "Ортодонтия и гигиена", "protocol": "Ультразвуковая профгигиена раз в 6 месяцев, ирригатор + зубная нить, физиологическое носовое дыхание во сне и сомкнутые без стискивания губы. При реальных нарушениях прикуса — элайнеры/брекеты у врача-ортодонта (а не травматичное сжимание челюстей, вызывающее дисфункцию ВНЧС!)."},
    {"category": "6. Брови, Ресницы и Уход за деталями (Grooming)", "science_level": "Эстетическая симметрия", "protocol": "Убирание только лишних волосков на переносице и нижнем веке с сохранением естественной прямой линии бровей, гигиенический бальзам с ланолином для губ, аккуратная форма бороды/щетины по линии подъязычной кости (на 1–2 пальца выше кадыка)."},
    {"category": "7. Сон и Кортизоловый контроль (Sleepmaxxing)", "science_level": "Сомнология", "protocol": "7.5–8.5 часов сна в полной темноте при +18…+20 °C снижают утренний кортизол, убирают сосудистые тёмные круги под глазами и максимизируют выработку соматотропина."},
    {"category": "8. Цветотип и Посадка одежды (Stylemaxxing)", "science_level": "Колористика и портновское дело", "protocol": "Правило третей (1/3 верх к 2/3 брюк с высокой/средней посадкой визуально удлиняет ноги), совпадение контрастности одежды с природным контрастом кожи/волос/глаз и подшив брюк у портного под конкретную обувь."},
    {"category": "9. Ольфакторный гардероб (Scentmaxxing)", "science_level": "Парфюмерная химия", "protocol": "Разделение ароматов по температуре воздуха: летом и в офис — свежие цитрусовые, фужерные, зелёные и амброксановые композиции (1–2 распыления); холодной осенью/зимой — древесные, пряные, кожаные и амбровые (на увлажнённую кожу без растирания запястий)."},
]


# ==============================================================================
# 5. GAMING WIKIS & GUIDES (DOTA 2, ELDEN RING, FORTNITE, MINECRAFT + MORE)
# ==============================================================================

GAMING_WIKIS_DB: list[dict[str, Any]] = [
    {
        "id": "dota2",
        "game": "Dota 2",
        "genre": "MOBA 5×5 (Valve)",
        "emoji": "⚔️",
        "sections": [
            {"title": "Роли по позициям 1–5 и приоритет фарма", "body": "Pos 1 (Carry — лёгкая линия): скейлинг в лейт, тайминги ключевого слота (Battle Fury / Manta / BKB к 14–21 мин). Pos 2 (Mid): контроль рун воды (2:00, 4:00) и активных рун (с 6:00 каждые 2 мин), темп по карте. Pos 3 (Offlane): инициация и ауры (Blink, Pipe, Crimson, Shiva). Pos 4 (Soft Support): разблокировка малого/большого кемпов, ганги под руну мудрости (7:00, 14:00...). Pos 5 (Hard Support): победа на линии, стаки, обзор под Рошана и Терзателя (20:00)."},
            {"title": "Ключевые тайминги карты", "body": "0:00 — Руны богатства (каждые 3 мин). 2:00 и 4:00 — Руны воды на реке. 3:00 — Лотосы в прудах линий (каждые 3 мин). 6:00 — Первая активная руна усиления. 7:00 — Руны мудрости (каждые 7 мин — критичны для 6 уровня саппортов!). 15:00 — Осколок Aghanim's Shard в лавке. 20:00 — Появление Терзателей (Tormentor — бесплатный Shard одному из двух беднейших героев с низким нетворсом). Рошан: респаун 8–11 минут после убийства; ночью в верхнем логове, днём в нижнем."},
            {"title": "Универсальная матрица контр-предметов", "body": "• Против иллюзионистов (PL, Naga, CK): Radiance, Mjollnir, Shiva's Guard, Gleipnir.\n• Против мощного вампиризма/регена (Huskar, Morphling, Alchemist, Bristleback): Spirit Vessel, Eye of Skadi, Shiva's Guard.\n• Против направленного контроля (Doom, Beastmaster, Bane): Linken's Sphere + Lotus Orb.\n• Против физического взрывного урона (PA, Templar, Ursa): Ghost Scepter, Aeon Disk, Heaven's Halberd, Armor."},
        ],
    },
    {
        "id": "elden_ring",
        "game": "Elden Ring + Shadow of the Erdtree",
        "genre": "Action-RPG (FromSoftware)",
        "emoji": "💍",
        "sections": [
            {"title": "Точные софткапы характеристик (Soft Caps)", "body": "• Жизненная сила (Vigor): ОБЯЗАТЕЛЬНО 40 к середине игры (1450 ОЗ) и 60 к лейту/DLC (1900 ОЗ); выше 60 прибавка падает вчетверо!\n• Стойкость (Endurance): 25 / 50 для выносливости; 25 / 60 для веса снаряжения (держите Среднюю загрузку < 70% веса!).\n• Сила / Ловкость / Мудрость / Вера / Колдовство: 20 → 55 → 80 для урона оружия (при двуручном хвате Сила умножается на ×1.5, поэтому 54 Силы в двух руках = 81!)."},
            {"title": "Механика DLC Shadow of the Erdtree", "body": "В Царстве Теней обычный уровень рун почти не спасает — решают Осколки Древа Упадка (Scadutree Fragments, уровень 1–20: на 20-м уровне даёт ×2.05 к вашему урону и режет входящий урон вдвое!) и Прах Почитаемого Духа (1–10 для призываемых духов и Потока)."},
            {"title": "Топ-4 проверенных архетипа сборок", "body": "1) Кровотечение (DEX/ARC): Реки Крови / Нагината Элеоноры / Парные скимитары со Сэппуку + Маска Варрэ + Торжество Повелителя Крови.\n2) Сила + Вера (STR/FAI): Богохульный клинок (Blasphemous Blade) + Золотой обет + Пламя, даруй мне силу.\n3) Чистая Сила (Stance Break): Двуручный меч Greatsword с Львиным когтем + Каменное сердце.\n4) Маг блестящих камней (INT): Королевский скипетр Карии + Спиральный осколок против крупных драконов и боссов."},
        ],
    },
    {
        "id": "minecraft",
        "game": "Minecraft (Java & Bedrock 1.21+)",
        "genre": "Sandbox Survival (Mojang)",
        "emoji": "⛏️",
        "sections": [
            {"title": "Оптимальные высоты Y для добычи руд (после 1.18+)", "body": "• Алмазы: пик генерации на Y = −58…−59 (ниже уровня лавовых озёр Y = −54 удобно копать на −53 или в затопленных пещерах).\n• Железо: два пика — в высоких горах (Y = 232) и в шахтах на Y = 15.\n• Медь: максимум на Y = 48 (особенно в капельных карстовых пещерах).\n• Золото: Y = −16 (а в биоме Бесплодных земель Badlands — на любой высоте Y = 32–256).\n• Изумруды: горы на Y = 236.\n• Древние обломки (Незерит в Незере): Y = 15 взрывами кроватей или ТНТ на границе чанков (F3 + G)."},
            {"title": "Быстрая шпаргалка зельеварения", "body": "База: Бутылочки воды + Незерский нарост = Мутное зелье.\n• + Огненный порошок → Сила (+3 урона; со светопылью +6).\n• + Сгусток магмы → Огнестойкость (редстоун продлевает до 8:00 — незаменимо в Незере!).\n• + Золотая морковь → Ночное зрение (+ маринованный паучий глаз = Невидимость).\n• + Мембрана фантома → Плавное падение (спасает в Краю против Дракона).\n• + Иглобрюх → Водное дыхание."},
            {"title": "Идеальная торговля с жителями и ферма книг", "body": "Кафедра (Lectern) → Библиотекарь: ломайте и ставьте кафедру до старта торгов (пока вы ещё не купили ничего!), пока в первом слоте не выпадет «Починка» (Mending), «Удача III», «Защита IV» или «Острота V»."},
        ],
    },
    {
        "id": "fortnite",
        "game": "Fortnite (Battle Royale & Zero Build)",
        "genre": "Battle Royale / Tactical Shooter (Epic Games)",
        "emoji": "🪂",
        "sections": [
            {"title": "Фундамент побед в Zero Build (Нулевая высота)", "body": "В Zero Build у каждого игрока есть регенерирующий сверхщит 50 ед. Никогда не принимайте перестрелку в чистом поле без естественного укрытия с правым пиком (Right-Hand Peek — камера персонажа справа, поэтому вы видите врага, оставляя 75% хитбокса за углом!). Всегда держите в инвентаре минимум 1 слот мобильности (ударные гранаты / крюк / джетпак / бункеры)."},
            {"title": "Оптимальные киберспортивные настройки ПК", "body": "Режим рендеринга Performance Mode (низкие меши для прозрачности построек и минимальной задержки ввода), включите «Визуализацию звуковых эффектов» в настройках звука (показывает шаги, сундуки и лечение врагов на 360° раньше, чем их слышно в наушниках!), эффективный eDPI = DPI × Sensitivity в диапазоне 44–68."},
            {"title": "Piece Control и Редактирование в Build Mode", "body": "Включайте «Подтверждение редактирования при отпускании» (Edit on Release). Главный принцип Piece Control: ставьте стену, конус на пол и потолок вокруг клетки соперника ДО выстрела дробовиком, открывая верхнее правое окно из 3 плиток (Peanut Butter Edit) с прыжком."},
        ],
    },
    {
        "id": "cs2",
        "game": "Counter-Strike 2",
        "genre": "Tactical FPS (Valve • Source 2)",
        "emoji": "🎯",
        "sections": [
            {"title": "Экономика раундов и контр-стрейфы", "body": "Точность первого выстрела AK-47 / M4A1-S восстанавливается мгновенно при коротком нажатии противоположной клавиши движения (A → тап D → выстрел). Бонус за серию поражений растёт от $1400 до $3400 ($1400 → $1900 → $2400 → $2900 → $3400). Объемные дымовые гранаты Source 2 рассеиваются осколочной гранатой HE на 2 секунды для внезапного пика!"},
        ],
    },
    {
        "id": "bg3_terraria_cyberpunk",
        "game": "Baldur's Gate 3 • Terraria • Cyberpunk 2077 • Hollow Knight",
        "genre": "Культовые RPG и Инди-шедевры",
        "emoji": "🐉",
        "sections": [
            {"title": "Baldur's Gate 3 (Режим Доблести)", "body": "Сильнейшие черты (Feats): Трактирный забияка (Tavern Brawler — удваивает бонус Силы для монаха Открытой Ладони и метателя), Меткий стрелок и Мастер великого оружия, Бдительность (+5 к инициативе при кубике d4 в BG3 даёт гарантированный первый ход всей группе!)."},
            {"title": "Terraria (Прогрессия классов до Moon Lord)", "body": "Всегда стройте длинные многоярусные арены из платформ с Кострами, Лампами-сердцами, Статуей Бастет (+5 защиты) и лужицей мёда. Зенит (Zenith) крафтится из 10 легендарных мечей от Медного кинжала до Мяумура и Звёздного гнева."},
            {"title": "Cyberpunk 2077 (Патч 2.1+ Phantom Liberty)", "body": "Три вершины киберимплантов: 1) Sandevistan «Апогей» Милитеха (замедление времени 85% с продлением за убийства + катана Бякко); 2) Кибердека Тетратроник Потрошитель (очередь из 4 скриптов Синаптического замыкания); 3) Берсерк Биодин (полная неуязвимость в ближнем бою)."},
        ],
    },
    {
        "id": "genshin_honkai",
        "game": "Genshin Impact & Honkai: Star Rail",
        "genre": "Action-RPG / Turn-Based RPG (HoYoverse)",
        "emoji": "✨",
        "sections": [
            {"title": "Множительные и Преобразующие реакции стихий", "body": "• Умножающие (критуют от КУ/КШ и статов атаки): Пар (Гидро по Пиро = ×2.0; Пиро по Гидро = ×1.5) и Таяние (Пиро по Крио = ×2.0; Крио по Пиро = ×1.5).\n• Дендро-катализ (зависят от уровня 90 и МС): Обострение (+базовый урон Электро) и Разрастание (+базовый урон Дендро).\n• Бутонизация: Вегетация (Гидро + Дендро → Электро по бутону; собирайте 900–1000 МС на Электро-триггере!) и Цветение (Тома / пиро-триггер в 1000 МС)."},
            {"title": "Золотое правило критов 1:2 и гарант Молитв", "body": "Оптимальное соотношение Шанса крита к Крит. урону — 1:2 (например, 75% КШ / 150%+ КУ). Софткап гаранта (Soft Pity) на ивентовом баннере персонажа начинается с 74-й крутки (+6% шанса за каждую крутку после 73-й, жёсткий потолок — 90), оружейный баннер — софткап с 63-й крутки (потолок 80, курс на 1 очко Судьбы)."},
        ],
    },
    {
        "id": "gta_valorant",
        "game": "GTA Online / GTA VI • Valorant • Apex Legends",
        "genre": "Open-World & Competitive Shooters",
        "emoji": "🏎️",
        "sections": [
            {"title": "GTA Online: Топ соло-фарма $/час", "body": "1) Ограбление Кайо-Перико (Косатка + Sparrow, тихий маршрут через дренажный туннель за 11–13 минут на элитное испытание).\n2) Кислотная лаборатория (Brickade 6×6 после миссий Первой дозы + улучшение оборудования = $351 000 пассивно).\n3) Ночной клуб (5 техников на Бункер, Грузы, Кокаин, Мет и Фальшивые банкноты + сейф при высокой популярности).\n4) Автомастерская и Утилизационный цех (еженедельные угоны)."},
            {"title": "Valorant & Шутеры: Универсальный эталон eDPI и cm/360°", "body": "• Valorant: средний про-диапазон eDPI = 200–320 (например, 800 DPI × 0.30 = 240 eDPI, что равно ~54.4 см на оборот 360°).\n• Формула перевода между играми: Sens(Valorant) = Sens(CS2) / 3.181818; Sens(Apex) = Sens(CS2) × 1.0; Sens(Overwatch 2) = Sens(CS2) × 3.3333."},
        ],
    },
]


# ==============================================================================
# 6. NEAL.FUN SUITE: INFINITE CRAFT + SPEND BILLIONAIRE'S FORTUNE
# ==============================================================================

CRAFT_RECIPES: dict[tuple[str, str], tuple[str, str]] = {
    ("Вода", "Огонь"): ("💨", "Пар"),
    ("Вода", "Земля"): ("🌱", "Растение"),
    ("Огонь", "Земля"): ("🌋", "Лава"),
    ("Воздух", "Огонь"): ("⚡", "Энергия"),
    ("Воздух", "Вода"): ("🌧️", "Дождь"),
    ("Воздух", "Земля"): ("🌪️", "Пыль"),
    ("Вода", "Лава"): ("🪨", "Камень"),
    ("Воздух", "Лава"): ("🪨", "Обсидиан"),
    ("Огонь", "Камень"): ("🔩", "Металл"),
    ("Огонь", "Пыль"): ("💥", "Порох"),
    ("Вода", "Вода"): ("🌊", "Океан"),
    ("Земля", "Земля"): ("🏔️", "Гора"),
    ("Воздух", "Воздух"): ("💨", "Ветер"),
    ("Огонь", "Огонь"): ("☀️", "Плазма"),
    ("Океан", "Энергия"): ("🦠", "Жизнь"),
    ("Земля", "Жизнь"): ("🧑", "Человек"),
    ("Вода", "Жизнь"): ("🐟", "Рыба"),
    ("Воздух", "Жизнь"): ("🦅", "Птица"),
    ("Растение", "Растение"): ("🌳", "Дерево"),
    ("Дерево", "Огонь"): ("🔥", "Уголь"),
    ("Камень", "Ветер"): ("⏳", "Песок"),
    ("Огонь", "Песок"): ("🪟", "Стекло"),
    ("Песок", "Стекло"): ("⌛", "Время"),
    ("Человек", "Камень"): ("🛠️", "Инструмент"),
    ("Человек", "Металл"): ("🤖", "Машина"),
    ("Энергия", "Песок"): ("💻", "Кремниевый чип"),
    ("Кремниевый чип", "Человек"): ("🌐", "Интернет"),
    ("Интернет", "Жизнь"): ("🧠", "Искусственный Интеллект"),
    ("Искусственный Интеллект", "Человек"): ("🦾", "Киборг"),
    ("Человек", "Птица"): ("✈️", "Самолёт"),
    ("Самолёт", "Плазма"): ("🚀", "Ракета"),
    ("Ракета", "Время"): ("🌌", "Межзвёздный Ковчег"),
    ("Человек", "Время"): ("📜", "История"),
    ("Дерево", "Инструмент"): ("📄", "Бумага"),
    ("Бумага", "История"): ("📚", "Вавилонская Библиотека"),
    ("Лава", "Гора"): ("🌋", "Вулкан"),
    ("Океан", "Вулкан"): ("🏝️", "Остров"),
    ("Человек", "Звезда"): ("✨", "Стенд Реквием"),
    ("Плазма", "Гора"): ("⭐", "Звезда"),
    ("Звезда", "Время"): ("🕳️", "Чёрная Дыра"),
}


def combine_infinite_craft(item_a: str, item_b: str) -> dict[str, Any]:
    a = (item_a or "").strip()
    b = (item_b or "").strip()
    if not a or not b:
        raise ValueError("Выберите два элемента для синтеза")
    pair = (a, b) if (a, b) in CRAFT_RECIPES else ((b, a) if (b, a) in CRAFT_RECIPES else None)
    if pair:
        emoji, res = CRAFT_RECIPES[pair]
        return {"emoji": emoji, "result": res, "first_discovery": False}

    # Deterministic procedural alchemy for ANY novel combination (Infinite Craft spirit!)
    key = "::".join(sorted([a.lower(), b.lower()]))
    h = int(hashlib.sha256(key.encode("utf-8")).hexdigest()[:8], 16)
    prefixes = ["Квантовый", "Кибер", "Нео", "Астральный", "Термо", "Гипер", "Хроно", "Мета", "Солнечный", "Архи"]
    emojis = ["🔮", "⚗️", "🧬", "🛸", "💠", "🪐", "⚡", "🧿", "🐉", "🏛️", "🌌", "💎"]
    stem_a = a.split()[-1][:6]
    stem_b = b.split()[-1]
    if a.lower() == b.lower():
        res_name = f"Мега-{a}"
    elif h % 2 == 0:
        res_name = f"{prefixes[h % len(prefixes)]} {stem_b}"
    else:
        res_name = f"{a}-{stem_b}"
    return {
        "emoji": emojis[h % len(emojis)],
        "result": res_name,
        "first_discovery": True,
    }


SPEND_BILLIONAIRE_ITEMS: list[dict[str, Any]] = [
    {"id": "shawarma", "emoji": "🌯", "name": "Авторская шаурма XL", "price_usd": 4},
    {"id": "coffee", "emoji": "☕", "name": "Спешелти Раф / Матча", "price_usd": 6},
    {"id": "indie_game", "emoji": "🎮", "name": "AAA-игра в Steam Ultimate Edition", "price_usd": 70},
    {"id": "airpods", "emoji": "🎧", "name": "Наушники флагманские с ANC", "price_usd": 250},
    {"id": "iphone", "emoji": "📱", "name": "Флагманский смартфон 1 TB", "price_usd": 1599},
    {"id": "rtx5090_pc", "emoji": "🖥️", "name": "Кастомный ПК на RTX 5090 + 9800X3D", "price_usd": 4800},
    {"id": "rolex", "emoji": "⌚", "name": "Швейцарский хронограф из платины", "price_usd": 65000},
    {"id": "porsche911", "emoji": "🏎️", "name": "Porsche 911 Turbo S", "price_usd": 245000},
    {"id": "bugatti", "emoji": "🏁", "name": "Гиперкар Bugatti Tourbillon", "price_usd": 4100000},
    {"id": "penthouse", "emoji": "🏙️", "name": "Пентхаус с панорамным видом на 80-м этаже", "price_usd": 18000000},
    {"id": "gulfstream", "emoji": "✈️", "name": "Бизнес-джет Gulfstream G700", "price_usd": 78000000},
    {"id": "f1_team", "emoji": "🏆", "name": "Собственная команда Формулы-1 на сезон", "price_usd": 420000000},
    {"id": "superyacht", "emoji": "🛥️", "name": "140-метровая океанская мегаяхта", "price_usd": 550000000},
    {"id": "skyscraper", "emoji": "🏢", "name": "Постройка небоскрёба высотой 800 м", "price_usd": 1500000000},
    {"id": "football_club", "emoji": "⚽", "name": "Топ-клуб Лиги Чемпионов УЕФА", "price_usd": 4800000000},
    {"id": "ai_datacenter", "emoji": "🧠", "name": "Гигакластер ИИ на 100 000 ускорителей", "price_usd": 12000000000},
    {"id": "moon_base", "emoji": "🌕", "name": "Автономная научная база в кратере Шеклтон на Луне", "price_usd": 45000000000},
    {"id": "mars_fleet", "emoji": "🚀", "name": "Флот из 100 межпланетных кораблей для колонии на Марсе", "price_usd": 95000000000},
]


# ==============================================================================
# 7. ROUTE PLANNER, UNIVERSAL FILE CONVERTER, IQ/EQ TESTS & CV PDF BUILDER
# ==============================================================================

WORLD_CITIES_COORDS: dict[str, tuple[float, float, str]] = {
    "москва": (55.7558, 37.6173, "Москва, Россия"),
    "санкт-петербург": (59.9343, 30.3351, "Санкт-Петербург, Россия"),
    "казань": (55.7961, 49.1064, "Казань, Россия"),
    "нижний новгород": (56.3269, 44.0059, "Нижний Новгород, Россия"),
    "екатеринбург": (56.8389, 60.6057, "Екатеринбург, Россия"),
    "новосибирск": (55.0084, 82.9357, "Новосибирск, Россия"),
    "красноярск": (56.0153, 92.8932, "Красноярск, Россия"),
    "иркутск": (52.2870, 104.3050, "Иркутск, Россия"),
    "владивосток": (43.1155, 131.8855, "Владивосток, Россия"),
    "сочи": (43.5855, 39.7231, "Сочи, Россия"),
    "краснодар": (45.0355, 38.9753, "Краснодар, Россия"),
    "ростов-на-дону": (47.2357, 39.7015, "Ростов-на-Дону, Россия"),
    "самара": (53.1959, 50.1002, "Самара, Россия"),
    "воронеж": (51.6608, 39.2003, "Воронеж, Россия"),
    "калининград": (54.7104, 20.4522, "Калининград, Россия"),
    "мурманск": (68.9585, 33.0827, "Мурманск, Россия"),
    "минск": (53.9006, 27.5590, "Минск, Беларусь"),
    "алматы": (43.2389, 76.8897, "Алматы, Казахстан"),
    "астана": (51.1694, 71.4491, "Астана, Казахстан"),
    "ташкент": (41.2995, 69.2401, "Ташкент, Узбекистан"),
    "тбилиси": (41.7151, 44.8271, "Тбилиси, Грузия"),
    "ереван": (40.1792, 44.4991, "Ереван, Армения"),
    "стамбул": (41.0082, 28.9784, "Стамбул, Турция"),
    "дубай": (25.2048, 55.2708, "Дубай, ОАЭ"),
    "франкфурт": (50.1109, 8.6821, "Франкфурт-на-Майне, Германия"),
    "берлин": (52.5200, 13.4050, "Берлин, Германия"),
    "париж": (48.8566, 2.3522, "Париж, Франция"),
    "лондон": (51.5072, -0.1276, "Лондон, Великобритания"),
    "рим": (41.9028, 12.4964, "Рим, Италия"),
    "пекин": (39.9042, 116.4074, "Пекин, Китай"),
    "токио": (35.6762, 139.6503, "Токио, Япония"),
    "нью-йорк": (40.7128, -74.0060, "Нью-Йорк, США"),
}


def _resolve_point(spec: str) -> tuple[float, float, str]:
    s = (spec or "").strip()
    low = s.lower()
    if low in WORLD_CITIES_COORDS:
        return WORLD_CITIES_COORDS[low]
    for k, val in WORLD_CITIES_COORDS.items():
        if k in low or low in k:
            return val
    # Try "lat, lon"
    parts = [p.strip() for p in s.replace(";", ",").split(",")]
    if len(parts) >= 2:
        try:
            la = float(parts[0])
            lo = float(parts[1])
            if -90 <= la <= 90 and -180 <= lo <= 180:
                return (la, lo, f"{la:.4f}°, {lo:.4f}°")
        except ValueError:
            pass
    raise ValueError(f"Не удалось распознать точку «{s}». Укажите известный город (например: Москва, Казань, Сочи, Франкфурт, Токио) или координаты «55.75, 37.61».")


def calculate_route_plan(
    origin: str = "Москва",
    destination: str = "Санкт-Петербург",
    via: str = "",
    transport: str = "car",  # car | train | plane | bike | walk
    fuel_l_per_100km: float = 8.2,
    fuel_price_rub: float = 61.5,
) -> dict[str, Any]:
    pts = [_resolve_point(origin)]
    if (via or "").strip():
        for v in via.split(";"):
            if v.strip():
                pts.append(_resolve_point(v.strip()))
    pts.append(_resolve_point(destination))

    def haversine(p1: tuple[float, float, str], p2: tuple[float, float, str]) -> float:
        r = 6371.0
        la1, lo1 = math.radians(p1[0]), math.radians(p1[1])
        la2, lo2 = math.radians(p2[0]), math.radians(p2[1])
        dla = la2 - la1
        dlo = lo2 - lo1
        a = math.sin(dla / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(dlo / 2) ** 2
        return 2 * r * math.asin(min(1.0, math.sqrt(a)))

    air_km = sum(haversine(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
    tortuosity = {"car": 1.21, "train": 1.18, "plane": 1.03, "bike": 1.24, "walk": 1.26}.get(transport, 1.21)
    speeds_kmh = {"car": 84.0, "train": 95.0, "plane": 780.0, "bike": 20.0, "walk": 5.0}
    speed = speeds_kmh.get(transport, 84.0)

    route_km = round(air_km * tortuosity, 1)
    raw_hours = route_km / speed + (0.75 if transport == "plane" else 0.0)
    h_int = int(raw_hours)
    m_int = int(round((raw_hours - h_int) * 60))

    fuel_needed_l = round((route_km / 100.0) * max(0.0, float(fuel_l_per_100km)), 1) if transport == "car" else 0.0
    fuel_cost_rub = int(round(fuel_needed_l * max(0.0, float(fuel_price_rub))))

    legs = []
    for i in range(len(pts) - 1):
        seg_air = haversine(pts[i], pts[i + 1])
        seg_road = round(seg_air * tortuosity, 1)
        legs.append({"from": pts[i][2], "to": pts[i + 1][2], "distance_km": seg_road})

    return {
        "waypoints": [{"label": p[2], "lat": p[0], "lon": p[1]} for p in pts],
        "air_distance_km": round(air_km, 1),
        "route_distance_km": route_km,
        "duration_hours": round(raw_hours, 2),
        "duration_formatted": f"{h_int} ч {m_int:02d} мин",
        "transport": transport,
        "fuel_liters": fuel_needed_l,
        "fuel_cost_rub": fuel_cost_rub,
        "legs": legs,
        "cities_available": [v[2].split(",")[0] for v in WORLD_CITIES_COORDS.values()],
    }


def convert_universal_file(raw_bytes: bytes, filename: str, target_format: str) -> tuple[bytes, str, str]:
    """
    Universal converter for images (PNG, JPG, WEBP, BMP, ICO, GIF, PDF)
    and structured data/text (JSON, CSV, TSV, MD, HTML, TXT, PDF).
    """
    tgt = (target_format or "png").strip().lower().lstrip(".")
    ext_in = (filename.rsplit(".", 1)[-1].lower() if "." in filename else "").strip()
    stem = (filename.rsplit(".", 1)[0] if "." in filename else filename) or "converted"

    img_exts = {"png", "jpg", "jpeg", "webp", "bmp", "ico", "gif", "tiff"}
    if ext_in in img_exts or tgt in {"png", "jpg", "jpeg", "webp", "bmp", "ico"}:
        with Image.open(io.BytesIO(raw_bytes)) as im:
            out = io.BytesIO()
            if tgt in ("jpg", "jpeg"):
                rgb = im.convert("RGB")
                rgb.save(out, format="JPEG", quality=92)
                return out.getvalue(), "image/jpeg", f"{stem}.jpg"
            if tgt == "webp":
                im.save(out, format="WEBP", quality=90)
                return out.getvalue(), "image/webp", f"{stem}.webp"
            if tgt == "bmp":
                im.convert("RGB").save(out, format="BMP")
                return out.getvalue(), "image/bmp", f"{stem}.bmp"
            if tgt == "ico":
                ico_im = im.convert("RGBA")
                ico_im.thumbnail((128, 128))
                ico_im.save(out, format="ICO")
                return out.getvalue(), "image/x-icon", f"{stem}.ico"
            if tgt == "pdf":
                im.convert("RGB").save(out, format="PDF", resolution=150.0)
                return out.getvalue(), "application/pdf", f"{stem}.pdf"
            im.save(out, format="PNG")
            return out.getvalue(), "image/png", f"{stem}.png"

    # Text / tabular conversions
    text = raw_bytes.decode("utf-8", errors="replace")
    rows: list[dict[str, Any]] = []
    if ext_in == "json":
        parsed = json.loads(text)
        rows = parsed if isinstance(parsed, list) else [parsed]
    elif ext_in in ("csv", "tsv"):
        delim = "\t" if ext_in == "tsv" else ","
        rows = list(csv.DictReader(io.StringIO(text), delimiter=delim))

    if tgt == "json":
        payload = rows if rows else {"filename": filename, "lines": text.splitlines()}
        return json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8"), "application/json", f"{stem}.json"

    if tgt in ("csv", "tsv"):
        delim = "\t" if tgt == "tsv" else ","
        sio = io.StringIO()
        if rows and isinstance(rows[0], dict):
            fieldnames = list(rows[0].keys())
            writer = csv.DictWriter(sio, fieldnames=fieldnames, delimiter=delim)
            writer.writeheader()
            for r in rows:
                writer.writerow({k: r.get(k, "") for k in fieldnames})
        else:
            for idx, ln in enumerate(text.splitlines(), start=1):
                sio.write(f"{idx}{delim}{ln}\n")
        mime = "text/tab-separated-values" if tgt == "tsv" else "text/csv"
        return sio.getvalue().encode("utf-8"), mime, f"{stem}.{tgt}"

    if tgt == "html":
        esc = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        html_doc = (
            f"<!doctype html><html lang='ru'><head><meta charset='utf-8'><title>{stem}</title>"
            "<style>body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;padding:24px;}pre{white-space:pre-wrap;background:#1e293b;padding:16px;border-radius:12px;}</style>"
            f"</head><body><h1>{stem}</h1><pre>{esc}</pre></body></html>"
        )
        return html_doc.encode("utf-8"), "text/html", f"{stem}.html"

    if tgt == "md":
        md = f"# {stem}\n\n```\n{text}\n```\n"
        return md.encode("utf-8"), "text/markdown", f"{stem}.md"

    return text.encode("utf-8"), "text/plain", f"{stem}.txt"


IQ_TEST_QUESTIONS: list[dict[str, Any]] = [
    {"id": 1, "q": "Продолжите числовую последовательность: 2, 6, 12, 20, 30, ?", "options": ["40", "42", "44", "38"], "correct": 1, "explain": "Разности соседних членов растут на 2: +4, +6, +8, +10, значит следующий шаг +12 → 30 + 12 = 42 (формула n·(n+1))."},
    {"id": 2, "q": "Матрица прогрессий: [3, 9, 27] → [4, 16, 64] → [5, 25, ?]", "options": ["75", "100", "125", "150"], "correct": 2, "explain": "В каждой строке записаны степени (n¹, n², n³): 5³ = 125."},
    {"id": 3, "q": "Все кварки — фермионы. Ни один бозон не является фермионом. Какой вывод логически неизбежен?", "options": ["Все фермионы — кварки", "Ни один кварк не является бозоном", "Некоторые бозоны — кварки", "Все частицы — фермионы"], "correct": 1, "explain": "Множество кварков целиком лежит внутри фермионов, а множества фермионов и бозонов не пересекаются."},
    {"id": 4, "q": "Ряд Фибоначчи с чередованием знака: 1, −1, 2, −3, 5, −8, 13, ?", "options": ["−21", "21", "−19", "−24"], "correct": 0, "explain": "Модуль равен сумме модулей двух предыдущих чисел (8 + 13 = 21), а знак чередуется на нечётных и чётных позициях → −21."},
    {"id": 5, "q": "Если 5 станков изготавливают 5 деталей за 5 минут, за сколько минут 100 таких же станков изготовят 100 деталей?", "options": ["100 минут", "20 минут", "5 минут", "1 минута"], "correct": 2, "explain": "Производительность одного станка — 1 деталь за 5 минут; работая параллельно, 100 станков сделают по одной детали за те же 5 минут."},
    {"id": 6, "q": "Аналогия понятий: ЭНТРОПИЯ : УПОРЯДОЧЕННОСТЬ = ТРЕНИЕ : ?", "options": ["Масса", "Инерционное скольжение", "Температура", "Плотность"], "correct": 1, "explain": "Рост энтропии препятствует сохранению упорядоченности так же, как трение препятствует сохранению свободного скольжения."},
    {"id": 7, "q": "Куб 4×4×4 покрасили снаружи со всех сторон и распилили на 64 кубика 1×1×1. У скольких маленьких кубиков НЕ окрашена ни одна грань?", "options": ["8", "16", "4", "12"], "correct": 0, "explain": "Внутреннее неокрашенное ядро имеет размер (4−2)×(4−2)×(4−2) = 2×2×2 = 8 кубиков."},
    {"id": 8, "q": "Найдите недостающее число в узле: (7, 4 → 33), (6, 5 → 11), (9, 7 → ?)", "options": ["16", "32", "63", "28"], "correct": 1, "explain": "Правило узла a² − b²: 49 − 16 = 33; 36 − 25 = 11; 81 − 49 = 32."},
    {"id": 9, "q": "Буквенно-числовой шифр русского алфавита (А=1, Б=2, В=3...): А(1), Г(4), И(9), О(16), ?", "options": ["У(21)", "Ч(25)", "Ш(26)", "Ц(24)"], "correct": 1, "explain": "Позиции в алфавите — точные квадраты: 1², 2², 3², 4², 5² = 25-я буква русского алфавита (с Ё) — Ч."},
    {"id": 10, "q": "В озере растёт кувшинка, удваивающая площадь каждый день. На 48-й день озеро заросло целиком. На какой день заросла ровно половина озера?", "options": ["На 24-й", "На 47-й", "На 46-й", "На 36-й"], "correct": 1, "explain": "Так как площадь удваивается каждые сутки, за день до полного заполнения (на 47-й день) озеро было покрыто ровно наполовину."},
]

EQ_TEST_QUESTIONS: list[dict[str, Any]] = [
    {"id": 1, "q": "Коллега резко критикует вашу работу в общем чате. Первая зрелая реакция с высоким EQ:", "options": ["Ответить такой же колкостью публично", "Промолчать и копить обиду неделями", "Перевести обсуждение в конструктивные факты: уточнить конкретные замечания без перехода на личности", "Немедленно удалить свой проект"], "best": 2},
    {"id": 2, "q": "Близкий друг рассказывает о тяжёлом дне, не прося совета. Что обычно поддерживает лучше всего?", "options": ["Сказать «не парься, у других хуже»", "Активно выслушать, отразить его чувства и спросить: «Хочешь просто выговориться или подумаем над решением вместе?»", "Сразу перевести тему на свои успехи", "Прочитать лекцию о тайм-менеджменте"], "best": 1},
    {"id": 3, "q": "Вы замечаете у себя нарастающее раздражение и усталость перед важным разговором:", "options": ["Начать спор прямо сейчас на пике эмоций", "Осознать физиологический триггер (голод/недосып/стресс), взять паузу 15 минут и сформулировать «Я-сообщение»", "Обвинить собеседника заранее", "Полностью заблокировать контакт"], "best": 1},
    {"id": 4, "q": "Что означает здоровая личная граница?", "options": ["Умение заставить окружающих жить по вашим правилам", "Спокойное обозначение того, как с вами можно и как нельзя поступать, и готовность последовательно соблюдать это самому", "Соглашаться на любую просьбу ради одобрения", "Полная эмоциональная изоляция"], "best": 1},
    {"id": 5, "q": "Вы допустили ошибку, из-за которой команда потеряла час времени:", "options": ["Скрыть ошибку или переложить на софт", "Назвать себя полным ничтожеством", "Прямо признать факт, коротко извиниться, предложить исправление и зафиксировать чек-лист на будущее", "Разозлиться на проверяющего"], "best": 2},
]
