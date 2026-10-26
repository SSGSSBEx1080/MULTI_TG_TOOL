from __future__ import annotations

import pytest

from backend.tools.mega_expansion_v6_hubs import PC_MOTHERBOARDS, PC_PSUS, evaluate_pc_build, get_pc_parts_catalog


EXPECTED_MINIMUMS = {
    "cpus": 36, "gpus": 31, "motherboards": 33, "rams": 18, "coolers": 13,
    "ssds": 14, "hdds": 10, "psus": 15, "cases": 14, "case_fans": 5,
    "wifi_adapters": 5, "monitors": 7, "keyboards": 5, "mice": 5, "thermal_pastes": 4,
}
CORE_COMPONENT_CATEGORIES = {"cpus", "gpus", "motherboards", "rams", "coolers", "ssds", "hdds", "psus", "cases"}
EXPECTED_SEGMENTS = {"legacy", "budget", "mainstream", "premium"}


def test_every_catalog_category_has_unique_complete_records() -> None:
    catalog = get_pc_parts_catalog()
    assert set(catalog) == set(EXPECTED_MINIMUMS)

    for category, minimum in EXPECTED_MINIMUMS.items():
        parts = catalog[category]
        assert len(parts) >= minimum, f"{category} should retain the expected range of options"
        ids = [part["id"] for part in parts]
        assert len(ids) == len(set(ids)), f"{category} contains duplicate IDs"
        if category in CORE_COMPONENT_CATEGORIES:
            assert EXPECTED_SEGMENTS <= {part["segment"] for part in parts}, f"{category} is missing a price/age segment"
        assert all(part["price_rub"] >= 0 and part["name"] and part["tier"] for part in parts)
        assert all(part.get("segment") in {"legacy", "budget", "mainstream", "premium", "optional"} for part in parts)


def test_2026_cpu_and_gpu_records_include_official_source_and_power_data() -> None:
    catalog = get_pc_parts_catalog()
    cpus = {part["id"]: part for part in catalog["cpus"]}
    gpus = {part["id"]: part for part in catalog["gpus"]}

    for cpu_id in ("r7_9850x3d", "r9_9950x3d2", "u7_270k_plus", "u5_250k_plus"):
        assert cpus[cpu_id]["release_year"] == 2026
        assert cpus[cpu_id]["source_url"].startswith("https://")
    for gpu_id in ("rtx_5060ti_16", "rtx_5060ti_8", "rtx_5060", "rx_9070", "rx_9070_gre"):
        assert gpus[gpu_id]["source_url"].startswith("https://")
        assert gpus[gpu_id]["recommended_psu_w"] > 0
        assert gpus[gpu_id]["power_connectors"]


def test_legacy_platform_options_are_really_compatible() -> None:
    result = evaluate_pc_build(
        cpu_id="i5_3570k", gpu_id="gtx_1050ti", mb_id="h61_lga1155",
        ram_id="ddr3_16_1600", cooler_id="stock_lga1155", ssd_id="sata_480",
        hdd_id="hdd_none", psu_id="psu_450", case_id="mid_tower_budget",
    )
    assert result["compatible"] is True, result["errors"]
    assert not result["errors"]


def test_aio_280_uses_radiator_support_not_air_cooler_height() -> None:
    result = evaluate_pc_build(
        cpu_id="r5_7600", gpu_id="gpu_none", mb_id="b650m", ram_id="ddr5_32_5600",
        cooler_id="aio_280", ssd_id="nvme_1tb_gen3", hdd_id="hdd_none",
        psu_id="psu_500", case_id="budget_mini",
    )
    assert any("280 мм" in error and "радиатор" in error for error in result["errors"])
    assert not any("кулер 60 мм упрётся" in error for error in result["errors"])


