import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Code2,
  Download,
  FileText,
  Image as ImageIcon,
  Menu,
  Paperclip,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react';
import { apiForm, apiGet, apiPost, copyText, openExternalLink, triggerHaptic } from '../lib/api';

interface InlineBtn {
  text: string;
  callback_data?: string;
  url?: string;
  web_app_url?: string;
  switch_inline?: string;
}

interface SimMessage {
  message_id: number;
  sender: 'user' | 'bot';
  text: string;
  media_url?: string | null;
  media_type?: 'photo' | 'document' | null;
  file_name?: string | null;
  inline_keyboard: InlineBtn[][];
  edited: boolean;
  timestamp: number;
}

interface ApiLogEntry {
  id: string;
  method: string;
  summary: Record<string, any>;
  timestamp: number;
}

interface Props {
  onOpenMiniAppTool: (categoryId?: string) => void;
  onWorkspaceSync: () => void;
  onToast: (msg: string) => void;
}

function formatTelegramHtml(raw: string): string {
  if (!raw) return '';
  // Preserve <pre> blocks before converting newlines to <br/>
  const preBlocks: string[] = [];
  let processed = raw.replace(/<pre>([\s\S]*?)<\/pre>/g, (_, code) => {
    const idx = preBlocks.length;
    preBlocks.push(`<pre>${code}</pre>`);
    return `@@PRE_${idx}@@`;
  });
  processed = processed.replace(/\n/g, '<br/>');
  preBlocks.forEach((block, idx) => {
    processed = processed.replace(`@@PRE_${idx}@@`, block);
  });
  return processed;
}

