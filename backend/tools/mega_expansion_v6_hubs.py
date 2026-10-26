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

def _pc_segment(tier: str, release_year: int | None) -> str:
    """Normalize different component tier labels into the shared catalog filter."""
    normalized_tier = tier.casefold()
    if "опцион" in normalized_tier or "без дополнительного" in normalized_tier:
        return "optional"
    if any(token in normalized_tier for token in ("вторич", "старый", "б/у")) or (release_year is not None and release_year <= 2018):
        return "legacy"
    if any(token in normalized_tier for token in ("производ", "флагман", "премиум")):
        return "premium"
    if any(token in normalized_tier for token in ("сред", "массов")):
        return "mainstream"
    return "budget"


def _pc_part(part_id: str, name: str, price_rub: int, tier: str, release_year: int | None = None, **spec: Any) -> dict[str, Any]:
    """Build one catalog record. Prices are broad planning estimates, not live offers."""
    segment = spec.pop("segment", None) or _pc_segment(tier, release_year)
    return {
        "id": part_id,
        "name": name,
        "price_rub": price_rub,
        "tier": tier,
        "segment": segment,
        "release_year": release_year,
        **spec,
    }


# Broad consumer range: legacy/used, entry, mainstream, performance and flagship.
# Relative performance scores are intentionally approximate, not benchmark results.
PC_CPUS: list[dict[str, Any]] = [
    _pc_part("i5_4590", "Intel Core i5-4590 · 4 ядра, Haswell", 2500, "Вторичный рынок", 2014, socket="LGA1150", platform_key="lga1150", ram_type="DDR3", cores="4C / 4T", boost_ghz=3.7, tdp_w=84, score=22, integrated_graphics=True),
    _pc_part("i7_4790", "Intel Core i7-4790 · 4 ядра / 8 потоков", 5000, "Вторичный рынок", 2014, socket="LGA1150", platform_key="lga1150", ram_type="DDR3", cores="4C / 8T", boost_ghz=4.0, tdp_w=84, score=30, integrated_graphics=True),
    _pc_part("i5_6500", "Intel Core i5-6500 · Skylake", 3500, "Вторичный рынок", 2015, socket="LGA1151", platform_key="lga1151_100_200", ram_type="DDR4", cores="4C / 4T", boost_ghz=3.6, tdp_w=65, score=27, integrated_graphics=True),
    _pc_part("i5_9400f", "Intel Core i5-9400F · 6 ядер", 6500, "Старый бюджет", 2019, socket="LGA1151", platform_key="lga1151_300", ram_type="DDR4", cores="6C / 6T", boost_ghz=4.1, tdp_w=65, score=42, integrated_graphics=False),
    _pc_part("i3_10100f", "Intel Core i3-10100F · 4 ядра / 8 потоков", 5500, "Старый бюджет", 2020, socket="LGA1200", platform_key="lga1200", ram_type="DDR4", cores="4C / 8T", boost_ghz=4.3, tdp_w=65, score=43, integrated_graphics=False),
    _pc_part("i5_10400f", "Intel Core i5-10400F · 6 ядер / 12 потоков", 8500, "Старый бюджет", 2020, socket="LGA1200", platform_key="lga1200", ram_type="DDR4", cores="6C / 12T", boost_ghz=4.3, tdp_w=65, score=49, integrated_graphics=False),
    _pc_part("r5_3600", "AMD Ryzen 5 3600 · 6 ядер / 12 потоков", 6500, "Старый бюджет", 2019, socket="AM4", platform_key="am4", ram_type="DDR4", cores="6C / 12T", boost_ghz=4.2, tdp_w=65, score=48, integrated_graphics=False),
    _pc_part("i3_12100f", "Intel Core i3-12100F · 4 ядра / 8 потоков", 8500, "Начальный", 2022, socket="LGA1700", platform_key="lga1700", ram_type="DDR4", cores="4C / 8T", boost_ghz=4.3, tdp_w=58, score=57, integrated_graphics=False),
    _pc_part("r5_5500", "AMD Ryzen 5 5500 · 6 ядер / 12 потоков", 8500, "Начальный", 2022, socket="AM4", platform_key="am4", ram_type="DDR4", cores="6C / 12T", boost_ghz=4.2, tdp_w=65, score=57, integrated_graphics=False),
    _pc_part("r5_5600", "AMD Ryzen 5 5600 · 6 ядер / 12 потоков", 10900, "Начальный", 2022, socket="AM4", platform_key="am4", ram_type="DDR4", cores="6C / 12T", boost_ghz=4.4, tdp_w=65, score=61, integrated_graphics=False),
    _pc_part("r5_5600g", "AMD Ryzen 5 5600G · встроенная графика Radeon", 12000, "Начальный", 2021, socket="AM4", platform_key="am4", ram_type="DDR4", cores="6C / 12T", boost_ghz=4.4, tdp_w=65, score=58, integrated_graphics=True),
    _pc_part("i5_12400f", "Intel Core i5-12400F · 6 ядер / 12 потоков", 11500, "Начальный", 2022, socket="LGA1700", platform_key="lga1700", ram_type="DDR4", cores="6C / 12T", boost_ghz=4.4, tdp_w=65, score=66, integrated_graphics=False),
    _pc_part("r7_5700x", "AMD Ryzen 7 5700X · 8 ядер / 16 потоков", 17500, "Средний", 2022, socket="AM4", platform_key="am4", ram_type="DDR4", cores="8C / 16T", boost_ghz=4.6, tdp_w=65, score=73, integrated_graphics=False),
    _pc_part("i5_13400f", "Intel Core i5-13400F · 10 ядер", 16500, "Средний", 2023, socket="LGA1700", platform_key="lga1700", ram_type="DDR4", cores="10C / 16T", boost_ghz=4.6, tdp_w=148, score=69, integrated_graphics=False),
    _pc_part("i5_14400f", "Intel Core i5-14400F · 10 ядер", 19500, "Средний", 2024, socket="LGA1700", platform_key="lga1700", ram_type="DDR4", cores="10C / 16T", boost_ghz=4.7, tdp_w=148, score=73, integrated_graphics=False),
    _pc_part("r5_7500f", "AMD Ryzen 5 7500F · 6 ядер / 12 потоков", 15900, "Средний", 2023, socket="AM5", platform_key="am5", ram_type="DDR5", cores="6C / 12T", boost_ghz=5.0, tdp_w=65, score=74, integrated_graphics=False),
    _pc_part("r5_7600", "AMD Ryzen 5 7600 · 6 ядер, встроенная графика", 20900, "Средний", 2023, socket="AM5", platform_key="am5", ram_type="DDR5", cores="6C / 12T", boost_ghz=5.1, tdp_w=65, score=78, integrated_graphics=True),
    _pc_part("i5_12600kf", "Intel Core i5-12600KF · 10 ядер", 18500, "Средний", 2021, socket="LGA1700", platform_key="lga1700", ram_type="DDR4", cores="10C / 16T", boost_ghz=4.9, tdp_w=150, score=74, integrated_graphics=False),
    _pc_part("i5_14600k", "Intel Core i5-14600K · 14 ядер", 28900, "Производительный", 2023, socket="LGA1700", platform_key="lga1700", ram_type="DDR5", cores="14C / 20T", boost_ghz=5.3, tdp_w=181, score=84, integrated_graphics=True),
    _pc_part("r7_7700", "AMD Ryzen 7 7700 · 8 ядер / 16 потоков", 26900, "Производительный", 2023, socket="AM5", platform_key="am5", ram_type="DDR5", cores="8C / 16T", boost_ghz=5.3, tdp_w=65, score=84, integrated_graphics=True),
    _pc_part("r7_5700x3d", "AMD Ryzen 7 5700X3D · AM4, 3D V-Cache", 21500, "Производительный", 2024, socket="AM4", platform_key="am4", ram_type="DDR4", cores="8C / 16T", boost_ghz=4.1, tdp_w=105, score=76, integrated_graphics=False),
    _pc_part("i7_12700k", "Intel Core i7-12700K · 12 ядер", 26900, "Производительный", 2021, socket="LGA1700", platform_key="lga1700", ram_type="DDR5", cores="12C / 20T", boost_ghz=5.0, tdp_w=190, score=82, integrated_graphics=True),
    _pc_part("r7_7800x3d", "AMD Ryzen 7 7800X3D · 3D V-Cache", 41900, "Производительный", 2023, socket="AM5", platform_key="am5", ram_type="DDR5", cores="8C / 16T", boost_ghz=5.0, tdp_w=120, score=92, integrated_graphics=True),
    _pc_part("i7_14700k", "Intel Core i7-14700K · 20 ядер", 39500, "Производительный", 2023, socket="LGA1700", platform_key="lga1700", ram_type="DDR5", cores="20C / 28T", boost_ghz=5.6, tdp_w=253, score=89, integrated_graphics=True),
    _pc_part("u5_245k", "Intel Core Ultra 5 245K", 29900, "Производительный", 2024, socket="LGA1851", platform_key="lga1851", ram_type="DDR5", cores="14C", boost_ghz=5.2, tdp_w=159, score=82, integrated_graphics=True),
    _pc_part("u7_265k", "Intel Core Ultra 7 265K", 43900, "Флагманский", 2024, socket="LGA1851", platform_key="lga1851", ram_type="DDR5", cores="20C", boost_ghz=5.5, tdp_w=250, score=88, integrated_graphics=True),
    _pc_part("r7_9800x3d", "AMD Ryzen 7 9800X3D · 3D V-Cache", 54900, "Флагманский", 2024, socket="AM5", platform_key="am5", ram_type="DDR5", cores="8C / 16T", boost_ghz=5.2, tdp_w=120, score=100, integrated_graphics=True),
    _pc_part("u9_285k", "Intel Core Ultra 9 285K", 64900, "Флагманский", 2024, socket="LGA1851", platform_key="lga1851", ram_type="DDR5", cores="24C", boost_ghz=5.7, tdp_w=250, score=94, integrated_graphics=True),
    _pc_part("r9_9950x", "AMD Ryzen 9 9950X · 16 ядер", 66500, "Флагманский", 2024, socket="AM5", platform_key="am5", ram_type="DDR5", cores="16C / 32T", boost_ghz=5.7, tdp_w=170, score=97, integrated_graphics=True),
    _pc_part("i5_3570k", "Intel Core i5-3570K · Ivy Bridge, 4 ядра", 1800, "Вторичный рынок", 2012, socket="LGA1155", platform_key="lga1155", ram_type="DDR3", cores="4C / 4T", boost_ghz=3.8, tdp_w=77, score=17, integrated_graphics=True),
    _pc_part("i7_9700f", "Intel Core i7-9700F · Coffee Lake Refresh, 8 ядер", 7900, "Старый бюджет", 2019, socket="LGA1151", platform_key="lga1151_300", ram_type="DDR4", cores="8C / 8T", boost_ghz=4.7, tdp_w=65, score=53, integrated_graphics=False),
    _pc_part("r5_9600x", "AMD Ryzen 5 9600X · Zen 5, 6 ядер / 12 потоков", 27900, "Производительный", 2024, socket="AM5", platform_key="am5", ram_type="DDR5", cores="6C / 12T", boost_ghz=5.4, tdp_w=65, score=86, integrated_graphics=True),
]

