import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  CheckCircle2,
  RefreshCw,
  Server,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { ToolCategory, apiGet } from '../lib/api';

interface Props {
  categories?: ToolCategory[];
  onToast: (msg: string) => void;
}

export const AdminControlHub: React.FC<Props> = ({ categories = [], onToast }) => {
  const [data, setData] = useState<any>(null);

  const toolNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of categories) {
      for (const t of c.tools) {
        map[t.id] = `${t.emoji} ${t.title}`;
      }
    }
    return map;
  }, [categories]);

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
  const topTools: any[] = data?.analytics?.top_tools || [];
  const recentEvents: any[] = data?.analytics?.recent_events || [];

  return (
    <div className="space-y-5">
      {/* System Status Banner */}
      <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-r from-[#0e0a1a] via-[#130e24] to-[#1a0d18] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-black tracking-wide text-white truncate">
              MULTI_TG_TOOL • Статус и статистика
            </div>
            <div className="text-xs text-slate-400">
              Синхронизация Telegram-бота, Mini App и игрового рейтинга
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 text-xs font-semibold">
            {botStatus.running
              ? `⚡ Онлайн (@${botStatus.bot_username || 'multi_tg_bot'})`
              : '⚡ Сервер активен'}
          </span>
          <button
            type="button"
            onClick={loadDashboard}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300"
            title="Обновить статистику"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-1 text-xs text-slate-400">
            <span className="truncate">Участников в базе</span>
            <Users className="w-4 h-4 text-sky-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white mt-2">{summary.total_users ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-1 text-xs text-slate-400">
            <span className="truncate">Запусков утилит</span>
            <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-300 mt-2">{summary.total_runs ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-1 text-xs text-slate-400">
            <span className="truncate">Суммарный опыт</span>
            <Award className="w-4 h-4 text-amber-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-amber-300 mt-2">{summary.total_xp ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-1 text-xs text-slate-400">
            <span className="truncate">Заметки / Задачи</span>
            <Server className="w-4 h-4 text-purple-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-purple-300 mt-2">
            {summary.notes_count ?? 0} / {summary.todos_count ?? 0}
          </div>
        </div>
      </div>

      {/* Telemetry Breakdown & Recent Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm text-white">📊 Популярные инструменты</h4>
            <button type="button" onClick={loadDashboard} className="text-slate-400 hover:text-white">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          {topTools.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">Пока нет запусков инструментов</div>
          ) : (
            <div className="space-y-2.5">
              {topTools.map((t: any) => {
                const maxCnt = topTools[0]?.count || 1;
                const width = Math.max(10, Math.round((t.count / maxCnt) * 100));
                return (
                  <div key={t.tool_id} className="space-y-1">
                    <div className="flex justify-between gap-2 text-xs">
                      <span className="text-slate-200 truncate">
                        {toolNames[t.tool_id] || t.tool_id}
                      </span>
                      <span className="text-amber-300 font-semibold shrink-0">{t.count}</span>
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
          )}
        </div>

        <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-3">
          <h4 className="font-semibold text-sm text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Последние действия
          </h4>
          {recentEvents.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">Лента активности пока пуста</div>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {recentEvents.map((ev: any) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950/80 border border-white/5 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 font-mono text-[11px] shrink-0">
                      {ev.source}
                    </span>
                    <span className="font-semibold text-white truncate">
                      {toolNames[ev.tool_id] || ev.tool_id}
                    </span>
                    {ev.detail && <span className="text-slate-400 truncate">— {ev.detail}</span>}
                  </div>
                  <span className="text-[11px] text-slate-500 shrink-0">
                    {new Date(ev.created_at * 1000).toLocaleTimeString('ru-RU')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
