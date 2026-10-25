import React, { useEffect, useState } from 'react';
import {
  Camera,
  Download,
  Eye,
  FileCode2,
  FileText,
  Lock,
  Palette,
  QrCode,
  Send,
  Shield,
  Sparkles,
  Upload,
} from 'lucide-react';
import {
  apiForm,
  apiPost,
  copyText,
  isInsideTelegram,
  openExternalLink,
  sendGeneratedToTelegramChat,
  triggerFileDownload,
} from '../../lib/api';
import { HoloQr3DShowcase } from '../three/Tilt3DCard';

const FileActionRow: React.FC<{
  downloadUrl?: string;
  dataUrl?: string;
  filename: string;
  label?: string;
  onToast: (msg: string) => void;
}> = ({ downloadUrl, dataUrl, filename, label = 'Скачать файл', onToast }) => {
  const inTg = isInsideTelegram();
  const [sending, setSending] = useState(false);

  return (
    <div className="flex flex-wrap gap-2 w-full">
      <button
        type="button"
        onClick={() => {
          triggerFileDownload(downloadUrl, filename, dataUrl);
          onToast(`Загрузка: ${filename}`);
        }}
        className="flex-1 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium flex items-center justify-center gap-1.5 border border-white/10 transition"
      >
        <Download className="w-3.5 h-3.5 text-sky-400" /> {label}
      </button>
      {inTg && (
        <button
          type="button"
          disabled={sending}
          onClick={async () => {
            setSending(true);
            try {
              await sendGeneratedToTelegramChat(downloadUrl, filename, dataUrl);
              onToast('Файл отправлен вам в чат с ботом');
            } catch (e: any) {
              onToast(e.message || 'Не удалось отправить в чат');
            } finally {
              setSending(false);
            }
          }}
          className="py-2 px-3 rounded-xl bg-sky-600/25 hover:bg-sky-600/40 text-sky-200 text-xs font-medium flex items-center justify-center gap-1.5 border border-sky-400/30 transition disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" /> {sending ? 'Отправка...' : 'В чат ТГ'}
        </button>
      )}
    </div>
  );
};

interface Props {
  activeCategory: string;
  activeTool: string;
  onSelectTool: (t: string) => void;
  favorites: string[];
  onToggleFav: (toolId: string) => void;
  onSync: () => void;
  onToast: (msg: string) => void;
}

