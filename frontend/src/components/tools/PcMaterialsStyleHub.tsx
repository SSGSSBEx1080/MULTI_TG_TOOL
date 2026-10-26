import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Car,
  CheckCircle2,
  Copy,
  Cpu,
  Download,
  FileSpreadsheet,
  Layers,
  MapPin,
  Palette,
  Search,
  Sparkles,
  Upload,
  Wrench,
} from 'lucide-react';
import { apiGet, apiPost, copyText } from '../../lib/api';

import { CarComparison3D, Mini3DSceneBadge, PcBuilderShowcase3D, RouteGlobe3D } from '../three/Interactive3DScenes';

const PC_SAVED_BUILDS_KEY = 'multi-tg-tool.pc-saved-builds.v1';
const PC_SAVED_BUILDS_LIMIT = 12;
const PC_BUILD_PART_KEYS = ['cpu', 'gpu', 'mb', 'ram', 'cooler', 'ssd', 'hdd', 'psu', 'case'] as const;
type PcBuildPartKey = (typeof PC_BUILD_PART_KEYS)[number];
type PcBuildParts = Record<PcBuildPartKey, string>;
type SavedPcBuild = {
  id: string;
  name: string;
  parts: PcBuildParts;
  createdAt: string;
  updatedAt: string;
  snapshotPriceRub: number | null;
};
type PcComparison = {
  left: any;
  right: any;
  price_delta_rub: number;
  cheaper_side: 'left' | 'right' | 'equal';
  note: string;
};

const PC_PART_CATALOG_KEYS: Record<PcBuildPartKey, string> = {
  cpu: 'cpus', gpu: 'gpus', mb: 'motherboards', ram: 'rams', cooler: 'coolers',
  ssd: 'ssds', hdd: 'hdds', psu: 'psus', case: 'cases',
};

const PC_SEGMENT_FILTERS = [
  { id: 'all', label: 'Все', description: 'Полный каталог' },
  { id: 'legacy', label: 'Старые / б/у', description: 'Старые поколения и вторичный рынок' },
  { id: 'budget', label: 'Бюджет', description: 'Доступные и начальные варианты' },
  { id: 'mainstream', label: 'Средний класс', description: 'Сбалансированные массовые модели' },
  { id: 'premium', label: 'Дорогие / новые', description: 'Производительные и флагманские' },
  { id: 'optional', label: 'Опционально', description: 'Необязательные позиции' },
] as const;

const isPcBuildParts = (value: unknown): value is PcBuildParts => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return PC_BUILD_PART_KEYS.every((key) => typeof candidate[key] === 'string' && candidate[key].length > 0);
};

const normalizeSavedPcBuild = (value: unknown): SavedPcBuild | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const name = typeof candidate.name === 'string' ? candidate.name.trim().slice(0, 60) : '';
  const parts = candidate.parts;
  if (!name || !isPcBuildParts(parts)) return null;
  const createdAt = typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date().toISOString();
  const updatedAt = typeof candidate.updatedAt === 'string' ? candidate.updatedAt : createdAt;
  const id = typeof candidate.id === 'string' && candidate.id ? candidate.id : `pc-${Date.now().toString(36)}`;
  const price = candidate.snapshotPriceRub === null || candidate.snapshotPriceRub === undefined
    ? Number.NaN
    : Number(candidate.snapshotPriceRub);
  return {
    id,
    name,
    parts: Object.fromEntries(PC_BUILD_PART_KEYS.map((key) => [key, parts[key]])) as PcBuildParts,
    createdAt,
    updatedAt,
    snapshotPriceRub: Number.isFinite(price) && price >= 0 ? price : null,
  };
};

const readSavedPcBuilds = (): SavedPcBuild[] => {
  try {
    const raw = window.localStorage.getItem(PC_SAVED_BUILDS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeSavedPcBuild).filter((item): item is SavedPcBuild => item !== null).slice(0, PC_SAVED_BUILDS_LIMIT);
  } catch {
    return [];
  }
};