PC_GPUS: list[dict[str, Any]] = [
    _pc_part("gpu_none", "Без отдельной видеокарты · использовать встроенную графику CPU", 0, "Офис / iGPU", None, vram_gb=0, length_mm=0, tdp_w=0, score=20, vendor="iGPU"),
    _pc_part("gtx_750ti", "NVIDIA GeForce GTX 750 Ti 2GB · вторичный рынок", 2500, "Вторичный рынок", 2014, vram_gb=2, length_mm=195, tdp_w=60, score=8, vendor="NVIDIA"),
    _pc_part("rx_580_8", "AMD Radeon RX 580 8GB · вторичный рынок", 5500, "Вторичный рынок", 2017, vram_gb=8, length_mm=270, tdp_w=185, score=24, vendor="AMD"),
    _pc_part("gtx_1050ti", "NVIDIA GeForce GTX 1050 Ti 4GB", 4500, "Вторичный рынок", 2016, vram_gb=4, length_mm=229, tdp_w=75, score=15, vendor="NVIDIA"),
    _pc_part("gtx_1650", "NVIDIA GeForce GTX 1650 4GB", 8500, "Старый бюджет", 2019, vram_gb=4, length_mm=229, tdp_w=75, score=22, vendor="NVIDIA"),
    _pc_part("gtx_1660s", "NVIDIA GeForce GTX 1660 SUPER 6GB", 10500, "Старый бюджет", 2019, vram_gb=6, length_mm=229, tdp_w=125, score=32, vendor="NVIDIA"),
    _pc_part("rx_6600", "AMD Radeon RX 6600 8GB", 18500, "Начальный", 2021, vram_gb=8, length_mm=204, tdp_w=132, score=43, vendor="AMD"),
    _pc_part("rtx_2060_12", "NVIDIA GeForce RTX 2060 12GB", 16500, "Начальный", 2021, vram_gb=12, length_mm=229, tdp_w=185, score=40, vendor="NVIDIA"),
    _pc_part("rx_6650xt", "AMD Radeon RX 6650 XT 8GB", 22900, "Начальный", 2022, vram_gb=8, length_mm=267, tdp_w=176, score=53, vendor="AMD"),
    _pc_part("rtx_3060_12", "NVIDIA GeForce RTX 3060 12GB", 23900, "Начальный", 2021, vram_gb=12, length_mm=242, tdp_w=170, score=48, vendor="NVIDIA"),
    _pc_part("arc_a750", "Intel Arc A750 8GB", 17900, "Начальный", 2022, vram_gb=8, length_mm=267, tdp_w=225, score=45, vendor="Intel"),
    _pc_part("rtx_4060", "NVIDIA GeForce RTX 4060 8GB", 33500, "Средний", 2023, vram_gb=8, length_mm=240, tdp_w=115, score=58, vendor="NVIDIA"),
    _pc_part("arc_a580", "Intel Arc A580 8GB", 15900, "Средний", 2023, vram_gb=8, length_mm=271, tdp_w=185, score=42, vendor="Intel"),
    _pc_part("rx_7600", "AMD Radeon RX 7600 8GB", 29900, "Средний", 2023, vram_gb=8, length_mm=267, tdp_w=165, score=54, vendor="AMD"),
    _pc_part("rtx_4060ti", "NVIDIA GeForce RTX 4060 Ti 16GB", 47000, "Средний", 2023, vram_gb=16, length_mm=245, tdp_w=165, score=68, vendor="NVIDIA"),
    _pc_part("rx_6700xt", "AMD Radeon RX 6700 XT 12GB", 34900, "Средний", 2021, vram_gb=12, length_mm=267, tdp_w=230, score=62, vendor="AMD"),
    _pc_part("arc_b580", "Intel Arc B580 12GB Battlemage", 28900, "Средний", 2024, vram_gb=12, length_mm=272, tdp_w=190, score=61, vendor="Intel"),
    _pc_part("rx_7800xt", "AMD Radeon RX 7800 XT 16GB", 56000, "Производительный", 2023, vram_gb=16, length_mm=280, tdp_w=263, score=82, vendor="AMD"),
    _pc_part("rtx_4070s", "NVIDIA GeForce RTX 4070 SUPER 12GB", 67000, "Производительный", 2024, vram_gb=12, length_mm=267, tdp_w=220, score=84, vendor="NVIDIA"),
    _pc_part("rx_9070xt", "AMD Radeon RX 9070 XT 16GB", 79000, "Производительный", 2025, vram_gb=16, length_mm=320, tdp_w=304, score=96, vendor="AMD"),
    _pc_part("rtx_5070ti", "NVIDIA GeForce RTX 5070 Ti 16GB GDDR7", 94000, "Производительный", 2025, vram_gb=16, length_mm=300, tdp_w=300, score=98, vendor="NVIDIA"),
    _pc_part("rtx_5080", "NVIDIA GeForce RTX 5080 16GB GDDR7", 129000, "Флагманский", 2025, vram_gb=16, length_mm=310, tdp_w=360, score=116, vendor="NVIDIA"),
    _pc_part("rtx_5090", "NVIDIA GeForce RTX 5090 32GB GDDR7", 249000, "Флагманский", 2025, vram_gb=32, length_mm=336, tdp_w=575, score=140, vendor="NVIDIA"),
    _pc_part("gtx_970", "NVIDIA GeForce GTX 970 4GB · вторичный рынок", 3500, "Вторичный рынок", 2014, vram_gb=4, length_mm=267, tdp_w=145, score=19, vendor="NVIDIA"),
    _pc_part("rtx_5070", "NVIDIA GeForce RTX 5070 12GB GDDR7", 77900, "Производительный", 2025, vram_gb=12, length_mm=304, tdp_w=250, score=82, vendor="NVIDIA"),
    _pc_part("rx_9060xt_16", "AMD Radeon RX 9060 XT 16GB", 55900, "Средний", 2025, vram_gb=16, length_mm=280, tdp_w=160, score=74, vendor="AMD"),
]