export const VisualMediaHub: React.FC<Props> = ({
  activeCategory,
  activeTool,
  onSelectTool,
  favorites,
  onToggleFav,
  onSync,
  onToast,
}) => {
  // --- QR & Barcode State ---
  const [qrSubTab, setQrSubTab] = useState<'designer' | 'barcode' | 'scanner' | 'links'>('designer');
  const [qrMode, setQrMode] = useState<'text' | 'wifi' | 'vcard'>('text');
  const [qrData, setQrData] = useState('https://t.me/multi_tg_bot');
  const [qrTheme, setQrTheme] = useState('cyber');
  const [qrShape, setQrShape] = useState('rounded');
  const [qrBadge, setQrBadge] = useState('MT');
  const [qrCaption, setQrCaption] = useState('MULTI_TG_TOOL • @multi_tg_bot');
  const [wifiSsid, setWifiSsid] = useState('MULTI_5G_PRO');
  const [wifiPwd, setWifiPwd] = useState('CyberAccess2026');
  const [vcardName, setVcardName] = useState('QLS');
  const [vcardPhone, setVcardPhone] = useState('+7 999 000-00-00');
  const [vcardTg, setVcardTg] = useState('@QLSCENR');
  const [qrResult, setQrResult] = useState<any>(null);
  const [qrView3D, setQrView3D] = useState<boolean>(true);

  const [bcVal, setBcVal] = useState('MT-2026-001');
  const [bcKind, setBcKind] = useState('code128');
  const [bcResult, setBcResult] = useState<any>(null);

  // --- Image, Stego & Code Card State ---
  const [imgSubTab, setImgSubTab] = useState<'stego' | 'code' | 'exif' | 'transform'>('stego');
  const [stegoSecret, setStegoSecret] = useState('Скрытое сообщение в PNG-контейнере');
  const [stegoPassword, setStegoPassword] = useState('omega2026');
  const [stegoCover, setStegoCover] = useState<File | null>(null);
  const [stegoEncoded, setStegoEncoded] = useState<any>(null);

  const [stegoDecodeFile, setStegoDecodeFile] = useState<File | null>(null);
  const [stegoDecodePwd, setStegoDecodePwd] = useState('omega2026');
  const [stegoDecodedResult, setStegoDecodedResult] = useState<any>(null);

  const [codeSnippet, setCodeSnippet] = useState(
    `from aiogram import Router\n\nrouter = Router(name="main")\n\nasync def launch_tool(user_id: int) -> dict:\n    return {"user": user_id, "status": "ok"}`
  );
  const [codeLang, setCodeLang] = useState('python');
  const [codeTheme, setCodeTheme] = useState('tokyo');
  const [codeTitle, setCodeTitle] = useState('bot_handler.py');
  const [codeCardRes, setCodeCardRes] = useState<any>(null);

  const [imgWorkFile, setImgWorkFile] = useState<File | null>(null);
  const [exifRes, setExifRes] = useState<any>(null);
  const [transformAction, setTransformAction] = useState('sticker');
  const [transformRes, setTransformRes] = useState<any>(null);

  // --- PDF State ---
  const [pdfSubTab, setPdfSubTab] = useState<'create' | 'photos' | 'inspect'>('create');
  const [pdfTitle, setPdfTitle] = useState('Документ');
  const [pdfBody, setPdfBody] = useState(
    `# Заголовок документа\nОсновной текст документа с поддержкой кириллицы.\n\n## Пункты\n- Первый пункт\n- Второй пункт\n- Третий пункт`
  );
  const [pdfCreated, setPdfCreated] = useState<any>(null);
  const [imgPdfFiles, setImgPdfFiles] = useState<File[]>([]);
  const [imgPdfRes, setImgPdfRes] = useState<any>(null);
  const [pdfUpload, setPdfUpload] = useState<File | null>(null);
  const [pdfInspectRes, setPdfInspectRes] = useState<any>(null);
  const [pdfPagesSpec, setPdfPagesSpec] = useState('');
  const [pdfRotate, setPdfRotate] = useState(0);
  const [pdfPwd, setPdfPwd] = useState('');
  const [pdfTransRes, setPdfTransRes] = useState<any>(null);

  // --- v2: QR Decoder & URL Shortener / Lengthener ---
  const [qrScanFile, setQrScanFile] = useState<File | null>(null);
  const [qrScanResult, setQrScanResult] = useState<any>(null);
  const [linkInput, setLinkInput] = useState('https://www.youtube.com/@qls8571?utm_source=telegram&utm_medium=post&fbclid=IwAR999');
  const [linkBundle, setLinkBundle] = useState<any>(null);

  const [busy, setBusy] = useState(false);

  const runQrDecode = async (customFile?: File | null) => {
    setBusy(true);
    try {
      let targetFile = customFile || qrScanFile;
      if (!targetFile && qrResult?.image_data_url) {
        const blob = await (await fetch(qrResult.image_data_url)).blob();
        targetFile = new File([blob], 'generated_qr.png', { type: 'image/png' });
      }
      if (!targetFile) {
        onToast('Выберите картинку с QR-кодом!');
        return;
      }
      const fd = new FormData();
      fd.append('file', targetFile);
      const res = await apiForm('/api/v2/qr/decode', fd);
      setQrScanResult(res);
      onSync();
      onToast(res.found ? 'QR-код успешно прочитан! 📷' : 'QR-код не найден на картинке');
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
      onToast('Ссылка очищена, укорочена и удлинена! 🔗');
    } catch (e: any) {
      onToast(e.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (activeTool === 'barcode_gen') {
      setQrSubTab('barcode');
    } else if (activeTool === 'qr_scanner') {
      setQrSubTab('scanner');
    } else if (activeTool === 'url_transformer') {
      setQrSubTab('links');
    } else if (activeTool === 'wifi_qr') {
      setQrSubTab('designer');
      setQrMode('wifi');
    } else if (activeTool === 'vcard_qr') {
      setQrSubTab('designer');
      setQrMode('vcard');
    } else if (activeTool === 'qr_studio') {
      setQrSubTab('designer');
      setQrMode('text');
    }

    if (activeTool === 'stego_lab') setImgSubTab('stego');
    else if (activeTool === 'code_card') setImgSubTab('code');
    else if (activeTool === 'exif_clean') setImgSubTab('exif');
    else if (activeTool === 'img_transform') setImgSubTab('transform');

    if (activeTool === 'text_to_pdf') setPdfSubTab('create');
    else if (activeTool === 'img_to_pdf') setPdfSubTab('photos');
    else if (activeTool === 'pdf_inspect' || activeTool === 'pdf_protect') setPdfSubTab('inspect');
  }, [activeTool]);

  // Initial auto-preview for QR & Code Card
  useEffect(() => {
    if (activeCategory === 'qr' && !qrResult) {
      generateQr();
    }
    if (activeCategory === 'image' && imgSubTab === 'code' && !codeCardRes) {
      generateCodeCard();
    }
  }, [activeCategory, imgSubTab]);

  const generateQr = async () => {
    setBusy(true);
    try {
      const res = await apiPost('/api/tools/qr', {
        mode: qrMode,
        data: qrData,
        theme: qrTheme,
        shape: qrShape,
        badge_text: qrBadge,
        caption: qrCaption,
        wifi_ssid: wifiSsid,
        wifi_password: wifiPwd,
        vcard_name: vcardName,
        vcard_phone: vcardPhone,
        vcard_telegram: vcardTg,
      });
      setQrResult(res);
      onSync();
    } catch (e: any) {
      onToast(e.message);
    } finally {
      setBusy(false);
    }
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

  const runStegoEncode = async () => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('secret_text', stegoSecret);
      fd.append('password', stegoPassword);
      if (stegoCover) fd.append('file', stegoCover);
      const res = await apiForm('/api/tools/stego/encode', fd);
      setStegoEncoded(res);
      onSync();
      onToast('Секрет успешно зашифрован внутри пикселей PNG 🕵️');
    } catch (e: any) {
      onToast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyGeneratedStego = async () => {
    if (!stegoEncoded?.image_data_url) return;
    setBusy(true);
    try {
      const blob = await (await fetch(stegoEncoded.image_data_url)).blob();
      const f = new File([blob], 'stego_carrier.png', { type: 'image/png' });
      const fd = new FormData();
      fd.append('file', f);
      fd.append('password', stegoDecodePwd);
      const res = await apiForm('/api/tools/stego/decode', fd);
      setStegoDecodedResult(res);
      onToast('Тайное послание успешно извлечено и расшифровано! 🔓');
    } catch (e: any) {
      onToast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const runStegoDecodeFile = async () => {
    if (!stegoDecodeFile) {
      onToast('Выберите PNG-файл со скрытым сообщением');
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', stegoDecodeFile);
      fd.append('password', stegoDecodePwd);
      const res = await apiForm('/api/tools/stego/decode', fd);
      setStegoDecodedResult(res);
      onSync();
    } catch (e: any) {
      onToast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const generateCodeCard = async () => {
    setBusy(true);
    try {
      const res = await apiPost('/api/tools/code-card', {
        code: codeSnippet,
        language: codeLang,
        title: codeTitle,
        theme: codeTheme,
      });
      setCodeCardRes(res);
      onSync();
    } catch (e: any) {
      onToast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const getOrMakeDemoImageFile = async (): Promise<File> => {
    if (imgWorkFile) return imgWorkFile;
    const card = await apiPost('/api/tools/code-card', {
      code: 'print("MULTI_TG_TOOL Image Sample")',
      language: 'python',
      title: 'sample.py',
      theme: 'emerald',
    });
    const blob = await (await fetch(card.image_data_url)).blob();
    return new File([blob], 'sample_artwork.png', { type: 'image/png' });
  };

  const runExifInspect = async () => {
    setBusy(true);
    try {
      const file = await getOrMakeDemoImageFile();
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiForm('/api/tools/image/exif', fd);
      setExifRes(res);
      onSync();
    } catch (e: any) {
      onToast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const runImgTransform = async () => {
    setBusy(true);
    try {
      const file = await getOrMakeDemoImageFile();
      const fd = new FormData();
      fd.append('file', file);
      fd.append('action', transformAction);
      const res = await apiForm('/api/tools/image/transform', fd);
      setTransformRes(res);
      onSync();
    } catch (e: any) {
      onToast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const runCreatePdf = async () => {
    setBusy(true);
    try {
      const res = await apiPost('/api/tools/pdf/from-text', {
        title: pdfTitle,
        content: pdfBody,
      });
      setPdfCreated(res);
      onSync();
      onToast('PDF документ с кириллицей успешно сгенерирован 📑');
    } catch (e: any) {
      onToast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const getOrMakeDemoPdf = async (): Promise<File> => {
    if (pdfUpload) return pdfUpload;
    const created = await apiPost('/api/tools/pdf/from-text', {
      title: pdfTitle,
      content: pdfBody,
    });
    const blob = await (await fetch(created.download_url)).blob();
    return new File([blob], 'demo_document.pdf', { type: 'application/pdf' });
  };

  const runPdfInspect = async () => {
    setBusy(true);
    try {
      const f = await getOrMakeDemoPdf();
      const fd = new FormData();
      fd.append('file', f);
      const res = await apiForm('/api/tools/pdf/inspect', fd);
      setPdfInspectRes(res);
      onSync();
    } catch (e: any) {
      onToast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const runPdfTransform = async () => {
    setBusy(true);
    try {
      const f = await getOrMakeDemoPdf();
      const fd = new FormData();
      fd.append('file', f);
      fd.append('pages_spec', pdfPagesSpec);
      fd.append('rotate_deg', String(pdfRotate));
      fd.append('password', pdfPwd);
      const res = await apiForm('/api/tools/pdf/transform', fd);
      setPdfTransRes(res);
      onSync();
      onToast('PDF успешно обработан!');
    } catch (e: any) {
      onToast(e.message);
    } finally {
      setBusy(false);
    }
  };

  // =========================================================================
  // HUB 1: QR & BARCODES
  // =========================================================================
  if (activeCategory === 'qr') {
    const isFav = favorites.includes(activeTool || 'qr_studio');
    return (
      <div className="space-y-5 min-w-0">
        {qrSubTab === 'designer' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Controls */}
            <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-slate-900/70 p-4 sm:p-5 space-y-4 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <QrCode className="w-5 h-5 text-sky-400 shrink-0" />
                  <h3 className="font-semibold text-sm sm:text-base text-white truncate">
                    Дизайнер Градиентных QR-кодов
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleFav(activeTool || 'qr_studio')}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition shrink-0 ${
                    isFav
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                      : 'bg-white/5 text-slate-400 border-white/10'
                  }`}
                >
                  {isFav ? '★ В избранном' : '☆ В избранное'}
                </button>
              </div>

              {/* Mode Switch */}
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2 p-1 rounded-xl bg-slate-950/70 border border-white/10">
                {[
                  { id: 'text', tool: 'qr_studio', label: '🔗 Ссылка / Текст' },
                  { id: 'wifi', tool: 'wifi_qr', label: '📶 Wi-Fi сеть' },
                  { id: 'vcard', tool: 'vcard_qr', label: '🪪 Визитка vCard' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setQrMode(t.id as any);
                      onSelectTool(t.tool);
                    }}
                    className={`py-2 px-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition truncate ${
                      qrMode === t.id ? 'bg-sky-500 text-slate-950 font-semibold' : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

            {qrMode === 'text' && (
              <div>
                <label className="text-xs text-slate-400 block mb-1">URL или произвольный текст</label>
                <input
                  value={qrData}
                  onChange={(e) => setQrData(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                />
              </div>
            )}

            {qrMode === 'wifi' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Название сети (SSID)</label>
                  <input
                    value={wifiSsid}
                    onChange={(e) => setWifiSsid(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Пароль WPA/WPA2</label>
                  <input
                    value={wifiPwd}
                    onChange={(e) => setWifiPwd(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
            )}

            {qrMode === 'vcard' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  value={vcardName}
                  onChange={(e) => setVcardName(e.target.value)}
                  placeholder="Имя Фамилия"
                  className="rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                />
                <input
                  value={vcardPhone}
                  onChange={(e) => setVcardPhone(e.target.value)}
                  placeholder="Телефон"
                  className="rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                />
                <input
                  value={vcardTg}
                  onChange={(e) => setVcardTg(e.target.value)}
                  placeholder="@telegram"
                  className="rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                />
              </div>
            )}

            {/* Theme & Shape */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'cyber', label: '🌌 Кибер Неон' },
                { id: 'telegram', label: '💎 Telegram Blue' },
                { id: 'emerald', label: '🌿 Изумруд' },
                { id: 'sunset', label: '🌅 Закат' },
                { id: 'royal', label: '🔮 Индиго' },
                { id: 'classic', label: '⬛ Классика' },
              ].map((th) => (
                <button
                  key={th.id}
                  onClick={() => setQrTheme(th.id)}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border text-left transition ${
                    qrTheme === th.id
                      ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                      : 'bg-slate-950/60 border-white/10 text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {th.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Форма модулей</label>
                <select
                  value={qrShape}
                  onChange={(e) => setQrShape(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                >
                  <option value="rounded">Скруглённый</option>
                  <option value="dots">Круглые точки</option>
                  <option value="gapped">Пиксельная сетка</option>
                  <option value="vbars">Вертикальные линии</option>
                  <option value="square">Строгий квадрат</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Центральный бейдж</label>
                <input
                  value={qrBadge}
                  onChange={(e) => setQrBadge(e.target.value)}
                  maxLength={6}
                  placeholder="MT"
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Подпись снизу</label>
                <input
                  value={qrCaption}
                  onChange={(e) => setQrCaption(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                />
              </div>
            </div>

            <button
              onClick={generateQr}
              disabled={busy}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-slate-950 font-semibold text-sm shadow-lg shadow-sky-500/20 transition"
            >
              ✨ Сгенерировать дизайнерский QR-код
            </button>
          </div>

          {/* Live QR Canvas Preview (2D + Interactive 3D Hologram) */}
          <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-slate-900/70 p-4 sm:p-5 flex flex-col items-center justify-between min-w-0">
            {qrResult ? (
              <>
                <div className="w-full flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold text-slate-300">Предпросмотр QR</span>
                  <div className="flex rounded-lg bg-slate-950 border border-white/10 p-0.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setQrView3D(true)}
                      className={`px-2.5 py-1 rounded-md font-semibold transition ${
                        qrView3D ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      🧊 3D Сцена
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrView3D(false)}
                      className={`px-2.5 py-1 rounded-md font-semibold transition ${
                        !qrView3D ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      🖼 2D PNG
                    </button>
                  </div>
                </div>

                {qrView3D ? (
                  <HoloQr3DShowcase
                    imageDataUrl={qrResult.image_data_url}
                    badgeText={qrBadge}
                    caption={qrCaption}
                  />
                ) : (
                  <div className="p-3 rounded-2xl bg-slate-950/80 border border-white/10 shadow-xl">
                    <img
                      src={qrResult.image_data_url}
                      alt="Styled QR"
                      className="max-h-72 w-auto rounded-xl object-contain"
                    />
                  </div>
                )}

                <div className="w-full mt-4 space-y-2">
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-xs text-slate-300">
                    <span className="text-sky-400 font-semibold">{qrResult.inspection?.type}:</span>{' '}
                    <code className="text-slate-200 break-all">{qrResult.payload.slice(0, 95)}</code>
                  </div>
                  <FileActionRow
                    downloadUrl={qrResult.download_url}
                    dataUrl={qrResult.image_data_url}
                    filename="qr_code.png"
                    label="Скачать PNG"
                    onToast={onToast}
                  />
                </div>
              </>
            ) : (
              <div className="py-20 text-sm text-slate-400">Генерация предпросмотра…</div>
            )}
          </div>
        </div>
        )}

        {/* Barcode Generator Card */}
        {qrSubTab === 'barcode' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 sm:p-5">
          <h4 className="text-sm font-semibold text-white mb-3">🏷️ Генератор Товарных и Складских Штрихкодов (Code128 / EAN-13)</h4>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-5">
              <label className="text-xs text-slate-400 block mb-1">Значение штрихкода</label>
              <input
                value={bcVal}
                onChange={(e) => setBcVal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && generateBarcode()}
                className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="md:col-span-3">
              <label className="text-xs text-slate-400 block mb-1">Стандарт</label>
              <select
                value={bcKind}
                onChange={(e) => setBcKind(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
              >
                <option value="code128">Code 128 (Универсальный)</option>
                <option value="ean13">EAN-13 (12–13 цифр)</option>
              </select>
            </div>
            <div className="md:col-span-4">
              <button
                type="button"
                onClick={generateBarcode}
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-sm font-semibold transition"
              >
                Создать штрихкод PNG
              </button>
            </div>
          </div>
          {bcResult && (
            <div className="mt-4 space-y-3 p-3 rounded-xl bg-slate-950 border border-white/10">
              <div className="p-2 rounded-lg bg-white inline-block max-w-full overflow-hidden">
                <img src={bcResult.image_data_url} alt="Barcode" className="max-h-28 w-auto max-w-full object-contain" />
              </div>
              <FileActionRow
                downloadUrl={bcResult.download_url}
                dataUrl={bcResult.image_data_url}
                filename="barcode.png"
                label="Скачать штрихкод PNG"
                onToast={onToast}
              />
            </div>
          )}
        </div>
        )}

        {/* v2: QR Image Scanner */}
        {qrSubTab === 'scanner' && (
          <div className="rounded-2xl border border-sky-400/25 bg-slate-900/75 p-4 sm:p-5 space-y-3.5 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                📷 Сканер и Расшифровка QR по Картинке
              </h4>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-400/30">
                OpenCV Multi-Pass
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Загрузите скриншот или фото QR-кода (даже инвертированного или цветного), либо проверьте сгенерированный QR в 1 клик.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 min-w-0">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setQrScanFile(f);
                  if (f) runQrDecode(f);
                }}
                className="flex-1 min-w-0 max-w-full overflow-hidden text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-sky-500/20 file:text-sky-200 hover:file:bg-sky-500/30"
              />
              <button
                type="button"
                onClick={() => runQrDecode(null)}
                disabled={busy}
                className="px-4 py-2.5 rounded-xl bg-sky-500 text-slate-950 font-semibold text-xs shrink-0 hover:bg-sky-400 transition"
              >
                🔍 Считать QR
              </button>
            </div>
            {qrScanResult && (
              <div className="p-3.5 rounded-xl bg-slate-950/90 border border-white/10 space-y-2 text-xs">
                {qrScanResult.found ? (
                  <>
                    <div className="flex items-center justify-between text-emerald-300 font-semibold">
                      <span>✅ Распознано ({qrScanResult.content_type})</span>
                      <span className="text-slate-400">{qrScanResult.image_size}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 font-mono text-white break-all">
                      {qrScanResult.primary}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => copyText(qrScanResult.primary, onToast)}
                        className="px-3 py-1.5 rounded-lg bg-sky-500/20 text-sky-200 border border-sky-400/30"
                      >
                        Скопировать содержимое
                      </button>
                      {qrScanResult.primary.startsWith('http') && (
                        <button
                          type="button"
                          onClick={() => openExternalLink(qrScanResult.primary)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-200 border border-emerald-400/30"
                        >
                          Открыть ссылку ↗
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-amber-300">{qrScanResult.message}</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* URL Shortener, Lengthener & Tracker Cleaner */}
        {qrSubTab === 'links' && (
          <div className="rounded-2xl border border-purple-400/25 bg-slate-900/75 p-4 sm:p-5 space-y-3.5 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-white">🔗 Укоротитель, Удлинитель & Анти-UTM Ссылок</h4>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-400/30">
                /s/ + /long/
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Срезает следящие метки (utm_*, fbclid, yclid), создаёт рабочую короткую ссылку и сверхдлинную ссылку-редирект.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runUrlTransform()}
                placeholder="https://example.com/..."
                className="flex-1 min-w-0 rounded-xl bg-slate-950 border border-white/10 px-3 py-2.5 text-xs sm:text-sm text-white"
              />
              <button
                type="button"
                onClick={runUrlTransform}
                disabled={busy}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-slate-950 font-semibold text-xs shrink-0"
              >
                ⚡ Преобразовать
              </button>
            </div>
            {linkBundle && (
              <div className="space-y-2 text-xs p-3.5 rounded-xl bg-slate-950/90 border border-white/10 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-emerald-300 font-medium">🧹 Без UTM ({linkBundle.cleaned_info.removed_trackers.length} удалено):</span>
                  <button type="button" onClick={() => copyText(linkBundle.cleaned_info.cleaned_url, onToast)} className="text-sky-300 hover:underline shrink-0">Копировать</button>
                </div>
                <div className="font-mono text-slate-200 break-all">{linkBundle.cleaned_info.cleaned_url}</div>

                <div className="pt-1 flex items-center justify-between gap-2">
                  <span className="text-sky-300 font-medium">Короткая ссылка:</span>
                  <button type="button" onClick={() => copyText(linkBundle.short_url, onToast)} className="text-sky-300 hover:underline shrink-0">Копировать</button>
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
                  <button type="button" onClick={() => copyText(linkBundle.long_url, onToast)} className="text-pink-300 hover:underline shrink-0">Копировать</button>
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
  }

  // =========================================================================
  // HUB 2: IMAGE LAB, LSB STEGANOGRAPHY & CARBON CODE CARD
  // =========================================================================
  if (activeCategory === 'image') {
    return (
      <div className="space-y-5 min-w-0">
        {imgSubTab === 'stego' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Hide Secret */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-3.5">
              <div className="flex items-center gap-2 text-purple-300 font-semibold text-sm">
                <Shield className="w-4 h-4" /> Спрятать секретный текст внутри пикселей PNG
              </div>
              <p className="text-xs text-slate-400">
                Шифрует послание алгоритмом <code className="text-purple-300">AES-256-GCM</code> и записывает биты в младшие разряды RGB без видимых глазу изменений!
              </p>
              <textarea
                rows={3}
                value={stegoSecret}
                onChange={(e) => setStegoSecret(e.target.value)}
                placeholder="Тайное сообщение…"
                className="w-full rounded-xl bg-slate-950 border border-white/10 p-3 text-sm text-white focus:outline-none focus:border-purple-400"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Пароль AES-256 (опционально)</label>
                  <input
                    value={stegoPassword}
                    onChange={(e) => {
                      setStegoPassword(e.target.value);
                      setStegoDecodePwd(e.target.value);
                    }}
                    className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Своя картинка (или авто-обложка)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setStegoCover(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-300 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:bg-purple-500/20 file:text-purple-200"
                  />
                </div>
              </div>
              <button
                onClick={runStegoEncode}
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold text-sm shadow-lg transition"
              >
                🕵️ Зашифровать и вшить в PNG
              </button>

              {stegoEncoded && (
                <div className="p-3 rounded-xl bg-slate-950/80 border border-purple-500/30 space-y-2.5">
                  <img
                    src={stegoEncoded.image_data_url}
                    alt="Stego Carrier"
                    className="max-h-48 mx-auto rounded-lg object-contain"
                  />
                  <div className="text-xs text-slate-300 flex items-center justify-between">
                    <span>Ёмкость занята: {stegoEncoded.meta.usage_pct}%</span>
                    <span>{stegoEncoded.meta.width}×{stegoEncoded.meta.height} PNG</span>
                  </div>
                  <div className="space-y-2">
                    <FileActionRow
                      downloadUrl={stegoEncoded.download_url}
                      dataUrl={stegoEncoded.image_data_url}
                      filename="stego_carrier.png"
                      label="Скачать PNG"
                      onToast={onToast}
                    />
                    <button
                      onClick={verifyGeneratedStego}
                      className="w-full py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-xs text-emerald-200 font-medium"
                    >
                      🔓 Проверить расшифровку →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Decode Secret */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-3.5">
              <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
                <Eye className="w-4 h-4" /> Извлечь тайное послание из PNG
              </div>
              <p className="text-xs text-slate-400">
                Загрузите PNG-контейнер со скрытым сообщением и введите пароль (если он задавался):
              </p>
              <input
                type="file"
                accept="image/png"
                onChange={(e) => setStegoDecodeFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-emerald-500/20 file:text-emerald-200"
              />
              <div>
                <label className="text-xs text-slate-400 block mb-1">Пароль дешифровки</label>
                <input
                  value={stegoDecodePwd}
                  onChange={(e) => setStegoDecodePwd(e.target.value)}
                  placeholder="Оставьте пустым, если без пароля"
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                />
              </div>
              <button
                onClick={runStegoDecodeFile}
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 font-semibold text-sm transition"
              >
                🔎 Извлечь скрытый текст из файла
              </button>

              {stegoDecodedResult && (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-400/40 space-y-2">
                  <div className="flex items-center justify-between text-xs text-emerald-300">
                    <span>✅ Скрытый контейнер прочитан ({stegoDecodedResult.dimensions})</span>
                    <button
                      onClick={() => copyText(stegoDecodedResult.secret_text, onToast)}
                      className="underline hover:text-white"
                    >
                      Копировать
                    </button>
                  </div>
                  <pre className="p-3 rounded-lg bg-slate-950 text-xs text-white whitespace-pre-wrap break-words font-mono">
                    {stegoDecodedResult.secret_text}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {imgSubTab === 'code' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-6 rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-3">
              <div className="flex items-center gap-2 text-sky-300 font-semibold text-sm">
                <FileCode2 className="w-4 h-4" /> Carbon Скриншот Кода (macOS карточка)
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  value={codeTitle}
                  onChange={(e) => setCodeTitle(e.target.value)}
                  placeholder="bot.py"
                  className="rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                />
                <select
                  value={codeLang}
                  onChange={(e) => setCodeLang(e.target.value)}
                  className="rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                >
                  <option value="python">Python</option>
                  <option value="typescript">TypeScript</option>
                  <option value="javascript">JavaScript</option>
                  <option value="sql">SQL</option>
                  <option value="bash">Bash</option>
                  <option value="json">JSON</option>
                  <option value="go">Go</option>
                  <option value="rust">Rust</option>
                </select>
                <select
                  value={codeTheme}
                  onChange={(e) => setCodeTheme(e.target.value)}
                  className="rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                >
                  <option value="tokyo">Tokyo Night</option>
                  <option value="dracula">Dracula</option>
                  <option value="emerald">Matrix Emerald</option>
                </select>
              </div>
              <textarea
                rows={8}
                value={codeSnippet}
                onChange={(e) => setCodeSnippet(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-white/10 p-3 font-mono text-xs text-slate-100 focus:outline-none focus:border-sky-400"
              />
              <button
                onClick={generateCodeCard}
                className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-sm transition"
              >
                📸 Срендерить карточку кода
              </button>
            </div>
            <div className="lg:col-span-6 rounded-2xl border border-white/10 bg-slate-900/70 p-5 flex flex-col justify-between items-center">
              {codeCardRes ? (
                <>
                  <img
                    src={codeCardRes.image_data_url}
                    alt="Code Card"
                    className="max-h-80 w-auto rounded-xl shadow-2xl object-contain"
                  />
                  <div className="mt-4 w-full">
                    <FileActionRow
                      downloadUrl={codeCardRes.download_url}
                      dataUrl={codeCardRes.image_data_url}
                      filename="code_card.png"
                      label="Скачать PNG карточку"
                      onToast={onToast}
                    />
                  </div>
                </>
              ) : (
                <div className="py-20 text-sm text-slate-400">Рендеринг…</div>
              )}
            </div>
          </div>
        )}

        {(imgSubTab === 'exif' || imgSubTab === 'transform') && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Palette className="w-4 h-4 text-purple-400" />
                  {imgSubTab === 'exif'
                    ? 'Приватная очистка EXIF и извлечение палитры цветов'
                    : 'Конвертер в Telegram Стикер 512×512 WEBP & Фильтры'}
                </h4>
                <p className="text-xs text-slate-400">
                  Выберите своё изображение (или нажмите запуск сразу — подставится демо-иллюстрация)
                </p>
              </div>
              <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white font-medium flex items-center gap-2">
                <Upload className="w-4 h-4 text-sky-400" />
                {imgWorkFile ? imgWorkFile.name : 'Выбрать фото…'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setImgWorkFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            {imgSubTab === 'exif' ? (
              <>
                <button
                  onClick={runExifInspect}
                  disabled={busy}
                  className="px-5 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white text-sm font-semibold transition"
                >
                  🧹 Проанализировать и очистить метаданные EXIF
                </button>
                {exifRes && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-white/10 space-y-2 text-xs">
                      <div className="text-slate-300">
                        Разрешение: <b className="text-white">{exifRes.info.width}×{exifRes.info.height}</b> ({exifRes.info.megapixels} MP)
                      </div>
                      <div className="text-slate-300">
                        Размер: {exifRes.info.original_size_kb} КБ → <b className="text-emerald-400">{exifRes.info.clean_size_kb} КБ</b>
                      </div>
                      <div className="text-slate-300">
                        Найдено и удалено EXIF-полей: <b className="text-amber-300">{exifRes.info.exif_found_count}</b>
                      </div>
                      <div className="pt-2">
                        <div className="text-slate-400 mb-1.5">Доминантная палитра (клик для копирования HEX):</div>
                        <div className="flex flex-wrap gap-2">
                          {exifRes.info.palette.map((hex: string) => (
                            <button
                              key={hex}
                              onClick={() => copyText(hex, onToast)}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 text-xs text-white"
                            >
                              <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: hex }} />
                              {hex}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-white/10 flex flex-col items-center justify-between gap-3">
                      <img src={exifRes.clean_image_data_url} alt="Clean" className="max-h-44 rounded-lg object-contain" />
                      <FileActionRow
                        downloadUrl={exifRes.download_url}
                        dataUrl={exifRes.clean_image_data_url}
                        filename="clean_no_exif.png"
                        label="Скачать очищенное фото"
                        onToast={onToast}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'sticker', label: '🎭 Telegram Стикер 512px WEBP' },
                    { id: 'cyberpunk', label: '🌆 Киберпанк Дуотон' },
                    { id: 'pixelate', label: '🕹 8-Bit Пиксель-Арт' },
                    { id: 'edges', label: '⚡ Неоновый Контур' },
                    { id: 'grayscale', label: '🌑 Монохром' },
                  ].map((act) => (
                    <button
                      key={act.id}
                      onClick={() => setTransformAction(act.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border ${
                        transformAction === act.id
                          ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                          : 'bg-slate-950 border-white/10 text-slate-300'
                      }`}
                    >
                      {act.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={runImgTransform}
                  disabled={busy}
                  className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-sm font-semibold transition"
                >
                  <Camera className="w-4 h-4 inline mr-1.5" /> Применить трансформацию
                </button>
                {transformRes && (
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-white/10 flex flex-col sm:flex-row items-center gap-5">
                    <img src={transformRes.image_data_url} alt="Transformed" className="max-h-48 rounded-xl object-contain" />
                    <div className="space-y-2 text-xs text-slate-300 flex-1">
                      <div>Формат: <b className="text-sky-300">{transformRes.meta.format}</b> ({transformRes.meta.dimensions})</div>
                      <div>Размер: {transformRes.meta.before_kb} КБ → <b className="text-emerald-300">{transformRes.meta.after_kb} КБ</b></div>
                      <FileActionRow
                        downloadUrl={transformRes.download_url}
                        dataUrl={transformRes.image_data_url}
                        filename={`image_${transformAction}.${transformRes.meta.format.toLowerCase()}`}
                        label="Скачать результат"
                        onToast={onToast}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // HUB 3: PDF FORGE
  // =========================================================================
  return (
    <div className="space-y-5 min-w-0">
      {pdfSubTab === 'photos' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-4">
          <div className="text-sm font-semibold text-white">🗂️ Объединение фотографий в один PDF-файл</div>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setImgPdfFiles(Array.from(e.target.files || []))}
            className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-rose-500/20 file:text-rose-200"
          />
          {imgPdfFiles.length > 0 && (
            <div className="text-xs text-slate-400">Выбрано изображений: {imgPdfFiles.length}</div>
          )}
          <button
            disabled={busy}
            onClick={async () => {
              if (!imgPdfFiles.length) {
                onToast('Выберите хотя бы одно изображение');
                return;
              }
              setBusy(true);
              try {
                const fd = new FormData();
                imgPdfFiles.forEach((f) => fd.append('files', f));
                const r = await apiForm('/api/tools/pdf/from-images', fd);
                setImgPdfRes(r);
                onSync();
                onToast('PDF из изображений готов');
              } catch (e: any) {
                onToast(e.message || 'Ошибка создания PDF');
              } finally {
                setBusy(false);
              }
            }}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition disabled:opacity-50"
          >
            Собрать PDF из фото
          </button>
          {imgPdfRes && (
            <FileActionRow
              downloadUrl={imgPdfRes.download_url}
              filename="photos.pdf"
              label={`Скачать PDF (${imgPdfRes.pages} стр., ${imgPdfRes.size_kb} КБ)`}
              onToast={onToast}
            />
          )}
        </div>
      )}

      {pdfSubTab === 'create' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-3.5">
          <div className="flex items-center gap-2 text-rose-300 font-semibold text-sm">
            <FileText className="w-4 h-4" /> Генератор PDF Документов с полной поддержкой Кириллицы
          </div>
          <input
            value={pdfTitle}
            onChange={(e) => setPdfTitle(e.target.value)}
            placeholder="Заголовок документа"
            className="w-full rounded-xl bg-slate-950 border border-white/10 px-3.5 py-2 text-sm text-white"
          />
          <textarea
            rows={8}
            value={pdfBody}
            onChange={(e) => setPdfBody(e.target.value)}
            className="w-full rounded-xl bg-slate-950 border border-white/10 p-3.5 text-sm text-slate-100 font-mono"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={runCreatePdf}
              disabled={busy}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-slate-950 font-semibold text-sm transition"
            >
              <Sparkles className="w-4 h-4 inline mr-1.5" /> Собрать PDF документ
            </button>
            {pdfCreated && (
              <div className="w-full sm:w-auto flex-1">
                <FileActionRow
                  downloadUrl={pdfCreated.download_url}
                  filename="document.pdf"
                  label={`Скачать PDF (${pdfCreated.size_kb} КБ)`}
                  onToast={onToast}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {pdfSubTab === 'inspect' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-3.5">
            <h4 className="text-sm font-semibold text-white">🔎 Чтение текста и метаданных PDF</h4>
            <p className="text-xs text-slate-400">
              Загрузите свой PDF или нажмите кнопку сразу для теста на демо-документе:
            </p>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => setPdfUpload(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-rose-500/20 file:text-rose-200"
            />
            <button
              onClick={runPdfInspect}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold"
            >
              Извлечь текстовый слой и структуру
            </button>
            {pdfInspectRes && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-white/10 space-y-2 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Страниц: <b>{pdfInspectRes.page_count}</b></span>
                  <span>Размер: <b>{pdfInspectRes.size_kb} КБ</b></span>
                  <span>Шифр: <b>{pdfInspectRes.is_encrypted ? 'Да 🔒' : 'Нет'}</b></span>
                </div>
                <pre className="max-h-48 overflow-y-auto p-2.5 rounded-lg bg-slate-900 text-slate-200 whitespace-pre-wrap">
                  {pdfInspectRes.extracted_text || '(Зашифрован или без текста)'}
                </pre>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-3.5">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-400" /> Шифрование AES-256, Вырезка страниц & Поворот
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Диапазон страниц (напр. 1-2)</label>
                <input
                  value={pdfPagesSpec}
                  onChange={(e) => setPdfPagesSpec(e.target.value)}
                  placeholder="Все страницы"
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Поворот страниц</label>
                <select
                  value={pdfRotate}
                  onChange={(e) => setPdfRotate(Number(e.target.value))}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                >
                  <option value={0}>0° (Без поворота)</option>
                  <option value={90}>90° по часовой</option>
                  <option value={180}>180°</option>
                  <option value={270}>270°</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Пароль защиты AES-256</label>
              <input
                value={pdfPwd}
                onChange={(e) => setPdfPwd(e.target.value)}
                placeholder="Укажите пароль для шифрования PDF…"
                className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
              />
            </div>
            <button
              onClick={runPdfTransform}
              className="w-full py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-semibold text-sm transition"
            >
              🔒 Применить защиту и сохранить PDF
            </button>
            {pdfTransRes && (
              <FileActionRow
                downloadUrl={pdfTransRes.download_url}
                filename="protected.pdf"
                label={`Скачать PDF (${pdfTransRes.meta.output_size_kb} КБ)`}
                onToast={onToast}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