def test_aio_280_fits_case_that_lists_support() -> None:
    result = evaluate_pc_build(
        cpu_id="r5_7600", gpu_id="gpu_none", mb_id="b650m", ram_id="ddr5_32_5600",
        cooler_id="aio_280", ssd_id="nvme_1tb_gen3", hdd_id="hdd_none",
        psu_id="psu_500", case_id="matx_mini",
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


@pytest.mark.parametrize(
    "parts",
    [
        ("u5_250k_plus", "rtx_5060", "b860_d5", "ddr5_32_5600", "ak400", "nvme_1tb_gen3", "hdd_none", "psu_650_gold", "mid_tower_budget"),
        ("r7_9850x3d", "rx_9070", "b850_atx", "ddr5_32_6000", "aio_240", "nvme_2tb_gen4", "hdd_none", "psu_850", "lancool_216"),
        ("r9_9950x3d2", "rx_9070_gre", "x870e_tomahawk", "ddr5_128_5600", "aio_360", "nvme_4tb_gen4", "hdd_8tb", "psu_1000", "full_tower"),
    ],
    ids=["2026-value", "2026-gaming", "2026-workstation"],
)
def test_current_generation_platform_combinations_are_compatible(parts: tuple[str, ...]) -> None:
    result = evaluate_pc_build(*parts)
    assert result["compatible"] is True, result["errors"]
    assert not result["errors"]


def test_memory_capacity_and_dimm_limit_are_checked() -> None:
    result = evaluate_pc_build(
        cpu_id="i5_6500", gpu_id="gtx_1050ti", mb_id="h110_lga1151", ram_id="ddr4_64_3200",
        cooler_id="stock_intel", ssd_id="sata_480", hdd_id="hdd_none", psu_id="psu_450", case_id="used_office_case",
    )
    assert any("превышает заявленный предел платы" in error for error in result["errors"])


def test_cpu_memory_controller_limit_is_combined_with_board_limit() -> None:
    result = evaluate_pc_build(
        cpu_id="r7_9850x3d", gpu_id="gpu_none", mb_id="b850_atx", ram_id="ddr5_32_6000",
        cooler_id="aio_240", ssd_id="nvme_1tb_gen3", hdd_id="hdd_none", psu_id="psu_750", case_id="lancool_216",
    )
    assert any("контроллера памяти CPU" in warning and "5600 MT/s" in warning for warning in result["warnings"])


def test_sata_ssd_and_hdd_are_counted_against_combined_port_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    motherboard = next(part for part in PC_MOTHERBOARDS if part["id"] == "h110_lga1151")
    monkeypatch.setitem(motherboard, "sata_ports", 1)
    result = evaluate_pc_build(
        cpu_id="i5_6500", gpu_id="gtx_1050ti", mb_id="h110_lga1151", ram_id="ddr4_16_2133",
        cooler_id="stock_intel", ssd_id="sata_480", hdd_id="hdd_1tb", psu_id="psu_450", case_id="used_office_case",
    )
    assert any("нужно 2 порта" in error for error in result["errors"])


def test_older_board_emits_bios_support_caveat_for_newer_cpu() -> None:
    result = evaluate_pc_build(
        cpu_id="r7_5700x3d", gpu_id="gpu_none", mb_id="b450m", ram_id="ddr4_32_3200",
        cooler_id="ag400", ssd_id="nvme_500", hdd_id="hdd_none", psu_id="psu_600", case_id="budget_mini",
    )
    assert any("BIOS" in warning and "CPU support list" in warning for warning in result["warnings"])


def test_estimated_partner_gpu_dimensions_do_not_create_false_hard_fit_error() -> None:
    result = evaluate_pc_build(
        cpu_id="i5_6500", gpu_id="rtx_5060", mb_id="h110_lga1151", ram_id="ddr4_16_2133",
        cooler_id="stock_intel", ssd_id="sata_480", hdd_id="hdd_none", psu_id="psu_450", case_id="used_office_case",
    )
    assert not any("превышает лимит корпуса" in error for error in result["errors"])
    assert any("длина дана как типичный ориентир" in warning.lower() for warning in result["warnings"])


def test_wifi_adapter_warns_if_board_already_has_wireless() -> None:
    result = evaluate_pc_build(
        cpu_id="r5_7500f", gpu_id="rx_7600", mb_id="b650_aorus", ram_id="ddr5_32_5600",
        cooler_id="ak400", ssd_id="nvme_1tb_gen3", hdd_id="hdd_none", psu_id="psu_650", case_id="mid_tower_budget",
        wifi_adapter_id="wifi6e_pcie",
    )
    assert any("уже указана встроенная Wi-Fi" in warning for warning in result["warnings"])


def test_optional_workspace_gear_is_priced_and_returned_without_affecting_default_build() -> None:
    default = evaluate_pc_build()
    equipped = evaluate_pc_build(monitor_id="monitor_27_qhd_165", keyboard_id="keyboard_tkl_mech", mouse_id="mouse_wireless_gaming")

    assert default["optional_equipment_price_rub"] == 0
    assert default["selected"]["monitor"]["id"] == "monitor_none"
    assert equipped["optional_equipment_price_rub"] == 27900 + 7900 + 8900
    assert equipped["total_price_rub"] - default["total_price_rub"] == equipped["optional_equipment_price_rub"]


def test_case_fan_pack_is_checked_against_available_mounts() -> None:
    result = evaluate_pc_build(case_id="sff_legacy", case_fans_id="fan_120_triple")
    assert any("дополнительных мест под вентиляторы" in error for error in result["errors"])


def test_mini_itx_build_has_matching_board_and_sfx_power_supply() -> None:
    result = evaluate_pc_build(
        cpu_id="r5_7600", gpu_id="gpu_none", mb_id="b650i_am5", ram_id="ddr5_32_5600",
        cooler_id="low_profile_92", ssd_id="sata_480", hdd_id="hdd_none",
        psu_id="psu_sfx_750", case_id="sff_legacy",
    )
    assert result["compatible"] is True, result["errors"]
    assert result["selected"]["psu"]["form_factor"] == "SFX"


def test_eatx_workstation_board_fits_only_large_case() -> None:
    result = evaluate_pc_build(
        cpu_id="r9_9950x3d2", gpu_id="rx_9070", mb_id="x870e_eatx_am5", ram_id="ddr5_128_5600",
        cooler_id="aio_360", ssd_id="nvme_4tb_gen4", hdd_id="hdd_8tb",
        psu_id="psu_1000", case_id="showcase_eatx_2025",
    )
    assert result["compatible"] is True, result["errors"]


def test_gpu_vendor_power_floor_is_included_in_recommendation() -> None:
    result = evaluate_pc_build(
        cpu_id="i5_6500", gpu_id="rtx_5060", mb_id="h110_lga1151", ram_id="ddr4_16_2133",
        cooler_id="stock_intel", ssd_id="sata_480", hdd_id="hdd_none", psu_id="psu_500", case_id="budget_mini",
    )
    assert result["recommended_psu_w"] >= 550
    assert any("рекомендуется от 550 Вт" in warning for warning in result["warnings"])


def test_native_16_pin_only_substitutes_for_gpus_that_accept_it(monkeypatch) -> None:
    psu = next(part for part in PC_PSUS if part["id"] == "psu_650_gold")
    monkeypatch.setitem(psu, "pcie_8pin_count", 0)
    monkeypatch.setitem(psu, "native_12v_2x6", True)
    amd_result = evaluate_pc_build(gpu_id="rx_9070", psu_id="psu_650_gold")
    nvidia_result = evaluate_pc_build(gpu_id="rtx_5060", psu_id="psu_650_gold")
    assert any("разъёмов PCIe 8-pin" in error for error in amd_result["errors"])
    assert not any("разъёмов PCIe 8-pin" in error for error in nvidia_result["errors"])