PC_MOTHERBOARDS: list[dict[str, Any]] = [
    _pc_part("h81_lga1150", "H81 mATX · LGA1150 / DDR3 · базовая плата", 3500, "Вторичный рынок", 2014, socket="LGA1150", platform_key="lga1150", ram_type="DDR3", max_ram_mhz=1600, m2_slots=0, sata_ports=4, form_factor="mATX", pcie="3.0", supports_atx=False),
    _pc_part("h110_lga1151", "H110 mATX · LGA1151 6/7 поколение / DDR4", 4500, "Вторичный рынок", 2015, socket="LGA1151", platform_key="lga1151_100_200", ram_type="DDR4", max_ram_mhz=2133, m2_slots=0, sata_ports=4, form_factor="mATX", pcie="3.0", supports_atx=False),
    _pc_part("b365_lga1151", "B365 mATX · LGA1151 8/9 поколение / DDR4", 6500, "Старый бюджет", 2019, socket="LGA1151", platform_key="lga1151_300", ram_type="DDR4", max_ram_mhz=2666, m2_slots=1, sata_ports=6, form_factor="mATX", pcie="3.0", supports_atx=False),
    _pc_part("b450m", "B450 mATX · AM4 / DDR4", 6900, "Старый бюджет", 2018, socket="AM4", platform_key="am4", ram_type="DDR4", max_ram_mhz=3600, m2_slots=1, sata_ports=4, form_factor="mATX", pcie="3.0/4.0", supports_atx=False),
    _pc_part("b550_tuf", "ASUS TUF GAMING B550M-PLUS · AM4 / DDR4", 12900, "Средний", 2020, socket="AM4", platform_key="am4", ram_type="DDR4", max_ram_mhz=4400, m2_slots=2, sata_ports=6, form_factor="mATX", pcie="4.0", supports_atx=False),
    _pc_part("b550_atx", "B550 ATX · AM4 / DDR4 · расширение и слоты", 13900, "Средний", 2020, socket="AM4", platform_key="am4", ram_type="DDR4", max_ram_mhz=4400, m2_slots=2, sata_ports=6, form_factor="ATX", pcie="4.0", supports_atx=True),
    _pc_part("b560_lga1200", "B560 mATX · LGA1200 / DDR4", 7900, "Старый бюджет", 2021, socket="LGA1200", platform_key="lga1200", ram_type="DDR4", max_ram_mhz=3200, m2_slots=2, sata_ports=6, form_factor="mATX", pcie="4.0", supports_atx=False),
    _pc_part("b660_d4", "B660 mATX · LGA1700 / DDR4", 9900, "Начальный", 2022, socket="LGA1700", platform_key="lga1700", ram_type="DDR4", max_ram_mhz=3200, m2_slots=2, sata_ports=4, form_factor="mATX", pcie="4.0", supports_atx=False),
    _pc_part("b760m_d4", "MSI PRO B760M-A WIFI DDR4 · LGA1700", 14500, "Средний", 2023, socket="LGA1700", platform_key="lga1700", ram_type="DDR4", max_ram_mhz=3200, m2_slots=2, sata_ports=4, form_factor="mATX", pcie="4.0", supports_atx=False),
    _pc_part("b760m_d5", "B760 mATX · LGA1700 / DDR5", 15900, "Средний", 2023, socket="LGA1700", platform_key="lga1700", ram_type="DDR5", max_ram_mhz=6800, m2_slots=2, sata_ports=4, form_factor="mATX", pcie="4.0/5.0", supports_atx=False),
    _pc_part("z790_ud", "GIGABYTE Z790 UD AX · LGA1700 / DDR5", 21500, "Производительный", 2023, socket="LGA1700", platform_key="lga1700", ram_type="DDR5", max_ram_mhz=7600, m2_slots=4, sata_ports=6, form_factor="ATX", pcie="5.0", supports_atx=True),
    _pc_part("b650_aorus", "GIGABYTE B650 AORUS ELITE AX V2 · AM5", 20900, "Средний", 2023, socket="AM5", platform_key="am5", ram_type="DDR5", max_ram_mhz=6400, m2_slots=3, sata_ports=4, form_factor="ATX", pcie="4.0/5.0", supports_atx=True),
    _pc_part("b650m", "B650 mATX · AM5 / DDR5", 14900, "Средний", 2023, socket="AM5", platform_key="am5", ram_type="DDR5", max_ram_mhz=6400, m2_slots=2, sata_ports=4, form_factor="mATX", pcie="4.0/5.0", supports_atx=False),
    _pc_part("x870e_tomahawk", "MSI MAG X870E TOMAHAWK WIFI · AM5", 34900, "Флагманский", 2024, socket="AM5", platform_key="am5", ram_type="DDR5", max_ram_mhz=8000, m2_slots=4, sata_ports=4, form_factor="ATX", pcie="5.0", supports_atx=True),
    _pc_part("z890_pro", "ASUS PRIME Z890-P WIFI · LGA1851 / DDR5", 28900, "Флагманский", 2024, socket="LGA1851", platform_key="lga1851", ram_type="DDR5", max_ram_mhz=8800, m2_slots=4, sata_ports=4, form_factor="ATX", pcie="5.0", supports_atx=True),
    _pc_part("h61_lga1155", "H61 mATX · LGA1155 / DDR3 · офисный апгрейд", 2300, "Вторичный рынок", 2011, socket="LGA1155", platform_key="lga1155", ram_type="DDR3", max_ram_mhz=1333, m2_slots=0, sata_ports=4, form_factor="mATX", pcie="2.0", supports_atx=False),
    _pc_part("b75_lga1155", "B75 ATX · LGA1155 / DDR3 · больше слотов расширения", 3900, "Вторичный рынок", 2012, socket="LGA1155", platform_key="lga1155", ram_type="DDR3", max_ram_mhz=1600, m2_slots=0, sata_ports=5, form_factor="ATX", pcie="3.0", supports_atx=True),
    _pc_part("a320m_am4", "A320 mATX · AM4 / DDR4 · начальная плата", 4900, "Старый бюджет", 2017, socket="AM4", platform_key="am4", ram_type="DDR4", max_ram_mhz=3200, m2_slots=1, sata_ports=4, form_factor="mATX", pcie="3.0", supports_atx=False),
    _pc_part("h510_lga1200", "H510 mATX · LGA1200 / DDR4 · базовая плата", 6200, "Старый бюджет", 2021, socket="LGA1200", platform_key="lga1200", ram_type="DDR4", max_ram_mhz=2933, m2_slots=1, sata_ports=4, form_factor="mATX", pcie="4.0", supports_atx=False),
    _pc_part("a620m_am5", "A620 mATX · AM5 / DDR5 · доступный вход на AM5", 10900, "Начальный", 2023, socket="AM5", platform_key="am5", ram_type="DDR5", max_ram_mhz=6000, m2_slots=1, sata_ports=4, form_factor="mATX", pcie="4.0", supports_atx=False),
    _pc_part("b850m_am5", "B850 mATX · AM5 / DDR5 · обновлённая массовая платформа", 17900, "Средний", 2025, socket="AM5", platform_key="am5", ram_type="DDR5", max_ram_mhz=8000, m2_slots=3, sata_ports=4, form_factor="mATX", pcie="5.0", supports_atx=False),
    _pc_part("x670e_am5", "X670E ATX · AM5 / DDR5 · расширенные линии PCIe", 29900, "Производительный", 2022, socket="AM5", platform_key="am5", ram_type="DDR5", max_ram_mhz=7600, m2_slots=4, sata_ports=6, form_factor="ATX", pcie="5.0", supports_atx=True),
]

