import React, { useEffect, useRef, useState } from 'react';
import { Bomb, Copy, Download, Flag, Plus, RotateCcw, Search, Shield, Table, Trash2, Trophy } from 'lucide-react';
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
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const tableRequestId = useRef(0);
  const molarRequestId = useRef(0);
  const queryEffectMounted = useRef(false);

  const loadData = async (q: string, f: string) => {
    const currentTableRequest = ++tableRequestId.current;
    const currentMolarRequest = f ? ++molarRequestId.current : null;
    setLoading(true);
    setLoadError('');
    try {
      const r = await apiGet(`/api/v2/v5/periodic-table?q=${encodeURIComponent(q)}&formula=${encodeURIComponent(f)}`);
      if (currentTableRequest === tableRequestId.current) {
        const nextElements = r.elements || [];
        setElements(nextElements);
        setSelected((current: any) =>
          !current || !nextElements.some((element: any) => element.z === current.z)
            ? (nextElements[0] || null)
            : current,
        );
      }
      if (currentMolarRequest !== null && currentMolarRequest === molarRequestId.current) {
        setMolar(r.molar || null);
      }
    } catch (e: any) {
      const tableIsCurrent = currentTableRequest === tableRequestId.current;
      const molarIsCurrent = currentMolarRequest !== null && currentMolarRequest === molarRequestId.current;
      if (!tableIsCurrent && !molarIsCurrent) return;
      const message = e?.message || 'Не удалось загрузить данные таблицы';
      setLoadError(message);
      onToast(message);
    } finally {
      if (currentTableRequest === tableRequestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    void loadData('', formula);
  }, []);

  useEffect(() => {
    if (!queryEffectMounted.current) {
      queryEffectMounted.current = true;
      return;
    }
    const t = window.setTimeout(() => void loadData(query, formula), 160);
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
          {loading && <p role="status" className="text-xs text-amber-200">Обновляем таблицу и расчёт…</p>}
          {loadError && <p role="alert" className="text-xs text-rose-300">{loadError}</p>}
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
              onChange={(e) => {
                setFormula(e.target.value);
                setMolar(null);
                setLoadError('');
                molarRequestId.current += 1;
              }}
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
type BillParticipant = { id: string; name: string; paid: number; share_weight: number };
type BillExpense = { id: string; description: string; amount: number; payerId: string; participantIds: string[] };
const BILL_SPLIT_CURRENCIES = [
  { code: 'RUB', label: '₽ RUB' }, { code: 'EUR', label: '€ EUR' }, { code: 'USD', label: '$ USD' },
  { code: 'GBP', label: '£ GBP' }, { code: 'CHF', label: 'CHF' }, { code: 'PLN', label: 'zł PLN' },
  { code: 'TRY', label: '₺ TRY' }, { code: 'KZT', label: '₸ KZT' }, { code: 'GEL', label: '₾ GEL' },
  { code: 'AMD', label: '֏ AMD' }, { code: 'UZS', label: "soʻm UZS" },
] as const;

const billEntryId = () => typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : `bill-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const makeBillParticipant = (index: number): BillParticipant => ({
  id: billEntryId(),
  name: ['Алексей', 'Мария', 'Денис', 'Катя'][index] || `Участник ${index + 1}`,
  paid: [3200, 900, 0, 500][index] || 0,
  share_weight: 1,
});

export const BillSplitterStudio: React.FC<{ onSync: () => void; onToast: (m: string) => void }> = ({ onSync, onToast }) => {
  const [entries, setEntries] = useState<BillParticipant[]>(() => [0, 1, 2, 3].map(makeBillParticipant));
  const [expenses, setExpenses] = useState<BillExpense[]>([]);
  const [splitMode, setSplitMode] = useState<'weighted' | 'items'>('weighted');
  const [currencyCode, setCurrencyCode] = useState<(typeof BILL_SPLIT_CURRENCIES)[number]['code']>('RUB');
  const [tipPct, setTipPct] = useState(0);
  const [res, setRes] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const formatMoney = (value: unknown) => new Intl.NumberFormat('ru-RU', {
    style: 'currency', currency: currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number(value) || 0);

  const markDirty = () => { requestId.current += 1; setLoading(false); setRes(null); setError(''); };
  const updateEntry = (id: string, patch: Partial<BillParticipant>) => {
    setEntries((current) => current.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
    markDirty();
  };
  const updateExpense = (id: string, patch: Partial<BillExpense>) => {
    setExpenses((current) => current.map((expense) => expense.id === id ? { ...expense, ...patch } : expense));
    markDirty();
  };

  const addExpense = () => {
    const firstId = entries[0]?.id || '';
    setExpenses((current) => [...current, {
      id: billEntryId(),
      description: `Позиция ${current.length + 1}`,
      amount: 0,
      payerId: firstId,
      participantIds: entries.map((entry) => entry.id),
    }]);
    markDirty();
  };

  const removeParticipant = (id: string) => {
    const remaining = entries.filter((entry) => entry.id !== id);
    if (remaining.length < 2) {
      onToast('Для взаимозачёта оставьте не менее двух участников.');
      return;
    }
    setEntries(remaining);
    setExpenses((current) => current.map((expense) => ({
      ...expense,
      payerId: expense.payerId === id ? remaining[0].id : expense.payerId,
      participantIds: expense.participantIds.filter((participantId) => participantId !== id),
    })));
    markDirty();
  };

  const calculate = async (silent = false) => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const apiEntries = entries.map(({ name, paid, share_weight }) => ({
        name: name.trim(),
        paid: splitMode === 'items' ? 0 : paid,
        share_weight: splitMode === 'items' ? 1 : share_weight,
      }));
      const apiExpenses = splitMode === 'items' ? expenses.map((expense) => ({
        description: expense.description.trim(),
        amount: expense.amount,
        payer: entries.find((entry) => entry.id === expense.payerId)?.name.trim() || '',
        participants: expense.participantIds.map((id) => entries.find((entry) => entry.id === id)?.name.trim() || '').filter(Boolean),
      })) : undefined;
      const result = await apiPost('/api/v2/v5/bill-split', { entries: apiEntries, tip_pct: tipPct, expenses: apiExpenses, currency_code: currencyCode });
      if (currentRequest !== requestId.current) return;
      setRes(result);
      if (!silent) onSync();
    } catch (caught: any) {
      if (currentRequest !== requestId.current) return;
      const message = caught?.message || 'Не удалось распределить счёт';
      setError(message);
      if (!silent) onToast(message);
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    void calculate(true);
    return () => { requestId.current += 1; };
  }, []);

  const createTransferText = () => res?.transfers?.length
    ? res.transfers.map((transfer: any) => `${transfer.from} → ${transfer.to}: ${formatMoney(transfer.amount)}`).join(String.fromCharCode(10))
    : 'Переводы не нужны';

  const exportSettlementCsv = () => {
    if (!res) return;
    const cell = (value: unknown) => {
      const text = String(value ?? '');
      const spreadsheetSafe = /^[=+@-]/.test(text.trimStart()) ? `'${text}` : text;
      return `"${spreadsheetSafe.replace(/"/g, '""')}"`;
    };
    const decimal = (value: unknown) => (Number(value) || 0).toFixed(2).replace('.', ',');
    const rows: unknown[][] = [
      ['Участник', 'Фактически оплатил', 'Доля с чаевыми', 'Чаевые', 'Баланс', 'Статус', 'Валюта'],
      ...(res.settlements || []).map((item: any) => [item.name, decimal(item.paid), decimal(item.share), decimal(item.tip_share), decimal(item.balance), item.status, currencyCode]),
      [],
      ['Переводы'],
      ['От', 'Кому', 'Сумма', 'Валюта'],
      ...(res.transfers || []).map((item: any) => [item.from, item.to, decimal(item.amount), currencyCode]),
    ];
    const csv = rows.map((row) => row.map(cell).join(';')).join(String.fromCharCode(13, 10));
    const url = URL.createObjectURL(new Blob([String.fromCharCode(0xFEFF), csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `bill-settlement-${currencyCode.toLowerCase()}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-12">
      <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 xl:col-span-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white sm:text-base">🧾 Общий счёт и взаимозачёт переводов</h3>
            <p className="mt-1 max-w-2xl text-[10px] leading-relaxed text-slate-400">Распределите общий счёт по долям или укажите позиции, которые делили не все. Суммы округляются до центов, расхождение округления распределяется по участникам.</p>
          </div>
          <button
            type="button"
            disabled={entries.length >= 25}
            onClick={() => { setEntries((current) => [...current, { id: billEntryId(), name: `Участник ${current.length + 1}`, paid: 0, share_weight: 1 }]); markDirty(); }}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-indigo-400/30 bg-indigo-500/20 px-2.5 text-xs text-indigo-100 hover:bg-indigo-500/30 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />Участник {entries.length >= 25 ? '· лимит' : ''}
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap gap-2" role="group" aria-label="Способ распределения счёта">
            <button type="button" aria-pressed={splitMode === 'weighted'} onClick={() => { setSplitMode('weighted'); markDirty(); }} className={`min-h-9 rounded-lg border px-3 text-xs transition ${splitMode === 'weighted' ? 'border-indigo-400 bg-indigo-500/20 text-indigo-100' : 'border-white/10 bg-slate-950 text-slate-300'}`}>По долям участников</button>
            <button type="button" aria-pressed={splitMode === 'items'} onClick={() => { setSplitMode('items'); markDirty(); }} className={`min-h-9 rounded-lg border px-3 text-xs transition ${splitMode === 'items' ? 'border-indigo-400 bg-indigo-500/20 text-indigo-100' : 'border-white/10 bg-slate-950 text-slate-300'}`}>Разобрать по позициям</button>
          </div>
          <label className="min-w-[110px] space-y-1 text-[9px] text-slate-500">Валюта
            <select value={currencyCode} onChange={(event) => { setCurrencyCode(event.target.value as typeof currencyCode); markDirty(); }} className="min-h-9 w-full rounded-lg border border-white/10 bg-slate-950 px-2 text-xs text-white" aria-label="Валюта общего счёта">
              {BILL_SPLIT_CURRENCIES.map((currency) => <option key={currency.code} value={currency.code}>{currency.label}</option>)}
            </select>
          </label>
        </div>

        <section aria-label="Участники счёта" className="space-y-2">
          <div className="hidden grid-cols-[minmax(100px,1fr)_minmax(90px,140px)_minmax(75px,100px)_36px] gap-2 px-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500 sm:grid">
            <span>Имя</span><span>{splitMode === 'items' ? 'Оплата по позициям' : `Уже оплатил · ${currencyCode}`}</span>{splitMode === 'weighted' && <span>Доля</span>}<span />
          </div>
          {entries.map((entry, index) => (
            <div key={entry.id} className={`grid grid-cols-[minmax(0,1fr)_minmax(88px,120px)_36px] items-center gap-2 rounded-xl border border-white/5 bg-slate-950/70 p-2 ${splitMode === 'weighted' ? 'sm:grid-cols-[minmax(100px,1fr)_minmax(90px,140px)_minmax(75px,100px)_36px]' : ''}`}>
              <label className="min-w-0"><span className="sr-only">Имя участника {index + 1}</span><input value={entry.name} maxLength={60} onChange={(event) => updateEntry(entry.id, { name: event.target.value })} placeholder={`Участник ${index + 1}`} className="w-full min-w-0 rounded-lg border border-white/10 bg-slate-900 px-2.5 py-2 text-xs text-white placeholder:text-slate-600" /></label>
              {splitMode === 'items' ? <span className="truncate px-1 text-center text-[9px] text-slate-500">считается из позиций</span> : <label><span className="sr-only">Сколько заплатил участник {index + 1}</span><input type="number" min="0" max="1000000000000" step="0.01" value={entry.paid} onChange={(event) => updateEntry(entry.id, { paid: Number(event.target.value) })} className="w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-2 text-xs text-white" /></label>}
              {splitMode === 'weighted' && <label><span className="sr-only">Доля расходов участника {index + 1}</span><input type="number" min="0.01" max="1000" step="0.25" value={entry.share_weight} onChange={(event) => updateEntry(entry.id, { share_weight: Number(event.target.value) })} className="w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-2 text-xs text-white" /></label>}
              <button type="button" onClick={() => removeParticipant(entry.id)} aria-label={`Удалить участника ${entry.name || index + 1}`} disabled={entries.length <= 2} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-rose-400/10 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-25"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {splitMode === 'weighted' && <p className="px-1 text-[9px] leading-relaxed text-slate-500">Доля 1 — обычная; 0,5 — половинная; 2 — двойная. Фактические доли нормируются автоматически. Например, если ребёнок платит половину взрослой доли, укажите 0,5.</p>}
        </section>

        {splitMode === 'items' && <section aria-label="Строки общего счёта" className="space-y-2 rounded-xl border border-indigo-300/10 bg-indigo-300/[.025] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h4 className="text-xs font-semibold text-white">Позиции в счёте</h4><p className="mt-1 text-[9px] text-slate-500">Выберите плательщика и только тех, кто делил эту позицию. Чаевые распределятся пропорционально долям.</p></div>
            <button type="button" onClick={addExpense} disabled={expenses.length >= 200} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 text-[10px] text-slate-200 hover:bg-white/10 disabled:opacity-40"><Plus className="h-3 w-3" />Добавить позицию</button>
          </div>
          {expenses.length === 0 && <div className="rounded-lg border border-dashed border-white/10 p-4 text-center text-[10px] text-slate-500">Добавьте блюдо, напиток или другую строку счёта, чтобы назначить её только нужным участникам.</div>}
          {expenses.map((expense, expenseIndex) => <article key={expense.id} className="space-y-2 rounded-xl border border-white/10 bg-slate-950/80 p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_120px_150px_36px]">
              <label><span className="sr-only">Название позиции {expenseIndex + 1}</span><input value={expense.description} maxLength={80} onChange={(event) => updateExpense(expense.id, { description: event.target.value })} placeholder={`Позиция ${expenseIndex + 1}`} className="w-full rounded-lg border border-white/10 bg-slate-900 px-2.5 py-2 text-xs text-white" /></label>
              <label><span className="sr-only">Стоимость позиции {expenseIndex + 1}</span><input type="number" min="0" max="1000000000000" step="0.01" value={expense.amount} onChange={(event) => updateExpense(expense.id, { amount: Number(event.target.value) })} placeholder={`Сумма ${currencyCode}`} className="w-full rounded-lg border border-white/10 bg-slate-900 px-2.5 py-2 text-xs text-white" /></label>
              <label><span className="sr-only">Кто оплатил позицию {expenseIndex + 1}</span><select value={expense.payerId} onChange={(event) => updateExpense(expense.id, { payerId: event.target.value })} className="w-full rounded-lg border border-white/10 bg-slate-900 px-2.5 py-2 text-xs text-white">{entries.map((participant) => <option key={participant.id} value={participant.id}>{participant.name || 'Без имени'}</option>)}</select></label>
              <button type="button" onClick={() => { setExpenses((current) => current.filter((item) => item.id !== expense.id)); markDirty(); }} aria-label={`Удалить позицию ${expense.description}`} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-rose-400/10 hover:text-rose-200"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            <fieldset className="flex flex-wrap gap-x-3 gap-y-1 border-t border-white/5 pt-2">
              <legend className="mb-1 text-[9px] text-slate-500">Кто делил позицию</legend>
              {entries.map((participant) => <label key={participant.id} className="flex cursor-pointer items-center gap-1 text-[10px] text-slate-300"><input type="checkbox" checked={expense.participantIds.includes(participant.id)} onChange={(event) => updateExpense(expense.id, { participantIds: event.target.checked ? [...expense.participantIds, participant.id] : expense.participantIds.filter((id) => id !== participant.id) })} className="accent-indigo-400" />{participant.name || 'Без имени'}</label>)}
            </fieldset>
          </article>)}
        </section>}

        <div className="space-y-1 text-xs">
          <div className="flex justify-between text-slate-300"><label htmlFor="bill-tip-rate">Чаевые сверху</label><b>{tipPct}%</b></div>
          <input id="bill-tip-rate" type="range" min="0" max="100" value={tipPct} onChange={(event) => { setTipPct(Number(event.target.value)); markDirty(); }} className="w-full accent-indigo-400" />
        </div>
        {error && <p role="alert" className="rounded-lg border border-rose-300/15 bg-rose-400/5 p-2.5 text-xs text-rose-200">{error}</p>}
        <button
          type="button"
          disabled={loading || (splitMode === 'items' && expenses.length === 0)}
          onClick={() => void calculate(false)}
          className="min-h-11 w-full rounded-xl bg-indigo-500 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-indigo-400 disabled:cursor-wait disabled:opacity-50"
        >
          {loading ? 'Считаю взаимозачёт…' : 'Рассчитать распределение и переводы'}
        </button>
      </div>

      <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 xl:col-span-5">
        {res ? <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-slate-950 p-3"><div className="text-[10px] text-slate-500">Счёт до чаевых</div><div className="mt-1 text-lg font-bold text-white">{formatMoney(res.raw_total)}</div></div>
            <div className="rounded-xl border border-amber-300/15 bg-slate-950 p-3"><div className="text-[10px] text-slate-500">Чаевые</div><div className="mt-1 text-lg font-bold text-amber-200">{formatMoney(res.tip_amount)}</div></div>
            <div className="col-span-2 rounded-xl border border-emerald-400/20 bg-slate-950 p-3 sm:col-span-1 xl:col-span-2"><div className="text-[10px] text-slate-500">Итого · средняя доля {formatMoney(res.average_share)}</div><div className="mt-1 text-xl font-bold text-emerald-200">{formatMoney(res.total_with_tip)}</div></div>
          </div>

          {res.expense_mode === 'items' && <section aria-label="Разобранные позиции счёта" className="space-y-2">
            <h4 className="text-xs font-semibold text-white">Проверка позиций</h4>
            <div className="max-h-40 space-y-1 overflow-y-auto">{(res.expenses || []).map((expense: any, index: number) => <div key={`${expense.description}-${index}`} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-white/5 bg-slate-950 px-3 py-2 text-[9px]"><div className="min-w-0"><b className="block truncate text-slate-200">{expense.description}</b><span className="text-slate-500">Оплатил {expense.payer} · делили: {expense.participants.join(', ')}</span></div><b className="shrink-0 text-slate-300">{formatMoney(expense.amount)}</b></div>)}</div>
          </section>}

          <section aria-label="Доли и баланс участников" className="space-y-2">
            <h4 className="text-xs font-semibold text-white">Баланс участников</h4>
            <div className="max-h-64 space-y-1.5 overflow-y-auto">{(res.settlements || []).map((settlement: any) => <div key={settlement.name} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-slate-950 px-3 py-2 text-[10px]">
              <div className="min-w-0"><b className="block truncate text-slate-200">{settlement.name}</b><span className="text-slate-500">Заплатил {formatMoney(settlement.paid)} · доля {formatMoney(settlement.share)}</span></div>
              <b className={settlement.status === 'receives' ? 'text-emerald-200' : settlement.status === 'owes' ? 'text-amber-200' : 'text-slate-400'}>{settlement.status === 'receives' ? `получит ${formatMoney(settlement.balance)}` : settlement.status === 'owes' ? `доплатит ${formatMoney(Math.abs(Number(settlement.balance)))}` : 'расчёт закрыт'}</b>
            </div>)}</div>
          </section>

          <section className="space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold text-white">Оптимальные переводы</h4><div className="flex gap-1.5"><button type="button" onClick={() => copyText(createTransferText(), onToast)} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 text-[10px] text-slate-200 hover:bg-white/10"><Copy className="h-3 w-3" />Копировать</button><button type="button" onClick={exportSettlementCsv} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 text-[10px] text-slate-200 hover:bg-white/10"><Download className="h-3 w-3" />CSV</button></div></div>
            {res.transfers.length > 0 ? res.transfers.map((transfer: any, index: number) => <div key={`${transfer.from}-${transfer.to}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-indigo-400/25 bg-slate-950 p-3"><span className="min-w-0 truncate text-slate-200"><b>{transfer.from}</b> → <b>{transfer.to}</b></span><b className="shrink-0 text-sm text-indigo-200">{formatMoney(transfer.amount)}</b></div>) : <div className="rounded-xl bg-slate-950 p-3 text-emerald-300">Взаимозачёт уже сбалансирован — переводы не нужны.</div>}
          </section>
          {res.expense_mode === 'items' && <p className="text-[9px] leading-relaxed text-slate-500">В режиме позиций оплата распределяется по выбранным плательщикам, доли — только между отмеченными участниками. Чаевые и округление включены в итог.</p>}
        </> : <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-white/10 text-center text-xs text-slate-500">{loading ? 'Рассчитываю доли и сверяю переводы…' : 'Добавьте участников и выполните расчёт, чтобы увидеть взаимозачёт.'}</div>}
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
