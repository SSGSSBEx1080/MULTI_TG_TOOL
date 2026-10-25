import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  ClipboardPaste,
  Copy,
  Download,
  ExternalLink,
  Grid,
  Link2,
  Printer,
  QrCode,
  RefreshCw,
  ScanLine,
  Send,
  Star,
  Upload,
} from 'lucide-react';
import {
  apiForm,
  apiPost,
  copyText,
  getTelegramWebApp,
  isInsideTelegram,
  openExternalLink,
  sendGeneratedToTelegramChat,
  triggerFileDownload,
} from '../../lib/api';
import { HoloQr3DShowcase } from '../three/Tilt3DCard';

interface Props {
  activeTool: string;
  onSelectTool: (t: string) => void;
  favorites: string[];
  onToggleFav: (toolId: string) => void;
  onSync: () => void;
  onToast: (msg: string) => void;
}

type QrMode = 'text' | 'wifi' | 'vcard' | 'telegram' | 'whatsapp' | 'email' | 'geo' | 'crypto';
type QrSubTab = 'designer' | 'scanner' | 'batch' | 'barcode' | 'links';

interface ScanHistoryEntry {
  text: string;
  type: string;
  ts: string;
}

const HISTORY_KEY = 'mt_qr_scan_history_v2';

function loadScanHistory(): ScanHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
  } catch {
    return [];
  }
}

function saveScanHistory(items: ScanHistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 12)));
  } catch {
    // ignore storage quota
  }
}

async function decodeImageClientJsQr(file: File): Promise<{ text: string; width: number; height: number } | null> {
  try {
    const bmp = await createImageBitmap(file);
    const maxDim = Math.max(bmp.width, bmp.height);
    const scale = maxDim > 1400 ? 1400 / maxDim : maxDim < 340 ? 2 : 1;
    const w = Math.max(64, Math.round(bmp.width * scale));
    const h = Math.max(64, Math.round(bmp.height * scale));
    const pad = 28;
    const cvs = document.createElement('canvas');
    cvs.width = w + pad * 2;
    cvs.height = h + pad * 2;
    const ctx = cvs.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      bmp.close();
      return null;
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    ctx.drawImage(bmp, pad, pad, w, h);
    bmp.close();

    // Native browser BarcodeDetector first if available (reads QR + EAN-13 + Code128 hardware-accelerated)
    const AnyWin = window as any;
    if (typeof AnyWin.BarcodeDetector === 'function') {
      try {
        const bd = new AnyWin.BarcodeDetector({
          formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'upc_a', 'data_matrix'],
        });
        const hits = await bd.detect(cvs);
        if (hits && hits.length > 0 && hits[0].rawValue) {
          return { text: String(hits[0].rawValue), width: w, height: h };
        }
      } catch {
        // continue to jsQR
      }
    }

    const imgData = ctx.getImageData(0, 0, cvs.width, cvs.height);
    const hit = jsQR(imgData.data, imgData.width, imgData.height, {
      inversionAttempts: 'attemptBoth',
    });
    if (hit && hit.data) {
      return { text: hit.data, width: w, height: h };
    }
    return null;
  } catch {
    return null;
  }
}