PC_RAMS: list[dict[str, Any]] = [
    _pc_part("ddr3_8_1600", "8GB (2×4) DDR3-1600 · базовый апгрейд", 1200, "Вторичный рынок", 2014, ram_type="DDR3", capacity_gb=8, speed_mhz=1600, kit="2×4 ГБ"),
    _pc_part("ddr3_16_1600", "16GB (2×8) DDR3-1600", 2500, "Вторичный рынок", 2015, ram_type="DDR3", capacity_gb=16, speed_mhz=1600, kit="2×8 ГБ"),
    _pc_part("ddr4_16_2133", "16GB (2×8) DDR4-2133 · для старых LGA1151 плат", 3300, "Вторичный рынок", 2016, ram_type="DDR4", capacity_gb=16, speed_mhz=2133, kit="2×8 ГБ"),
    _pc_part("ddr4_8_2666", "8GB DDR4-2666 · один модуль", 1800, "Старый бюджет", 2018, ram_type="DDR4", capacity_gb=8, speed_mhz=2666, kit="1×8 ГБ"),
    _pc_part("ddr4_16_3200", "16GB (2×8) DDR4-3200", 4500, "Начальный", 2020, ram_type="DDR4", capacity_gb=16, speed_mhz=3200, kit="2×8 ГБ"),
    _pc_part("ddr4_32_3200", "32GB (2×16) DDR4-3200", 6900, "Средний", 2021, ram_type="DDR4", capacity_gb=32, speed_mhz=3200, kit="2×16 ГБ"),
    _pc_part("ddr4_32_3600", "32GB (2×16) Kingston FURY Beast DDR4-3600 CL16", 7900, "Средний", 2022, ram_type="DDR4", capacity_gb=32, speed_mhz=3600, kit="2×16 ГБ"),
    _pc_part("ddr5_16_5200", "16GB (2×8) DDR5-5200 · начальный комплект", 5900, "Начальный", 2022, ram_type="DDR5", capacity_gb=16, speed_mhz=5200, kit="2×8 ГБ"),
    _pc_part("ddr5_32_5600", "32GB (2×16) DDR5-5600", 9900, "Средний", 2023, ram_type="DDR5", capacity_gb=32, speed_mhz=5600, kit="2×16 ГБ"),
    _pc_part("ddr5_32_6000", "32GB (2×16) G.Skill Trident Z5 DDR5-6000 CL30", 13500, "Средний", 2023, ram_type="DDR5", capacity_gb=32, speed_mhz=6000, kit="2×16 ГБ"),
    _pc_part("ddr5_64_6000", "64GB (2×32) DDR5-6000", 19900, "Производительный", 2024, ram_type="DDR5", capacity_gb=64, speed_mhz=6000, kit="2×32 ГБ"),
    _pc_part("ddr5_64_6400", "64GB (2×32) Kingston FURY Renegade DDR5-6400 CL32", 25900, "Производительный", 2024, ram_type="DDR5", capacity_gb=64, speed_mhz=6400, kit="2×32 ГБ"),
    _pc_part("ddr5_96_6000", "96GB (2×48) DDR5-6000 · рабочая станция", 32900, "Флагманский", 2024, ram_type="DDR5", capacity_gb=96, speed_mhz=6000, kit="2×48 ГБ"),
    _pc_part("ddr3_4_1333", "4GB DDR3-1333 · минимальный модуль для старого ПК", 600, "Вторичный рынок", 2010, ram_type="DDR3", capacity_gb=4, speed_mhz=1333, kit="1×4 ГБ"),
    _pc_part("ddr4_64_3200", "64GB (2×32) DDR4-3200 · расширенная рабочая память", 14900, "Производительный", 2022, ram_type="DDR4", capacity_gb=64, speed_mhz=3200, kit="2×32 ГБ"),
    _pc_part("ddr5_16_4800", "16GB DDR5-4800 · один модуль для постепенного апгрейда", 3900, "Начальный", 2022, ram_type="DDR5", capacity_gb=16, speed_mhz=4800, kit="1×16 ГБ"),
    _pc_part("ddr5_24_6400", "48GB (2×24) DDR5-6400 · современный комплект", 16900, "Производительный", 2024, ram_type="DDR5", capacity_gb=48, speed_mhz=6400, kit="2×24 ГБ"),
    _pc_part("ddr5_128_5600", "128GB (2×64) DDR5-5600 · тяжёлые рабочие задачи", 42900, "Флагманский", 2024, ram_type="DDR5", capacity_gb=128, speed_mhz=5600, kit="2×64 ГБ"),
]

