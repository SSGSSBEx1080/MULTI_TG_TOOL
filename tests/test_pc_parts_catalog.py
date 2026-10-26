from __future__ import annotations

import pytest

from backend.tools.mega_expansion_v6_hubs import evaluate_pc_build, get_pc_parts_catalog


EXPECTED_MINIMUMS = {
    "cpus": 32,
    "gpus": 26,
    "motherboards": 21,
    "rams": 16,
    "coolers": 12,
    "ssds": 14,
    "hdds": 10,
    "psus": 13,
    "cases": 14,
}
EXPECTED_SEGMENTS = {"legacy", "budget", "mainstream", "premium"}


def test_every_pc_category_covers_price_and_generation_ranges() -> None:
    catalog = get_pc_parts_catalog()

    assert set(catalog) == set(EXPECTED_MINIMUMS)
    for category, minimum in EXPECTED_MINIMUMS.items():
        parts = catalog[category]
        assert len(parts) >= minimum, f"{category} should retain its legacy, entry and current options"
        ids = [part["id"] for part in parts]
        assert len(ids) == len(set(ids)), f"{category} contains duplicate IDs"
        assert EXPECTED_SEGMENTS <= {part["segment"] for part in parts}, f"{category} is missing a segment"
        assert all(part["price_rub"] >= 0 for part in parts)
        assert all(part["name"] and part["tier"] for part in parts)


def test_legacy_platform_options_are_really_compatible() -> None:
    result = evaluate_pc_build(
        cpu_id="i5_3570k",
        gpu_id="gtx_1050ti",
        mb_id="h61_lga1155",
        ram_id="ddr3_16_1600",
        cooler_id="stock_lga1155",
        ssd_id="sata_480",
        hdd_id="hdd_none",
        psu_id="psu_450",
        case_id="mid_tower_budget",
    )

    assert result["compatible"] is True, result["errors"]
    assert not result["errors"]


def test_aio_280_uses_radiator_support_not_air_cooler_height() -> None:
    result = evaluate_pc_build(
        cpu_id="r5_7600",
        gpu_id="gpu_none",
        mb_id="b650m",
        ram_id="ddr5_32_5600",
        cooler_id="aio_280",
        ssd_id="nvme_1tb_gen3",
        hdd_id="hdd_none",
        psu_id="psu_500",
        case_id="budget_mini",
    )

    assert any("280 мм" in error and "радиатор" in error for error in result["errors"])
    assert not any("кулер 60 мм упрётся" in error for error in result["errors"])


def test_compatible_case_accepts_aio_280_without_false_height_error() -> None:
    result = evaluate_pc_build(
        cpu_id="r5_7600",
        gpu_id="gpu_none",
        mb_id="b650m",
        ram_id="ddr5_32_5600",
        cooler_id="aio_280",
        ssd_id="nvme_1tb_gen3",
        hdd_id="hdd_none",
        psu_id="psu_500",
        case_id="matx_mini",
    )

    assert not any("радиатора СЖО 280 мм" in error for error in result["errors"])
    assert not any("кулер 60 мм упрётся" in error for error in result["errors"])


@pytest.mark.parametrize(
    "parts",
    [
        ("r5_5600g", "gpu_none", "b550_tuf", "ddr4_16_3200", "stock_am4", "sata_480", "hdd_1tb", "psu_450", "budget_mini"),
        ("i5_6500", "gtx_1050ti", "h110_lga1151", "ddr4_16_2133", "stock_intel", "sata_480", "hdd_none", "psu_450", "used_office_case"),
        ("r5_5600", "rx_6600", "b550_tuf", "ddr4_32_3200", "ag400", "nvme_500", "hdd_2tb", "psu_600", "budget_mini"),
        ("r5_7500f", "rx_7600", "b650m", "ddr5_32_5600", "ak400", "nvme_1tb_gen3", "hdd_none", "psu_650", "mid_tower_budget"),
        ("r7_7800x3d", "rx_7800xt", "b650_aorus", "ddr5_32_6000", "ak620", "nvme_2tb_gen4", "hdd_2tb", "psu_750", "lancool_216"),
        ("r7_9800x3d", "rtx_5090", "x870e_tomahawk", "ddr5_64_6000", "aio_360", "t705_2tb", "hdd_4tb", "psu_1200", "full_tower"),
    ],
    ids=["office-apu", "legacy", "budget-1080p", "mainstream", "performance", "flagship"],
)
def test_existing_build_presets_remain_compatible(parts: tuple[str, ...]) -> None:
    result = evaluate_pc_build(*parts)
    assert result["compatible"] is True, result["errors"]
    assert not result["errors"]


@pytest.mark.parametrize("category", EXPECTED_MINIMUMS)
def test_all_catalog_items_have_shared_segment_metadata(category: str) -> None:
    parts = get_pc_parts_catalog()[category]
    assert all(part.get("segment") in {"legacy", "budget", "mainstream", "premium", "optional"} for part in parts)
