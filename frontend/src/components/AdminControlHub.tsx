import React, { useEffect, useState } from 'react';
import {
  Activity,
  Award,
  CheckCircle2,
  RefreshCw,
  Server,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { apiGet } from '../lib/api';

interface Props {
  onToast: (msg: string) => void;
}

export const AdminControlHub: React.FC<Props> = ({ onToast }) => {
  const [data, setData] = useState<any>(null);

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

  const summary = data?.analytics?.summary || {};
  const botStatus = data?.bot_status || {};

  return (
    <div className="space-y-6">
      {/* System Status Banner */}
      <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-r from-[#0e0a1a] via-[#130e24] to-[#1a0d18] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="text-sm font-black tracking-wide text-white">MULTI_TG_TOOL • Ядро телеметрии</div>
            <div className="text-xs text-slate-400">
              Единая синхронизация Telegram Bot + Mini App + Игровой рейтинг
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 text-xs font-semibold">
            {botStatus.running ? `⚡ Онлайн (@${botStatus.bot_username || 'multi_tg_bot'})` : '⚡ Ядро активно'}
          </span>
          <button
            onClick={loadDashboard}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300"
            title="Обновить статистику"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Участников в базе</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{summary.total_users ?? 1}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Запусков утилит</span>
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

      {/* Telemetry Breakdown & Recent Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-slate-900/75 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm text-white">📊 Топ используемых инструментов</h4>
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
                    <span className="text-amber-300 font-semibold">{t.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-950 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 via-rose-500 to-amber-400 rounded-full"
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
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Живая лента активности (Бот + Mini App + Игры)
          </h4>
          <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
            {(data?.analytics?.recent_events || []).map((ev: any) => (
              <div
                key={ev.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950/80 border border-white/5 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 font-mono text-[11px] shrink-0">
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