PC_COOLERS: list[dict[str, Any]] = [
    _pc_part("stock_am4", "Штатный кулер AMD Wraith · только совместимые AM4 CPU", 0, "Бюджетный", 2019, max_tdp_w=65, height_mm=55, is_aio_360=False, supported_sockets=["AM4"], cooler_kind="stock"),
    _pc_part("stock_intel", "Штатный кулер Intel Laminar · базовый режим", 0, "Бюджетный", 2022, max_tdp_w=65, height_mm=55, is_aio_360=False, supported_sockets=["LGA1151", "LGA1200", "LGA1700"], cooler_kind="stock"),
    _pc_part("se224xts", "ID-COOLING SE-224-XTS · башня 4 теплотрубки", 2400, "Начальный", 2022, max_tdp_w=180, height_mm=151, is_aio_360=False, supported_sockets=["AM4", "AM5", "LGA1150", "LGA1151", "LGA1200", "LGA1700", "LGA1851"], cooler_kind="tower"),
    _pc_part("ag400", "DeepCool AG400 · компактная башня", 2100, "Начальный", 2022, max_tdp_w=180, height_mm=150, is_aio_360=False, supported_sockets=["AM4", "AM5", "LGA1150", "LGA1151", "LGA1200", "LGA1700", "LGA1851"], cooler_kind="tower"),
    _pc_part("ak400", "DeepCool AK400 · башня с 4 трубками", 3200, "Средний", 2022, max_tdp_w=220, height_mm=155, is_aio_360=False, supported_sockets=["AM4", "AM5", "LGA1150", "LGA1151", "LGA1200", "LGA1700", "LGA1851"], cooler_kind="tower"),
    _pc_part("ak620", "DeepCool AK620 Dual-Tower · 6 теплотрубок", 6400, "Производительный", 2022, max_tdp_w=260, height_mm=160, is_aio_360=False, supported_sockets=["AM4", "AM5", "LGA1150", "LGA1151", "LGA1200", "LGA1700", "LGA1851"], cooler_kind="dual_tower"),
    _pc_part("aio_240", "СЖО 240 мм · радиатор в зависимости от корпуса", 7900, "Производительный", 2023, max_tdp_w=260, height_mm=55, is_aio_360=False, supported_sockets=["AM4", "AM5", "LGA1150", "LGA1151", "LGA1200", "LGA1700", "LGA1851"], cooler_kind="aio_240"),
    _pc_part("aio_360", "Arctic Liquid Freezer III 360 · СЖО", 11900, "Флагманский", 2024, max_tdp_w=320, height_mm=65, is_aio_360=True, supported_sockets=["AM4", "AM5", "LGA1200", "LGA1700", "LGA1851"], cooler_kind="aio_360"),
    _pc_part("stock_lga1155", "Штатный кулер Intel push-pin · старые LGA1155 / LGA1150", 500, "Вторичный рынок", 2012, max_tdp_w=77, height_mm=55, is_aio_360=False, supported_sockets=["LGA1155", "LGA1150"], cooler_kind="stock"),
    _pc_part("low_profile_92", "Низкопрофильный 92 мм кулер · компактные корпуса", 1900, "Начальный", 2021, max_tdp_w=95, height_mm=67, is_aio_360=False, supported_sockets=["AM4", "AM5", "LGA1155", "LGA1150", "LGA1151", "LGA1200", "LGA1700"], cooler_kind="low_profile"),
    _pc_part("tower_120_budget", "Башенный кулер 120 мм · доступный апгрейд штатного", 2800, "Бюджетный", 2022, max_tdp_w=160, height_mm=154, is_aio_360=False, supported_sockets=["AM4", "AM5", "LGA1155", "LGA1150", "LGA1151", "LGA1200", "LGA1700", "LGA1851"], cooler_kind="tower"),
    _pc_part("dual_tower_pro", "Двухбашенный кулер 140 мм · высокое тепловыделение", 8900, "Производительный", 2024, max_tdp_w=280, height_mm=168, is_aio_360=False, supported_sockets=["AM4", "AM5", "LGA1155", "LGA1150", "LGA1151", "LGA1200", "LGA1700", "LGA1851"], cooler_kind="dual_tower"),
    _pc_part("aio_280", "СЖО 280 мм · проверьте посадочные места корпуса", 8900, "Производительный", 2023, max_tdp_w=280, height_mm=60, is_aio_360=False, supported_sockets=["AM4", "AM5", "LGA1200", "LGA1700", "LGA1851"], cooler_kind="aio_280"),
]

PC_SSDS: list[dict[str, Any]] = [
    _pc_part("sata_240", "240GB SATA SSD · бюджетное обновление старого ПК", 1900, "Бюджетный", 2020, capacity_gb=240, interface="SATA III", speed_mbps=500, drive_kind="sata_ssd"),
    _pc_part("sata_480", "480GB SATA SSD · повседневная система", 2900, "Начальный", 2021, capacity_gb=480, interface="SATA III", speed_mbps=550, drive_kind="sata_ssd"),
    _pc_part("sata_1tb", "1TB SATA SSD", 5900, "Средний", 2022, capacity_gb=1000, interface="SATA III", speed_mbps=550, drive_kind="sata_ssd"),
    _pc_part("nvme_500", "500GB NVMe PCIe 3.0 SSD", 3900, "Начальный", 2021, capacity_gb=500, interface="NVMe PCIe 3.0", speed_mbps=3500, drive_kind="nvme"),
    _pc_part("kc3000_1tb", "Kingston KC3000 1TB NVMe PCIe 4.0", 9800, "Средний", 2022, capacity_gb=1000, interface="NVMe PCIe 4.0", speed_mbps=7000, drive_kind="nvme"),
    _pc_part("nvme_1tb_gen3", "1TB NVMe PCIe 3.0 · массовый накопитель", 6200, "Начальный", 2022, capacity_gb=1000, interface="NVMe PCIe 3.0", speed_mbps=3500, drive_kind="nvme"),
    _pc_part("990pro_2tb", "Samsung 990 PRO 2TB NVMe PCIe 4.0", 19900, "Производительный", 2023, capacity_gb=2000, interface="NVMe PCIe 4.0", speed_mbps=7450, drive_kind="nvme"),
    _pc_part("nvme_2tb_gen4", "2TB NVMe PCIe 4.0 · объёмный вариант", 14900, "Средний", 2023, capacity_gb=2000, interface="NVMe PCIe 4.0", speed_mbps=7000, drive_kind="nvme"),
    _pc_part("t705_2tb", "Crucial T705 2TB NVMe PCIe 5.0", 31500, "Флагманский", 2024, capacity_gb=2000, interface="NVMe PCIe 5.0", speed_mbps=14500, drive_kind="nvme"),
    _pc_part("sata_120", "120GB SATA SSD · бюджетный диск для старого ПК", 1100, "Вторичный рынок", 2016, capacity_gb=120, interface="SATA III", speed_mbps=500, drive_kind="sata_ssd"),
    _pc_part("nvme_256", "256GB NVMe PCIe 3.0 · начальный M.2 SSD", 2600, "Бюджетный", 2021, capacity_gb=256, interface="NVMe PCIe 3.0", speed_mbps=3000, drive_kind="nvme"),
    _pc_part("nvme_4tb_gen4", "4TB NVMe PCIe 4.0 · большой быстрый диск", 32900, "Производительный", 2024, capacity_gb=4000, interface="NVMe PCIe 4.0", speed_mbps=7400, drive_kind="nvme"),
    _pc_part("nvme_2tb_gen5", "2TB NVMe PCIe 5.0 · высокоскоростной накопитель", 37900, "Флагманский", 2024, capacity_gb=2000, interface="NVMe PCIe 5.0", speed_mbps=14000, drive_kind="nvme"),
    _pc_part("nvme_4tb_gen5", "4TB NVMe PCIe 5.0 · флагманский объём", 68900, "Флагманский", 2025, capacity_gb=4000, interface="NVMe PCIe 5.0", speed_mbps=14500, drive_kind="nvme"),
]