export const TelegramSimulator: React.FC<Props> = ({ onOpenMiniAppTool, onWorkspaceSync, onToast }) => {
  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [commands, setCommands] = useState<Array<{ command: string; description: string }>>([]);
  const [apiLogs, setApiLogs] = useState<ApiLogEntry[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCmdMenu, setShowCmdMenu] = useState(false);
  const [showDropMenu, setShowDropMenu] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [inlineModeOpen, setInlineModeOpen] = useState(false);
  const [inlineQuery, setInlineQuery] = useState('256 * 16');
  const [inlineResults, setInlineResults] = useState<Array<{ id: string; title: string; description: string; message_text: string }>>([]);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const applySnapshot = (data: any) => {
    setMessages(data.messages || []);
    if (data.commands) setCommands(data.commands);
    if (data.api_logs) setApiLogs(data.api_logs);
    if (data.toast?.text) {
      onToast(data.toast.text);
    }
    onWorkspaceSync();
  };

  useEffect(() => {
    apiGet('/api/sim/state').then(applySnapshot).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const sendText = async (txt?: string) => {
    const val = (txt !== undefined ? txt : input).trim();
    if (!val || loading) return;
    if (txt === undefined) setInput('');
    setShowCmdMenu(false);
    setLoading(true);
    triggerHaptic('light');
    try {
      const snap = await apiPost('/api/sim/send-text', { text: val });
      applySnapshot(snap);
    } catch (e: any) {
      onToast(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInlineButton = async (msgId: number, btn: InlineBtn) => {
    triggerHaptic('light');
    if (btn.web_app_url) {
      const m = btn.web_app_url.match(/tool=([a-z_]+)/);
      onOpenMiniAppTool(m ? m[1] : undefined);
      onToast('Открыт раздел в приложении');
      return;
    }
    if (btn.switch_inline !== undefined) {
      setInlineModeOpen(true);
      setInlineQuery(btn.switch_inline || '256 * 16');
      runInlineSearch(btn.switch_inline || '256 * 16');
      return;
    }
    if (btn.url) {
      openExternalLink(btn.url);
      return;
    }
    if (!btn.callback_data) return;

    setLoading(true);
    try {
      const snap = await apiPost('/api/sim/callback', {
        message_id: msgId,
        callback_data: btn.callback_data,
      });
      applySnapshot(snap);
    } catch (e: any) {
      onToast(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File, mode: string = 'auto') => {
    setShowDropMenu(false);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mode', mode);
      const snap = await apiForm('/api/sim/upload', fd);
      applySnapshot(snap);
    } catch (e: any) {
      onToast(e.message);
    } finally {
      setLoading(false);
    }
  };

  const dropDemoStegoPng = async () => {
    setShowDropMenu(false);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('secret_text', 'Секретный текст MULTI_TG_TOOL: проверка LSB');
      fd.append('password', '');
      const stego = await apiForm('/api/tools/stego/encode', fd);
      const blob = await (await fetch(stego.image_data_url)).blob();
      const demoFile = new File([blob], 'secret_stego.png', { type: 'image/png' });
      await handleFileUpload(demoFile, 'document');
      onToast('Стего-PNG отправлен в чат. Нажмите «🔓 Прочитать текст из PNG»');
    } catch (e: any) {
      onToast(e.message);
      setLoading(false);
    }
  };

  const dropDemoPhoto = async () => {
    setShowDropMenu(false);
    setLoading(true);
    try {
      const qr = await apiPost('/api/tools/code-card', {
        code: 'def run_tool():\n    return "MULTI_TG_TOOL Ready"',
        language: 'python',
        title: 'demo_photo.py',
        theme: 'tokyo',
      });
      const blob = await (await fetch(qr.image_data_url)).blob();
      const photoFile = new File([blob], 'code_card.png', { type: 'image/png' });
      await handleFileUpload(photoFile, 'photo');
    } catch (e: any) {
      onToast(e.message);
      setLoading(false);
    }
  };

  const dropDemoPdf = async () => {
    setShowDropMenu(false);
    setLoading(true);
    try {
      const pdf = await apiPost('/api/tools/pdf/from-text', {
        title: 'Документ MULTI_TG_TOOL',
        content: '# Описание MULTI_TG_TOOL\n- Движок Telegram: aiogram 3.x\n- Поддержка кириллицы и AES-256 защиты',
      });
      const blob = await (await fetch(pdf.download_url)).blob();
      const pdfFile = new File([blob], 'document_spec.pdf', { type: 'application/pdf' });
      await handleFileUpload(pdfFile, 'document');
    } catch (e: any) {
      onToast(e.message);
      setLoading(false);
    }
  };

  const runInlineSearch = async (q: string) => {
    try {
      const res = await apiPost('/api/sim/inline', { query: q });
      setInlineResults(res.results || []);
      if (res.api_logs) setApiLogs(res.api_logs);
    } catch {
      // ignore
    }
  };

  const resetChat = async () => {
    setLoading(true);
    try {
      const snap = await apiPost('/api/sim/reset', {});
      applySnapshot(snap);
      onToast('Чат перезапущен (/start)');
    } finally {
      setLoading(false);
    }
  };

  const onRichHtmlClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'CODE') {
      copyText(target.innerText, onToast);
    }
  };

  const omniQuickChips = [
    { label: '🌟 /horoscope', value: '/horoscope' },
    { label: '💞 /compat', value: '/compat' },
    { label: '⚛️ /physics', value: '/physics' },
    { label: '📅 /habits', value: '/habits' },
    { label: '📏 75 кг в фунты', value: '75 кг в фунты' },
    { label: '🥃 /alcohol', value: '/alcohol' },
    { label: '💡 /bored', value: '/bored' },
    { label: '🏆 /top', value: '/top' },
    { label: '🔗 /author', value: '/author' },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
      {/* Main Telegram Chat Frame */}
      <div className={`${showInspector ? 'xl:col-span-8' : 'xl:col-span-12'} flex flex-col rounded-2xl border border-white/10 bg-[#0e1525] overflow-hidden shadow-2xl h-[calc(100dvh-115px)] sm:h-[calc(100vh-145px)] min-h-[460px] sm:min-h-[580px]`}>
        {/* Authentic Telegram Chat Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 bg-[#131c31] border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/avatar.png"
              alt="MULTI_TG_TOOL"
              className="w-10 h-10 rounded-full object-cover border border-amber-400/50 shadow-lg shadow-purple-600/30 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white truncate">MULTI_TG_TOOL</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-amber-300 border border-amber-400/30 font-medium">
                  @multi_tg_bot
                </span>
              </div>
              <div className="text-xs text-emerald-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="truncate">бот • 59 инструментов</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const next = !inlineModeOpen;
                setInlineModeOpen(next);
                if (next) runInlineSearch(inlineQuery);
              }}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 border transition ${
                inlineModeOpen
                  ? 'bg-purple-500/25 text-purple-200 border-purple-400/40'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
              }`}
              title="Протестировать инлайн-режим @multi_tg_bot"
            >
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">@inline</span>
            </button>

            <button
              onClick={() => setShowInspector(!showInspector)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 border transition ${
                showInspector
                  ? 'bg-sky-500/20 text-sky-200 border-sky-400/40'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
              }`}
              title="Инспектор вызовов Telegram Bot API"
            >
              <Terminal className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Bot API</span>
            </button>

            <button
              onClick={resetChat}
              className="p-2 rounded-xl bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 border border-white/10 transition"
              title="Очистить историю и отправить /start"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Inline Query Bar Drawer (@multi_tg_bot ...) */}
        {inlineModeOpen && (
          <div className="bg-[#161f36] border-b border-purple-500/30 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-purple-300 bg-purple-500/15 px-2 py-1 rounded-lg border border-purple-500/30 shrink-0">
                @multi_tg_bot
              </span>
              <input
                value={inlineQuery}
                onChange={(e) => {
                  setInlineQuery(e.target.value);
                  runInlineSearch(e.target.value);
                }}
                placeholder="Введите пример, текст для смены раскладки или оставьте пустым…"
                className="w-full bg-slate-950/70 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
              {inlineResults.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    sendText(r.message_text.replace(/<[^>]+>/g, ''));
                    setInlineModeOpen(false);
                  }}
                  className="text-left p-2 rounded-lg bg-slate-900/90 hover:bg-purple-500/20 border border-white/10 transition"
                >
                  <div className="text-xs font-medium text-white truncate">{r.title}</div>
                  <div className="text-[11px] text-slate-400 truncate">{r.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 tg-chat-bg">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.message_id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] sm:max-w-[78%] rounded-2xl px-3.5 py-2.5 shadow-lg ${
                    isUser
                      ? 'bg-gradient-to-br from-sky-600 to-indigo-600 text-white rounded-br-sm'
                      : 'bg-[#172136]/95 border border-white/10 text-slate-100 rounded-bl-sm'
                  }`}
                >
                  {/* Media Attachment */}
                  {msg.media_url && msg.media_type === 'photo' && (
                    <div className="mb-2 rounded-xl overflow-hidden bg-slate-950/60 border border-white/10">
                      <img
                        src={msg.media_url}
                        alt={msg.file_name || 'photo'}
                        className="max-h-72 w-auto mx-auto object-contain"
                      />
                    </div>
                  )}

                  {msg.media_url && msg.media_type === 'document' && (
                    <a
                      href={msg.media_url}
                      download={msg.file_name || 'file'}
                      target="_blank"
                      rel="noreferrer"
                      className="mb-2 flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-950/70 border border-sky-500/25 hover:border-sky-400/60 transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-lg bg-sky-500/20 text-sky-300">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-white truncate">
                            {msg.file_name || 'Документ'}
                          </div>
                          <div className="text-[11px] text-sky-300">Нажмите для скачивания</div>
                        </div>
                      </div>
                      <Download className="w-4 h-4 text-sky-400 shrink-0" />
                    </a>
                  )}

                  {/* Rich HTML Text */}
                  {msg.text && (
                    <div
                      onClick={onRichHtmlClick}
                      className="tg-rich-html text-[13.5px] leading-relaxed break-words"
                      dangerouslySetInnerHTML={{ __html: formatTelegramHtml(msg.text) }}
                    />
                  )}

                  <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] opacity-65">
                    {msg.edited && <span>изм.</span>}
                    <span>
                      {new Date(msg.timestamp * 1000).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {/* Telegram Inline Keyboard Grid */}
                {!isUser && msg.inline_keyboard && msg.inline_keyboard.length > 0 && (
                  <div className="mt-1.5 w-full max-w-[94%] sm:max-w-[78%] space-y-1">
                    {msg.inline_keyboard.map((row, rIdx) => (
                      <div
                        key={rIdx}
                        className="grid gap-1"
                        style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
                      >
                        {row.map((btn, bIdx) => {
                          const isWebApp = Boolean(btn.web_app_url);
                          return (
                            <button
                              key={bIdx}
                              type="button"
                              disabled={loading}
                              onClick={() => handleInlineButton(msg.message_id, btn)}
                              className={`px-2 py-2 min-h-[36px] rounded-xl text-[11px] sm:text-xs font-medium leading-tight whitespace-normal break-words text-center flex items-center justify-center transition border shadow-sm ${
                                isWebApp
                                  ? 'bg-gradient-to-r from-sky-500/25 via-indigo-500/25 to-purple-500/25 hover:from-sky-500/40 hover:to-purple-500/40 text-sky-100 border-sky-400/40'
                                  : 'bg-[#1c2942]/90 hover:bg-[#263859] text-slate-100 border-white/10 active:scale-[0.99]'
                              }`}
                              title={btn.text}
                            >
                              {btn.text}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Smart Omni Quick Test Strip */}
        <div className="px-3 py-2 bg-[#101729] border-t border-white/5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[11px] text-slate-400 shrink-0 flex items-center gap-1 pr-1">
            <Sparkles className="w-3 h-3 text-sky-400" /> Omni-тест:
          </span>
          {omniQuickChips.map((chip) => (
            <button
              key={chip.label}
              onClick={() => sendText(chip.value)}
              className="shrink-0 text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-sky-500/20 text-slate-300 hover:text-sky-200 border border-white/10 transition"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Telegram Bottom Composer Bar with /Menu and Smart Drop */}
        <div className="relative px-2.5 sm:px-3 py-2.5 bg-[#131c31] border-t border-white/10 flex items-center gap-1.5 sm:gap-2">
          {(showCmdMenu || showDropMenu) && (
            <div
              className="fixed inset-0 z-20"
              onClick={() => {
                setShowCmdMenu(false);
                setShowDropMenu(false);
              }}
            />
          )}

          {/* Slash Commands Popover */}
          {showCmdMenu && (
            <div className="absolute bottom-14 left-2 right-2 sm:right-auto sm:left-3 sm:w-80 max-h-72 overflow-y-auto rounded-2xl bg-[#162038] border border-white/15 shadow-2xl p-1.5 z-30">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-sky-300 uppercase tracking-wider">
                Команды бота MULTI_TG_TOOL
              </div>
              {commands.map((c) => (
                <button
                  key={c.command}
                  type="button"
                  onClick={() => sendText(c.command)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl hover:bg-white/10 text-left transition"
                >
                  <span className="font-mono text-xs text-sky-300 font-semibold shrink-0">{c.command}</span>
                  <span className="text-xs text-slate-300 truncate">{c.description}</span>
                </button>
              ))}
            </div>
          )}

          {/* Smart Media Drop Popover */}
          {showDropMenu && (
            <div className="absolute bottom-14 left-2 right-2 sm:right-auto sm:left-14 sm:w-80 rounded-2xl bg-[#162038] border border-white/15 shadow-2xl p-2 z-30 space-y-1">
              <div className="px-2.5 py-1 text-[11px] font-semibold text-purple-300 uppercase tracking-wider">
                Отправить файл или демо-пример в 1 клик
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/10 text-xs text-white text-left"
              >
                <Paperclip className="w-4 h-4 text-sky-400" />
                Загрузить своё Фото / PNG / PDF с диска…
              </button>
              <button
                onClick={dropDemoPhoto}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/10 text-xs text-slate-200 text-left"
              >
                <ImageIcon className="w-4 h-4 text-emerald-400" />
                Демо: Сбросить Фото (EXIF / Стикер 512px / Фильтры)
              </button>
              <button
                onClick={dropDemoStegoPng}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/10 text-xs text-slate-200 text-left"
              >
                <ShieldAlert className="w-4 h-4 text-purple-400" />
                Демо: Сбросить PNG со скрытой тайной (Stego)
              </button>
              <button
                onClick={dropDemoPdf}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/10 text-xs text-slate-200 text-left"
              >
                <FileText className="w-4 h-4 text-rose-400" />
                Демо: Сбросить PDF документ (Текст / AES-256)
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileUpload(f, 'auto');
              e.target.value = '';
            }}
          />

          <button
            onClick={() => {
              setShowCmdMenu(!showCmdMenu);
              setShowDropMenu(false);
            }}
            className="px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shrink-0 transition"
          >
            <Menu className="w-4 h-4" />
            Меню
          </button>

          <button
            onClick={() => {
              setShowDropMenu(!showDropMenu);
              setShowCmdMenu(false);
            }}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 shrink-0 transition"
            title="Прикрепить фото, стего-PNG или PDF"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') sendText();
            }}
            placeholder="Напишите сообщение, команду (/qr, /pass) или просто вставьте данные…"
            className="flex-1 bg-slate-950/70 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-sky-400"
          />

          <button
            disabled={loading || !input.trim()}
            onClick={() => sendText()}
            className="p-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 transition shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Live Bot API Calls Inspector Drawer */}
      {showInspector && (
        <div className="xl:col-span-4 rounded-2xl border border-white/10 bg-[#0c1220] p-4 flex flex-col h-[calc(100vh-145px)] min-h-[580px]">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-sky-400" />
              <span className="text-sm font-semibold text-white">Журнал вызовов Bot API</span>
            </div>
            <span className="text-[11px] text-slate-400">{apiLogs.length} событий</span>
          </div>
          <p className="text-xs text-slate-400 mt-2 mb-3">
            Реальные методы <code className="text-sky-300">aiogram 3.31</code>, выполняемые при кликах на кнопки и отправке сообщений:
          </p>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {apiLogs.map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-xl bg-slate-950/80 border border-white/10 font-mono text-xs"
              >
                <div className="flex items-center justify-between text-sky-300 font-semibold">
                  <span>{log.method}</span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(log.timestamp * 1000).toLocaleTimeString('ru-RU')}
                  </span>
                </div>
                <pre className="mt-1 text-[11px] text-slate-300 whitespace-pre-wrap break-all">
                  {JSON.stringify(log.summary, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
