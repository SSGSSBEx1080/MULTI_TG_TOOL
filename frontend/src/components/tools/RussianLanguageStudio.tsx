import React, { useEffect, useState } from 'react';
import { BookCheck, CheckCircle2, Copy, Languages, RefreshCw, Sparkles, XCircle } from 'lucide-react';
import { apiGet, apiPost, copyText } from '../../lib/api';

interface StressItem {
  base: string;
  correct: string;
  wrong: string;
  pos: string;
  hint: string;
  options: string[];
}

export const RussianLanguageStudio: React.FC<{ onToast: (m: string) => void }> = ({ onToast }) => {
  const [sub, setSub] = useState<'stress' | 'yo' | 'translit'>('stress');
  const [deck, setDeck] = useState<StressItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [searchQ, setSearchQ] = useState('');

  // Yoficator & Translit
  const [yoInput, setYoInput] = useState('Еще теплый звездный вечер: режиссер и актер ведут серьезный расчет съемок.');
  const [yoOut, setYoOut] = useState<{ output: string; replacements_count: number } | null>(null);
  const [trInput, setTrInput] = useState('Щеглов Артём Юрьевич');
  const [trStandards, setTrStandards] = useState<{ id: string; title: string; value: string }[]>([]);

  const loadDeck = (q = '') => {
    apiGet(`/api/v2/timbrica/ege-stress?count=20&q=${encodeURIComponent(q)}`)
      .then((r) => {
        setDeck(r.items || []);
        setIdx(0);
        setPicked(null);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadDeck();
  }, []);

  const cur = deck[idx];

  const runYo = async () => {
    try {
      const r = await apiPost('/api/v2/timbrica/yoficate', { text: yoInput });
      setYoOut(r);
    } catch (e: any) {
      onToast(e.message);
    }
  };

  const runTranslit = async () => {
    try {
      const r = await apiPost('/api/v2/timbrica/translit', { text: trInput });
      setTrStandards(r.standards || []);
    } catch (e: any) {
      onToast(e.message);
    }
  };

  useEffect(() => {
    if (sub === 'translit' && trStandards.length === 0) {
      runTranslit();
    }
  }, [sub]);

  return (
    <div className="rounded-2xl border border-pink-500/30 bg-slate-900/80 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'stress', label: '🎯 Ударения ЕГЭ (ФИПИ)' },
            { id: 'yo', label: 'Ё Ёфикатор текста' },
            { id: 'translit', label: '🛂 Транслит МВД / ГОСТ' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSub(t.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                sub === t.id
                  ? 'bg-pink-500/25 border-pink-400 text-pink-200'
                  : 'bg-slate-950 border-white/10 text-slate-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {sub === 'stress' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 p-4 rounded-2xl bg-slate-950 border border-white/10 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Орфоэпический минимум ФИПИ • Слово {idx + 1}/{deck.length || 1}</span>
              <span className="font-mono font-bold text-emerald-300">Серия без ошибок: {streak}</span>
            </div>

            {cur ? (
              <>
                <div className="text-center py-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-white/5 text-[11px] text-slate-400">{cur.pos}</span>
                  <div className="text-sm text-slate-300 mt-2">Выберите верную постановку ударения:</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {cur.options.map((opt) => {
                    const isCorrect = opt === cur.correct;
                    const chosen = picked === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        disabled={Boolean(picked)}
                        onClick={() => {
                          setPicked(opt);
                          setStreak((s) => (isCorrect ? s + 1 : 0));
                        }}
                        className={`py-4 px-3 rounded-2xl border text-lg sm:text-xl font-display font-bold transition ${
                          !picked
                            ? 'bg-slate-900 hover:bg-pink-500/15 border-white/15 text-white'
                            : isCorrect
                            ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                            : chosen
                            ? 'bg-rose-500/25 border-rose-400 text-rose-200'
                            : 'bg-slate-900/50 border-white/5 text-slate-500'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {picked && (
                  <div className="p-3 rounded-xl bg-slate-900 border border-white/10 space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 font-bold">
                      {picked === cur.correct ? (
                        <span className="text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Верно: {cur.correct}
                        </span>
                      ) : (
                        <span className="text-rose-300 flex items-center gap-1">
                          <XCircle className="w-4 h-4" /> Правильно: {cur.correct}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-300 leading-relaxed">{cur.hint}</p>
                    <button
                      type="button"
                      onClick={() => {
                        if (idx + 1 >= deck.length) loadDeck(searchQ);
                        else {
                          setIdx((i) => i + 1);
                          setPicked(null);
                        }
                      }}
                      className="w-full py-2 rounded-xl glow-btn text-white font-bold"
                    >
                      Следующее слово →
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs text-slate-400 py-6 text-center">Слова загружаются…</div>
            )}
          </div>

          <div className="lg:col-span-5 p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <BookCheck className="w-4 h-4 text-pink-400" /> Быстрый поиск по словнику ФИПИ
            </div>
            <div className="flex gap-1.5">
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="звонит, торты, свекла, квартал..."
                className="flex-1 rounded-xl bg-slate-900 border border-white/10 px-3 py-1.5 text-xs text-white"
              />
              <button
                type="button"
                onClick={() => loadDeck(searchQ)}
                className="px-3 py-1.5 rounded-xl bg-pink-500/25 border border-pink-400/50 text-xs text-pink-200 font-semibold"
              >
                Найти
              </button>
            </div>
            <div className="max-h-52 overflow-y-auto space-y-1.5 text-xs">
              {deck.slice(0, 12).map((w) => (
                <div key={w.base} className="p-2 rounded-lg bg-slate-900/90 border border-white/5">
                  <span className="font-bold text-emerald-300">{w.correct}</span>{' '}
                  <span className="text-slate-500 line-through ml-1">{w.wrong}</span>
                  <div className="text-[11px] text-slate-400 mt-0.5">{w.hint}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {sub === 'yo' && (
        <div className="space-y-3">
          <div className="text-xs text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-pink-400" /> Автоматическое восстановление буквы «ё» в однозначных корнях и именах
          </div>
          <textarea
            rows={4}
            value={yoInput}
            onChange={(e) => setYoInput(e.target.value)}
            className="w-full rounded-xl bg-slate-950 border border-white/10 p-3 text-sm text-white"
          />
          <button type="button" onClick={runYo} className="px-5 py-2 rounded-xl glow-btn text-white text-xs font-bold">
            Восстановить букву «ё»
          </button>
          {yoOut && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs text-emerald-300">
                <span>Восстановлено слов: {yoOut.replacements_count}</span>
                <button
                  type="button"
                  onClick={() => copyText(yoOut.output, onToast)}
                  className="px-2.5 py-1 rounded bg-white/10 text-white flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Копировать
                </button>
              </div>
              <p className="text-sm text-white whitespace-pre-wrap">{yoOut.output}</p>
            </div>
          )}
        </div>
      )}

      {sub === 'translit' && (
        <div className="space-y-3">
          <div className="text-xs text-slate-300 flex items-center gap-1.5">
            <Languages className="w-4 h-4 text-sky-400" /> Транслитерация ФИО и текста по официальным стандартам (Загранпаспорт МВД / ГОСТ / ISO)
          </div>
          <div className="flex gap-2">
            <input
              value={trInput}
              onChange={(e) => setTrInput(e.target.value)}
              placeholder="Введите ФИО или фразу на русском..."
              className="flex-1 rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
            />
            <button
              type="button"
              onClick={runTranslit}
              className="px-4 py-2 rounded-xl glow-btn text-white text-xs font-bold flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Перевести
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {trStandards.map((st) => (
              <div key={st.id} className="p-3 rounded-xl bg-slate-950 border border-white/10 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-400">{st.title}</div>
                  <div className="text-sm font-mono font-bold text-white break-all mt-0.5">{st.value}</div>
                </div>
                <button
                  type="button"
                  onClick={() => copyText(st.value, onToast)}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/15 text-white shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