PC_HDDS: list[dict[str, Any]] = [
    _pc_part("hdd_none", "Без дополнительного HDD", 0, "Опционально", None, capacity_gb=0, interface="—", rpm=0),
    _pc_part("hdd_1tb", "1TB HDD 3.5″ · архив и файлы", 3900, "Бюджетный", 2021, capacity_gb=1000, interface="SATA III", rpm=7200),
    _pc_part("hdd_2tb", "2TB HDD 3.5″ · массовое хранилище", 5900, "Начальный", 2022, capacity_gb=2000, interface="SATA III", rpm=7200),
    _pc_part("hdd_4tb", "4TB HDD 3.5″ · архив больших файлов", 9900, "Средний", 2023, capacity_gb=4000, interface="SATA III", rpm=5400),
    _pc_part("hdd_500gb_used", "500GB HDD 3.5″ · старый вторичный рынок", 900, "Вторичный рынок", 2014, capacity_gb=500, interface="SATA II/III", rpm=7200),
    _pc_part("hdd_2tb_cmr", "2TB HDD CMR 3.5″ · домашний архив", 6900, "Начальный", 2023, capacity_gb=2000, interface="SATA III", rpm=7200),
    _pc_part("hdd_6tb", "6TB HDD 3.5″ · расширенный архив", 12900, "Средний", 2024, capacity_gb=6000, interface="SATA III", rpm=7200),
    _pc_part("hdd_8tb", "8TB HDD 3.5″ · большой архив / NAS начального уровня", 17900, "Производительный", 2024, capacity_gb=8000, interface="SATA III", rpm=7200),
    _pc_part("hdd_10tb", "10TB HDD 3.5″ · большой архив", 22900, "Флагманский", 2024, capacity_gb=10000, interface="SATA III", rpm=7200),
    _pc_part("hdd_12tb", "12TB HDD 3.5″ · ёмкий диск для файлового хранилища", 29900, "Флагманский", 2025, capacity_gb=12000, interface="SATA III", rpm=7200),
]

PC_PSUS: list[dict[str, Any]] = [
    _pc_part("psu_450", "450W 80+ Bronze · офисные и маломощные сборки", 3500, "Бюджетный", 2020, watts=450, efficiency="80+ Bronze", atx_version="ATX 2.x", pcie_5=False),
    _pc_part("psu_500", "500W 80+ Bronze · базовый запас", 4300, "Начальный", 2021, watts=500, efficiency="80+ Bronze", atx_version="ATX 2.x", pcie_5=False),
    _pc_part("psu_600", "MONTECH GAMMA II 600W 80+ Gold", 6200, "Начальный", 2022, watts=600, efficiency="80+ Gold", atx_version="ATX 2.x", pcie_5=False),
    _pc_part("psu_650", "650W 80+ Bronze · массовый игровой ПК", 6900, "Средний", 2022, watts=650, efficiency="80+ Bronze", atx_version="ATX 2.x", pcie_5=False),
    _pc_part("psu_750", "be quiet! Pure Power 12 M 750W 80+ Gold", 11500, "Средний", 2023, watts=750, efficiency="80+ Gold", atx_version="ATX 3.0", pcie_5=True),
    _pc_part("psu_850", "DeepCool PQ850M / PX850G 850W 80+ Gold", 12900, "Производительный", 2023, watts=850, efficiency="80+ Gold", atx_version="ATX 3.0", pcie_5=True),
    _pc_part("psu_1000", "1000W 80+ Gold ATX 3.1 · мощный GPU", 18900, "Флагманский", 2024, watts=1000, efficiency="80+ Gold", atx_version="ATX 3.1", pcie_5=True),
    _pc_part("psu_1200", "Seasonic VERTEX GX-1200W 80+ Gold ATX 3.1", 24900, "Флагманский", 2024, watts=1200, efficiency="80+ Gold", atx_version="ATX 3.1", pcie_5=True),
    _pc_part("psu_300_used", "300W 80+ · старый офисный ПК / вторичный рынок", 900, "Вторичный рынок", 2014, watts=300, efficiency="80+", atx_version="ATX 2.x", pcie_5=False),
    _pc_part("psu_400", "400W 80+ Bronze · тихая офисная система", 2900, "Бюджетный", 2019, watts=400, efficiency="80+ Bronze", atx_version="ATX 2.x", pcie_5=False),
    _pc_part("psu_550", "550W 80+ Bronze · начальная игровая видеокарта", 5100, "Начальный", 2022, watts=550, efficiency="80+ Bronze", atx_version="ATX 2.x", pcie_5=False),
    _pc_part("psu_650_gold", "650W 80+ Gold · модульный блок среднего класса", 8900, "Средний", 2023, watts=650, efficiency="80+ Gold", atx_version="ATX 3.0", pcie_5=True),
    _pc_part("psu_1600", "1600W 80+ Platinum ATX 3.1 · рабочая станция", 59900, "Флагманский", 2025, watts=1600, efficiency="80+ Platinum", atx_version="ATX 3.1", pcie_5=True),
]

PC_CASES: list[dict[str, Any]] = [
    _pc_part("used_office_case", "Обычный офисный корпус · вторичный рынок, mATX", 1500, "Вторичный рынок", 2015, drive_bays_35=1, max_gpu_mm=240, max_cooler_mm=145, supports_atx=False, supports_aio240=False, supports_aio280=False, supports_aio360=False, supported_form_factors=["mATX", "Mini-ITX"], case_size="старый mATX"),
    _pc_part("budget_mini", "Бюджетный компактный корпус mATX", 3200, "Бюджетный", 2020, drive_bays_35=1, max_gpu_mm=260, max_cooler_mm=150, supports_atx=False, supports_aio240=False, supports_aio280=False, supports_aio360=False, supported_form_factors=["mATX", "Mini-ITX"], case_size="mini tower"),
    _pc_part("compact_itx", "Компактный Mini-Tower · GPU до 285 мм", 5200, "Начальный", 2021, drive_bays_35=1, max_gpu_mm=285, max_cooler_mm=155, supports_atx=False, supports_aio240=False, supports_aio280=False, supports_aio360=False, supported_form_factors=["mATX", "Mini-ITX"], case_size="compact"),
    _pc_part("matx_mini", "ASUS Prime AP201 Mesh · компактный mATX", 8500, "Средний", 2022, drive_bays_35=1, max_gpu_mm=338, max_cooler_mm=170, supports_atx=False, supports_aio240=True, supports_aio280=True, supports_aio360=True, supported_form_factors=["mATX", "Mini-ITX"], case_size="mATX mesh"),
    _pc_part("mid_tower_budget", "Mid-Tower ATX · базовая вентиляция", 4900, "Начальный", 2021, drive_bays_35=2, max_gpu_mm=320, max_cooler_mm=160, supports_atx=True, supports_aio240=True, supports_aio280=True, supports_aio360=False, supported_form_factors=["ATX", "mATX", "Mini-ITX"], case_size="ATX mid-tower"),
    _pc_part("lancool_216", "Lian Li LANCOOL 216 Mesh RGB · ATX", 10900, "Производительный", 2023, drive_bays_35=2, max_gpu_mm=392, max_cooler_mm=180, supports_atx=True, supports_aio240=True, supports_aio280=True, supports_aio360=True, supported_form_factors=["ATX", "mATX", "Mini-ITX"], case_size="ATX airflow"),
    _pc_part("lianli_o11", "Lian Li O11 Dynamic EVO · ATX / стекло", 16900, "Производительный", 2022, drive_bays_35=2, max_gpu_mm=422, max_cooler_mm=167, supports_atx=True, supports_aio240=True, supports_aio280=True, supports_aio360=True, supported_form_factors=["ATX", "mATX", "Mini-ITX"], case_size="ATX dual-chamber"),
    _pc_part("full_tower", "Full-Tower · просторный корпус для рабочей станции", 18900, "Флагманский", 2023, drive_bays_35=3, max_gpu_mm=450, max_cooler_mm=190, supports_atx=True, supports_aio240=True, supports_aio280=True, supports_aio360=True, supported_form_factors=["E-ATX", "ATX", "mATX", "Mini-ITX"], case_size="full tower"),
    _pc_part("sff_legacy", "SFF slim · старый офисный корпус, только низкопрофильные платы", 900, "Вторичный рынок", 2012, drive_bays_35=0, max_gpu_mm=170, max_cooler_mm=70, supports_atx=False, supports_aio240=False, supports_aio280=False, supports_aio360=False, supported_form_factors=["Mini-ITX"], case_size="SFF slim"),
    _pc_part("budget_atx_legacy", "ATX mid-tower · бюджетный корпус предыдущего поколения", 2800, "Старый бюджет", 2017, drive_bays_35=2, max_gpu_mm=300, max_cooler_mm=155, supports_atx=True, supports_aio240=False, supports_aio280=False, supports_aio360=False, supported_form_factors=["ATX", "mATX", "Mini-ITX"], case_size="ATX mid-tower"),
    _pc_part("mesh_compact_2024", "Mesh mATX · компактный современный airflow-корпус", 7900, "Средний", 2024, drive_bays_35=1, max_gpu_mm=350, max_cooler_mm=170, supports_atx=False, supports_aio240=True, supports_aio280=True, supports_aio360=False, supported_form_factors=["mATX", "Mini-ITX"], case_size="mATX mesh"),
    _pc_part("airflow_atx_2025", "Airflow ATX · крупные видеокарты и три радиатора", 14900, "Производительный", 2025, drive_bays_35=2, max_gpu_mm=420, max_cooler_mm=185, supports_atx=True, supports_aio240=True, supports_aio280=True, supports_aio360=True, supported_form_factors=["ATX", "mATX", "Mini-ITX"], case_size="ATX airflow"),
    _pc_part("showcase_eatx_2025", "E-ATX showcase · флагманская рабочая станция", 25900, "Флагманский", 2025, drive_bays_35=3, max_gpu_mm=460, max_cooler_mm=195, supports_atx=True, supports_aio240=True, supports_aio280=True, supports_aio360=True, supported_form_factors=["E-ATX", "ATX", "mATX", "Mini-ITX"], case_size="E-ATX full tower"),
    _pc_part("itx_airflow_2025", "Mini-ITX airflow · компактная мощная сборка", 11900, "Производительный", 2025, drive_bays_35=1, max_gpu_mm=330, max_cooler_mm=165, supports_atx=False, supports_aio240=True, supports_aio280=False, supports_aio360=False, supported_form_factors=["Mini-ITX"], case_size="Mini-ITX tower"),
]

