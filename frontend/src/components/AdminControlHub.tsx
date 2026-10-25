import React, { useEffect, useState } from 'react';
import {
  Activity,
  Award,
  CheckCircle2,
  Coins,
  KeyRound,
  RefreshCw,
  Rocket,
  Server,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { apiGet, apiPost, copyText } from '../lib/api';

interface Props {
  onToast: (msg: string) => void;
}

export const AdminControlHub: React.FC<Props> = ({ onToast }) => {
  const [data, setData] = useState<any>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [saving, setSaving] = useState(false);

  const loadDashboard = async () => {
    try {
      const res = await apiGet('/api/admin/dashboard');
      setData(res);
    } catch (e: any) {
      onToast(e.message);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const saveBotToken = async () => {
    setSaving(true);
    try {
      const res = await apiPost('/api/admin/bot-token', { bot_token: tokenInput });
      setData((prev: any) => ({ ...prev, bot_status: res.bot_status }));
      setTokenInput('');
      onToast('Токен сохранён в .env и настройках бота!');
    } catch (e: any) {
      onToast(e.message);
    } finally {
      setSaving(false);
    }
  };

  const summary = data?.analytics?.summary || {};
  const botStatus = data?.bot_status || {};

  return (
    <div className="space-y-6">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Операторов в БД</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{summary.total_users ?? 1}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Запусков инструментов</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-300 mt-2">{summary.total_runs ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Суммарный опыт (XP)</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-300 mt-2">{summary.total_xp ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Заметок / Чек-листов</span>
            <Server className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-300 mt-2">
            {summary.notes_count ?? 0} / {summary.todos_count ?? 0}
          </div>
        </div>
      </div>

      {/* STEP-BY-STEP RUSSIAN TUTORIAL: BOTFATHER + AMVERA/AEZA (100-200 RUB) + DONATIONS */}
      <div className="rounded-3xl border border-emerald-400/35 bg-gradient-to-br from-[#0e1b26] via-[#0f1628] to-[#17122a] p-6 space-y-5 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              🚀 Полный Туториал: Как запустить своего Бота 24/7 за ~150 ₽/мес и подключить Донаты
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Тот самый облачный хостинг на букву «А» для Python/ТГ-ботов — это <b>Amvera Cloud (amvera.ru)</b> (и VPS <b>Aeza</b>). Конфиг <code>amvera.yml</code> уже готов в корне проекта!
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold">
            Готово к деплою в 1 клик
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
          {/* STEP 1 */}
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-sky-400/30 space-y-2.5">
            <div className="text-sm font-bold text-sky-300">Шаг 1. Создаём бота в @BotFather (2 мин)</div>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-200 leading-relaxed">
              <li>Откройте в Telegram официального бота <b>@BotFather</b> (с синей галочкой).</li>
              <li>Отправьте команду <code>/newbot</code>, придумайте имя (например, <i>NEXUS Multi-Tool</i>) и юзернейм, оканчивающийся на <code>_bot</code>.</li>
              <li>Скопируйте выданный <b>HTTP API Token</b> вида <code>7123456789:AAH...</code>.</li>
              <li>Отправьте <code>/setinline</code> → выберите бота → напишите <code>Запрос...</code> (чтобы работал инлайн-режим в любых чатах!).</li>
              <li>После деплоя отправьте <code>/mybots</code> → <i>Bot Settings → Menu Button</i> и вставьте ваш бесплатный HTTPS-домен от Amvera — тогда Mini App со всеми играми и утилитами откроется прямо внутри Telegram!</li>
            </ol>
          </div>

          {/* STEP 2 */}
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-400/30 space-y-2.5">
            <div className="text-sm font-bold text-emerald-300">Шаг 2. Хостинг на «А» за 100–200 ₽/мес (Amvera / Aeza)</div>
            <div className="space-y-1.5 text-slate-200 leading-relaxed">
              <p><b>Вариант А — Amvera Cloud (amvera.ru, самый простой!):</b></p>
              <ol className="list-decimal list-inside space-y-1 text-slate-300">
                <li>Зарегистрируйтесь на <b>amvera.ru</b> (дают стартовый баланс для теста, оплата картами РФ / СБП, тариф «Начальный» выходит ~<b>120–190 ₽/мес</b>).</li>
                <li>Нажмите <b>«Создать проект» → «Приложение»</b> и привяжите ваш GitHub-репозиторий с этим кодом (файл <code>amvera.yml</code> подхватится сам!).</li>
                <li>Во вкладке <b>«Переменные»</b> добавьте:
                  <br /><code>BOT_TOKEN</code> = ваш токен от BotFather
                  <br /><code>WEBAPP_URL</code> = бесплатный HTTPS домен <code>https://имя.amvera.io</code> (включается тумблером во вкладке «Домены» бесплатно!).
                </li>
                <li>Нажмите <b>«Собрать»</b> — через 2 минуты и Бот, и Mini App работают 24/7, а база SQLite живёт в постоянном хранилище <code>/data</code>!</li>
              </ol>
              <p className="pt-1 text-slate-400">
                <b>Вариант Б — VPS Aeza (aeza.net, промо-тарифы 150–200 ₽/мес):</b> арендуйте Ubuntu VPS, выполните <code>git clone ... && BOT_TOKEN="..." docker compose up -d --build</code>.
              </p>
            </div>
          </div>

          {/* STEP 3 */}
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-amber-400/30 space-y-2.5">
            <div className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
              <Coins className="w-4 h-4" /> Шаг 3. Как прикрутить Донаты (3 способа)
            </div>
            <div className="space-y-2 text-slate-200 leading-relaxed">
              <div>
                <b className="text-white">1) В 1 клик через Витрину «QLS СЕНЯ» (уже встроено!):</b>
                <p className="text-slate-300">Зарегистрируйтесь на <b>DonationAlerts</b>, <b>Boosty</b>, <b>CloudTips (Т-Банк)</b> или <b>ЮMoney</b>, скопируйте ссылку на страницу доната и вставьте её прямо в разделе <i>«Соцсеть → Автор: QLS СЕНЯ → Изменить ссылки»</i>. Кнопка сразу появится и в Mini App, и по команде <code>/author</code>!</p>
              </div>
              <div>
                <b className="text-white">2) Нативные Звёзды Telegram (Telegram Stars — XTR):</b>
                <p className="text-slate-300">Не требуют ИП и юрлица! В <code>aiogram 3</code> вызывается <code>message.answer_invoice(..., currency="XTR", provider_token="")</code> — пользователи дарят вам Звёзды в 1 тап, а вы выводите их в TON через Fragment.</p>
              </div>
              <div>
                <b className="text-white">3) Крипто-донаты (@send / @CryptoBot):</b>
                <p className="text-slate-300">Создайте вечный счёт в <code>@send</code> (Crypto Bot) и добавьте ссылку счёта в кнопки автора.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live @BotFather Token Connector + Deploy Quickstart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 rounded-2xl border border-white/10 bg-slate-900/75 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-sky-400" /> Живое подключение BOT_TOKEN прямо из панели
            </h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
              Симулятор активен
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-white/10 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Текущий токен:</span>
              <span className="font-mono text-sky-300">{botStatus.masked_token || 'Не задан (работает локальный симулятор)'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Telegram Long-Polling:</span>
              <span className={botStatus.running ? 'text-emerald-400 font-semibold' : 'text-amber-300'}>
                {botStatus.running ? `Активен (@${botStatus.bot_username})` : 'Ожидает деплоя на Amvera / VPS'}
              </span>
            </div>
            {botStatus.error && <div className="text-[11px] text-slate-400 pt-1">{botStatus.error}</div>}
          </div>

          <div className="flex gap-2">
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Вставьте BOT_TOKEN от @BotFather (напр. 7123456:AAH...)"
              className="flex-1 rounded-xl bg-slate-950 border border-white/10 px-3.5 py-2 text-xs text-white font-mono"
            />
            <button
              onClick={saveBotToken}
              disabled={saving || !tokenInput.trim()}
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-semibold text-xs shrink-0"
            >
              Сохранить и запустить
            </button>
          </div>
        </div>

        <div className="lg:col-span-6 rounded-2xl border border-white/10 bg-slate-900/75 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-white flex items-center gap-2">
              <Rocket className="w-4 h-4 text-purple-400" /> Шпаргалка команд для VPS / Docker
            </h3>
            <button
              onClick={() =>
                copyText(
                  'git clone <repo> && cd MULTI_TG_TOOL\nBOT_TOKEN="ваш_токен" WEBAPP_URL="https://ваш-домен" docker compose up -d --build',
                  onToast
                )
              }
              className="text-xs text-sky-300 hover:underline"
            >
              Копировать команды
            </button>
          </div>
          <pre className="p-3.5 rounded-xl bg-slate-950 border border-white/10 font-mono text-xs text-slate-200 overflow-x-auto">
{`# Вариант 1: На Amvera Cloud (amvera.ru) — просто залейте репо,
# файл amvera.yml уже настроен на порт 8000 и хранилище /data!

# Вариант 2: Docker Compose на любом VPS (Aeza / Timeweb)
BOT_TOKEN="ваш_токен" WEBAPP_URL="https://ваш-домен" docker compose up -d --build`}
          </pre>
        </div>
      </div>

      {/* Telemetry Breakdown & Recent Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-slate-900/75 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm text-white">📊 Популярность инструментов</h4>
            <button onClick={loadDashboard} className="text-slate-400 hover:text-white">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2.5">
            {(data?.analytics?.top_tools || []).map((t: any) => {
              const maxCnt = data?.analytics?.top_tools?.[0]?.count || 1;
              const width = Math.max(10, Math.round((t.count / maxCnt) * 100));
              return (
                <div key={t.tool_id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-mono text-slate-200">{t.tool_id}</span>
                    <span className="text-sky-300 font-semibold">{t.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-950 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-400 to-purple-500 rounded-full"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-slate-900/75 p-5 space-y-3">
          <h4 className="font-semibold text-sm text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Живая лента телеметрии (Бот + Mini App + Игры)
          </h4>
          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
            {(data?.analytics?.recent_events || []).map((ev: any) => (
              <div
                key={ev.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950/80 border border-white/5 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 font-mono text-[11px] shrink-0">
                    {ev.source}
                  </span>
                  <span className="font-semibold text-white truncate">{ev.tool_id}</span>
                  {ev.detail && <span className="text-slate-400 truncate">— {ev.detail}</span>}
                </div>
                <span className="text-[11px] text-slate-500 shrink-0">
                  {new Date(ev.created_at * 1000).toLocaleTimeString('ru-RU')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
