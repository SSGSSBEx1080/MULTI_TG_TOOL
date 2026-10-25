import React, { useEffect, useRef, useState } from 'react';
import { Copy, Crop, Download, Mic, Palette, Play, Sparkles, Square, Star, Type } from 'lucide-react';
import { apiPost, copyText, triggerFileDownload } from '../../lib/api';

interface Props {
  activeTool: string;
  onSelectTool: (t: string) => void;
  favorites: string[];
  onToggleFav: (id: string) => void;
  onSync: () => void;
  onToast: (msg: string) => void;
}

type CreatorTab = 'color_palette' | 'css_studio' | 'social_resizer' | 'readtime_teleprompter' | 'ascii_meme_art';

const ASCII_3X5: Record<string, string[]> = {
  A: [' █ ', '█ █', '███', '█ █', '█ █'],
  B: ['██ ', '█ █', '██ ', '█ █', '██ '],
  C: [' ██', '█  ', '█  ', '█  ', ' ██'],
  D: ['██ ', '█ █', '█ █', '█ █', '██ '],
  E: ['███', '█  ', '██ ', '█  ', '███'],
  F: ['███', '█  ', '██ ', '█  ', '█  '],
  G: [' ██', '█  ', '█ █', '█ █', ' ██'],
  H: ['█ █', '█ █', '███', '█ █', '█ █'],
  I: ['███', ' █ ', ' █ ', ' █ ', '███'],
  J: ['  █', '  █', '  █', '█ █', ' █ '],
  K: ['█ █', '██ ', '█  ', '██ ', '█ █'],
  L: ['█  ', '█  ', '█  ', '█  ', '███'],
  M: ['█ █', '███', '█ █', '█ █', '█ █'],
  N: ['███', '█ █', '█ █', '█ █', '█ █'],
  O: [' █ ', '█ █', '█ █', '█ █', ' █ '],
  P: ['██ ', '█ █', '██ ', '█  ', '█  '],
  Q: [' █ ', '█ █', '█ █', ' ██', '  █'],
  R: ['██ ', '█ █', '██ ', '█ █', '█ █'],
  S: [' ██', '█  ', ' █ ', '  █', '██ '],
  T: ['███', ' █ ', ' █ ', ' █ ', ' █ '],
  U: ['█ █', '█ █', '█ █', '█ █', '███'],
  V: ['█ █', '█ █', '█ █', '█ █', ' █ '],
  W: ['█ █', '█ █', '█ █', '███', '█ █'],
  X: ['█ █', '█ █', ' █ ', '█ █', '█ █'],
  Y: ['█ █', '█ █', ' █ ', ' █ ', ' █ '],
  Z: ['███', '  █', ' █ ', '█  ', '███'],
  '0': ['███', '█ █', '█ █', '█ █', '███'],
  '1': [' █ ', '██ ', ' █ ', ' █ ', '███'],
  '2': ['███', '  █', '███', '█  ', '███'],
  '3': ['███', '  █', '███', '  █', '███'],
  '4': ['█ █', '█ █', '███', '  █', '  █'],
  '5': ['███', '█  ', '███', '  █', '███'],
  '6': ['███', '█  ', '███', '█ █', '███'],
  '7': ['███', '  █', ' █ ', ' █ ', ' █ '],
  '8': ['███', '█ █', '███', '█ █', '███'],
  '9': ['███', '█ █', '███', '  █', '███'],
  ' ': ['   ', '   ', '   ', '   ', '   '],
  '!': [' █ ', ' █ ', ' █ ', '   ', ' █ '],
  '-': ['   ', '   ', '███', '   ', '   '],
};

function renderBlockAscii(input: string, frameStyle: 'double' | 'rounded' | 'none'): string {
  const clean = (input || 'QLS 2026').toUpperCase().slice(0, 18);
  const rows = ['', '', '', '', ''];
  for (const ch of clean) {
    const glyph = ASCII_3X5[ch] || ASCII_3X5[' '];
    for (let r = 0; r < 5; r += 1) rows[r] += glyph[r] + ' ';
  }
  const width = Math.max(...rows.map((r) => r.length));
  if (frameStyle === 'none') return rows.join('\n');
  const [tl, tr, bl, br, hz, vt] =
    frameStyle === 'double' ? ['╔', '╗', '╚', '╝', '═', '║'] : ['╭', '╮', '╰', '╯', '─', '│'];
  const top = `${tl}${hz.repeat(width + 2)}${tr}`;
  const bot = `${bl}${hz.repeat(width + 2)}${br}`;
  return [top, ...rows.map((r) => `${vt} ${r.padEnd(width, ' ')} ${vt}`), bot].join('\n');
}