export const QrStudioPro: React.FC<Props> = ({
  activeTool,
  onSelectTool,
  favorites,
  onToggleFav,
  onSync,
  onToast,
}) => {
  const inTg = isInsideTelegram();

  const [subTab, setSubTab] = useState<QrSubTab>(() => {
    if (activeTool === 'qr_decoder' || activeTool === 'qr_scanner') return 'scanner';
    if (activeTool === 'qr_batch') return 'batch';
    if (activeTool === 'barcode_gen') return 'barcode';
    if (activeTool === 'url_transformer') return 'links';
    return 'designer';
  });

  // --- Creator state ---
  const [qrMode, setQrMode] = useState<QrMode>(() => (activeTool === 'wifi_qr' ? 'wifi' : 'text'));
  const [qrData, setQrData] = useState('https://t.me/multi_tg_bot');
  const [qrTheme, setQrTheme] = useState('cyber');
  const [qrShape, setQrShape] = useState('rounded');
  const [finderStyle, setFinderStyle] = useState('rounded');
  const [qrFramed, setQrFramed] = useState(true);
  const [useCustomColors, setUseCustomColors] = useState(false);
  const [fgHex, setFgHex] = useState('#0a1a2f');
  const [bgHex, setBgHex] = useState('#ffffff');
  const [qrBadge, setQrBadge] = useState('MT');
  const [qrCaption, setQrCaption] = useState('MULTI_TG_TOOL • @multi_tg_bot');

  const [wifiSsid, setWifiSsid] = useState('HOME_5G_PRO');
  const [wifiPwd, setWifiPwd] = useState('CyberAccess2026');
  const [wifiSec, setWifiSec] = useState('WPA');
  const [wifiHidden, setWifiHidden] = useState(false);

  const [vcardName, setVcardName] = useState('Арсений QLS');
  const [vcardPhone, setVcardPhone] = useState('+7 999 000-00-00');
  const [vcardEmail, setVcardEmail] = useState('');
  const [vcardOrg, setVcardOrg] = useState('MULTI_TG_TOOL');
  const [vcardTg, setVcardTg] = useState('@QLSCENR');

  const [tgTarget, setTgTarget] = useState('@multi_tg_bot');
  const [tgStart, setTgStart] = useState('');
  const [waPhone, setWaPhone] = useState('+7 999 000-00-00');
  const [waText, setWaText] = useState('Привет!');
  const [emailTo, setEmailTo] = useState('contact@example.com');
  const [emailSubj, setEmailSubj] = useState('Запрос');
  const [emailBody, setEmailBody] = useState('');
  const [geoLat, setGeoLat] = useState('55.7558');
  const [geoLon, setGeoLon] = useState('37.6173');
  const [geoLabel, setGeoLabel] = useState('Москва');
  const [cryptoNet, setCryptoNet] = useState('ton');
  const [cryptoAddr, setCryptoAddr] = useState('UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ');
  const [cryptoAmt, setCryptoAmt] = useState('1.5');
  const [cryptoMemo, setCryptoMemo] = useState('');

  // Default to crisp flat 2D view so phone cameras lock immediately off screen
  const [qrView3D, setQrView3D] = useState(false);
  const [qrResult, setQrResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [sendingTg, setSendingTg] = useState(false);

  // --- Scanner state (Live Camera + File + Clipboard Paste + Drag&Drop) ---
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanPreviewUrl, setScanPreviewUrl] = useState<string>('');
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>(() => loadScanHistory());
  const [camActive, setCamActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [camError, setCamError] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  // --- Batch QR Sheet state ---
  const [batchLines, setBatchLines] = useState(
    'https://t.me/multi_tg_bot | Telegram Бот\nhttps://www.youtube.com/@qls8571 | YouTube Канал\nWIFI:T:WPA;S:GUEST_WIFI;P:Welcome2026;; | Гостевой Wi-Fi\nhttps://t.me/QLSCENR | Контакт @QLSCENR'
  );
  const [batchItems, setBatchItems] = useState<Array<{ label: string; payload: string; image_data_url: string; download_url: string }>>([]);

  // --- Barcode & Links state ---
  const [bcVal, setBcVal] = useState('460700952011');
  const [bcKind, setBcKind] = useState('ean13');
  const [bcResult, setBcResult] = useState<any>(null);
  const [linkInput, setLinkInput] = useState('https://www.youtube.com/@qls8571?utm_source=telegram&utm_medium=post&fbclid=IwAR999');
  const [linkBundle, setLinkBundle] = useState<any>(null);

  useEffect(() => {
    if (activeTool === 'qr_decoder' || activeTool === 'qr_scanner') setSubTab('scanner');
    else if (activeTool === 'qr_batch') setSubTab('batch');
    else if (activeTool === 'barcode_gen') setSubTab('barcode');
    else if (activeTool === 'url_transformer') setSubTab('links');
    else if (activeTool === 'wifi_qr') {
      setSubTab('designer');
      setQrMode('wifi');
    } else if (activeTool === 'qr_studio') {
      setSubTab('designer');
    }
  }, [activeTool]);

  const stopCamera = useCallback(() => {
    if (scanLoopRef.current) {
      window.clearInterval(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    setCamActive(false);
  }, []);

  useEffect(() => {
    if (subTab !== 'scanner') {
      stopCamera();
    }
    return () => stopCamera();
  }, [subTab, stopCamera]);

  const pushHistory = useCallback((primary: string, contentType: string) => {
    setScanHistory((prev) => {
      const filtered = prev.filter((x) => x.text !== primary);
      const next = [
        {
          text: primary,
          type: contentType || 'QR',
          ts: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        },
        ...filtered,
      ].slice(0, 10);
      saveScanHistory(next);
      return next;
    });
  }, []);

  const generateQr = useCallback(
    async (silent = false) => {
      if (!silent) setBusy(true);
      try {
        const res = await apiPost('/api/tools/qr', {
          mode: qrMode,
          data: qrData,
          theme: qrTheme,
          shape: qrShape,
          finder_style: finderStyle,
          framed: qrFramed,
          fg_hex: useCustomColors ? fgHex : '',
          bg_hex: useCustomColors ? bgHex : '',
          badge_text: qrBadge,
          caption: qrCaption,
          wifi_ssid: wifiSsid,
          wifi_password: wifiPwd,
          wifi_security: wifiSec,
          wifi_hidden: wifiHidden,
          vcard_name: vcardName,
          vcard_phone: vcardPhone,
          vcard_email: vcardEmail,
          vcard_org: vcardOrg,
          vcard_telegram: vcardTg,
          tg_target: tgTarget,
          tg_start: tgStart,
          wa_phone: waPhone,
          wa_text: waText,
          email_to: emailTo,
          email_subject: emailSubj,
          email_body: emailBody,
          geo_lat: geoLat,
          geo_lon: geoLon,
          geo_label: geoLabel,
          crypto_net: cryptoNet,
          crypto_addr: cryptoAddr,
          crypto_amount: cryptoAmt,
          crypto_comment: cryptoMemo,
        });
        setQrResult(res);
        if (!silent) onSync();
      } catch (e: any) {
        if (!silent) onToast(e.message || 'Ошибка генерации QR');
      } finally {
        if (!silent) setBusy(false);
      }
    },
    [
      qrMode, qrData, qrTheme, qrShape, finderStyle, qrFramed, useCustomColors, fgHex, bgHex,
      qrBadge, qrCaption, wifiSsid, wifiPwd, wifiSec, wifiHidden, vcardName, vcardPhone,
      vcardEmail, vcardOrg, vcardTg, tgTarget, tgStart, waPhone, waText, emailTo, emailSubj,
      emailBody, geoLat, geoLon, geoLabel, cryptoNet, cryptoAddr, cryptoAmt, cryptoMemo, onSync, onToast,
    ]
  );

  // Debounced live preview whenever parameters change in Designer tab
  useEffect(() => {
    if (subTab !== 'designer') return;
    const t = window.setTimeout(() => {
      generateQr(true);
    }, 260);
    return () => window.clearTimeout(t);
  }, [subTab, generateQr]);

  const decodeFileHybrid = useCallback(
    async (file: File) => {
      setBusy(true);
      setCamError('');
      try {
        const objUrl = URL.createObjectURL(file);
        setScanPreviewUrl((prev) => {
          if (prev.startsWith('blob:')) URL.revokeObjectURL(prev);
          return objUrl;
        });

        // 1. Server 17-pass OpenCV + structured payload inspector (runs in parallel with client jsQR fallback)
        const fd = new FormData();
        fd.append('file', file);
        const [srvRes, localHit] = await Promise.all([
          apiForm('/api/v2/qr/decode', fd).catch(() => null),
          decodeImageClientJsQr(file),
        ]);

        if (srvRes && srvRes.found) {
          setScanResult(srvRes);
          pushHistory(srvRes.primary, srvRes.content_type);
          getTelegramWebApp()?.HapticFeedback?.notificationOccurred?.('success');
          onSync();
          onToast(`Распознано: ${srvRes.content_type}`);
          return;
        }

        if (localHit && localHit.text) {
          // Enrich local jsQR hit via omni inspector
          let inspection: any = { type: 'QR Данные', fields: [] };
          try {
            const om = await apiPost('/api/tools/omni', { text: localHit.text });
            if (om?.result?.fields) inspection = om.result;
          } catch {
            // ignore
          }
          const combined = {
            found: true,
            count: 1,
            primary: localHit.text,
            results: [localHit.text],
            content_type: inspection.type || (localHit.text.startsWith('http') ? 'Веб-ссылка (URL)' : 'Текст / Данные'),
            inspection,
            method: 'client_jsqr_hybrid',
            elapsed_ms: 8,
            image_size: `${localHit.width}×${localHit.height}`,
          };
          setScanResult(combined);
          pushHistory(combined.primary, combined.content_type);
          getTelegramWebApp()?.HapticFeedback?.notificationOccurred?.('success');
          onToast('QR-код успешно распознан');
          return;
        }

        setScanResult(
          srvRes || {
            found: false,
            message: 'Код не найден. Проверьте, что 3 поисковых квадрата QR полностью попали в кадр.',
          }
        );
        onToast('QR-код не обнаружен на изображении');
      } catch (e: any) {
        onToast(e.message || 'Ошибка чтения файла');
      } finally {
        setBusy(false);
      }
    },
    [onSync, onToast, pushHistory]
  );

  // Global Ctrl+V paste handler while Scanner tab is active
  useEffect(() => {
    if (subTab !== 'scanner') return;
    const onPaste = (ev: ClipboardEvent) => {
      const items = ev.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i += 1) {
        const it = items[i];
        if (it.type.startsWith('image/')) {
          const blob = it.getAsFile();
          if (blob) {
            ev.preventDefault();
            decodeFileHybrid(blob);
            return;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [subTab, decodeFileHybrid]);

  const pasteFromClipboardBtn = async () => {
    try {
      if (!navigator.clipboard?.read) {
        onToast('Нажмите Ctrl+V (или Cmd+V), чтобы вставить скриншот QR из буфера');
        return;
      }
      const clipItems = await navigator.clipboard.read();
      for (const item of clipItems) {
        const imgType = item.types.find((t) => t.startsWith('image/'));
        if (imgType) {
          const blob = await item.getType(imgType);
          await decodeFileHybrid(new File([blob], 'clipboard_qr.png', { type: imgType }));
          return;
        }
      }
      onToast('В буфере обмена нет картинки — скопируйте скриншот QR и повторите');
    } catch {
      onToast('Нажмите Ctrl+V на клавиатуре или выберите файл скриншота');
    }
  };

  const startLiveCamera = async (mode: 'environment' | 'user' = facingMode) => {
    stopCamera();
    setCamError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamError('Браузер не предоставил доступ к камере — загрузите фото или скриншот ниже.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCamActive(true);
      setFacingMode(mode);

      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });

      const workCvs = document.createElement('canvas');
      const AnyWin = window as any;
      const nativeDetector =
        typeof AnyWin.BarcodeDetector === 'function'
          ? new AnyWin.BarcodeDetector({ formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'upc_a'] })
          : null;

      scanLoopRef.current = window.setInterval(async () => {
        const v = videoRef.current;
        if (!v || v.readyState < 2 || !v.videoWidth) return;
        const vw = v.videoWidth;
        const vh = v.videoHeight;
        workCvs.width = vw;
        workCvs.height = vh;
        const ctx = workCvs.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(v, 0, 0, vw, vh);

        let hitText = '';
        if (nativeDetector) {
          try {
            const codes = await nativeDetector.detect(workCvs);
            if (codes?.length && codes[0].rawValue) {
              hitText = String(codes[0].rawValue);
            }
          } catch {
            // fallback to jsQR
          }
        }
        if (!hitText) {
          const imd = ctx.getImageData(0, 0, vw, vh);
          const qr = jsQR(imd.data, vw, vh, { inversionAttempts: 'attemptBoth' });
          if (qr?.data) hitText = qr.data;
        }

        if (hitText) {
          stopCamera();
          workCvs.toBlob(async (blob) => {
            if (blob) {
              await decodeFileHybrid(new File([blob], 'camera_frame.png', { type: 'image/png' }));
            } else {
              setScanResult({
                found: true,
                count: 1,
                primary: hitText,
                results: [hitText],
                content_type: hitText.startsWith('http') ? 'Веб-ссылка (URL)' : 'QR Данные',
                method: 'live_camera',
                image_size: `${vw}×${vh}`,
              });
              pushHistory(hitText, 'Live Камера');
            }
          }, 'image/png');
        }
      }, 170);
    } catch (err: any) {
      setCamError('Доступ к камере отклонён или камера занята. Используйте загрузку фото или вставку из буфера.');
    }
  };

  const testCurrentGeneratedQr = async () => {
    if (!qrResult?.image_data_url) {
      await generateQr(false);
      return;
    }
    setSubTab('scanner');
    onSelectTool('qr_decoder');
    const blob = await (await fetch(qrResult.image_data_url)).blob();
    await decodeFileHybrid(new File([blob], 'generated_qr.png', { type: 'image/png' }));
  };

  const runBatchGenerate = async () => {
    const rows = batchLines
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 12);
    if (!rows.length) {
      onToast('Введите хотя бы одну строку для пакетной генерации');
      return;
    }
    setBusy(true);
    try {
      const results = await Promise.all(
        rows.map(async (row, idx) => {
          const [rawPayload, rawLabel] = row.includes('|') ? row.split('|', 2) : [row, `Код #${idx + 1}`];
          const p = rawPayload.trim();
          const lbl = (rawLabel || '').trim() || p.slice(0, 28);
          const r = await apiPost('/api/tools/qr', {
            mode: 'text',
            data: p,
            theme: qrTheme,
            shape: qrShape,
            badge_text: qrBadge,
            caption: lbl.slice(0, 32),
            framed: true,
          });
          return {
            label: lbl,
            payload: p,
            image_data_url: r.image_data_url,
            download_url: r.download_url,
          };
        })
      );
      setBatchItems(results);
      onSync();
      onToast(`Сгенерировано ${results.length} QR-кодов`);
    } catch (e: any) {
      onToast(e.message || 'Ошибка пакетной генерации');
    } finally {
      setBusy(false);
    }
  };

  const downloadBatchPrintSheet = async () => {
    if (!batchItems.length) return;
    const cols = 3;
    const rows = Math.ceil(batchItems.length / cols);
    const cellW = 420;
    const cellH = 470;
    const cvs = document.createElement('canvas');
    cvs.width = cols * cellW + 60;
    cvs.height = rows * cellH + 80;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('MULTI_TG_TOOL • Печатный лист QR-кодов', 34, 42);

    for (let i = 0; i < batchItems.length; i += 1) {
      const item = batchItems[i];
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = 30 + c * cellW;
      const y = 62 + r * cellH;
      ctx.strokeStyle = '#cbd5e1';
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(x + 8, y + 8, cellW - 16, cellH - 16);
      ctx.setLineDash([]);
      const img = new Image();
      img.src = item.image_data_url;
      await new Promise((res) => {
        img.onload = res;
        img.onerror = res;
      });
      ctx.drawImage(img, x + 35, y + 22, 350, 385);
      ctx.fillStyle = '#334155';
      ctx.font = '14px monospace';
      ctx.fillText(item.payload.slice(0, 38), x + 36, y + 436);
    }
    const sheetUrl = cvs.toDataURL('image/png');
    triggerFileDownload(undefined, 'qr_print_sheet_a4.png', sheetUrl);
    onToast('Печатный лист PNG сохранён');
  };

  const generateBarcode = async () => {
    setBusy(true);
    try {
      const res = await apiPost('/api/tools/barcode', { value: bcVal, kind: bcKind });
      setBcResult(res);
      onSync();
    } catch (e: any) {
      onToast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const runUrlTransform = async () => {
    setBusy(true);
    try {
      const res = await apiPost('/api/v2/links/create', { url: linkInput });
      setLinkBundle(res);
      onSync();
      onToast('Ссылка очищена и сокращена');
    } catch (e: any) {
      onToast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const downloadVcardFile = (vcfText: string) => {
    const b64 = `data:text/vcard;charset=utf-8,${encodeURIComponent(vcfText)}`;
    triggerFileDownload(undefined, 'contact.vcf', b64);
    onToast('Файл контакта contact.vcf скачан');
  };

  const isFav = favorites.includes(activeTool || 'qr_studio');

  return (
    <div className="space-y-4 min-w-0">
      {/* Top Sub-Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-900/80 p-2">
        <div className="flex flex-wrap gap-1.5 min-w-0">
          {[
            { id: 'designer', tool: 'qr_studio', label: '🎨 Конструктор QR' },
            { id: 'scanner', tool: 'qr_decoder', label: '📷 Сканер (Камера / Фото)' },
            { id: 'batch', tool: 'qr_batch', label: '🗂 Пакетный A4' },
            { id: 'barcode', tool: 'barcode_gen', label: '🏷️ Штрихкоды' },
            { id: 'links', tool: 'url_transformer', label: '🔗 Анти-UTM & Короткие' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSubTab(tab.id as QrSubTab);
                onSelectTool(tab.tool);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                subTab === tab.id
                  ? 'bg-sky-500 text-slate-950 shadow shadow-sky-500/25'
                  : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onToggleFav(activeTool || 'qr_studio')}
          className={`px-2.5 py-1.5 rounded-xl text-xs border transition flex items-center gap-1 ${
            isFav ? 'bg-amber-500/20 border-amber-400/40 text-amber-200' : 'border-white/10 text-slate-400 hover:text-white'
          }`}
        >
          <Star className="w-3.5 h-3.5" /> {isFav ? 'В избранном' : 'В избранное'}
        </button>
      </div>

      {/* =====================================================================
          1. QR DESIGNER PRO (8 PAYLOAD BUILDERS + PNG/SVG + WCAG CONTRAST)
         ===================================================================== */}
      {subTab === 'designer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-4 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <QrCode className="w-5 h-5 text-sky-400 shrink-0" />
                <h3 className="font-semibold text-sm sm:text-base text-white truncate">
                  QR-Конструктор ISO 18004 (PNG + Векторный SVG)
                </h3>
              </div>
              {qrResult?.contrast && (
                <span
                  className={`text-[11px] px-2.5 py-0.5 rounded-full border shrink-0 ${
                    qrResult.contrast.safe
                      ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                      : 'bg-amber-500/15 border-amber-400/30 text-amber-300'
                  }`}
                >
                  Контраст {qrResult.contrast.ratio}:1
                </span>
              )}
            </div>

            {/* 8 Payload Modes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 rounded-xl bg-slate-950/80 border border-white/10">
              {[
                { id: 'text', label: '🔗 Ссылка / Текст' },
                { id: 'wifi', label: '📶 Wi-Fi сеть' },
                { id: 'vcard', label: '🪪 Визитка vCard' },
                { id: 'telegram', label: '✈️ Telegram' },
                { id: 'whatsapp', label: '💬 WhatsApp' },
                { id: 'email', label: '✉️ Email' },
                { id: 'geo', label: '📍 Гео-точка' },
                { id: 'crypto', label: '🪙 TON / BTC' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setQrMode(m.id as QrMode)}
                  className={`py-1.5 px-2 rounded-lg text-[11px] sm:text-xs font-medium transition truncate ${
                    qrMode === m.id ? 'bg-sky-500 text-slate-950 font-semibold' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Mode-Specific Inputs */}
            {qrMode === 'text' && (
              <div>
                <label className="text-xs text-slate-400 block mb-1">Ссылка (URL) или любой текст (UTF-8)</label>
                <textarea
                  rows={2}
                  value={qrData}
                  onChange={(e) => setQrData(e.target.value)}
                  placeholder="https://t.me/multi_tg_bot"
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-sky-400"
                />
              </div>
            )}

            {qrMode === 'wifi' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Имя сети (SSID)</label>
                  <input
                    value={wifiSsid}
                    onChange={(e) => setWifiSsid(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Пароль</label>
                  <input
                    value={wifiPwd}
                    onChange={(e) => setWifiPwd(e.target.value)}
                    placeholder="Без пароля — оставьте пустым"
                    className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Шифрование</label>
                  <div className="flex gap-2 items-center">
                    <select
                      value={wifiSec}
                      onChange={(e) => setWifiSec(e.target.value)}
                      className="flex-1 rounded-xl bg-slate-950 border border-white/10 px-2.5 py-2 text-sm text-white"
                    >
                      <option value="WPA">WPA / WPA2 / WPA3</option>
                      <option value="WEP">WEP</option>
                      <option value="nopass">Открытая сеть</option>
                    </select>
                    <label className="flex items-center gap-1 text-[11px] text-slate-300 shrink-0 cursor-pointer">
                      <input type="checkbox" checked={wifiHidden} onChange={(e) => setWifiHidden(e.target.checked)} />
                      Скрытая
                    </label>
                  </div>
                </div>
              </div>
            )}

            {qrMode === 'vcard' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  value={vcardName}
                  onChange={(e) => setVcardName(e.target.value)}
                  placeholder="Имя и Фамилия"
                  className="rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                />
                <input
                  value={vcardPhone}
                  onChange={(e) => setVcardPhone(e.target.value)}
                  placeholder="Телефон (+7...)"
                  className="rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                />
                <input
                  value={vcardTg}
                  onChange={(e) => setVcardTg(e.target.value)}
                  placeholder="@telegram или сайт"
                  className="rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                />
                <input
                  value={vcardEmail}
                  onChange={(e) => setVcardEmail(e.target.value)}
                  placeholder="Email (необязательно)"
                  className="rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                />
                <input
                  value={vcardOrg}
                  onChange={(e) => setVcardOrg(e.target.value)}
                  placeholder="Компания / Проект"
                  className="sm:col-span-2 rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                />
              </div>
            )}

            {qrMode === 'telegram' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">@username бота, канала или контакта</label>
                  <input
                    value={tgTarget}
                    onChange={(e) => setTgTarget(e.target.value)}
                    placeholder="@multi_tg_bot"
                    className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Параметр ?start= (необязательно)</label>
                  <input
                    value={tgStart}
                    onChange={(e) => setTgStart(e.target.value)}
                    placeholder="ref_2026"
                    className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
            )}

            {qrMode === 'whatsapp' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  placeholder="+7 999 000-00-00"
                  className="rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                />
                <input
                  value={waText}
                  onChange={(e) => setWaText(e.target.value)}
                  placeholder="Текст предзаполненного сообщения"
                  className="rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                />
              </div>
            )}

            {qrMode === 'email' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="Получатель (email)"
                  className="rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                />
                <input
                  value={emailSubj}
                  onChange={(e) => setEmailSubj(e.target.value)}
                  placeholder="Тема письма"
                  className="rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                />
                <input
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Текст письма (необязательно)"
                  className="sm:col-span-2 rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                />
              </div>
            )}

            {qrMode === 'geo' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  value={geoLat}
                  onChange={(e) => setGeoLat(e.target.value)}
                  placeholder="Широта (55.7558)"
                  className="rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                />
                <input
                  value={geoLon}
                  onChange={(e) => setGeoLon(e.target.value)}
                  placeholder="Долгота (37.6173)"
                  className="rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                />
                <input
                  value={geoLabel}
                  onChange={(e) => setGeoLabel(e.target.value)}
                  placeholder="Подпись точки"
                  className="rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                />
              </div>
            )}

            {qrMode === 'crypto' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <select
                  value={cryptoNet}
                  onChange={(e) => setCryptoNet(e.target.value)}
                  className="rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                >
                  <option value="ton">TON (Tonkeeper / Wallet)</option>
                  <option value="bitcoin">Bitcoin (BTC)</option>
                  <option value="ethereum">Ethereum (ETH)</option>
                  <option value="tron">TRON / USDT TRC-20</option>
                </select>
                <input
                  value={cryptoAmt}
                  onChange={(e) => setCryptoAmt(e.target.value)}
                  placeholder="Сумма (необязательно)"
                  className="rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                />
                <input
                  value={cryptoMemo}
                  onChange={(e) => setCryptoMemo(e.target.value)}
                  placeholder="Комментарий / Memo"
                  className="rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                />
                <input
                  value={cryptoAddr}
                  onChange={(e) => setCryptoAddr(e.target.value)}
                  placeholder="Адрес кошелька"
                  className="sm:col-span-3 rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs font-mono text-white"
                />
              </div>
            )}

            {/* Themes */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-400">Оптическая палитра (100% читаемость камерами)</span>
                <label className="text-xs text-sky-300 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomColors}
                    onChange={(e) => setUseCustomColors(e.target.checked)}
                  />
                  Свои HEX-цвета
                </label>
              </div>
              {!useCustomColors ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { id: 'cyber', label: '💠 Кибер-Индиго' },
                    { id: 'classic', label: '⬛ Классика ISO' },
                    { id: 'ocean', label: '🌊 Океан' },
                    { id: 'emerald', label: '🌿 Изумруд' },
                    { id: 'sunset', label: '🌅 Закат' },
                    { id: 'royal', label: '🔮 Аметист' },
                    { id: 'crimson', label: '🌹 Рубин' },
                    { id: 'amber', label: '🍯 Графит & Золото' },
                  ].map((th) => (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => setQrTheme(th.id)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-medium border text-left transition truncate ${
                        qrTheme === th.id
                          ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                          : 'bg-slate-950/60 border-white/10 text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      {th.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 p-2.5 rounded-xl bg-slate-950/80 border border-white/10">
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input type="color" value={fgHex} onChange={(e) => setFgHex(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent" />
                    Цвет модулей ({fgHex})
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input type="color" value={bgHex} onChange={(e) => setBgHex(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent" />
                    Цвет фона ({bgHex})
                  </label>
                </div>
              )}
            </div>

            {/* Module Shape + Finder Eye Style + Badge + Caption */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Модули</label>
                <select
                  value={qrShape}
                  onChange={(e) => setQrShape(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-2.5 py-2 text-xs text-white"
                >
                  <option value="rounded">Скруглённые</option>
                  <option value="square">Классический квадрат</option>
                  <option value="dots">Круглые точки</option>
                  <option value="gapped">Пиксельная сетка</option>
                  <option value="diamond">Кристалл (ромбы)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Угловые квадраты</label>
                <select
                  value={finderStyle}
                  onChange={(e) => setFinderStyle(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-2.5 py-2 text-xs text-white"
                >
                  <option value="rounded">Мягкий контур</option>
                  <option value="square">Строгий ISO</option>
                  <option value="circle">Фаска</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Лого-бейдж (до 4 симв.)</label>
                <input
                  value={qrBadge}
                  onChange={(e) => setQrBadge(e.target.value)}
                  maxLength={4}
                  placeholder="Пусто — без лого"
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-2.5 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Карточка-рамка</label>
                <button
                  type="button"
                  onClick={() => setQrFramed((v) => !v)}
                  className={`w-full py-2 px-2.5 rounded-xl text-xs font-medium border transition ${
                    qrFramed ? 'bg-sky-500/20 border-sky-400/40 text-sky-200' : 'bg-slate-950 border-white/10 text-slate-400'
                  }`}
                >
                  {qrFramed ? 'С рамкой' : 'Только матрица'}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Подпись на карточке (необязательно)</label>
              <input
                value={qrCaption}
                onChange={(e) => setQrCaption(e.target.value)}
                placeholder="Наведите камеру телефона"
                className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs sm:text-sm text-white"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => generateQr(false)}
                disabled={busy}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-slate-950 font-semibold text-sm shadow-lg shadow-sky-500/20 transition"
              >
                {busy ? 'Генерация…' : 'Обновить и сохранить QR'}
              </button>
              <button
                type="button"
                onClick={testCurrentGeneratedQr}
                className="py-2.5 px-3.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-400/30 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <CheckCircle2 className="w-4 h-4" /> Проверить сканером
              </button>
            </div>
          </div>

          {/* Preview & Export Column */}
          <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 flex flex-col items-center justify-between min-w-0">
            {qrResult ? (
              <>
                <div className="w-full flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs text-slate-300 font-medium">
                    Версия v{qrResult.version} ({qrResult.modules}×{qrResult.modules}, ECC-{qrResult.error_correction})
                  </span>
                  <div className="flex rounded-lg bg-slate-950 border border-white/10 p-0.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setQrView3D(false)}
                      className={`px-2.5 py-1 rounded-md font-semibold transition ${
                        !qrView3D ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      🖼 2D Чёткий
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrView3D(true)}
                      className={`px-2.5 py-1 rounded-md font-semibold transition ${
                        qrView3D ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      🧊 3D Голограмма
                    </button>
                  </div>
                </div>

                {qrView3D ? (
                  <HoloQr3DShowcase imageDataUrl={qrResult.image_data_url} badgeText={qrBadge} caption={qrCaption} />
                ) : (
                  <div className="p-3 rounded-2xl bg-slate-950/90 border border-white/10 shadow-xl flex items-center justify-center">
                    <img
                      src={qrResult.image_data_url}
                      alt="QR Code"
                      className="max-h-72 w-auto rounded-xl object-contain select-all"
                    />
                  </div>
                )}

                <div className="w-full mt-4 space-y-2.5">
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-xs text-slate-300">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sky-400 font-semibold">
                        {qrResult.inspection?.icon || '📌'} {qrResult.inspection?.type}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyText(qrResult.payload, onToast)}
                        className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Код текста
                      </button>
                    </div>
                    <code className="text-slate-200 break-all text-[11px] line-clamp-2">{qrResult.payload}</code>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        triggerFileDownload(qrResult.download_url, 'qr_code.png', qrResult.image_data_url);
                        onToast('Скачан PNG высокого разрешения');
                      }}
                      className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/10 transition"
                    >
                      <Download className="w-3.5 h-3.5 text-sky-400" /> Скачать PNG
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerFileDownload(qrResult.svg_download_url, 'qr_vector.svg', qrResult.svg_data_url);
                        onToast('Скачан векторный SVG');
                      }}
                      className="py-2 px-3 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-indigo-400/30 transition"
                    >
                      <Download className="w-3.5 h-3.5" /> Вектор SVG
                    </button>
                  </div>

                  {inTg && (
                    <button
                      type="button"
                      disabled={sendingTg}
                      onClick={async () => {
                        setSendingTg(true);
                        try {
                          await sendGeneratedToTelegramChat(qrResult.download_url, 'qr_code.png', qrResult.image_data_url);
                          onToast('QR-код отправлен в ваш чат с ботом');
                        } catch (e: any) {
                          onToast(e.message || 'Ошибка отправки');
                        } finally {
                          setSendingTg(false);
                        }
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-sky-600/25 hover:bg-sky-600/40 text-sky-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-sky-400/30 transition"
                    >
                      <Send className="w-3.5 h-3.5" /> {sendingTg ? 'Отправка…' : 'Отправить QR в чат Telegram'}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="py-20 text-sm text-slate-400">Подготовка QR-студии…</div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          2. LIVE CAMERA + MULTI-PASS OPENCV + CLIPBOARD QR & BARCODE SCANNER
         ===================================================================== */}
      {subTab === 'scanner' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 rounded-2xl border border-sky-400/25 bg-slate-900/80 p-4 sm:p-5 space-y-4 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
                <ScanLine className="w-5 h-5 text-sky-400" />
                Оптический Сканер QR и Штрихкодов
              </h3>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-400/30">
                Live Камера • jsQR + 17-проходный OpenCV
              </span>
            </div>

            {/* Action Buttons: Camera + Paste + Upload */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {!camActive ? (
                <button
                  type="button"
                  onClick={() => startLiveCamera('environment')}
                  className="py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <Camera className="w-4 h-4" /> Включить камеру
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="py-2.5 px-3 rounded-xl bg-rose-500/25 hover:bg-rose-500/35 text-rose-200 border border-rose-400/40 font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <CameraOff className="w-4 h-4" /> Остановить камеру
                </button>
              )}

              <button
                type="button"
                onClick={pasteFromClipboardBtn}
                className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/10 font-medium text-xs flex items-center justify-center gap-1.5 transition"
              >
                <ClipboardPaste className="w-4 h-4 text-sky-400" /> Вставить (Ctrl+V)
              </button>

              <label className="py-2.5 px-3 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer transition">
                <Upload className="w-4 h-4" /> Загрузить фото
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) decodeFileHybrid(f);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
            </div>

            {camError && (
              <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-400/30 text-xs text-amber-200">
                {camError}
              </div>
            )}

            {/* Live Camera Viewfinder */}
            {camActive && (
              <div className="relative rounded-2xl overflow-hidden border border-sky-400/40 bg-black aspect-video flex items-center justify-center">
                <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(2,6,23,0.45)] relative">
                    <div className="absolute inset-x-2 top-1/2 h-0.5 bg-emerald-400/80 animate-pulse" />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => startLiveCamera(facingMode === 'environment' ? 'user' : 'environment')}
                  className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-slate-950/85 text-white text-xs border border-white/15 flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Сменить камеру
                </button>
              </div>
            )}

            {/* Drag & Drop Zone */}
            {!camActive && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) decodeFileHybrid(f);
                }}
                className={`rounded-2xl border-2 border-dashed p-5 text-center transition ${
                  dragOver ? 'border-sky-400 bg-sky-500/10' : 'border-white/15 bg-slate-950/60'
                }`}
              >
                {scanPreviewUrl ? (
                  <div className="flex flex-col items-center gap-2">
                    <img src={scanPreviewUrl} alt="Scanned frame" className="max-h-44 rounded-xl object-contain border border-white/10" />
                    <span className="text-[11px] text-slate-400">
                      Перетащите сюда другой скриншот или нажмите Ctrl+V
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1.5 py-4">
                    <div className="text-sm font-medium text-slate-200">
                      Перетащите скриншот / фото с QR или нажмите <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300">Ctrl+V</kbd>
                    </div>
                    <p className="text-xs text-slate-400">
                      Распознаёт обычные, инвертированные (тёмные), цветные, точечные, повёрнутые QR и штрихкоды EAN-13
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Decoded Result & History */}
          <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 space-y-4 min-w-0">
            <h4 className="text-sm font-semibold text-white">Результат расшифровки</h4>

            {busy && <div className="text-xs text-sky-300 animate-pulse">Выполняется оптическое декодирование…</div>}

            {scanResult ? (
              scanResult.found ? (
                <div className="space-y-3 rounded-xl bg-slate-950/90 border border-emerald-400/30 p-3.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-emerald-300 font-semibold">
                      ✅ {scanResult.inspection?.icon || '📷'} {scanResult.content_type}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {scanResult.image_size} {scanResult.elapsed_ms ? `• ${scanResult.elapsed_ms} мс` : ''}
                    </span>
                  </div>

                  {/* Structured parsed fields (Wi-Fi password, vCard phone, FNS receipt sum, etc.) */}
                  {Array.isArray(scanResult.inspection?.fields) && scanResult.inspection.fields.length > 0 && (
                    <div className="space-y-1.5 border-t border-b border-white/10 py-2.5">
                      {scanResult.inspection.fields.map((f: { label: string; value: string }, idx: number) => (
                        <div key={idx} className="flex items-center justify-between gap-2 bg-slate-900/90 rounded-lg px-2.5 py-1.5">
                          <div className="min-w-0">
                            <span className="text-slate-400">{f.label}: </span>
                            <span className="text-white font-medium break-all">{f.value}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyText(f.value, onToast)}
                            className="text-sky-300 hover:text-sky-200 shrink-0 px-1.5 py-0.5 rounded bg-sky-500/10"
                          >
                            Копир.
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="p-2.5 rounded-lg bg-slate-900 font-mono text-slate-100 break-all max-h-36 overflow-y-auto">
                    {scanResult.primary}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => copyText(scanResult.primary, onToast)}
                      className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/30 font-medium flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" /> Скопировать всё
                    </button>

                    {(scanResult.inspection?.action_url || scanResult.primary.startsWith('http')) && (
                      <button
                        type="button"
                        onClick={() => openExternalLink(scanResult.inspection?.action_url || scanResult.primary)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 font-medium flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> {scanResult.inspection?.action_label || 'Открыть ссылку'}
                      </button>
                    )}

                    {scanResult.primary.includes('BEGIN:VCARD') && (
                      <button
                        type="button"
                        onClick={() => downloadVcardFile(scanResult.primary)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 font-medium"
                      >
                        💾 Сохранить контакт (.vcf)
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setQrMode('text');
                        setQrData(scanResult.primary);
                        setSubTab('designer');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10"
                    >
                      Пересоздать в дизайнере
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-400/30 text-xs text-amber-200">
                  {scanResult.message}
                </div>
              )
            ) : (
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 text-xs text-slate-400">
                Наведите камеру, вставьте скриншот из буфера (Ctrl+V) или выберите файл для мгновенной расшифровки.
              </div>
            )}

            {scanHistory.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">Недавние сканы</span>
                  <button
                    type="button"
                    onClick={() => {
                      setScanHistory([]);
                      saveScanHistory([]);
                    }}
                    className="text-[11px] text-slate-500 hover:text-slate-300"
                  >
                    Очистить
                  </button>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {scanHistory.map((h, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950/70 border border-white/5 text-xs">
                      <div className="min-w-0">
                        <div className="text-[10px] text-sky-400">{h.type} • {h.ts}</div>
                        <div className="text-slate-200 truncate font-mono">{h.text}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyText(h.text, onToast)}
                        className="text-slate-400 hover:text-white shrink-0 px-2 py-1 rounded bg-white/5"
                      >
                        Копир.
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          3. BATCH QR SHEET GENERATOR (NEW SUBTOOL: qr_batch)
         ===================================================================== */}
      {subTab === 'batch' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 space-y-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
              <Grid className="w-5 h-5 text-sky-400" />
              Пакетный Генератор QR + Печатный Лист Этикеток A4
            </h3>
            <span className="text-xs text-slate-400">До 12 кодов за раз (`данные | подпись`)</span>
          </div>

          <textarea
            rows={5}
            value={batchLines}
            onChange={(e) => setBatchLines(e.target.value)}
            placeholder="https://example.com | Столик №1"
            className="w-full rounded-xl bg-slate-950 border border-white/10 p-3 text-xs sm:text-sm font-mono text-white"
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runBatchGenerate}
              disabled={busy}
              className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs sm:text-sm transition"
            >
              {busy ? 'Генерация пакета…' : 'Сгенерировать пакет QR'}
            </button>
            {batchItems.length > 0 && (
              <button
                type="button"
                onClick={downloadBatchPrintSheet}
                className="px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition"
              >
                <Printer className="w-4 h-4" /> Скачать единый лист для печати (A4 PNG)
              </button>
            )}
          </div>

          {batchItems.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
              {batchItems.map((it, idx) => (
                <div key={idx} className="rounded-xl bg-slate-950/90 border border-white/10 p-2.5 flex flex-col items-center gap-2">
                  <img src={it.image_data_url} alt={it.label} className="w-full max-w-[180px] rounded-lg object-contain" />
                  <div className="text-xs font-medium text-white text-center truncate w-full">{it.label}</div>
                  <button
                    type="button"
                    onClick={() => triggerFileDownload(it.download_url, `qr_${idx + 1}.png`, it.image_data_url)}
                    className="w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-slate-200"
                  >
                    Скачать PNG
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          4. RETAIL & WAREHOUSE BARCODE GENERATOR
         ===================================================================== */}
      {subTab === 'barcode' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 space-y-4">
          <h4 className="text-sm sm:text-base font-semibold text-white">
            🏷️ Генератор Штрихкодов (EAN-13 / EAN-8 / UPC-A / Code-128)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-5">
              <label className="text-xs text-slate-400 block mb-1">Цифры или код артикула</label>
              <input
                value={bcVal}
                onChange={(e) => setBcVal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && generateBarcode()}
                className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="md:col-span-4">
              <label className="text-xs text-slate-400 block mb-1">Стандарт</label>
              <select
                value={bcKind}
                onChange={(e) => setBcKind(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
              >
                <option value="ean13">EAN-13 (Розничный товар, 12–13 цифр)</option>
                <option value="ean8">EAN-8 (Малая упаковка, 7–8 цифр)</option>
                <option value="upca">UPC-A (США/Канада, 11–12 цифр)</option>
                <option value="code128">Code-128 (Склад / Логистика ASCII)</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <button
                type="button"
                onClick={generateBarcode}
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-sm font-semibold transition"
              >
                Создать штрихкод
              </button>
            </div>
          </div>
          {bcResult && (
            <div className="space-y-3 p-4 rounded-xl bg-slate-950 border border-white/10">
              <div className="p-3 rounded-lg bg-white inline-block max-w-full overflow-hidden">
                <img src={bcResult.image_data_url} alt="Barcode" className="max-h-32 w-auto max-w-full object-contain" />
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => triggerFileDownload(bcResult.download_url, 'barcode.png', bcResult.image_data_url)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white font-semibold"
                >
                  Скачать штрихкод PNG
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          5. URL ANTI-UTM CLEANER + SHORTENER + LENGTHENER
         ===================================================================== */}
      {subTab === 'links' && (
        <div className="rounded-2xl border border-purple-400/25 bg-slate-900/80 p-4 sm:p-5 space-y-3.5 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
              <Link2 className="w-4 h-4 text-purple-400" />
              Очистка UTM-меток, Короткие и Длинные Ссылки
            </h4>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-400/30">
              /s/ + /long/
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runUrlTransform()}
              placeholder="https://example.com/?utm_source=..."
              className="flex-1 min-w-0 rounded-xl bg-slate-950 border border-white/10 px-3 py-2.5 text-xs sm:text-sm text-white"
            />
            <button
              type="button"
              onClick={runUrlTransform}
              disabled={busy}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-slate-950 font-semibold text-xs shrink-0"
            >
              Преобразовать
            </button>
          </div>
          {linkBundle && (
            <div className="space-y-2.5 text-xs p-3.5 rounded-xl bg-slate-950/90 border border-white/10 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-emerald-300 font-medium">
                  Чистая ссылка (удалено трекеров: {linkBundle.cleaned_info.removed_trackers.length}):
                </span>
                <button type="button" onClick={() => copyText(linkBundle.cleaned_info.cleaned_url, onToast)} className="text-sky-300 hover:underline shrink-0">
                  Копировать
                </button>
              </div>
              <div className="font-mono text-slate-200 break-all">{linkBundle.cleaned_info.cleaned_url}</div>

              <div className="pt-1 flex items-center justify-between gap-2">
                <span className="text-sky-300 font-medium">Короткая ссылка:</span>
                <button type="button" onClick={() => copyText(linkBundle.short_url, onToast)} className="text-sky-300 hover:underline shrink-0">
                  Копировать
                </button>
              </div>
              <button
                type="button"
                onClick={() => openExternalLink(linkBundle.short_url)}
                className="block text-left font-mono text-sky-200 hover:underline break-all"
              >
                {linkBundle.short_url}
              </button>

              <div className="pt-1 flex items-center justify-between gap-2">
                <span className="text-pink-300 font-medium">Длинная ссылка:</span>
                <button type="button" onClick={() => copyText(linkBundle.long_url, onToast)} className="text-pink-300 hover:underline shrink-0">
                  Копировать
                </button>
              </div>
              <button
                type="button"
                onClick={() => openExternalLink(linkBundle.long_url)}
                className="block text-left font-mono text-[11px] text-pink-200/90 hover:underline break-all line-clamp-2"
              >
                {linkBundle.long_url}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
