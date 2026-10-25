import React, { useState } from 'react';
import {
  Bot,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Globe,
  HeartHandshake,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { apiPost, copyText } from '../../lib/api';
import { Mini3DSceneBadge } from '../three/Interactive3DScenes';

interface SourceItem {
  source: string;
  title: string;
  snippet: string;
  url: string;
  image?: string | null;
}

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  sources?: SourceItem[];
  images?: string[];
}

async function browserWebAndLlmEnrich(
  query: string,
  history: { role: string; content: string }[],
  mode: string,
  pageContext: string
): Promise<{ answer?: string; sources: SourceItem[]; images: string[]; model?: string }> {
  const sources: SourceItem[] = [];
  const images: string[] = [];

  // 1. Direct CORS-enabled Wikipedia RU search from browser for rich live facts & illustrations
  try {
    const clean = query.replace(/^(кто такой|кто такая|что такое|расскажи про|найди)\s+/i, '').trim();
    const wikiUrl = `https://ru.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      clean
    )}&gsrlimit=3&prop=extracts|pageimages|info&exintro=1&explaintext=1&exchars=550&piprop=thumbnail&pithumbsize=640&inprop=url&format=json&origin=*`;
    const wr = await fetch(wikiUrl);
    if (wr.ok) {
      const wj = await wr.json();
      const pages = Object.values((wj?.query?.pages || {}) as Record<string, any>).sort(
        (a, b) => (a.index || 99) - (b.index || 99)
      );
      for (const p of pages) {
        if (p.extract) {
          const thumb = p.thumbnail?.source || null;
          if (thumb) images.push(thumb);
          sources.push({
            source: 'Wikipedia RU Live',
            title: p.title,
            snippet: p.extract,
            url: p.fullurl || `https://ru.wikipedia.org/wiki/${encodeURIComponent(p.title)}`,
            image: thumb,
          });
        }
      }
    }
  } catch {
    // ignore browser offline
  }

  // 2. Direct keyless LLM synthesis from browser if backend gateway was unreachable
  try {
    const webCtx = sources
      .map((s, i) => `[${i + 1}] ${s.title}: ${s.snippet}`)
      .join('\n')
      .slice(0, 1800);
    const sys = `Ты точный интеллектуальный ассистент MULTI_TG_TOOL с доступом в Интернет. Дата: 25.10.2026.${
      pageContext ? ` Раздел: ${pageContext}.` : ''
    } Отвечай содержательно на русском языке без лишней воды.${
      webCtx ? `\nСвежие данные из сети:\n${webCtx}` : ''
    }`;
    const msgs = [
      { role: 'system', content: sys },
      ...history.slice(-6),
      { role: 'user', content: query },
    ];
    const lr = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'openai', messages: msgs, temperature: 0.45 }),
    });
    if (lr.ok) {
      const lj = await lr.json();
      const txt = lj?.choices?.[0]?.message?.content?.trim();
      if (txt) {
        return { answer: txt, sources, images, model: 'Live Web + OpenAI Gateway' };
      }
    }
  } catch {
    // ignore
  }

  return { sources, images };
}