const makePcBuildId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `pc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
};

const PC_BUILD_PRESETS = [
  { id: 'office-apu', name: 'Офис / апгрейд', note: 'Вторичный рынок · встроенная графика', parts: { cpu: 'r5_5600g', gpu: 'gpu_none', mb: 'b550_tuf', ram: 'ddr4_16_3200', cooler: 'stock_am4', ssd: 'sata_480', hdd: 'hdd_1tb', psu: 'psu_450', case: 'budget_mini' } },
  { id: 'legacy-entry', name: 'Старый игровой ПК', note: 'Недорогая 1080p-сборка / б/у', parts: { cpu: 'i5_6500', gpu: 'gtx_1050ti', mb: 'h110_lga1151', ram: 'ddr4_16_2133', cooler: 'stock_intel', ssd: 'sata_480', hdd: 'hdd_none', psu: 'psu_450', case: 'used_office_case' } },
  { id: 'budget-1080p', name: 'Доступный 1080p', note: 'Современный массовый AM4', parts: { cpu: 'r5_5600', gpu: 'rx_6600', mb: 'b550_tuf', ram: 'ddr4_32_3200', cooler: 'ag400', ssd: 'nvme_500', hdd: 'hdd_2tb', psu: 'psu_600', case: 'budget_mini' } },
  { id: 'mainstream', name: 'Сбалансированный', note: 'AM5 · средний класс', parts: { cpu: 'r5_7500f', gpu: 'rx_7600', mb: 'b650m', ram: 'ddr5_32_5600', cooler: 'ak400', ssd: 'nvme_1tb_gen3', hdd: 'hdd_none', psu: 'psu_650', case: 'mid_tower_budget' } },
  { id: 'performance', name: 'Высокая производительность', note: '1440p-класс · больше памяти и диска', parts: { cpu: 'r7_7800x3d', gpu: 'rx_7800xt', mb: 'b650_aorus', ram: 'ddr5_32_6000', cooler: 'ak620', ssd: 'nvme_2tb_gen4', hdd: 'hdd_2tb', psu: 'psu_750', case: 'lancool_216' } },
  { id: 'flagship', name: 'Флагманская', note: 'Максимальный класс · большая цена и мощность', parts: { cpu: 'r7_9800x3d', gpu: 'rtx_5090', mb: 'x870e_tomahawk', ram: 'ddr5_64_6000', cooler: 'aio_360', ssd: 't705_2tb', hdd: 'hdd_4tb', psu: 'psu_1200', case: 'full_tower' } },
  { id: 'ivy-bridge-rebuild', name: 'Ретро-апгрейд LGA1155', note: 'Недорогая система DDR3 · корпус с запасом по охлаждению', parts: { cpu: 'i5_3570k', gpu: 'gtx_1050ti', mb: 'h61_lga1155', ram: 'ddr3_16_1600', cooler: 'stock_lga1155', ssd: 'sata_480', hdd: 'hdd_none', psu: 'psu_450', case: 'mid_tower_budget' } },
  { id: 'am5-budget', name: 'Доступный вход на AM5', note: 'Свежая платформа с DDR5 и видеокартой среднего уровня', parts: { cpu: 'r5_7500f', gpu: 'rx_9060xt_16', mb: 'a620m_am5', ram: 'ddr5_32_5600', cooler: 'tower_120_budget', ssd: 'nvme_1tb_gen3', hdd: 'hdd_none', psu: 'psu_650_gold', case: 'airflow_atx_2025' } },
  { id: 'new-mainstream-1440p', name: 'Новое поколение · 1440p', note: 'Современная видеокарта, быстрый SSD и резерв мощности', parts: { cpu: 'r5_9600x', gpu: 'rtx_5070', mb: 'b850m_am5', ram: 'ddr5_32_6000', cooler: 'ak620', ssd: 'nvme_2tb_gen4', hdd: 'hdd_none', psu: 'psu_750', case: 'airflow_atx_2025' } },
] as const;

// ============================================================================
// 1. PC BUILDER + ENGINEERING MATERIALS + OUTFIT STYLES & LOOKSMAXXING HUB
// ============================================================================

export const PcMaterialsStyleHub: React.FC<{
  activeTool: string;
  onSelectTool: (t: string) => void;
  onSync: () => void;
  onToast: (msg: string) => void;
}> = ({ activeTool, onSelectTool, onSync, onToast }) => {
  const tab =
    activeTool === 'materials_fasteners_encyc'
      ? 'materials'
      : activeTool === 'outfit_looksmax_hub'
      ? 'style'
      : 'pc';

  // PC Builder State
  const [catalog, setCatalog] = useState<any>(null);
  const [catalogError, setCatalogError] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [partSearch, setPartSearch] = useState('');
  const [pcSegmentFilter, setPcSegmentFilter] = useState<(typeof PC_SEGMENT_FILTERS)[number]['id']>('all');
  const [cpuId, setCpuId] = useState('i5_6500');
  const [gpuId, setGpuId] = useState('gtx_1050ti');
  const [mbId, setMbId] = useState('h110_lga1151');
  const [ramId, setRamId] = useState('ddr4_16_2133');
  const [coolerId, setCoolerId] = useState('stock_intel');
  const [ssdId, setSsdId] = useState('sata_480');
  const [hddId, setHddId] = useState('hdd_none');
  const [psuId, setPsuId] = useState('psu_450');
  const [caseId, setCaseId] = useState('used_office_case');
  const [evalRes, setEvalRes] = useState<any>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalError, setEvalError] = useState('');
  const evalRequestId = useRef(0);
  const [savedPcBuilds, setSavedPcBuilds] = useState<SavedPcBuild[]>(readSavedPcBuilds);
  const [savedBuildName, setSavedBuildName] = useState('');
  const [compareLeftId, setCompareLeftId] = useState('');
  const [compareRightId, setCompareRightId] = useState('');
  const [pcComparison, setPcComparison] = useState<PcComparison | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const importBuildInputRef = useRef<HTMLInputElement>(null);
  const compareRequestId = useRef(0);

  useEffect(() => {
    const first = savedPcBuilds[0];
    if (!first) {
      setCompareLeftId('');
      setCompareRightId('');
      return;
    }
    const leftId = savedPcBuilds.some((build) => build.id === compareLeftId) ? compareLeftId : first.id;
    const rightIsValid = savedPcBuilds.some((build) => build.id === compareRightId && build.id !== leftId);
    setCompareLeftId(leftId);
    setCompareRightId(rightIsValid ? compareRightId : savedPcBuilds.find((build) => build.id !== leftId)?.id || '');
  }, [savedPcBuilds, compareLeftId, compareRightId]);

  // Materials State
  const [matData, setMatData] = useState<any>(null);
  const [matLoading, setMatLoading] = useState(false);
  const [matError, setMatError] = useState('');
  const [matRetry, setMatRetry] = useState(0);
  const [matSec, setMatSec] = useState<'fasteners' | 'metals' | 'plastics' | 'glass'>('fasteners');

  // Style & Looksmax State
  const [styleData, setStyleData] = useState<any>({ outfits: [], looksmaxxing: [] });
  const [styleLoaded, setStyleLoaded] = useState(false);
  const [styleLoading, setStyleLoading] = useState(false);
  const [styleError, setStyleError] = useState('');
  const [styleRetry, setStyleRetry] = useState(0);


  useEffect(() => {
    let current = true;
    setCatalogLoading(true);
    setCatalogError('');
    apiGet('/api/v6/pc/catalog')
      .then((data) => { if (current) setCatalog(data); })
      .catch((error: any) => { if (current) setCatalogError(error?.message || 'Не удалось загрузить каталог деталей ПК'); })
      .finally(() => { if (current) setCatalogLoading(false); });
    return () => { current = false; };
  }, [catalogRetry]);

  useEffect(() => {
    if (tab !== 'pc' || !catalog) return;
    const id = ++evalRequestId.current;
    setEvalLoading(true);
    setEvalError('');
    setEvalRes(null);
    apiPost('/api/v6/pc/evaluate', {
      cpu_id: cpuId,
      gpu_id: gpuId,
      mb_id: mbId,
      ram_id: ramId,
      cooler_id: coolerId,
      ssd_id: ssdId,
      hdd_id: hddId,
      psu_id: psuId,
      case_id: caseId,
    })
      .then((r) => {
        if (id !== evalRequestId.current) return;
        setEvalRes(r);
        onSync();
      })
      .catch((error: any) => {
        if (id === evalRequestId.current) setEvalError(error?.message || 'Не удалось проверить совместимость');
      })
      .finally(() => { if (id === evalRequestId.current) setEvalLoading(false); });
    return () => { evalRequestId.current += 1; };
  }, [tab, catalog, cpuId, gpuId, mbId, ramId, coolerId, ssdId, hddId, psuId, caseId]);

  useEffect(() => {
    if (tab !== 'materials' || matData) return;
    let current = true;
    setMatLoading(true); setMatError('');
    apiGet('/api/v6/materials/catalog')
      .then((data) => { if (current) setMatData(data); })
      .catch((error: any) => { if (current) setMatError(error?.message || 'Не удалось загрузить справочник материалов'); })
      .finally(() => { if (current) setMatLoading(false); });
    return () => { current = false; };
  }, [tab, matData, matRetry]);

  useEffect(() => {
    if (tab !== 'style' || styleLoaded) return;
    let current = true;
    setStyleLoading(true); setStyleError('');
    apiGet('/api/v6/style/looksmax')
      .then((data) => { if (current) { setStyleData({ outfits: data?.outfits || [], looksmaxxing: data?.looksmaxxing || [] }); setStyleLoaded(true); } })
      .catch((error: any) => { if (current) setStyleError(error?.message || 'Не удалось загрузить справочник стилей'); })
      .finally(() => { if (current) setStyleLoading(false); });
    return () => { current = false; };
  }, [tab, styleLoaded, styleRetry]);

  const applyPcPreset = (preset: (typeof PC_BUILD_PRESETS)[number]) => {
    setCpuId(preset.parts.cpu); setGpuId(preset.parts.gpu); setMbId(preset.parts.mb);
    setRamId(preset.parts.ram); setCoolerId(preset.parts.cooler); setSsdId(preset.parts.ssd);
    setHddId(preset.parts.hdd); setPsuId(preset.parts.psu); setCaseId(preset.parts.case);
    onToast(`Загружен пресет «${preset.name}»; детали можно менять по отдельности.`);
  };

  const estimatePresetPrice = (preset: (typeof PC_BUILD_PRESETS)[number]) => {
    if (!catalog) return 0;
    return Object.entries(preset.parts).reduce((sum, [part, id]) => {
      const item = catalog[PC_PART_CATALOG_KEYS[part as PcBuildPartKey]]?.find((candidate: any) => candidate.id === id);
      return sum + (Number(item?.price_rub) || 0);
    }, 0);
  };

  const currentPcParts = (): PcBuildParts => ({
    cpu: cpuId, gpu: gpuId, mb: mbId, ram: ramId, cooler: coolerId,
    ssd: ssdId, hdd: hddId, psu: psuId, case: caseId,
  });

  const persistSavedPcBuilds = (next: SavedPcBuild[]) => {
    try {
      window.localStorage.setItem(PC_SAVED_BUILDS_KEY, JSON.stringify(next));
      compareRequestId.current += 1;
      setCompareLoading(false);
      setPcComparison(null);
      setCompareError('');
      setSavedPcBuilds(next);
      return true;
    } catch {
      onToast('Не удалось сохранить сборки в браузере. Проверьте свободное место и настройки хранилища.');
      return false;
    }
  };

  const missingPartsForBuild = (parts: PcBuildParts) => PC_BUILD_PART_KEYS.filter((key) =>
    !catalog?.[PC_PART_CATALOG_KEYS[key]]?.some((item: any) => item.id === parts[key]),
  );

  const applySavedPcBuild = (build: SavedPcBuild) => {
    const missing = missingPartsForBuild(build.parts);
    if (missing.length) {
      onToast(`Сборка «${build.name}» содержит детали, отсутствующие в текущем каталоге: ${missing.join(', ')}.`);
      return;
    }
    setCpuId(build.parts.cpu); setGpuId(build.parts.gpu); setMbId(build.parts.mb);
    setRamId(build.parts.ram); setCoolerId(build.parts.cooler); setSsdId(build.parts.ssd);
    setHddId(build.parts.hdd); setPsuId(build.parts.psu); setCaseId(build.parts.case);
    onToast(`Загружена сохранённая сборка «${build.name}».`);
  };

  const saveCurrentPcBuild = () => {
    const name = savedBuildName.trim().slice(0, 60);
    if (!name) {
      onToast('Укажите название сборки перед сохранением.');
      return;
    }
    const now = new Date().toISOString();
    const existing = savedPcBuilds.find((build) => build.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (!existing && savedPcBuilds.length >= PC_SAVED_BUILDS_LIMIT) {
      onToast(`Можно хранить не более ${PC_SAVED_BUILDS_LIMIT} сборок. Удалите старую или экспортируйте резервную копию.`);
      return;
    }
    const saved: SavedPcBuild = {
      id: existing?.id || makePcBuildId(),
      name,
      parts: currentPcParts(),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      snapshotPriceRub: Number.isFinite(Number(evalRes?.total_price_rub)) ? Number(evalRes.total_price_rub) : null,
    };
    const next = existing
      ? savedPcBuilds.map((build) => build.id === existing.id ? saved : build)
      : [saved, ...savedPcBuilds];
    if (persistSavedPcBuilds(next)) {
      setSavedBuildName('');
      if (!existing && savedPcBuilds.length === 0) setCompareLeftId(saved.id);
      if (!existing && savedPcBuilds.length === 1) setCompareRightId(saved.id);
      onToast(existing ? `Сборка «${name}» обновлена.` : `Сборка «${name}» сохранена на этом устройстве.`);
    }
  };

  const removeSavedPcBuild = (build: SavedPcBuild) => {
    const next = savedPcBuilds.filter((item) => item.id !== build.id);
    if (!persistSavedPcBuilds(next)) return;
    if (compareLeftId === build.id) setCompareLeftId(next[0]?.id || '');
    if (compareRightId === build.id) setCompareRightId(next[1]?.id || '');
    setPcComparison(null);
    onToast(`Сборка «${build.name}» удалена.`);
  };

  const downloadPcJson = (filename: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportSavedPcBuild = (build: SavedPcBuild) => {
    downloadPcJson(`pc-build-${build.name.trim().replace(/[^\p{L}\p{N}-]+/gu, '-').slice(0, 40) || 'saved'}.json`, {
      schema_version: 1,
      kind: 'multi-tg-pc-build',
      name: build.name,
      parts: build.parts,
      exported_at: new Date().toISOString(),
    });
  };

  const exportAllSavedPcBuilds = () => {
    if (!savedPcBuilds.length) {
      onToast('Сначала сохраните хотя бы одну сборку.');
      return;
    }
    downloadPcJson('multi-tg-pc-builds-backup.json', {
      schema_version: 1,
      kind: 'multi-tg-pc-builds',
      exported_at: new Date().toISOString(),
      builds: savedPcBuilds.map(({ name, parts, snapshotPriceRub }) => ({ name, parts, snapshotPriceRub })),
    });
  };

  const importSavedPcBuilds = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 64 * 1024) {
      onToast('Файл резервной копии слишком большой: максимум 64 КБ.');
      return;
    }
    setImportLoading(true);
    try {
      const payload: unknown = JSON.parse(await file.text());
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Неверный формат JSON.');
      const data = payload as Record<string, unknown>;
      if (data.schema_version !== 1) throw new Error('Поддерживается только резервная копия версии 1.');
      const candidates = data.kind === 'multi-tg-pc-builds'
        ? data.builds
        : data.kind === 'multi-tg-pc-build' ? [data] : null;
      if (!Array.isArray(candidates) || candidates.length === 0 || candidates.length > PC_SAVED_BUILDS_LIMIT) {
        throw new Error('В файле нет сборок или их количество превышает лимит.');
      }
      const imported = candidates.map((candidate) => {
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
        const item = candidate as Record<string, unknown>;
        if (!isPcBuildParts(item.parts) || typeof item.name !== 'string' || !item.name.trim()) return null;
        return normalizeSavedPcBuild({ ...item, id: makePcBuildId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      });
      if (imported.some((item) => item === null)) throw new Error('Одна или несколько сборок имеют неполные данные.');
      const validBuilds = imported as SavedPcBuild[];
      const missing = validBuilds.flatMap((build) => missingPartsForBuild(build.parts));
      if (missing.length) throw new Error(`Каталог не содержит некоторые детали: ${Array.from(new Set(missing)).join(', ')}.`);
      const merged = [...savedPcBuilds];
      for (const build of validBuilds) {
        const baseName = build.name.slice(0, 54);
        let name = baseName;
        let suffix = 2;
        while (merged.some((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
          name = `${baseName.slice(0, 54 - String(suffix).length)} (${suffix})`;
          suffix += 1;
        }
        merged.push({ ...build, name });
      }
      if (merged.length > PC_SAVED_BUILDS_LIMIT) {
        throw new Error(`Импорт превысит лимит ${PC_SAVED_BUILDS_LIMIT}. Удалите лишние сборки и повторите.`);
      }
      if (persistSavedPcBuilds(merged)) {
        setCompareLeftId((value) => value || validBuilds[0].id);
        setCompareRightId((value) => value || validBuilds[1]?.id || '');
        onToast(`Импортировано сборок: ${validBuilds.length}.`);
      }
    } catch (error: any) {
      onToast(error?.message || 'Не удалось прочитать файл сборок.');
    } finally {
      setImportLoading(false);
    }
  };

  const compareSavedPcBuilds = async () => {
    const left = savedPcBuilds.find((build) => build.id === compareLeftId);
    const right = savedPcBuilds.find((build) => build.id === compareRightId);
    if (!left || !right) {
      setCompareError('Выберите две сохранённые сборки для сравнения.');
      setPcComparison(null);
      return;
    }
    if (left.id === right.id) {
      setCompareError('Для сравнения выберите две разные сборки.');
      setPcComparison(null);
      return;
    }
    const id = ++compareRequestId.current;
    setCompareLoading(true);
    setCompareError('');
    setPcComparison(null);
    const apiParts = (parts: PcBuildParts) => ({
      cpu_id: parts.cpu, gpu_id: parts.gpu, mb_id: parts.mb, ram_id: parts.ram,
      cooler_id: parts.cooler, ssd_id: parts.ssd, hdd_id: parts.hdd, psu_id: parts.psu, case_id: parts.case,
    });
    try {
      const result = await apiPost('/api/v6/pc/compare', { left: apiParts(left.parts), right: apiParts(right.parts) });
      if (id === compareRequestId.current) setPcComparison(result as PcComparison);
    } catch (error: any) {
      if (id === compareRequestId.current) setCompareError(error?.message || 'Не удалось сравнить сохранённые сборки.');
    } finally {
      if (id === compareRequestId.current) setCompareLoading(false);
    }
  };

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onSelectTool('pc_builder_pro')}
          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
            tab === 'pc' ? 'bg-indigo-500/25 border-indigo-400 text-indigo-100' : 'bg-slate-900 border-white/10 text-slate-300'
          }`}
        >
          🖥️ Конструктор ПК и Совместимость
        </button>
        <button
          type="button"
          onClick={() => onSelectTool('materials_fasteners_encyc')}
          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
            tab === 'materials' ? 'bg-amber-500/25 border-amber-400 text-amber-100' : 'bg-slate-900 border-white/10 text-slate-300'
          }`}
        >
          🔩 Гвозди, Металлы, Пластики и Стекло
        </button>
        <button
          type="button"
          onClick={() => onSelectTool('outfit_looksmax_hub')}
          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
            tab === 'style' ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100' : 'bg-slate-900 border-white/10 text-slate-300'
          }`}
        >
          🧥 Стили Одежды и Все Виды Луксмаксинга
        </button>
      </div>

      {tab === 'pc' && !catalog && <div className="rounded-2xl border border-indigo-400/20 bg-slate-950 p-5 text-center">
        {catalogError ? <><p role="alert" className="text-sm text-rose-200">{catalogError}</p><button type="button" onClick={() => setCatalogRetry((value) => value + 1)} className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs text-white">Повторить загрузку</button></> : <p role="status" className="text-sm text-slate-300">{catalogLoading ? 'Загружаю расширенный каталог комплектующих…' : 'Каталог не загружен.'}</p>}
      </div>}

      {tab === 'pc' && catalog && <>
        <section className="rounded-2xl border border-indigo-300/20 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/40 p-4">
          <div className="flex flex-wrap items-end justify-between gap-2"><div><div className="text-[9px] font-bold uppercase tracking-[.22em] text-indigo-300">КОНФИГУРАТОР · ОТ СТАРОГО ДО ФЛАГМАНСКОГО</div><h3 className="mt-1 text-sm font-bold text-white">Выберите стартовую сборку, затем меняйте любую деталь</h3></div><span className="text-[9px] text-slate-500">Цены — ориентиры, не live-предложения</span></div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{PC_BUILD_PRESETS.map((preset) => <button key={preset.id} type="button" onClick={() => applyPcPreset(preset)} className="group min-w-0 rounded-xl border border-white/10 bg-slate-950/80 p-3 text-left transition hover:-translate-y-0.5 hover:border-indigo-300/40 hover:bg-indigo-950/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300"><span className="flex items-start justify-between gap-2"><span className="min-w-0"><b className="block truncate text-xs text-white">{preset.name}</b><span className="mt-1 block text-[10px] leading-relaxed text-slate-400">{preset.note}</span></span><span className="shrink-0 font-mono text-[10px] font-bold text-amber-200">≈ {estimatePresetPrice(preset).toLocaleString('ru-RU')} ₽</span></span><span className="mt-2 flex flex-wrap gap-1">{[preset.parts.cpu, preset.parts.gpu, preset.parts.ram].map((id) => <span key={id} className="max-w-full truncate rounded-md border border-white/5 bg-white/[.04] px-1.5 py-0.5 text-[9px] text-slate-400">{catalog.cpus.find((x: any) => x.id === id)?.name || catalog.gpus.find((x: any) => x.id === id)?.name || catalog.rams.find((x: any) => x.id === id)?.name || id}</span>)}</span></button>)}</div>
          <div className="mt-3 grid grid-cols-2 gap-1.5 text-center sm:grid-cols-4 lg:grid-cols-9">{[['Процессоры', catalog.cpus], ['Видеокарты', catalog.gpus], ['Платы', catalog.motherboards], ['ОЗУ', catalog.rams], ['Охлаждение', catalog.coolers], ['SSD', catalog.ssds], ['HDD', catalog.hdds], ['БП', catalog.psus], ['Корпуса', catalog.cases]].map(([label, items]: any) => <div key={label} className="rounded-lg border border-white/5 bg-black/20 px-2 py-1.5"><b className="block text-xs text-white">{items?.length || 0}</b><span className="text-[9px] text-slate-500">{label}</span></div>)}</div>
          <p className="mt-2 text-[9px] leading-relaxed text-slate-500">Б/у детали требуют проверки состояния, модели платы, BIOS и комплектации. Совместимость носит справочный характер: сверяйте конкретные ревизии и руководства производителей.</p>
        </section>

        <section aria-labelledby="saved-pc-builds-heading" className="rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-slate-900 via-slate-950 to-cyan-950/20 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[9px] font-bold uppercase tracking-[.22em] text-cyan-300">ПРОФИЛИ ЭТОГО УСТРОЙСТВА</div>
              <h3 id="saved-pc-builds-heading" className="mt-1 text-sm font-bold text-white">Сохранённые сборки и сравнение</h3>
              <p className="mt-1 max-w-2xl text-[10px] leading-relaxed text-slate-400">Хранение остаётся в браузере. Экспортируйте JSON, чтобы перенести конфигурации на другое устройство или сделать резервную копию.</p>
            </div>
            <span className="shrink-0 rounded-lg border border-cyan-300/15 bg-cyan-300/5 px-2 py-1 text-[10px] text-cyan-100">{savedPcBuilds.length}/{PC_SAVED_BUILDS_LIMIT} профилей</span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <label className="min-w-0">
              <span className="sr-only">Название сохраняемой сборки</span>
              <input value={savedBuildName} onChange={(event) => setSavedBuildName(event.target.value.slice(0, 60))} onKeyDown={(event) => { if (event.key === 'Enter') saveCurrentPcBuild(); }} maxLength={60} placeholder="Название текущей конфигурации" className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs text-white placeholder:text-slate-600 focus:border-cyan-300/50 focus:outline-none" />
            </label>
            <button type="button" onClick={saveCurrentPcBuild} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"><CheckCircle2 className="h-3.5 w-3.5" />Сохранить / обновить</button>
            <div className="flex gap-2">
              <button type="button" onClick={() => importBuildInputRef.current?.click()} disabled={importLoading} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/10 disabled:opacity-50"><Upload className="h-3.5 w-3.5" />{importLoading ? 'Импорт…' : 'Импорт'}</button>
              <button type="button" onClick={exportAllSavedPcBuilds} disabled={!savedPcBuilds.length} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"><Download className="h-3.5 w-3.5" />Резервная копия</button>
              <input ref={importBuildInputRef} type="file" accept="application/json,.json" aria-label="Импорт сборок ПК из JSON" className="hidden" onChange={importSavedPcBuilds} />
            </div>
          </div>

          {savedPcBuilds.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-white/10 bg-black/10 px-4 py-5 text-center">
              <p className="text-xs font-semibold text-slate-300">Здесь пока нет сохранённых конфигураций</p>
              <p className="mt-1 text-[10px] text-slate-500">Подберите детали выше, задайте понятное имя и нажмите «Сохранить».</p>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {savedPcBuilds.map((build) => {
                const cpu = catalog.cpus.find((item: any) => item.id === build.parts.cpu)?.name || build.parts.cpu;
                const gpu = catalog.gpus.find((item: any) => item.id === build.parts.gpu)?.name || build.parts.gpu;
                const ram = catalog.rams.find((item: any) => item.id === build.parts.ram)?.name || build.parts.ram;
                return <article key={build.id} className="min-w-0 rounded-xl border border-white/10 bg-slate-950/70 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="truncate text-xs font-bold text-white" title={build.name}>{build.name}</h4>
                      <p className="mt-1 text-[9px] text-slate-500">Обновлено {new Date(build.updatedAt).toLocaleDateString('ru-RU')}</p>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] font-semibold text-amber-200">{build.snapshotPriceRub === null ? 'Цена не сохранена' : `≈ ${build.snapshotPriceRub.toLocaleString('ru-RU')} ₽`}</span>
                  </div>
                  <div className="mt-2 space-y-1 text-[10px] text-slate-400">
                    <p className="truncate" title={cpu}><span className="text-slate-600">CPU · </span>{cpu}</p>
                    <p className="truncate" title={gpu}><span className="text-slate-600">GPU · </span>{gpu}</p>
                    <p className="truncate" title={ram}><span className="text-slate-600">RAM · </span>{ram}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => applySavedPcBuild(build)} className="min-h-8 rounded-lg border border-indigo-300/20 bg-indigo-300/10 px-2.5 text-[10px] font-semibold text-indigo-100 hover:bg-indigo-300/20">Загрузить</button>
                    <button type="button" onClick={() => exportSavedPcBuild(build)} aria-label={`Экспортировать сборку ${build.name}`} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 text-[10px] text-slate-200 hover:bg-white/10"><Download className="h-3 w-3" />JSON</button>
                    <button type="button" onClick={() => removeSavedPcBuild(build)} aria-label={`Удалить сборку ${build.name}`} className="ml-auto min-h-8 rounded-lg border border-rose-300/15 bg-rose-300/5 px-2.5 text-[10px] text-rose-200 hover:bg-rose-300/10">Удалить</button>
                  </div>
                </article>;
              })}
            </div>
          )}

          {savedPcBuilds.length >= 2 && <div className="mt-3 rounded-xl border border-indigo-300/15 bg-indigo-300/[.04] p-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-[140px] flex-1 space-y-1"><span className="block text-[9px] font-semibold text-slate-400">Сборка A</span><select value={compareLeftId} onChange={(event) => { setCompareLeftId(event.target.value); setPcComparison(null); setCompareError(''); }} className="min-h-9 w-full rounded-lg border border-white/10 bg-slate-950 px-2 text-[10px] text-white">{savedPcBuilds.map((build) => <option key={build.id} value={build.id}>{build.name}</option>)}</select></label>
              <ArrowLeftRight className="mb-2 hidden h-4 w-4 text-indigo-300 sm:block" aria-hidden="true" />
              <label className="min-w-[140px] flex-1 space-y-1"><span className="block text-[9px] font-semibold text-slate-400">Сборка B</span><select value={compareRightId} onChange={(event) => { setCompareRightId(event.target.value); setPcComparison(null); setCompareError(''); }} className="min-h-9 w-full rounded-lg border border-white/10 bg-slate-950 px-2 text-[10px] text-white">{savedPcBuilds.map((build) => <option key={build.id} value={build.id}>{build.name}</option>)}</select></label>
              <button type="button" onClick={compareSavedPcBuilds} disabled={compareLoading} className="min-h-9 rounded-lg border border-indigo-300/30 bg-indigo-400/15 px-3 text-[10px] font-semibold text-indigo-100 hover:bg-indigo-400/25 disabled:opacity-50">{compareLoading ? 'Сравниваем…' : 'Сравнить совместимость и цену'}</button>
            </div>
            {compareError && <p role="alert" className="mt-2 text-[10px] text-rose-200">{compareError}</p>}
            {pcComparison && <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full min-w-[420px] text-left text-[10px]">
                <thead className="bg-white/[.04] text-slate-400"><tr><th className="px-2 py-2 font-medium">Показатель</th><th className="px-2 py-2 font-semibold text-cyan-100">{savedPcBuilds.find((build) => build.id === compareLeftId)?.name || 'Сборка A'}</th><th className="px-2 py-2 font-semibold text-indigo-100">{savedPcBuilds.find((build) => build.id === compareRightId)?.name || 'Сборка B'}</th></tr></thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  <tr><th className="px-2 py-2 font-medium text-slate-500">Оценка цены</th><td className="px-2 py-2">{Number(pcComparison.left?.total_price_rub || 0).toLocaleString('ru-RU')} ₽</td><td className="px-2 py-2">{Number(pcComparison.right?.total_price_rub || 0).toLocaleString('ru-RU')} ₽</td></tr>
                  <tr><th className="px-2 py-2 font-medium text-slate-500">Совместимость</th><td className="px-2 py-2">{pcComparison.left?.compatible ? '✓ Совместима' : `⚠ ${pcComparison.left?.errors?.length || 0} ошибок`}</td><td className="px-2 py-2">{pcComparison.right?.compatible ? '✓ Совместима' : `⚠ ${pcComparison.right?.errors?.length || 0} ошибок`}</td></tr>
                  {(['cpu', 'gpu', 'ram', 'ssd', 'psu'] as const).map((key) => <tr key={key}><th className="px-2 py-2 font-medium uppercase text-slate-500">{key}</th><td className="max-w-[180px] truncate px-2 py-2" title={pcComparison.left?.selected?.[key]?.name}>{pcComparison.left?.selected?.[key]?.name || '—'}</td><td className="max-w-[180px] truncate px-2 py-2" title={pcComparison.right?.selected?.[key]?.name}>{pcComparison.right?.selected?.[key]?.name || '—'}</td></tr>)}
                  <tr><th className="px-2 py-2 font-medium text-slate-500">Разница в цене B − A</th><td colSpan={2} className="px-2 py-2 font-semibold text-amber-100">{pcComparison.price_delta_rub > 0 ? '+' : ''}{pcComparison.price_delta_rub.toLocaleString('ru-RU')} ₽{pcComparison.cheaper_side === 'equal' ? ' · цена равна' : ` · дешевле: ${pcComparison.cheaper_side === 'left' ? 'A' : 'B'}`}</td></tr>
                </tbody>
              </table>
              <p className="border-t border-white/5 px-2 py-2 text-[9px] leading-relaxed text-slate-500">{pcComparison.note} {pcComparison.left?.errors?.length ? `A: ${pcComparison.left.errors.join('; ')} ` : ''}{pcComparison.right?.errors?.length ? `B: ${pcComparison.right.errors.join('; ')}` : ''}</p>
            </div>}
          </div>}
          {savedPcBuilds.length === 1 && <p className="mt-2 text-[9px] text-slate-500">Сохраните ещё одну сборку, чтобы сравнить совместимость, состав и ориентировочную цену.</p>}
        </section>
      </>}

      {/* 1. PC BUILDER PRO */}
      {tab === 'pc' && catalog && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-7 rounded-2xl bg-slate-900/80 border border-indigo-500/25 p-4 space-y-3 text-xs">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" /> Сборка ПК: от офисных апгрейдов до флагманов
            </h3>
            <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" /><input type="search" value={partSearch} onChange={(event) => setPartSearch(event.target.value)} placeholder="Фильтр по модели, поколению, сокету, типу или цене…" aria-label="Поиск комплектующих в списках" className="w-full rounded-xl border border-white/10 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white placeholder:text-slate-600" /></label>
            <fieldset className="min-w-0 rounded-xl border border-white/10 bg-slate-950/70 p-2.5">
              <legend className="px-1 text-[10px] font-semibold text-slate-300">Ценовой и возрастной сегмент каталога</legend>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
                {PC_SEGMENT_FILTERS.map((segment) => {
                  const count = segment.id === 'all'
                    ? Object.values(catalog).reduce((sum: number, items: any) => sum + (Array.isArray(items) ? items.length : 0), 0)
                    : Object.values(catalog).reduce((sum: number, items: any) => sum + (Array.isArray(items) ? items.filter((item: any) => item.segment === segment.id).length : 0), 0);
                  const active = pcSegmentFilter === segment.id;
                  return <button key={segment.id} type="button" aria-pressed={active} title={segment.description} onClick={() => setPcSegmentFilter(segment.id)} className={`min-h-10 rounded-lg border px-2 py-1.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300 ${active ? 'border-indigo-300/50 bg-indigo-500/15 text-indigo-100' : 'border-white/5 bg-white/[.025] text-slate-400 hover:border-white/15 hover:text-white'}`}><span className="block truncate text-[10px] font-semibold">{segment.label}</span><span className="block text-[9px] opacity-70">{count} поз.</span></button>;
                })}
              </div>
              <p className="mt-2 text-[9px] leading-relaxed text-slate-500">Сегмент фильтрует детали во всех девяти категориях. Текущий выбор всегда остаётся доступен, чтобы не терять совместимость сборки.</p>
            </fieldset>

            {[
              { label: 'Процессор (CPU)', val: cpuId, set: setCpuId, list: catalog.cpus, extra: (x: any) => `${x.cores} · ${x.socket}/${x.ram_type} · ${x.release_year || 'старое поколение'} · ${x.tdp_w} Вт` },
              { label: 'Материнская плата', val: mbId, set: setMbId, list: catalog.motherboards, extra: (x: any) => `${x.socket} · ${x.ram_type} · ${x.form_factor} · PCIe ${x.pcie}` },
              { label: 'Видеокарта (GPU)', val: gpuId, set: setGpuId, list: catalog.gpus, extra: (x: any) => `${x.vram_gb ? `${x.vram_gb} ГБ · ` : ''}${x.length_mm ? `${x.length_mm} мм · ` : ''}${x.tdp_w} Вт · ${x.tier}` },
              { label: 'Оперативная память (RAM)', val: ramId, set: setRamId, list: catalog.rams, extra: (x: any) => `${x.capacity_gb} ГБ · ${x.ram_type}-${x.speed_mhz} · ${x.kit}` },
              { label: 'Охлаждение CPU', val: coolerId, set: setCoolerId, list: catalog.coolers, extra: (x: any) => `${x.max_tdp_w} Вт · ${x.height_mm} мм` },
              { label: 'Основной SSD', val: ssdId, set: setSsdId, list: catalog.ssds, extra: (x: any) => `${x.capacity_gb} ГБ · ${x.interface} · до ${x.speed_mbps} МБ/с` },
              { label: 'Дополнительный HDD (необязательно)', val: hddId, set: setHddId, list: catalog.hdds, extra: (x: any) => `${x.capacity_gb} ГБ · ${x.interface}${x.rpm ? ` · ${x.rpm} об/мин` : ''}` },
              { label: 'Блок питания (PSU)', val: psuId, set: setPsuId, list: catalog.psus, extra: (x: any) => `${x.watts} Вт · ${x.efficiency} · ${x.atx_version}` },
              { label: 'Корпус ПК', val: caseId, set: setCaseId, list: catalog.cases, extra: (x: any) => `${x.case_size} · GPU до ${x.max_gpu_mm} мм · кулер до ${x.max_cooler_mm} мм` },
            ].map((row) => (
              <div key={row.label} className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-300">{row.label}</div>
                <select
                  value={row.val}
                  onChange={(e) => row.set(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-white/15 px-3 py-2 text-white"
                >
                  {(row.list || []).filter((item: any) => {
                    if (item.id === row.val) return true;
                    if (pcSegmentFilter !== 'all' && item.segment !== pcSegmentFilter) return false;
                    if (!partSearch.trim()) return true;
                    const terms = `${item.name} ${item.id} ${item.tier || ''} ${item.release_year || ''} ${item.segment || ''} ${row.extra(item)} ${item.price_rub}`.toLocaleLowerCase();
                    return terms.includes(partSearch.trim().toLocaleLowerCase());
                  }).map((item: any) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({row.extra(item)} • {item.price_rub.toLocaleString('ru-RU')} ₽)
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="xl:col-span-5 rounded-2xl bg-slate-950/95 border border-white/10 p-4 space-y-3 text-xs">
            <PcBuilderShowcase3D build={evalRes} />
            {evalLoading && <p role="status" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-[10px] text-slate-400">Пересчитываю совместимость выбранных деталей…</p>}
            {evalError && <p role="alert" className="rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-[10px] text-rose-100">{evalError}</p>}

            {evalRes && (
              <>
                <div
                  className={`p-3 rounded-xl border ${
                    evalRes.compatible
                      ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                      : 'bg-rose-500/15 border-rose-400/45 text-rose-200'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    {evalRes.compatible ? (
                      <><CheckCircle2 className="w-4 h-4" /> Ошибок в проверенных параметрах не найдено</>
                    ) : (
                      <><AlertTriangle className="w-4 h-4" /> Несовместимость комплектующих:</>
                    )}
                  </div>
                  {(evalRes.errors || []).map((err: string, i: number) => (
                    <div key={i} className="mt-1">• {err}</div>
                  ))}
                  {(evalRes.warnings || []).map((w: string, i: number) => (
                    <div key={i} className="mt-1 text-amber-300">⚠️ {w}</div>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="min-w-0 rounded-xl border border-white/10 bg-slate-900 p-2.5">
                    <div className="text-[10px] text-slate-400">Ориентировочная цена</div>
                    <div className="break-words font-mono text-base font-black text-amber-300">{evalRes.total_price_rub.toLocaleString('ru-RU')} ₽</div>
                  </div>
                  <div className="min-w-0 rounded-xl border border-white/10 bg-slate-900 p-2.5">
                    <div className="text-[10px] text-slate-400">Суммарное хранилище</div>
                    <div className="font-mono text-sm font-bold text-cyan-200">{(evalRes.storage_capacity_gb / 1000).toLocaleString('ru-RU')} ТБ</div>
                  </div>
                  <div className="min-w-0 rounded-xl border border-white/10 bg-slate-900 p-2.5">
                    <div className="text-[10px] text-slate-400">Условный баланс CPU / GPU</div>
                    <div className="text-xs font-bold text-sky-300">{evalRes.bottleneck_verdict}</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="font-bold text-slate-200">Модельный FPS-ориентир (1080p / 1440p / 4K):</div>
                  {(evalRes.fps_benchmarks || []).map((g: any) => (
                    <div key={g.game} className="p-2 rounded-lg bg-slate-900 border border-white/5 flex items-center justify-between gap-2">
                      <span className="text-slate-300 truncate">{g.game}</span>
                      <span className="font-mono font-bold text-emerald-300 shrink-0">
                        {g.fps_1080p} / {g.fps_1440p} / {g.fps_4k}
                      </span>
                    </div>
                  ))}
                  <p className="rounded-lg border border-amber-300/10 bg-amber-400/[.04] p-2 text-[9px] leading-relaxed text-amber-100/70">{evalRes.performance_note}</p>
                  <p className="text-[9px] leading-relaxed text-slate-500">{evalRes.price_note}</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'materials' && !matData && <div className="rounded-2xl border border-amber-400/20 bg-slate-950 p-5 text-center">
        {matError ? <><p role="alert" className="text-sm text-rose-200">{matError}</p><button type="button" onClick={() => setMatRetry((value) => value + 1)} className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs text-white">Повторить загрузку</button></> : <p role="status" className="text-sm text-slate-400">{matLoading ? 'Загружаю справочник материалов…' : 'Справочник пока недоступен.'}</p>}
      </div>}
      {tab === 'style' && !styleLoaded && <div className="rounded-2xl border border-emerald-400/20 bg-slate-950 p-5 text-center">
        {styleError ? <><p role="alert" className="text-sm text-rose-200">{styleError}</p><button type="button" onClick={() => setStyleRetry((value) => value + 1)} className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs text-white">Повторить загрузку</button></> : <p role="status" className="text-sm text-slate-400">{styleLoading ? 'Загружаю данные о стилях…' : 'Данные о стилях пока недоступны.'}</p>}
      </div>}
      {tab === 'style' && styleLoaded && styleData.outfits.length === 0 && <div role="status" className="rounded-xl border border-white/10 bg-slate-950 p-4 text-sm text-slate-400">Справочник загрузился, но в нём пока нет вариантов для отображения.</div>}

      {/* 2. ENGINEERING CLASSIFICATION: NAILS, METALS, PLASTICS & GLASS */}
      {tab === 'materials' && matData && (
        <div className="rounded-2xl bg-slate-900/80 border border-amber-500/25 p-4 space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'fasteners', label: '🔩 Гвозди, Саморезы и Болты' },
                { id: 'metals', label: '⚙️ Металлы и Сплавы' },
                { id: 'plastics', label: '♻️ Пластики и Полимеры (1–7)' },
                { id: 'glass', label: '🪟 Виды Стекла' },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setMatSec(s.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  matSec === s.id
                    ? 'bg-amber-500/25 border-amber-400 text-amber-100'
                    : 'bg-slate-950 border-white/10 text-slate-300'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(matData[matSec] || []).map((item: any, idx: number) => (
              <div key={idx} className="p-4 rounded-xl bg-slate-950/90 border border-white/10 space-y-1.5 text-xs">
                <div className="text-sm font-bold text-white">{item.name}</div>
                <div className="font-mono text-[11px] text-amber-300">{item.spec}</div>
                <div className="text-sky-300">Состав / основа: {item.material}</div>
                <p className="text-slate-300 leading-relaxed">{item.use}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. OUTFIT MATCHING BY AESTHETICS & ALL TYPES OF LOOKSMAXXING */}
      {tab === 'style' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-900/80 border border-emerald-500/25 p-4 space-y-3">
            <h3 className="text-sm sm:text-base font-bold text-white">
              🧥 Капсульный Подбор Одежды по Стилям и Цветовым Сочетаниям
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(styleData.outfits || []).map((o: any) => (
                <div key={o.id} className="p-4 rounded-xl bg-slate-950/90 border border-white/10 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-white">{o.style}</span>
                    <div className="flex gap-1">
                      {(o.palette || []).map((hex: string) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => copyText(hex, onToast)}
                          style={{ backgroundColor: hex }}
                          title={`Скопировать ${hex}`}
                          className="w-5 h-5 rounded-md border border-white/25"
                        />
                      ))}
                    </div>
                  </div>
                  <div className="text-emerald-300 text-[11px]">{o.vibe}</div>
                  <div className="text-slate-300"><b>Верх:</b> {o.top}</div>
                  <div className="text-slate-300"><b>Низ:</b> {o.bottom}</div>
                  <div className="text-slate-300"><b>Обувь:</b> {o.shoes}</div>
                  <div className="text-slate-400"><b>Детали:</b> {o.acc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900/80 border border-sky-500/25 p-4 space-y-3">
            <h3 className="text-sm sm:text-base font-bold text-white">
              🧬 Полная Систематика Всех Направлений Looksmaxxing (Доказательный разбор)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(styleData.looksmaxxing || []).map((l: any, i: number) => (
                <div key={i} className="p-4 rounded-xl bg-slate-950/90 border border-white/10 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-white">{l.category}</span>
                    <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 text-[10px] shrink-0">
                      {l.science_level}
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{l.protocol}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2. CAR MAKES & MODELS SPECS STUDIO + SIDE-BY-SIDE COMPARISON
// ============================================================================

export const CarSpecsStudio: React.FC<{ onToast: (m: string) => void }> = () => {
  const [q, setQ] = useState('');
  const [cars, setCars] = useState<any[]>([]);
  const [cmpA, setCmpA] = useState('car_1');
  const [cmpB, setCmpB] = useState('car_16');
  const [showCar, setShowCar] = useState<'A' | 'B'>('A');
  const [loadingCars, setLoadingCars] = useState(true);
  const [carsError, setCarsError] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    setLoadingCars(true);
    setCars([]);
    setCarsError('');
    const timer = window.setTimeout(() => {
      apiGet(`/api/v6/cars/catalog?q=${encodeURIComponent(q)}`)
        .then((r) => { if (id === requestId.current) setCars(r.items || []); })
        .catch((error: any) => { if (id === requestId.current) setCarsError(error?.message || 'Не удалось загрузить каталог'); })
        .finally(() => { if (id === requestId.current) setLoadingCars(false); });
    }, q.trim() ? 220 : 0);
    return () => { window.clearTimeout(timer); requestId.current += 1; };
  }, [q]);

  const carA = cars.find((c) => c.id === cmpA) || cars[0];
  const carB = cars.find((c) => c.id === cmpB) || cars[1];
  const showcaseCar = showCar === 'A' ? carA : carB;

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-sky-500/25 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Mini3DSceneBadge seed="car_specs_catalog" color="#38bdf8" size={38} />
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white">
              🏎️ Каталог Марок и Моделей Автомобилей с Характеристиками
            </h3>
            <p className="text-xs text-slate-400">
              Двигатели, мощность, крутящий момент, разгон 0–100 км/ч, масса и удельная мощность
            </p>
          </div>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Марка, модель или мотор (BMW, Porsche, Supra, 2JZ, V8, LADA)..."
          className="w-full sm:w-72 rounded-xl bg-slate-950 border border-white/15 px-3.5 py-2 text-xs text-white"
        />
      </div>

      {carA && carB && (
        <div className="p-3.5 rounded-xl bg-slate-950 border border-amber-400/30 space-y-2 text-xs">
          <div className="font-bold text-amber-300">🏁 Сравнение динамики двух автомобилей:</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select value={carA.id} onChange={(e) => setCmpA(e.target.value)} className="rounded-lg bg-slate-900 border border-white/10 p-2 text-white">
              {cars.map((c) => (
                <option key={c.id} value={c.id}>{c.make} {c.model} ({c.hp} л.с. • {c.zero_to_100_s} с)</option>
              ))}
            </select>
            <select value={carB.id} onChange={(e) => setCmpB(e.target.value)} className="rounded-lg bg-slate-900 border border-white/10 p-2 text-white">
              {cars.map((c) => (
                <option key={c.id} value={c.id}>{c.make} {c.model} ({c.hp} л.с. • {c.zero_to_100_s} с)</option>
              ))}
            </select>
          </div>
          <div className="font-mono text-[11px] text-slate-300">
            Разница 0–100 км/ч: <b className="text-emerald-300">{Math.abs(carA.zero_to_100_s - carB.zero_to_100_s).toFixed(2)} с</b> • Удельная мощность: <b>{carA.power_to_weight}</b> vs <b>{carB.power_to_weight} л.с./т</b>
          </div>
        </div>
      )}

      {showcaseCar && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold text-slate-200">Выберите, какую машину показать в 3D:</div>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setShowCar('A')} className={`rounded-lg border px-2.5 py-1 text-[11px] ${showCar === 'A' ? 'border-sky-300/50 bg-sky-400/15 text-sky-100' : 'border-white/10 bg-white/5 text-slate-400'}`}>A · {carA?.make} {carA?.model}</button>
              <button type="button" disabled={!carB} onClick={() => setShowCar('B')} className={`rounded-lg border px-2.5 py-1 text-[11px] disabled:opacity-40 ${showCar === 'B' ? 'border-amber-300/50 bg-amber-400/15 text-amber-100' : 'border-white/10 bg-white/5 text-slate-400'}`}>B · {carB ? `${carB.make} ${carB.model}` : 'выберите вторую'}</button>
            </div>
          </div>
          <CarComparison3D car={showcaseCar} side={showCar} />
        </div>
      )}

      {loadingCars && <div role="status" className="rounded-xl border border-white/10 bg-slate-950 p-4 text-center text-xs text-slate-400">Загружаю каталог автомобилей…</div>}
      {carsError && <div role="alert" className="rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-xs text-rose-100">{carsError}. Попробуйте изменить запрос или обновить раздел.</div>}
      {!loadingCars && !carsError && cars.length === 0 && <div className="rounded-xl border border-white/10 bg-slate-950 p-5 text-center text-sm text-slate-400">По запросу «{q || 'все автомобили'}» ничего не найдено. Проверьте написание марки, модели или двигателя.</div>}

      {cars.length > 0 && <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[560px] overflow-y-auto pr-1">
        {cars.map((c) => (
          <div key={c.id} className="p-3.5 rounded-xl bg-slate-950/90 border border-white/10 space-y-2 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-bold text-sm text-white">{c.make} {c.model}</div>
                <div className="text-[11px] text-slate-400">{c.origin} • {c.years} • {c.body_class}</div>
              </div>
              <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-200 font-mono font-bold">
                {c.zero_to_100_s} с
              </span>
            </div>
            <div className="text-amber-300 font-mono text-[11px]">{c.engine} • {c.drivetrain}</div>
            <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[11px]">
              <div className="p-1.5 rounded bg-slate-900"><b>{c.hp}</b> л.с. / {c.torque_nm} Н·м</div>
              <div className="p-1.5 rounded bg-slate-900">Макс. <b>{c.top_speed_kmh}</b> км/ч</div>
              <div className="p-1.5 rounded bg-slate-900">{c.weight_kg} кг ({c.power_to_weight} л.с./т)</div>
            </div>
            <div className="flex flex-wrap gap-1.5 border-t border-white/5 pt-2">
              <button type="button" onClick={() => { setCmpA(c.id); setShowCar('A'); }} className="rounded-lg border border-sky-300/20 bg-sky-400/10 px-2.5 py-1.5 text-[10px] font-semibold text-sky-100 hover:bg-sky-400/20">Сравнить как A · показать в 3D</button>
              <button type="button" onClick={() => { setCmpB(c.id); setShowCar('B'); }} className="rounded-lg border border-amber-300/20 bg-amber-400/10 px-2.5 py-1.5 text-[10px] font-semibold text-amber-100 hover:bg-amber-400/20">Сравнить как B · показать в 3D</button>
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
};

// ============================================================================
// 3. ROUTE PLANNER & DISTANCE / FUEL CALCULATOR
// ============================================================================

export const RoutePlannerStudio: React.FC<{ onSync: () => void; onToast: (m: string) => void }> = ({ onSync, onToast }) => {
  const [origin, setOrigin] = useState('Москва');
  const [dest, setDest] = useState('Санкт-Петербург');
  const [via, setVia] = useState('');
  const [transport, setTransport] = useState<'car' | 'train' | 'plane' | 'bike' | 'walk'>('car');
  const [fuelL, setFuelL] = useState(8.2);
  const [fuelRub, setFuelRub] = useState(61.5);
  const [res, setRes] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [routeError, setRouteError] = useState('');
  const requestId = useRef(0);

  const invalidateResult = () => {
    requestId.current += 1;
    setRes(null);
    setLoading(false);
    setRouteError('');
  };

  const calc = async () => {
    const id = ++requestId.current;
    setLoading(false);
    setRes(null);
    setRouteError('');
    if (!origin.trim() || !dest.trim()) {
      setRouteError('Заполните начальную и конечную точки маршрута.');
      return;
    }
    const viaPoints = via.split(';').map((point) => point.trim()).filter(Boolean);
    if (viaPoints.length > 6) {
      setRouteError('Можно добавить не более 6 промежуточных точек (разделяйте их точкой с запятой).');
      return;
    }
    setLoading(true);
    setRouteError('');
    try {
      const r = await apiPost('/api/v6/route/plan', {
        origin,
        destination: dest,
        via,
        transport,
        fuel_l_per_100km: fuelL,
        fuel_price_rub: fuelRub,
      });
      if (id !== requestId.current) return;
      setRes(r);
      onSync();
    } catch (e: any) {
      if (id === requestId.current) {
        setRouteError(e.message || 'Не удалось рассчитать маршрут');
        onToast(e.message || 'Ошибка маршрута');
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  const reverseRoute = () => {
    invalidateResult();
    setOrigin(dest);
    setDest(origin);
    setVia(via.split(';').map((point) => point.trim()).filter(Boolean).reverse().join('; '));
  };

  const copyRouteSummary = () => {
    if (!res) return;
    const stops = (res.waypoints || []).map((point: any) => point.label).join(' → ');
    copyText(`${stops}\nРасчётная длина: ${res.route_distance_km} км · время: ${res.duration_formatted}${res.transport === 'car' ? ` · топливо: ${res.fuel_liters} л, ${res.fuel_cost_rub} ₽` : ''}\n${res.estimate_note}`, onToast);
  };

  const downloadRouteWaypoints = () => {
    if (!res?.waypoints?.length) return;
    const escapeXml = (value: unknown) => String(value ?? '').replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char] || char));
    const points = res.waypoints.map((point: any) => `<wpt lat="${Number(point.lat).toFixed(6)}" lon="${Number(point.lon).toFixed(6)}"><name>${escapeXml(point.label)}</name></wpt>`).join('\n  ');
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="MULTI_TG_TOOL Route Planner" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${escapeXml(origin)} — ${escapeXml(dest)}</name><desc>Только путевые точки. Это не навигационный трек: дорожная сеть не рассчитывалась.</desc></metadata>\n  ${points}\n</gpx>`;
    const url = URL.createObjectURL(new Blob([gpx], { type: 'application/gpx+xml;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'route-waypoints.gpx'; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadRouteCsv = () => {
    if (!res?.legs?.length) return;
    const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [['№', 'От', 'До', 'Расчётное расстояние, км'], ...res.legs.map((leg: any, index: number) => [index + 1, leg.from, leg.to, leg.distance_km])];
    const csv = `\uFEFF${rows.map((row) => row.map(quote).join(';')).join('\r\n')}\r\n\r\n${quote('Пояснение')};${quote(res.estimate_note)}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'route-estimate.csv'; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  useEffect(() => {
    void calc();
    return () => { requestId.current += 1; };
  }, []);

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-emerald-500/25 p-4 space-y-4 text-xs">
      <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
        <MapPin className="w-4 h-4 text-emerald-400" /> Калькулятор Маршрутов, Времени в Пути и Топлива
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <label className="text-[10px] text-slate-400">Начало<input aria-label="Начальная точка маршрута" value={origin} onChange={(e) => { invalidateResult(); setOrigin(e.target.value); }} placeholder="Город или широта, долгота" className="mt-1 w-full rounded-xl bg-slate-950 border border-white/15 px-3 py-2 text-xs text-white" /></label>
        <label className="text-[10px] text-slate-400">Промежуточные точки<input aria-label="Промежуточные точки через точку с запятой" value={via} onChange={(e) => { invalidateResult(); setVia(e.target.value); }} placeholder="Необязательно · разделитель ;" className="mt-1 w-full rounded-xl bg-slate-950 border border-white/15 px-3 py-2 text-xs text-white" /><span className="mt-1 block text-[9px] text-slate-600">{via.split(';').filter((point) => point.trim()).length}/6 точек</span></label>
        <label className="text-[10px] text-slate-400">Финиш<input aria-label="Конечная точка маршрута" value={dest} onChange={(e) => { invalidateResult(); setDest(e.target.value); }} placeholder="Город или широта, долгота" className="mt-1 w-full rounded-xl bg-slate-950 border border-white/15 px-3 py-2 text-xs text-white" /></label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={reverseRoute} disabled={loading} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-[10px] text-slate-300 hover:border-emerald-300/40 hover:text-white disabled:opacity-50"><ArrowLeftRight className="h-3.5 w-3.5" />Поменять начало и финиш</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: 'car', label: '🚗 Автомобиль' },
          { id: 'train', label: '🚆 Поезд' },
          { id: 'plane', label: '✈️ Самолёт' },
          { id: 'bike', label: '🚴 Велосипед' },
          { id: 'walk', label: '🚶 Пешком' },
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => { invalidateResult(); setTransport(m.id as typeof transport); }}
            className={`px-3 py-1.5 rounded-xl border ${
              transport === m.id ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100 font-bold' : 'bg-slate-950 border-white/10 text-slate-300'
            }`}
          >
            {m.label}
          </button>
        ))}
        <button type="button" onClick={() => void calc()} disabled={loading} className="px-4 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold disabled:cursor-wait disabled:opacity-60">
          {loading ? 'Рассчитываю…' : 'Рассчитать маршрут'}
        </button>
      </div>

      {transport === 'car' && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-[10px] text-slate-400">Расход автомобиля, л/100 км<input type="number" min="0" max="100" step="0.1" value={fuelL} onChange={(e) => { invalidateResult(); setFuelL(Math.max(0, Math.min(100, Number(e.target.value) || 0))); }} className="mt-1 w-full rounded-xl bg-slate-950 border border-white/15 px-3 py-2 text-xs text-white" /></label>
        <label className="text-[10px] text-slate-400">Цена топлива, ₽/л<input type="number" min="0" max="1000" step="0.1" value={fuelRub} onChange={(e) => { invalidateResult(); setFuelRub(Math.max(0, Math.min(1000, Number(e.target.value) || 0))); }} className="mt-1 w-full rounded-xl bg-slate-950 border border-white/15 px-3 py-2 text-xs text-white" /></label>
      </div>}
      {routeError && <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{routeError}</p>}

      {res && <>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            ['Оценка расстояния', `${Number(res.route_distance_km).toLocaleString('ru-RU')} км`, `Прямые участки: ${res.air_distance_km} км`],
            ['Модельное время', res.duration_formatted, `Средняя расчётная скорость · ${res.transport}`],
            ...(res.transport === 'car'
              ? [['Расчётное топливо', `${res.fuel_liters} л`, `Введено: ${fuelL} л/100 км`], ['Стоимость топлива', `${Number(res.fuel_cost_rub).toLocaleString('ru-RU')} ₽`, `По введённой цене ${fuelRub} ₽/л`]]
              : [['Промежуточные точки', String(Math.max(0, res.waypoints.length - 2)), 'Из маршрута по порядку'], ['Транспорт', res.transport, 'Время — грубая оценка']]),
          ].map(([label, value, detail]) => <div key={label} className="min-w-0 rounded-xl border border-white/10 bg-slate-950 p-3"><div className="text-[10px] text-slate-400">{label}</div><div className="mt-1 break-words text-lg font-mono font-bold text-white">{value}</div><div className="mt-1 text-[9px] leading-relaxed text-slate-500">{detail}</div></div>)}
        </div>
        <RouteGlobe3D points={res.waypoints || []} transport={res.transport || transport} />
        <div className="rounded-xl border border-white/10 bg-slate-950 p-3">
          <div className="mb-2 text-xs font-semibold text-white">Участки в указанном порядке</div>
          <div className="flex flex-wrap gap-1.5">{res.legs.map((leg: any, index: number) => <div key={`${index}-${leg.from}-${leg.to}`} className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[10px] text-slate-300"><span className="text-slate-500">{leg.from}</span><span className="mx-1 text-emerald-300">→</span><span>{leg.to}</span><b className="ml-1.5 font-mono text-white">{leg.distance_km} км*</b></div>)}</div>
          <p className="mt-3 text-[10px] leading-relaxed text-amber-100/70">{res.estimate_note}</p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Действия с рассчитанным маршрутом">
          <button type="button" onClick={copyRouteSummary} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-[10px] text-slate-200 hover:bg-slate-800"><Copy className="h-3.5 w-3.5" />Копировать сводку</button>
          <button type="button" onClick={downloadRouteCsv} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-[10px] text-slate-200 hover:bg-slate-800"><FileSpreadsheet className="h-3.5 w-3.5" />Экспорт участков CSV</button>
          <button type="button" onClick={downloadRouteWaypoints} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-[10px] text-slate-200 hover:bg-slate-800"><Download className="h-3.5 w-3.5" />GPX с точками, без трека</button>
        </div>
      </>}
    </div>
  );
};

// ============================================================================
// 4. COLOR MATCHING PRO STUDIO + PHOTO PALETTE EXTRACTOR + DALTONISM SIM
// ============================================================================

function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
}

export const ColorMatchingProStudio: React.FC<{ onToast: (m: string) => void }> = ({ onToast }) => {
  const [hue, setHue] = useState(202);
  const [sat, setSat] = useState(86);
  const [light, setLight] = useState(56);
  const [photoColors, setPhotoColors] = useState<string[]>([]);

  const harmonies = useMemo(() => {
    return [
      { name: 'Базовый + Комплементарный (контраст Иттена 180°)', colors: [hslToHex(hue, sat, light), hslToHex((hue + 180) % 360, sat, light), hslToHex(hue, 20, 94), hslToHex((hue + 180) % 360, 30, 14)] },
      { name: 'Раздельно-комплементарная триада (+150° / +210°)', colors: [hslToHex(hue, sat, light), hslToHex((hue + 150) % 360, sat, light), hslToHex((hue + 210) % 360, sat, light)] },
      { name: 'Классическая триада Иттена (120°)', colors: [hslToHex(hue, sat, light), hslToHex((hue + 120) % 360, sat, light), hslToHex((hue + 240) % 360, sat, light)] },
      { name: 'Мягкая аналоговая гармония (±28°)', colors: [hslToHex((hue + 332) % 360, sat, light), hslToHex(hue, sat, light), hslToHex((hue + 28) % 360, sat, light)] },
      { name: 'Правило 60–30–10 для интерьера и UI', colors: [hslToHex(hue, 16, 12), hslToHex(hue, 28, 24), hslToHex((hue + 165) % 360, 88, 58)] },
    ];
  }, [hue, sat, light]);

  const handleImageUpload = (file?: File | null) => {
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const cvs = document.createElement('canvas');
      cvs.width = 64;
      cvs.height = 64;
      const ctx = cvs.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 64, 64);
      const data = ctx.getImageData(0, 0, 64, 64).data;
      const buckets: Record<string, { r: number; g: number; b: number; n: number }> = {};
      for (let i = 0; i < data.length; i += 16) {
        if (data[i + 3] < 128) continue;
        const key = `${data[i] >> 5}-${data[i + 1] >> 5}-${data[i + 2] >> 5}`;
        if (!buckets[key]) buckets[key] = { r: 0, g: 0, b: 0, n: 0 };
        buckets[key].r += data[i];
        buckets[key].g += data[i + 1];
        buckets[key].b += data[i + 2];
        buckets[key].n += 1;
      }
      const top = Object.values(buckets)
        .sort((a, b) => b.n - a.n)
        .slice(0, 8)
        .map((b) => {
          const toH = (v: number) => Math.round(v / b.n).toString(16).padStart(2, '0');
          return `#${toH(b.r)}${toH(b.g)}${toH(b.b)}`.toUpperCase();
        });
      setPhotoColors(top);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-purple-500/25 p-4 sm:p-5 space-y-4 text-xs">
      <div className="flex items-center gap-2.5">
        <Mini3DSceneBadge seed="color_matching_studio" color="#c084fc" size={38} />
        <div>
          <h3 className="text-sm sm:text-base font-bold text-white">
            🌈 Студия Подбора и Сочетания Цветов + Извлечение Палитры с Фото
          </h3>
          <p className="text-xs text-slate-400">
            Цветовой круг Иттена, правило 60–30–10 для одежды/UI и мгновенная выжимка доминирующих цветов из любой картинки
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-950 border border-white/10">
        <div>
          <div className="flex justify-between mb-1"><span>Тон (Hue)</span><span className="font-mono text-purple-300">{hue}°</span></div>
          <input type="range" min={0} max={359} value={hue} onChange={(e) => setHue(Number(e.target.value))} className="w-full accent-purple-400" />
        </div>
        <div>
          <div className="flex justify-between mb-1"><span>Насыщенность</span><span className="font-mono text-purple-300">{sat}%</span></div>
          <input type="range" min={10} max={100} value={sat} onChange={(e) => setSat(Number(e.target.value))} className="w-full accent-purple-400" />
        </div>
        <div>
          <div className="flex justify-between mb-1"><span>Светлота</span><span className="font-mono text-purple-300">{light}%</span></div>
          <input type="range" min={15} max={88} value={light} onChange={(e) => setLight(Number(e.target.value))} className="w-full accent-purple-400" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {harmonies.map((h) => (
          <div key={h.name} className="p-3.5 rounded-xl bg-slate-950 border border-white/10 space-y-2">
            <div className="font-bold text-slate-200">{h.name}</div>
            <div className="flex gap-2">
              {h.colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => copyText(c, onToast)}
                  className="flex-1 rounded-xl p-2 border border-white/15 flex flex-col items-center justify-end h-16 transition hover:scale-[1.02]"
                  style={{ backgroundColor: c }}
                >
                  <span className="px-1.5 py-0.5 rounded bg-slate-950/80 font-mono text-[10px] text-white">{c}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-xl bg-slate-950 border border-purple-400/30 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-bold text-white">📷 Извлечь готовую палитру из вашей фотографии:</div>
          <label className="px-3.5 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold cursor-pointer flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Выбрать фото
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e.target.files?.[0])} />
          </label>
        </div>
        {photoColors.length > 0 && (
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {photoColors.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => copyText(hex, onToast)}
                style={{ backgroundColor: hex }}
                className="h-16 rounded-xl border border-white/20 flex items-end justify-center p-1"
              >
                <span className="px-1 rounded bg-slate-950/85 font-mono text-[9px] text-white">{hex}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
