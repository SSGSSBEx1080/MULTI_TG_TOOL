import React, { useEffect, useState } from 'react';
import { Bomb, Copy, Flag, Plus, RotateCcw, Search, Shield, Table, Trash2, Trophy } from 'lucide-react';
import { apiGet, apiPost, copyText } from '../../lib/api';

// ============================================================================
// 1. PERIODIC TABLE OF 118 ELEMENTS + MOLAR MASS CALCULATOR (periodic_table)
// ============================================================================
export const PeriodicTableStudio: React.FC<{ onToast: (m: string) => void }> = ({ onToast }) => {
  const [query, setQuery] = useState('');
  const [formula, setFormula] = useState('H2SO4');
  const [elements, setElements] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [molar, setMolar] = useState<any>(null);

  const loadData = async (q: string, f: string) => {
    try {
      const r = await apiGet(`/api/v2/v5/periodic-table?q=${encodeURIComponent(q)}&formula=${encodeURIComponent(f)}`);
      setElements(r.elements || []);
      if (!selected && r.elements?.length) setSelected(r.elements[0]);
      if (r.molar) setMolar(r.molar);
    } catch (e: any) {
      onToast(e.message);
    }
  };

  useEffect(() => {
    loadData('', formula);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => loadData(query, ''), 160);
    return () => window.clearTimeout(t);
  }, [query]);

  return (
    <div className="space-y-4 min-w-0">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-slate-900/80 p-4 space-y-3">
          <h3 className="text-sm sm:text-base font-semibold text-white">🧪 Таблица Менделеева (118 элементов)</h3>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по символу (Fe, Au), номеру (79) или названию (Золото)…"
              className="w-full rounded-xl bg-slate-950 border border-white/10 pl-9 pr-3 py-2 text-xs sm:text-sm text-white"
            />
          </div>
          {selected && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-amber-400/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-amber-500/20 border border-amber-400/40 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-amber-300 leading-none">{selected.z}</span>
                  <span className="text-xl font-bold text-white">{selected.symbol}</span>
                </div>
                <div>
                  <div className="text-sm font-bold text-white">
                    {selected.name_ru} <span className="text-slate-400 font-normal">({selected.name_en})</span>
                  </div>
                  <div className="text-xs text-amber-300">{selected.category}</div>
                  <div className="text-xs text-slate-300">Атомная масса: <b>{selected.mass}</b> а.е.м.</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-slate-900/80 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-white">⚖️ Расчёт Молярной Массы Формулы</h4>
          <div className="flex gap-2">
            <input
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadData(query, formula)}
              placeholder="H2SO4, Ca(OH)2, C6H12O6"
              className="flex-1 rounded-xl bg-slate-950 border border-white/10 px-3 py-2 font-mono text-sm text-white"
            />
            <button
              type="button"
              onClick={() => loadData(query, formula)}
              className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-semibold text-xs"
            >
              Считать
            </button>
          </div>
          {molar && (
            <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Молярная масса {molar.formula}:</span>
                <b className="text-emerald-300 text-sm">{molar.molar_mass_g_mol} г/моль</b>
              </div>
              <div className="space-y-1">
                {molar.breakdown.map((b: any) => (
                  <div key={b.symbol} className="flex justify-between text-slate-300">
                    <span>{b.symbol} ({b.name_ru}) × {b.count}</span>
                    <span>{b.subtotal_g_mol} г ({b.mass_pct}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-9 lg:grid-cols-12 gap-1.5">
        {elements.map((el) => (
          <button
            key={el.z}
            type="button"
            onClick={() => setSelected(el)}
            className={`p-2 rounded-xl border text-left transition ${
              selected?.z === el.z
                ? 'bg-amber-500/25 border-amber-400 text-white'
                : 'bg-slate-900/80 border-white/10 text-slate-200 hover:bg-white/5'
            }`}
          >
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>{el.z}</span>
              <span>{el.mass}</span>
            </div>
            <div className="text-base font-bold text-white leading-tight">{el.symbol}</div>
            <div className="text-[10px] text-slate-300 truncate">{el.name_ru}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 2. GROUP BILL SPLITTER & SETTLEMENT (bill_splitter)
// ============================================================================
export const BillSplitterStudio: React.FC<{ onSync: () => void; onToast: (m: string) => void }> = ({ onSync, onToast }) => {
  const [entries, setEntries] = useState([
    { name: 'Алексей', paid: 3200 },
    { name: 'Мария', paid: 900 },
    { name: 'Денис', paid: 0 },
    { name: 'Катя', paid: 500 },
  ]);
  const [tipPct, setTipPct] = useState(0);
  const [res, setRes] = useState<any>(null);

  const calculate = async (silent = false) => {
    try {
      const r = await apiPost('/api/v2/v5/bill-split', { entries, tip_pct: tipPct });
      setRes(r);
      if (!silent) onSync();
    } catch (e: any) {
      if (!silent) onToast(e.message);
    }
  };

  useEffect(() => {
    calculate(true);
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-w-0">
      <div className="lg:col-span-6 rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-semibold text-white">🧾 Кто сколько заплатил в общий счёт</h3>
          <button
            type="button"
            onClick={() => setEntries([...entries, { name: `Участник ${entries.length + 1}`, paid: 0 }])}
            className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 text-xs flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Участник
          </button>
        </div>

        <div className="space-y-2">
          {entries.map((e, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                value={e.name}
                onChange={(ev) => setEntries(entries.map((x, i) => (i === idx ? { ...x, name: ev.target.value } : x)))}
                placeholder="Имя"
                className="flex-1 rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs sm:text-sm text-white"
              />
              <input
                type="number"
                value={e.paid}
                onChange={(ev) => setEntries(entries.map((x, i) => (i === idx ? { ...x, paid: Number(ev.target.value) || 0 } : x)))}
                placeholder="Оплатил ₽"
                className="w-28 rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs sm:text-sm text-white"
              />
              {entries.length > 2 && (
                <button
                  type="button"
                  onClick={() => setEntries(entries.filter((_, i) => i !== idx))}
                  className="p-2 text-slate-400 hover:text-rose-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="text-xs">
          <div className="flex justify-between text-slate-300 mb-1">
            <span>Чаевые сверху</span>
            <b>{tipPct}%</b>
          </div>
          <input type="range" min={0} max={25} value={tipPct} onChange={(e) => setTipPct(Number(e.target.value))} className="w-full accent-indigo-400" />
        </div>

        <button
          type="button"
          onClick={() => calculate(false)}
          className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-semibold text-sm transition"
        >
          Рассчитать взаимозачёт переводов
        </button>
      </div>

      <div className="lg:col-span-6 rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 space-y-3">
        {res && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-950 border border-white/10">
                <div className="text-xs text-slate-400">Итого по счёту</div>
                <div className="text-xl font-bold text-white">{res.total_with_tip} ₽</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-emerald-400/30">
                <div className="text-xs text-slate-400">Доля каждого</div>
                <div className="text-xl font-bold text-emerald-300">{res.per_person} ₽</div>
              </div>
            </div>
            <div className="space-y-2 text-xs">
              <div className="text-slate-300 font-semibold">Кому сколько перевести:</div>
              {res.transfers.length > 0 ? (
                res.transfers.map((tr: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-indigo-400/30">
                    <span className="text-slate-200">
                      <b>{tr.from}</b> → <b>{tr.to}</b>
                    </span>
                    <b className="text-indigo-300 text-sm">{tr.amount} ₽</b>
                  </div>
                ))
              ) : (
                <div className="p-3 rounded-xl bg-slate-950 text-emerald-300">Все заплатили поровну — переводы не нужны</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 3. HTTP STATUS CODES & LINUX CHMOD MATRIX (http_chmod_lab)
// ============================================================================
export const HttpChmodStudio: React.FC<{ onToast: (m: string) => void }> = ({ onToast }) => {
  const [perms, setPerms] = useState([
    [true, true, true],
    [true, false, true],
    [true, false, true],
  ]);
  const [httpQuery, setHttpQuery] = useState('');
  const [data, setData] = useState<any>(null);

  const octal = perms
    .map((row) => (row[0] ? 4 : 0) + (row[1] ? 2 : 0) + (row[2] ? 1 : 0))
    .join('');

  useEffect(() => {
    apiGet(`/api/v2/v5/http-chmod?octal=${octal}&q=${encodeURIComponent(httpQuery)}`)
      .then(setData)
      .catch(() => {});
  }, [octal, httpQuery]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-w-0">
      <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 space-y-4">
        <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-amber-400" /> Калькулятор Прав Linux (Chmod)
        </h3>
        <div className="space-y-2 text-xs">
          {['Владелец (User)', 'Группа (Group)', 'Остальные (Others)'].map((role, rIdx) => (
            <div key={role} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-white/10">
              <span className="text-slate-200 font-medium">{role}</span>
              <div className="flex gap-3">
                {['Read (4)', 'Write (2)', 'Exec (1)'].map((lbl, cIdx) => (
                  <label key={lbl} className="flex items-center gap-1 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={perms[rIdx][cIdx]}
                      onChange={() =>
                        setPerms(perms.map((row, ri) => (ri === rIdx ? row.map((v, ci) => (ci === cIdx ? !v : v)) : row)))
                      }
                      className="accent-amber-400"
                    />
                    {lbl.split(' ')[0]}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        {data && (
          <div className="p-3.5 rounded-xl bg-slate-950 border border-amber-400/30 flex items-center justify-between">
            <div className="font-mono">
              <div className="text-lg font-bold text-amber-300">{data.chmod_command}</div>
              <div className="text-xs text-slate-400">Символьная маска: {data.chmod_symbolic}</div>
            </div>
            <button
              type="button"
              onClick={() => copyText(data.chmod_command, onToast)}
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs"
            >
              Копировать
            </button>
          </div>
        )}
      </div>

      <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 space-y-3">
        <h3 className="text-sm sm:text-base font-semibold text-white">🌐 Справочник Статусов HTTP (100–599)</h3>
        <input
          value={httpQuery}
          onChange={(e) => setHttpQuery(e.target.value)}
          placeholder="Код (404, 422, 502) или описание…"
          className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs sm:text-sm text-white"
        />
        <div className="space-y-1.5 max-h-72 overflow-y-auto text-xs">
          {(data?.http_codes || []).map((c: any) => (
            <div key={c.code} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-950 border border-white/5">
              <div>
                <span
                  className={`font-mono font-bold mr-2 ${
                    c.code < 300 ? 'text-emerald-400' : c.code < 400 ? 'text-sky-400' : c.code < 500 ? 'text-amber-400' : 'text-rose-400'
                  }`}
                >
                  {c.code} {c.title}
                </span>
                <span className="text-slate-300">{c.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. CSV / TEXT TO MARKDOWN TABLE CONVERTER (markdown_table_fmt)
// ============================================================================
export const MarkdownTableStudio: React.FC<{ onToast: (m: string) => void }> = ({ onToast }) => {
  const [rawCsv, setRawCsv] = useState(
    'Сервис, Задержка, Статус\nAPI Gateway, 12 мс, OK\nQR OpenCV, 18 мс, OK\nSQLite DB, 2 мс, OK'
  );

  const buildTable = (): string => {
    const lines = rawCsv
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return '';
    const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
    const grid = lines.map((l) => l.split(sep).map((c) => c.trim()));
    const cols = Math.max(...grid.map((r) => r.length));
    const widths = Array.from({ length: cols }, (_, ci) =>
      Math.max(3, ...grid.map((r) => (r[ci] || '').length))
    );
    const fmtRow = (r: string[]) =>
      '| ' + widths.map((w, ci) => (r[ci] || '').padEnd(w, ' ')).join(' | ') + ' |';
    const divider = '| ' + widths.map((w) => '-'.repeat(w)).join(' | ') + ' |';
    return [fmtRow(grid[0]), divider, ...grid.slice(1).map(fmtRow)].join('\n');
  };

  const md = buildTable();

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 space-y-4">
      <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
        <Table className="w-5 h-5 text-pink-400" /> Конвертер CSV / Списков в Выровненную Таблицу Markdown
      </h3>
      <textarea
        rows={5}
        value={rawCsv}
        onChange={(e) => setRawCsv(e.target.value)}
        placeholder="Колонка 1, Колонка 2, Колонка 3"
        className="w-full rounded-xl bg-slate-950 border border-white/10 p-3 font-mono text-xs sm:text-sm text-white"
      />
      <pre className="p-3.5 rounded-xl bg-slate-950 border border-white/10 font-mono text-xs text-emerald-300 overflow-x-auto">
        {md}
      </pre>
      <button
        type="button"
        onClick={() => copyText(md, onToast)}
        className="px-4 py-2 rounded-xl bg-pink-500 text-slate-950 font-semibold text-xs flex items-center gap-1.5"
      >
        <Copy className="w-3.5 h-3.5" /> Скопировать таблицу Markdown
      </button>
    </div>
  );
};

// ============================================================================
// 5. TOURNAMENT PLAYOFF BRACKET & TEAM DRAW (tournament_bracket)
// ============================================================================
export const TournamentBracketStudio: React.FC = () => {
  const [namesText, setNamesText] = useState('Тигры\nСоколы\nКибер-Волки\nФеникс\nМолния\nЛегион\nАтлант\nШторм');
  const [rounds, setRounds] = useState<string[][]>([]);

  const startBracket = (shuffle: boolean) => {
    let list = namesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (shuffle) {
      list = [...list].sort(() => Math.random() - 0.5);
    }
    const size = list.length <= 4 ? 4 : list.length <= 8 ? 8 : 16;
    while (list.length < size) list.push('Тех. проход');
    list = list.slice(0, size);

    const nextRounds: string[][] = [list];
    let n = size / 2;
    while (n >= 1) {
      nextRounds.push(Array(n).fill('—'));
      n = Math.floor(n / 2);
    }
    setRounds(nextRounds);
  };

  useEffect(() => {
    startBracket(false);
  }, []);

  const advanceWinner = (rIdx: number, pIdx: number) => {
    if (rIdx >= rounds.length - 1) return;
    const player = rounds[rIdx][pIdx];
    if (!player || player === '—') return;
    setRounds((prev) =>
      prev.map((col, ci) => {
        if (ci === rIdx + 1) {
          return col.map((val, vi) => (vi === Math.floor(pIdx / 2) ? player : val));
        }
        return col;
      })
    );
  };

  return (
    <div className="space-y-4 min-w-0">
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 space-y-3">
        <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" /> Турнирная Сетка Плей-офф (4 / 8 / 16 участников)
        </h3>
        <textarea
          rows={4}
          value={namesText}
          onChange={(e) => setNamesText(e.target.value)}
          placeholder="По одному участнику или команде на строке"
          className="w-full rounded-xl bg-slate-950 border border-white/10 p-3 text-xs sm:text-sm text-white"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => startBracket(true)}
            className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-semibold text-xs"
          >
            Случайная жеребьёвка
          </button>
          <button
            type="button"
            onClick={() => startBracket(false)}
            className="px-4 py-2 rounded-xl bg-white/10 text-white font-semibold text-xs"
          >
            По порядку списка
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 overflow-x-auto">
        <div className="flex gap-4 min-w-[520px]">
          {rounds.map((col, rIdx) => (
            <div key={rIdx} className="flex-1 flex flex-col justify-around gap-2">
              <div className="text-[11px] font-semibold text-slate-400 text-center pb-1">
                {rIdx === rounds.length - 1 ? '🏆 Чемпион' : `Раунд ${rIdx + 1}`}
              </div>
              {col.map((name, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() => advanceWinner(rIdx, pIdx)}
                  className={`p-2.5 rounded-xl border text-xs font-medium text-left truncate transition ${
                    rIdx === rounds.length - 1 && name !== '—'
                      ? 'bg-amber-500/25 border-amber-400 text-amber-200 font-bold'
                      : 'bg-slate-950 border-white/10 text-slate-200 hover:border-sky-400'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 6. CLASSIC MINESWEEPER PRO (minesweeper_pro)
// ============================================================================
interface Cell {
  mine: boolean;
  open: boolean;
  flag: boolean;
  adj: number;
}

export const MinesweeperProStudio: React.FC<{ onToast: (m: string) => void }> = ({ onToast }) => {
  const [size, setSize] = useState<9 | 12>(9);
  const minesCount = size === 9 ? 10 : 20;
  const [board, setBoard] = useState<Cell[][]>([]);
  const [started, setStarted] = useState(false);
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [flagMode, setFlagMode] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const initEmpty = (n: number) => {
    setBoard(
      Array.from({ length: n }, () =>
        Array.from({ length: n }, () => ({ mine: false, open: false, flag: false, adj: 0 }))
      )
    );
    setStarted(false);
    setStatus('playing');
    setSeconds(0);
  };

  useEffect(() => {
    initEmpty(size);
  }, [size]);

  useEffect(() => {
    if (!started || status !== 'playing') return;
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [started, status]);

  const plantMines = (grid: Cell[][], safeR: number, safeC: number) => {
    const n = grid.length;
    let placed = 0;
    while (placed < minesCount) {
      const r = Math.floor(Math.random() * n);
      const c = Math.floor(Math.random() * n);
      if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
      if (!grid[r][c].mine) {
        grid[r][c].mine = true;
        placed += 1;
      }
    }
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        if (grid[r][c].mine) continue;
        let cnt = 0;
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let dc = -1; dc <= 1; dc += 1) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < n && nc >= 0 && nc < n && grid[nr][nc].mine) cnt += 1;
          }
        }
        grid[r][c].adj = cnt;
      }
    }
  };

  const floodOpen = (grid: Cell[][], r: number, c: number) => {
    const n = grid.length;
    const stack: Array<[number, number]> = [[r, c]];
    while (stack.length) {
      const [cr, cc] = stack.pop()!;
      if (cr < 0 || cr >= n || cc < 0 || cc >= n) continue;
      const cell = grid[cr][cc];
      if (cell.open || cell.flag) continue;
      cell.open = true;
      if (cell.adj === 0 && !cell.mine) {
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let dc = -1; dc <= 1; dc += 1) {
            if (dr !== 0 || dc !== 0) stack.push([cr + dr, cc + dc]);
          }
        }
      }
    }
  };

  const handleCellClick = (r: number, c: number, rightClick = false) => {
    if (status !== 'playing') return;
    const next = board.map((row) => row.map((cell) => ({ ...cell })));
    if (rightClick || flagMode) {
      if (!next[r][c].open) {
        next[r][c].flag = !next[r][c].flag;
        setBoard(next);
      }
      return;
    }
    if (next[r][c].flag) return;

    if (!started) {
      plantMines(next, r, c);
      setStarted(true);
    }

    if (next[r][c].mine) {
      next.forEach((row) => row.forEach((cell) => { if (cell.mine) cell.open = true; }));
      setBoard(next);
      setStatus('lost');
      onToast('Подрыв на мине!');
      return;
    }

    floodOpen(next, r, c);
    const unrevealedSafe = next.flat().filter((cell) => !cell.mine && !cell.open).length;
    if (unrevealedSafe === 0) {
      setStatus('won');
      onToast(`Поле разминировано за ${seconds} сек!`);
    }
    setBoard(next);
  };

  const flagsUsed = board.flat().filter((c) => c.flag).length;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 space-y-4 flex flex-col items-center">
      <div className="w-full flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
          <Bomb className="w-5 h-5 text-emerald-400" /> Сапёр (Minesweeper)
        </h3>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setSize(9)}
            className={`px-2.5 py-1 rounded-lg ${size === 9 ? 'bg-emerald-500 text-slate-950 font-semibold' : 'bg-slate-950 text-slate-300'}`}
          >
            9×9 (10 мин)
          </button>
          <button
            type="button"
            onClick={() => setSize(12)}
            className={`px-2.5 py-1 rounded-lg ${size === 12 ? 'bg-emerald-500 text-slate-950 font-semibold' : 'bg-slate-950 text-slate-300'}`}
          >
            12×12 (20 мин)
          </button>
          <button
            type="button"
            onClick={() => setFlagMode((v) => !v)}
            className={`px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
              flagMode ? 'bg-amber-500/25 border-amber-400 text-amber-200 font-semibold' : 'bg-slate-950 border-white/10 text-slate-300'
            }`}
          >
            <Flag className="w-3.5 h-3.5" /> {flagMode ? 'Режим: Флажок' : 'Режим: Ход'}
          </button>
          <button
            type="button"
            onClick={() => initEmpty(size)}
            className="px-2.5 py-1 rounded-lg bg-white/10 text-white flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Заново
          </button>
        </div>
      </div>

      <div className="flex items-center gap-5 text-xs font-mono bg-slate-950 px-4 py-2 rounded-xl border border-white/10">
        <span className="text-amber-300">🚩 Мин осталось: {minesCount - flagsUsed}</span>
        <span className="text-sky-300">⏱ {seconds} с</span>
        <span className="text-emerald-300">
          {status === 'won' ? 'ПОБЕДА' : status === 'lost' ? 'ПОРАЖЕНИЕ' : 'В ИГРЕ'}
        </span>
      </div>

      <div
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        className="grid gap-1 bg-slate-950 p-2 rounded-2xl border border-white/10 max-w-full"
      >
        {board.map((row, r) =>
          row.map((cell, c) => (
            <button
              key={`${r}-${c}`}
              type="button"
              onClick={() => handleCellClick(r, c, false)}
              onContextMenu={(e) => {
                e.preventDefault();
                handleCellClick(r, c, true);
              }}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md text-xs font-bold flex items-center justify-center select-none transition ${
                cell.open
                  ? cell.mine
                    ? 'bg-rose-500 text-white'
                    : 'bg-slate-900 text-sky-300 border border-white/5'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-white/10'
              }`}
            >
              {cell.open ? (cell.mine ? '💣' : cell.adj || '') : cell.flag ? '🚩' : ''}
            </button>
          ))
        )}
      </div>
    </div>
  );
};