def get_pc_parts_catalog() -> dict[str, Any]:
    return {
        "cpus": PC_CPUS,
        "gpus": PC_GPUS,
        "motherboards": PC_MOTHERBOARDS,
        "rams": PC_RAMS,
        "coolers": PC_COOLERS,
        "ssds": PC_SSDS,
        "hdds": PC_HDDS,
        "psus": PC_PSUS,
        "cases": PC_CASES,
    }


def evaluate_pc_build(
    cpu_id: str = "i5_6500",
    gpu_id: str = "gtx_1050ti",
    mb_id: str = "h110_lga1151",
    ram_id: str = "ddr4_16_2133",
    cooler_id: str = "stock_intel",
    ssd_id: str = "sata_480",
    hdd_id: str = "hdd_none",
    psu_id: str = "psu_450",
    case_id: str = "used_office_case",
) -> dict[str, Any]:
    cpu = next((x for x in PC_CPUS if x["id"] == cpu_id), next(x for x in PC_CPUS if x["id"] == "i5_6500"))
    gpu = next((x for x in PC_GPUS if x["id"] == gpu_id), next(x for x in PC_GPUS if x["id"] == "gtx_1050ti"))
    mb = next((x for x in PC_MOTHERBOARDS if x["id"] == mb_id), next(x for x in PC_MOTHERBOARDS if x["id"] == "h110_lga1151"))
    ram = next((x for x in PC_RAMS if x["id"] == ram_id), next(x for x in PC_RAMS if x["id"] == "ddr4_16_2133"))
    cooler = next((x for x in PC_COOLERS if x["id"] == cooler_id), next(x for x in PC_COOLERS if x["id"] == "stock_intel"))
    ssd = next((x for x in PC_SSDS if x["id"] == ssd_id), next(x for x in PC_SSDS if x["id"] == "sata_480"))
    hdd = next((x for x in PC_HDDS if x["id"] == hdd_id), PC_HDDS[0])
    psu = next((x for x in PC_PSUS if x["id"] == psu_id), next(x for x in PC_PSUS if x["id"] == "psu_450"))
    case = next((x for x in PC_CASES if x["id"] == case_id), next(x for x in PC_CASES if x["id"] == "used_office_case"))

    errors: list[str] = []
    warnings: list[str] = []
    requested_parts = [
        ("CPU", cpu_id, PC_CPUS), ("GPU", gpu_id, PC_GPUS), ("материнскую плату", mb_id, PC_MOTHERBOARDS),
        ("RAM", ram_id, PC_RAMS), ("кулер", cooler_id, PC_COOLERS), ("SSD", ssd_id, PC_SSDS),
        ("HDD", hdd_id, PC_HDDS), ("БП", psu_id, PC_PSUS), ("корпус", case_id, PC_CASES),
    ]
    for label, requested_id, options in requested_parts:
        if not any(option["id"] == requested_id for option in options):
            errors.append(f"Неизвестный идентификатор детали ({label}); проверьте актуальный каталог.")

    if cpu["socket"] != mb["socket"]:
        errors.append(f"Несовместимость сокета: процессор {cpu['socket']}, а материнская плата {mb['socket']}.")
    if gpu["id"] == "gpu_none" and not cpu.get("integrated_graphics"):
        errors.append("Выбрана сборка без дискретной видеокарты, но у этого процессора нет заявленной встроенной графики.")
    if mb.get("platform_key") and cpu.get("platform_key") and mb["platform_key"] != cpu["platform_key"]:
        errors.append("Поколение/чипсет платы не заявлены как совместимые с выбранным процессором, даже если название сокета совпадает.")
    if mb["ram_type"] != ram["ram_type"]:
        errors.append(f"Несовместимость стандарта памяти: плата поддерживает {mb['ram_type']}, выбрана ОЗУ {ram['ram_type']}.")
    if ram["capacity_gb"] < 8:
        warnings.append("Менее 8 ГБ ОЗУ — минимальный объём; современные ОС и игры могут работать с ограничениями.")
    if mb.get("max_ram_mhz") and ram["speed_mhz"] > mb["max_ram_mhz"]:
        warnings.append(f"Выбранная память рассчитана на {ram['speed_mhz']} МГц, а для этой платы в каталоге указан предел {mb['max_ram_mhz']} МГц; фактическая частота может быть снижена.")
    if ram.get("kit", "").startswith("1×"):
        warnings.append("Выбран один модуль памяти: двухканальный режим обычно требует согласованного комплекта модулей и установки в правильные слоты.")
    if ssd.get("drive_kind") == "nvme" and mb.get("m2_slots") == 0:
        errors.append(f"Для NVMe SSD на плате {mb['name']} не указано место M.2; выберите SATA SSD или проверьте точную ревизию платы.")
    if hdd["capacity_gb"] and case.get("drive_bays_35", 0) < 1:
        errors.append(f"Для 3.5-дюймового HDD в корпусе {case['name']} не указано посадочное место.")
    if hdd["capacity_gb"] and mb.get("sata_ports", 0) < 1:
        errors.append(f"Для дополнительного HDD нужна свободная SATA-позиция на плате {mb['name']}.")
    if mb["form_factor"] == "ATX" and not case["supports_atx"]:
        errors.append(f"Материнская плата формата ATX не поместится в корпус ({case['name']}).")
    if case.get("supported_form_factors") and mb["form_factor"] not in case["supported_form_factors"]:
        errors.append(f"Формат платы {mb['form_factor']} не указан в списке поддерживаемых для корпуса {case['name']}.")
    if cooler.get("supported_sockets") and cpu["socket"] not in cooler["supported_sockets"]:
        errors.append(f"Для кулера {cooler['name']} не заявлено крепление на сокет {cpu['socket']}.")
    if gpu["length_mm"] > case["max_gpu_mm"]:
        errors.append(f"Видеокарта длиной {gpu['length_mm']} мм не войдёт в корпус (максимум {case['max_gpu_mm']} мм).")
    cooler_kind = cooler.get("cooler_kind", "tower")
    radiator_sizes = {"aio_240": 240, "aio_280": 280, "aio_360": 360}
    if cooler_kind in radiator_sizes:
        radiator_size = radiator_sizes[cooler_kind]
        support_key = f"supports_aio{radiator_size}"
        if case.get(support_key) is False:
            errors.append(f"Корпус {case['name']} не поддерживает установку радиатора СЖО {radiator_size} мм по карточке совместимости.")
        elif case.get(support_key) is None:
            warnings.append(f"Для корпуса {case['name']} нет данных о радиаторе СЖО {radiator_size} мм; сверьте места установки по руководству производителя.")
    elif cooler["height_mm"] > case["max_cooler_mm"]:
        errors.append(f"Башенный кулер {cooler['height_mm']} мм упрётся в крышку корпуса (лимит {case['max_cooler_mm']} мм).")
    if cooler["max_tdp_w"] < cpu["tdp_w"]:
        warnings.append(f"Теплопакет CPU ({cpu['tdp_w']} Вт) превышает паспортный отвод кулера ({cooler['max_tdp_w']} Вт) — возможен троттлинг.")

    if gpu["tdp_w"] >= 300 and not psu.get("pcie_5"):
        warnings.append("Для видеокарты такого класса проверьте требования производителя к кабелю питания и стандарту БП: в каталоге выбран более старый тип БП.")

    est_peak_draw_w = int(cpu["tdp_w"] + gpu["tdp_w"] + 75)
    recommended_psu_w = int(math.ceil((est_peak_draw_w * 1.28) / 50.0) * 50)
    if psu["watts"] < est_peak_draw_w:
        errors.append(f"Мощности БП ({psu['watts']} Вт) недостаточно для пикового потребления системы (~{est_peak_draw_w} Вт).")
    elif psu["watts"] < recommended_psu_w:
        warnings.append(f"Блок питания {psu['watts']} Вт работает с малым запасом; рекомендуется от {recommended_psu_w} Вт.")

    # Bottleneck & FPS estimation across 1080p / 1440p / 4K
    ratio = gpu["score"] / max(1.0, cpu["score"])
    bottleneck_pct = round(min(45.0, abs(ratio - 1.02) * 28.0), 1)
    bottleneck_side = "Баланс оптимален по условному индексу"
    if gpu["id"] == "gpu_none":
        bottleneck_pct = 0.0
        bottleneck_side = "Используется встроенная графика CPU; FPS-показатель особенно условен"
    elif ratio > 1.24:
        bottleneck_side = f"Условный перекос в CPU при низком разрешении (~{bottleneck_pct}%)"
    elif ratio < 0.76:
        bottleneck_side = f"Условный перекос в GPU (~{bottleneck_pct}%)"

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

    total_rub = sum(x["price_rub"] for x in (cpu, gpu, mb, ram, cooler, ssd, hdd, psu, case))
    return {
        "compatible": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "est_peak_draw_w": est_peak_draw_w,
        "recommended_psu_w": recommended_psu_w,
        "bottleneck_pct": bottleneck_pct,
        "bottleneck_verdict": bottleneck_side,
        "total_price_rub": total_rub,
        "storage_capacity_gb": int(ssd["capacity_gb"] + hdd["capacity_gb"]),
        "fps_benchmarks": fps_benchmarks,
        "performance_note": "Производительные баллы и FPS здесь — ориентировочная внутренняя модель, не результаты тестирования этих конкретных комплектующих. Реальные значения зависят от версий игры, разрешения, настроек, драйвера, охлаждения и конкретных моделей карт.",
        "price_note": "Цены — справочные ориентиры для сравнения конфигураций, а не актуальные предложения магазинов; б/у-комплектующие особенно сильно зависят от состояния и комплектации.",
        "selected": {"cpu": cpu, "gpu": gpu, "mb": mb, "ram": ram, "cooler": cooler, "ssd": ssd, "hdd": hdd, "psu": psu, "case": case},
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
    low = s.casefold().replace("ё", "е")
    if not low:
        raise ValueError("Укажите город или координаты в формате широта, долгота")
    if low in WORLD_CITIES_COORDS:
        return WORLD_CITIES_COORDS[low]

    # Permit a full country suffix or a small spelling variation, but don't let
    # short fragments such as "a" silently resolve to an unrelated city.
    normalized = low.replace("-", " ")
    candidates = [
        (key, value)
        for key, value in WORLD_CITIES_COORDS.items()
        if len(normalized) >= 4
        and (normalized in key.replace("-", " ") or key.replace("-", " ") in normalized)
    ]
    if len(candidates) == 1:
        return candidates[0][1]
    if len(candidates) > 1:
        names = ", ".join(value[2].split(",")[0] for _, value in candidates[:5])
        raise ValueError(f"Запрос «{s}» неоднозначен. Уточните название: {names}")

    # Coordinates are intentionally strict: exactly one latitude and longitude.
    parts = [part.strip() for part in s.replace(";", ",").split(",")]
    if len(parts) == 2:
        try:
            lat, lon = float(parts[0]), float(parts[1])
            if math.isfinite(lat) and math.isfinite(lon) and -90 <= lat <= 90 and -180 <= lon <= 180:
                return (lat, lon, f"{lat:.4f}°, {lon:.4f}°")
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
    supported_transport = {"car", "train", "plane", "bike", "walk"}
    if transport not in supported_transport:
        raise ValueError("Способ передвижения должен быть car, train, plane, bike или walk")
    if not math.isfinite(float(fuel_l_per_100km)) or not 0 <= float(fuel_l_per_100km) <= 100:
        raise ValueError("Расход топлива должен быть от 0 до 100 л/100 км")
    if not math.isfinite(float(fuel_price_rub)) or not 0 <= float(fuel_price_rub) <= 1000:
        raise ValueError("Цена топлива должна быть от 0 до 1000 ₽/л")

    via_points = [point.strip() for point in (via or "").split(";") if point.strip()]
    if len(via_points) > 6:
        raise ValueError("Можно добавить не более 6 промежуточных точек")
    pts = [_resolve_point(origin)]
    pts.extend(_resolve_point(point) for point in via_points)
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
    total_minutes = max(0, int(round(raw_hours * 60)))
    h_int, m_int = divmod(total_minutes, 60)

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
        "estimate_note": (
            f"Оценка без дорожного/железнодорожного роутера: прямые расстояния между точками умножены на коэффициент {tortuosity:.2f}. "
            f"Время рассчитано по усреднённой скорости {speed:g} км/ч{'; для самолёта добавлено 45 мин' if transport == 'plane' else ''}. "
            "Реальная дорога, расписание, пробки, пересадки, рельеф, границы и платные участки могут существенно изменить результат."
        ),
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