export const CreatorDesignHub: React.FC<Props> = ({
  activeTool,
  onSelectTool,
  favorites,
  onToggleFav,
  onSync,
  onToast,
}) => {
  const [tab, setTab] = useState<CreatorTab>(() =>
    (['color_palette', 'css_studio', 'social_resizer', 'readtime_teleprompter', 'ascii_meme_art'] as const).includes(activeTool as any)
      ? (activeTool as CreatorTab)
      : 'color_palette'
  );

  useEffect(() => {
    if ((['color_palette', 'css_studio', 'social_resizer', 'readtime_teleprompter', 'ascii_meme_art'] as const).includes(activeTool as any)) {
      setTab(activeTool as CreatorTab);
    }
  }, [activeTool]);

  // 1. Color Harmony
  const [hexColor, setHexColor] = useState('#38bdf8');
  const [colorRes, setColorRes] = useState<any>(null);

  // 2. CSS Studio
  const [gradA, setGradA] = useState('#0ea5e9');
  const [gradB, setGradB] = useState('#8b5cf6');
  const [gradAngle, setGradAngle] = useState(135);
  const [glassBlur, setGlassBlur] = useState(16);
  const [glassAlpha, setGlassAlpha] = useState(0.16);
  const [radiusPx, setRadiusPx] = useState(24);

  // 3. Social Cropper
  const [aspectPreset, setAspectPreset] = useState<'1:1' | '16:9' | '9:16' | '4:5'>('16:9');
  const [cropSrcUrl, setCropSrcUrl] = useState<string>('');
  const [croppedDataUrl, setCroppedDataUrl] = useState<string>('');

  // 4. Teleprompter
  const [scriptText, setScriptText] = useState(
    'Добро пожаловать в эфир.\n\nЭтот экранный телесуфлёр плавно прокручивает сценарий с выбранной скоростью чтения.\n\nВы можете включить зеркальный режим для съёмки через отражающее стекло или читать текст прямо над объективом камеры.'
  );
  const [wpm, setWpm] = useState(135);
  const [prompterRunning, setPrompterRunning] = useState(false);
  const [prompterMirror, setPrompterMirror] = useState(false);
  const [fontSizePx, setFontSizePx] = useState(24);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // 5. ASCII Banner
  const [asciiInput, setAsciiInput] = useState('MULTI TG');
  const [asciiFrame, setAsciiFrame] = useState<'double' | 'rounded' | 'none'>('double');

  const runColor = async (hex: string, silent = false) => {
    try {
      const r = await apiPost('/api/v2/v5/color-harmony', { hex_color: hex });
      setColorRes(r);
      if (!silent) onSync();
    } catch (e: any) {
      if (!silent) onToast(e.message);
    }
  };

  useEffect(() => {
    runColor(hexColor, true);
  }, []);

  useEffect(() => {
    if (!prompterRunning) return;
    const id = window.setInterval(() => {
      const el = scrollerRef.current;
      if (!el) return;
      el.scrollTop += Math.max(1, Math.round(wpm / 55));
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
        setPrompterRunning(false);
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [prompterRunning, wpm]);

  const performCrop = async (srcUrl: string, ratioStr: string) => {
    if (!srcUrl) return;
    const img = new Image();
    img.src = srcUrl;
    await new Promise((res) => {
      img.onload = res;
      img.onerror = res;
    });
    if (!img.naturalWidth) return;
    const [rw, rh] = ratioStr.split(':').map(Number);
    const targetRatio = rw / rh;
    const srcRatio = img.naturalWidth / img.naturalHeight;
    let sw = img.naturalWidth;
    let sh = img.naturalHeight;
    let sx = 0;
    let sy = 0;
    if (srcRatio > targetRatio) {
      sw = Math.round(img.naturalHeight * targetRatio);
      sx = Math.round((img.naturalWidth - sw) / 2);
    } else {
      sh = Math.round(img.naturalWidth / targetRatio);
      sy = Math.round((img.naturalHeight - sh) / 2);
    }
    const outW = ratioStr === '16:9' ? 1280 : ratioStr === '9:16' ? 1080 : 1024;
    const outH = Math.round(outW / targetRatio);
    const cvs = document.createElement('canvas');
    cvs.width = outW;
    cvs.height = outH;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    setCroppedDataUrl(cvs.toDataURL('image/png'));
  };

  useEffect(() => {
    if (cropSrcUrl) performCrop(cropSrcUrl, aspectPreset);
  }, [cropSrcUrl, aspectPreset]);

  const cssCode = `background: linear-gradient(${gradAngle}deg, ${gradA}, ${gradB});\nbackdrop-filter: blur(${glassBlur}px);\nborder-radius: ${radiusPx}px;\nborder: 1px solid rgba(255, 255, 255, ${glassAlpha.toFixed(2)});\nbox-shadow: 0 20px 50px rgba(2, 6, 23, 0.45);`;

  const wordsCount = scriptText.trim() ? scriptText.trim().split(/\s+/).length : 0;
  const estSec = Math.round((wordsCount / Math.max(60, wpm)) * 60);
  const asciiArt = renderBlockAscii(asciiInput, asciiFrame);
  const isFav = favorites.includes(tab);

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-900/80 p-2">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'color_palette', label: '🎨 Палитры & WCAG' },
            { id: 'css_studio', label: '✨ CSS Градиенты & Стекло' },
            { id: 'social_resizer', label: '📐 Кроппер Обложек' },
            { id: 'readtime_teleprompter', label: '🎙️ Телесуфлёр' },
            { id: 'ascii_meme_art', label: '🧱 ASCII Баннеры' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id as CreatorTab);
                onSelectTool(t.id);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                tab === t.id ? 'bg-purple-500 text-slate-950' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onToggleFav(tab)}
          className={`px-2.5 py-1.5 rounded-xl text-xs border flex items-center gap-1 ${
            isFav ? 'bg-amber-500/20 border-amber-400/40 text-amber-200' : 'border-white/10 text-slate-400'
          }`}
        >
          <Star className="w-3.5 h-3.5" /> {isFav ? 'В избранном' : 'В избранное'}
        </button>
      </div>

      {/* 1. COLOR HARMONY & WCAG */}
      {tab === 'color_palette' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-4">
            <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
              <Palette className="w-5 h-5 text-purple-400" /> Гармонии Цветов и Контраст WCAG
            </h3>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={hexColor}
                onChange={(e) => {
                  setHexColor(e.target.value);
                  runColor(e.target.value, true);
                }}
                className="w-14 h-12 rounded-xl cursor-pointer bg-transparent"
              />
              <input
                value={hexColor}
                onChange={(e) => setHexColor(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runColor(hexColor, false)}
                className="flex-1 rounded-xl bg-slate-950 border border-white/10 px-3 py-2.5 font-mono text-sm text-white"
              />
              <button
                type="button"
                onClick={() => runColor(hexColor, false)}
                className="px-4 py-2.5 rounded-xl bg-purple-500 text-slate-950 font-semibold text-xs"
              >
                Разбор
              </button>
            </div>
            {colorRes && (
              <div className="space-y-2 text-xs font-mono bg-slate-950 p-3.5 rounded-xl border border-white/10">
                <div className="flex justify-between"><span className="text-slate-400">HEX:</span><button type="button" onClick={() => copyText(colorRes.hex, onToast)} className="text-white">{colorRes.hex}</button></div>
                <div className="flex justify-between"><span className="text-slate-400">RGB:</span><button type="button" onClick={() => copyText(colorRes.rgb, onToast)} className="text-white">{colorRes.rgb}</button></div>
                <div className="flex justify-between"><span className="text-slate-400">HSL:</span><button type="button" onClick={() => copyText(colorRes.hsl, onToast)} className="text-white">{colorRes.hsl}</button></div>
                <div className="flex justify-between"><span className="text-slate-400">CMYK:</span><span className="text-slate-200">{colorRes.cmyk}</span></div>
                <div className="pt-2 border-t border-white/10 flex justify-between font-sans">
                  <span className="text-slate-400">Контраст с белым / чёрным:</span>
                  <b className="text-emerald-300">{colorRes.wcag_on_white}:1 / {colorRes.wcag_on_black}:1</b>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-3.5">
            {colorRes &&
              Object.entries(colorRes.harmonies).map(([group, arr]: [string, any]) => (
                <div key={group} className="space-y-1.5">
                  <div className="text-xs text-slate-400 capitalize">{group} (нажмите на цвет для копирования)</div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {arr.map((hx: string, i: number) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => copyText(hx, onToast)}
                        style={{ backgroundColor: hx }}
                        className="h-14 rounded-xl border border-white/15 flex items-end justify-center pb-1.5 shadow"
                      >
                        <span className="px-1.5 py-0.5 rounded bg-slate-950/75 text-[10px] font-mono text-white">{hx}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 2. CSS GRADIENT & GLASSMORPHISM */}
      {tab === 'css_studio' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-6 rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-3 text-xs">
            <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" /> Генератор CSS Градиентов и Стекла
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-slate-300">
                <input type="color" value={gradA} onChange={(e) => setGradA(e.target.value)} className="w-9 h-9 rounded bg-transparent" />
                Цвет 1 ({gradA})
              </label>
              <label className="flex items-center gap-2 text-slate-300">
                <input type="color" value={gradB} onChange={(e) => setGradB(e.target.value)} className="w-9 h-9 rounded bg-transparent" />
                Цвет 2 ({gradB})
              </label>
            </div>
            <div>
              <div className="flex justify-between text-slate-300 mb-1"><span>Угол градиента</span><b>{gradAngle}°</b></div>
              <input type="range" min={0} max={360} value={gradAngle} onChange={(e) => setGradAngle(Number(e.target.value))} className="w-full accent-purple-400" />
            </div>
            <div>
              <div className="flex justify-between text-slate-300 mb-1"><span>Размытие стекла (blur)</span><b>{glassBlur}px</b></div>
              <input type="range" min={0} max={40} value={glassBlur} onChange={(e) => setGlassBlur(Number(e.target.value))} className="w-full accent-purple-400" />
            </div>
            <div>
              <div className="flex justify-between text-slate-300 mb-1"><span>Скругление углов</span><b>{radiusPx}px</b></div>
              <input type="range" min={0} max={48} value={radiusPx} onChange={(e) => setRadiusPx(Number(e.target.value))} className="w-full accent-purple-400" />
            </div>
            <pre className="p-3 rounded-xl bg-slate-950 border border-white/10 font-mono text-[11px] text-sky-200 overflow-x-auto">
              {cssCode}
            </pre>
            <button
              type="button"
              onClick={() => copyText(cssCode, onToast)}
              className="w-full py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-semibold text-sm flex items-center justify-center gap-1.5"
            >
              <Copy className="w-4 h-4" /> Скопировать CSS
            </button>
          </div>

          <div
            className="lg:col-span-6 rounded-2xl p-8 flex items-center justify-center min-h-[260px]"
            style={{ background: `linear-gradient(${gradAngle}deg, ${gradA}, ${gradB})` }}
          >
            <div
              style={{
                backdropFilter: `blur(${glassBlur}px)`,
                backgroundColor: `rgba(15, 23, 42, 0.35)`,
                borderRadius: `${radiusPx}px`,
                border: `1px solid rgba(255,255,255,${glassAlpha})`,
              }}
              className="p-6 max-w-xs text-center text-white shadow-2xl"
            >
              <div className="text-base font-bold">Glassmorphism Preview</div>
              <p className="text-xs text-white/80 mt-1">Живой предпросмотр многослойной стеклянной карточки</p>
            </div>
          </div>
        </div>
      )}

      {/* 3. SOCIAL CROPPER */}
      {tab === 'social_resizer' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
              <Crop className="w-5 h-5 text-purple-400" /> Кроппер Аватарок, Сторис и Обложек YouTube / TG
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: '1:1', label: '1:1 Аватарка TG' },
                { id: '16:9', label: '16:9 Превью YouTube' },
                { id: '9:16', label: '9:16 Stories / Reels' },
                { id: '4:5', label: '4:5 Пост' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setAspectPreset(p.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                    aspectPreset === p.id ? 'bg-purple-500 text-slate-950 font-semibold' : 'bg-slate-950 text-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setCropSrcUrl(URL.createObjectURL(f));
            }}
            className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-purple-500/20 file:text-purple-200"
          />

          {croppedDataUrl && (
            <div className="space-y-3 p-4 rounded-xl bg-slate-950 border border-white/10 flex flex-col items-center">
              <img src={croppedDataUrl} alt="Cropped" className="max-h-72 rounded-xl object-contain border border-white/10" />
              <button
                type="button"
                onClick={() => triggerFileDownload(undefined, `cropped_${aspectPreset.replace(':', 'x')}.png`, croppedDataUrl)}
                className="px-5 py-2 rounded-xl bg-purple-500 text-slate-950 font-semibold text-xs flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" /> Скачать кадрированный PNG
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. SPEECH TIMER & TELEPROMPTER */}
      {tab === 'readtime_teleprompter' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-3">
            <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
              <Mic className="w-5 h-5 text-purple-400" /> Хронометраж Речи и Сценарий
            </h3>
            <textarea
              rows={6}
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-white/10 p-3 text-xs sm:text-sm text-white"
            />
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div>
                <div className="flex justify-between text-slate-300 mb-1"><span>Темп</span><b>{wpm} сл/мин</b></div>
                <input type="range" min={90} max={200} value={wpm} onChange={(e) => setWpm(Number(e.target.value))} className="w-full accent-purple-400" />
              </div>
              <div>
                <div className="flex justify-between text-slate-300 mb-1"><span>Кегль</span><b>{fontSizePx}px</b></div>
                <input type="range" min={18} max={42} value={fontSizePx} onChange={(e) => setFontSizePx(Number(e.target.value))} className="w-full accent-purple-400" />
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-white/10 text-xs flex justify-between">
              <span className="text-slate-400">Слов: <b className="text-white">{wordsCount}</b></span>
              <span className="text-purple-300 font-semibold">
                Хронометраж: {Math.floor(estSec / 60)} мин {estSec % 60} сек
              </span>
            </div>
          </div>

          <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-slate-950 p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPrompterRunning((v) => !v)}
                  className="px-4 py-1.5 rounded-xl bg-purple-500 text-slate-950 font-semibold text-xs flex items-center gap-1"
                >
                  {prompterRunning ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {prompterRunning ? 'Стоп' : 'Пуск суфлёра'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPrompterRunning(false);
                    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/10 text-xs text-white"
                >
                  В начало
                </button>
              </div>
              <label className="text-xs text-slate-300 flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={prompterMirror} onChange={(e) => setPrompterMirror(e.target.checked)} />
                Зеркально
              </label>
            </div>
            <div
              ref={scrollerRef}
              style={{
                fontSize: `${fontSizePx}px`,
                transform: prompterMirror ? 'scaleX(-1)' : 'none',
              }}
              className="h-64 overflow-y-auto rounded-xl bg-black/80 border border-white/10 p-5 leading-relaxed font-semibold text-white whitespace-pre-wrap"
            >
              {scriptText}
            </div>
          </div>
        </div>
      )}

      {/* 5. ASCII BANNER GENERATOR */}
      {tab === 'ascii_meme_art' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
              <Type className="w-5 h-5 text-purple-400" /> Генератор ASCII-Заголовков и Рамок
            </h3>
            <div className="flex gap-1.5">
              {[
                { id: 'double', label: 'Двойная рамка' },
                { id: 'rounded', label: 'Скруглённая' },
                { id: 'none', label: 'Без рамки' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setAsciiFrame(f.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs ${
                    asciiFrame === f.id ? 'bg-purple-500 text-slate-950 font-semibold' : 'bg-slate-950 text-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <input
            value={asciiInput}
            onChange={(e) => setAsciiInput(e.target.value)}
            maxLength={18}
            placeholder="Латиница и цифры (до 18 симв.)"
            className="w-full rounded-xl bg-slate-950 border border-white/10 px-3.5 py-2 text-sm text-white"
          />
          <pre className="p-4 rounded-xl bg-slate-950 border border-white/10 font-mono text-xs sm:text-sm text-purple-300 overflow-x-auto leading-tight">
            {asciiArt}
          </pre>
          <button
            type="button"
            onClick={() => copyText(asciiArt, onToast)}
            className="px-4 py-2 rounded-xl bg-purple-500 text-slate-950 font-semibold text-xs flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" /> Скопировать ASCII-блок
          </button>
        </div>
      )}
    </div>
  );
};