export const AiAssistantHub: React.FC<{
  activeTool: string;
  onSelectTool: (t: string) => void;
  onSync: () => void;
  onToast: (msg: string) => void;
}> = ({ activeTool, onSelectTool, onSync, onToast }) => {
  const isCbt = activeTool === 'ai_psychotherapist';

  // --- AI Web Chat State ---
  const [mode, setMode] = useState<'general' | 'deep' | 'code' | 'study'>('general');
  const [useWeb, setUseWeb] = useState(true);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);

  // --- CBT Psychotherapist State ---
  const [situation, setSituation] = useState('');
  const [autoThought, setAutoThought] = useState('');
  const [emotion, setEmotion] = useState('Тревога');
  const [intensity, setIntensity] = useState(72);
  const [cbtBusy, setCbtBusy] = useState(false);
  const [cbtRes, setCbtRes] = useState<any>(null);

  const sendChat = async (customPrompt?: string) => {
    const q = (customPrompt ?? input).trim();
    if (!q || busy) return;
    if (!customPrompt) setInput('');
    const prevHistory = turns.map((t) => ({ role: t.role, content: t.content }));
    setTurns((p) => [...p, { role: 'user', content: q }]);
    setBusy(true);

    try {
      const res = await apiPost('/api/v6/ai/chat', {
        message: q,
        history: prevHistory,
        use_web: useWeb,
        mode,
      });

      let finalAnswer = res.answer;
      let finalSources: SourceItem[] = res.sources || [];
      let finalImages: string[] = res.images || [];
      let finalModel = res.model;

      if (res.offline_fallback && useWeb) {
        const enriched = await browserWebAndLlmEnrich(q, prevHistory, mode, '');
        if (enriched.answer) {
          finalAnswer = enriched.answer;
          finalModel = enriched.model || finalModel;
        } else if (enriched.sources.length > 0 && finalSources.length === 0) {
          finalAnswer = enriched.sources.map((s) => `${s.title}\n${s.snippet}`).join('\n\n');
        }
        if (enriched.sources.length > finalSources.length) finalSources = enriched.sources;
        if (enriched.images.length > finalImages.length) finalImages = enriched.images;
      }

      setTurns((p) => [
        ...p,
        {
          role: 'assistant',
          content: finalAnswer,
          model: finalModel,
          sources: finalSources,
          images: finalImages,
        },
      ]);
      onSync();
    } catch (e: any) {
      onToast(e.message || 'Ошибка соединения с ИИ');
    } finally {
      setBusy(false);
    }
  };

  const runCbt = async () => {
    if (!situation.trim() && !autoThought.trim()) {
      onToast('Опишите ситуацию или автоматическую мысль');
      return;
    }
    setCbtBusy(true);
    try {
      const res = await apiPost('/api/v6/ai/cbt', {
        situation,
        automatic_thought: autoThought,
        emotion,
        intensity_before: intensity,
      });
      setCbtRes(res);
      onSync();
    } catch (e: any) {
      onToast(e.message || 'Ошибка разбора КПТ');
    } finally {
      setCbtBusy(false);
    }
  };

  return (
    <div className="space-y-4 min-w-0">
      {/* Sub-mode switcher */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSelectTool('ai_web_chat')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition ${
            !isCbt
              ? 'bg-sky-500/25 border-sky-400 text-sky-100'
              : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white'
          }`}
        >
          <Globe className="w-4 h-4" /> ИИ-Ассистент с выходом в Интернет
        </button>
        <button
          type="button"
          onClick={() => onSelectTool('ai_psychotherapist')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition ${
            isCbt
              ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100'
              : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white'
          }`}
        >
          <HeartHandshake className="w-4 h-4" /> ИИ-Психотерапевт (КПТ / Дневник СМЭР)
        </button>
      </div>

      {!isCbt ? (
        <div className="rounded-2xl bg-slate-900/80 border border-sky-500/25 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <Mini3DSceneBadge seed="ai_web_chat" color="#38bdf8" size={40} />
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  🌐 Нейросеть с живым доступом в Интернет
                </h3>
                <p className="text-xs text-slate-400">
                  Поиск по свежим источникам и энциклопедиям, иллюстрации, решение кода и задач (дата: 25.10.2026)
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setUseWeb((v) => !v)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                  useWeb
                    ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                    : 'bg-slate-950 border-white/10 text-slate-400'
                }`}
              >
                <Globe className="w-3.5 h-3.5" /> Интернет: {useWeb ? 'ВКЛ' : 'ВЫКЛ'}
              </button>
              {turns.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTurns([])}
                  className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Очистить
                </button>
              )}
            </div>
          </div>

          {/* Role Mode Pills */}
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'general', label: '🌐 Поиск и Факты' },
                { id: 'deep', label: '🧠 Глубокий разбор' },
                { id: 'code', label: '💻 Код и Архитектура' },
                { id: 'study', label: '📚 Учёба и Формулы' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`px-3 py-1 rounded-lg text-xs border transition ${
                  mode === m.id
                    ? 'bg-sky-500/25 border-sky-400 text-sky-100 font-semibold'
                    : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Quick Starter Prompts */}
          {turns.length === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                'Объясни квантовую запутанность и теорему Белла простыми словами',
                'Когда ближайшее полное солнечное затмение после 25 октября 2026 года?',
                'Сравни Ryzen 7 9800X3D и Core Ultra 9 285K для игр и работы',
                'Напиши быстрый алгоритм Дейкстры на Python с комментариями',
              ].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => sendChat(sample)}
                  className="p-3 rounded-xl bg-slate-950/90 hover:bg-sky-500/10 border border-white/10 hover:border-sky-400/40 text-left text-xs text-slate-200 transition"
                >
                  {sample}
                </button>
              ))}
            </div>
          )}

          {/* Conversation Viewport */}
          {turns.length > 0 && (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {turns.map((t, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-2xl border text-xs sm:text-sm space-y-2.5 ${
                    t.role === 'user'
                      ? 'bg-indigo-950/45 border-indigo-400/30 text-white ml-4 sm:ml-12'
                      : 'bg-slate-950/95 border-white/10 text-slate-100 mr-2 sm:mr-6'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                    <span className="font-semibold text-sky-300 flex items-center gap-1.5">
                      {t.role === 'user' ? 'Вы' : <><Bot className="w-3.5 h-3.5" /> ИИ ({t.model || 'Live'})</>}
                    </span>
                    {t.role === 'assistant' && (
                      <button
                        type="button"
                        onClick={() => copyText(t.content, onToast)}
                        className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Копировать
                      </button>
                    )}
                  </div>

                  {t.images && t.images.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {t.images.map((img, i) => (
                        <img
                          key={i}
                          src={img}
                          alt="Иллюстрация"
                          className="h-32 rounded-xl object-cover border border-white/10 shrink-0"
                        />
                      ))}
                    </div>
                  )}

                  <div className="whitespace-pre-line leading-relaxed">{t.content}</div>

                  {t.sources && t.sources.length > 0 && (
                    <div className="pt-2 border-t border-white/10 space-y-1.5">
                      <div className="text-[10px] uppercase font-mono text-emerald-300">
                        Найденные интернет-источники:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {t.sources.map((s, si) => (
                          <a
                            key={si}
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/12 hover:bg-emerald-500/20 border border-emerald-400/30 text-[11px] text-emerald-200 flex items-center gap-1 transition"
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[210px]">{s.title}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {busy && (
                <div className="p-3 rounded-xl bg-slate-950 border border-sky-400/30 text-xs text-sky-300 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Поиск в сети и генерация ответа...
                </div>
              )}
            </div>
          )}

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendChat();
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Задайте любой вопрос нейросети с выходом в Интернет..."
              className="flex-1 rounded-xl bg-slate-950 border border-white/15 px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-sky-400"
            />
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-1.5 shrink-0 transition"
            >
              <Send className="w-4 h-4" /> Отправить
            </button>
          </form>
        </div>
      ) : (
        /* CBT PSYCHOTHERAPIST & THOUGHT RECORD (СМЭР) */
        <div className="rounded-2xl bg-slate-900/80 border border-emerald-500/25 p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <Mini3DSceneBadge seed="ai_psychotherapist" color="#10b981" size={40} />
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                🛋️ Когнитивно-поведенческий психотерапевт (КПТ и Дневник СМЭР)
              </h3>
              <p className="text-xs text-slate-400">
                Структурированный разбор тревожных мыслей, поиск когнитивных искажений и возврат опоры
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">1. Ситуация (что произошло фактически?)</label>
              <textarea
                rows={3}
                value={situation}
                onChange={(e) => setSituation(e.target.value)}
                placeholder="Например: задержал сдачу задачи на работе / не ответили на сообщение..."
                className="w-full rounded-xl bg-slate-950 border border-white/10 p-3 text-xs text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                2. Автоматическая мысль (что пронеслось в голове?)
              </label>
              <textarea
                rows={3}
                value={autoThought}
                onChange={(e) => setAutoThought(e.target.value)}
                placeholder="Например: «Я никогда ничего не успеваю, все считают меня неудачником, всё пропало»..."
                className="w-full rounded-xl bg-slate-950 border border-white/10 p-3 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div className="flex flex-wrap gap-1.5">
              {['Тревога', 'Вина', 'Стыд', 'Выгорание', 'Раздражение', 'Подавленность'].map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setEmotion(em)}
                  className={`px-3 py-1.5 rounded-xl text-xs border transition ${
                    emotion === em
                      ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100 font-semibold'
                      : 'bg-slate-950 border-white/10 text-slate-300'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Сила эмоции сейчас:</span>
                <span className="font-mono font-bold text-emerald-300">{intensity}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={100}
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                className="w-full accent-emerald-400"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={cbtBusy}
            onClick={runCbt}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition"
          >
            <BrainCircuit className="w-4 h-4" />
            {cbtBusy ? 'Разбираем по протоколу КПТ...' : 'Разобрать мысль и снизить тревогу'}
          </button>

          {cbtRes && (
            <div className="space-y-3 pt-2 border-t border-white/10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {(cbtRes.distortions || []).map((d: any) => (
                  <div key={d.id} className="p-3 rounded-xl bg-slate-950 border border-amber-400/30 space-y-1 text-xs">
                    <div className="font-bold text-amber-300">⚡ {d.title}</div>
                    <p className="text-slate-400">{d.desc}</p>
                    <p className="text-emerald-200 pt-1">💡 <b>Рациональный сдвиг:</b> {d.reframe}</p>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-emerald-400/35 text-xs sm:text-sm text-slate-100 whitespace-pre-line leading-relaxed">
                {cbtRes.therapist_response}
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-1.5 text-xs">
                <div className="font-bold text-sky-300">🌿 Быстрое телесное заземление 5–4–3–2–1:</div>
                {(cbtRes.grounding_54321 || []).map((step: string, i: number) => (
                  <div key={i} className="text-slate-300">{step}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Compact contextual AI + Live Internet helper bar embedded across tool pages.
 */
export const EmbeddedAiHelperBar: React.FC<{
  pageTitle: string;
  onOpenFullAi: () => void;
  onToast: (msg: string) => void;
}> = ({ pageTitle, onOpenFullAi, onToast }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<SourceItem[]>([]);

  const askContextual = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = q.trim();
    if (!prompt || busy) return;
    setBusy(true);
    try {
      const res = await apiPost('/api/v6/ai/chat', {
        message: prompt,
        use_web: true,
        mode: 'general',
        page_context: pageTitle,
      });
      let ans = res.answer;
      let srcs: SourceItem[] = res.sources || [];
      if (res.offline_fallback) {
        const enr = await browserWebAndLlmEnrich(prompt, [], 'general', pageTitle);
        if (enr.answer) ans = enr.answer;
        if (enr.sources.length > srcs.length) srcs = enr.sources;
      }
      setAnswer(ans);
      setSources(srcs);
    } catch (err: any) {
      onToast(err.message || 'Ошибка запроса к ИИ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl bg-slate-950/90 border border-sky-500/25 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-xs font-semibold text-sky-200 hover:text-white transition min-w-0"
        >
          <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="truncate">ИИ-помощник с Интернетом по разделу «{pageTitle}»</span>
          {open ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
        </button>
        <button
          type="button"
          onClick={onOpenFullAi}
          className="px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 text-[11px] text-sky-200 shrink-0"
        >
          Полный чат →
        </button>
      </div>

      {open && (
        <div className="space-y-2.5 pt-1">
          <form onSubmit={askContextual} className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Спросите ИИ или найдите в сети по теме «${pageTitle}»...`}
              className="flex-1 rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400"
            />
            <button
              type="submit"
              disabled={busy}
              className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shrink-0"
            >
              {busy ? '...' : 'Спросить'}
            </button>
          </form>

          {answer && (
            <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 text-xs text-slate-200 space-y-2">
              <div className="whitespace-pre-line leading-relaxed">{answer}</div>
              {sources.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-white/10">
                  {sources.slice(0, 3).map((s, idx) => (
                    <a
                      key={idx}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-emerald-300 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" /> {s.title}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
