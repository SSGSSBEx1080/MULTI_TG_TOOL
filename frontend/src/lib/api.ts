export interface ToolMeta {
  id: string;
  title: string;
  emoji: string;
  desc: string;
}

export interface ToolCategory {
  id: string;
  title: string;
  emoji: string;
  short: string;
  color: string;
  tools: ToolMeta[];
}

export interface RankInfo {
  level: number;
  title: string;
  xp: number;
  next_xp: number;
  progress_pct: number;
}

export interface UserProfile {
  user_id: number;
  username: string;
  first_name: string;
  xp: number;
  tools_used: number;
  rank: RankInfo;
}

export interface NoteItem {
  id: number;
  title: string;
  content: string;
  tag: string;
  pinned: number;
  updated_at: number;
}

export interface TodoItem {
  id: number;
  text: string;
  done: number;
  priority: string;
}

export function triggerHaptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  try {
    const tg = (window as unknown as { Telegram?: { WebApp?: { HapticFeedback?: { impactOccurred: (s: string) => void } } } }).Telegram?.WebApp;
    tg?.HapticFeedback?.impactOccurred(style);
  } catch {
    // ignore outside Telegram WebApp
  }
}

export async function apiPost<T = any>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.detail || 'Ошибка запроса к серверу');
  }
  return data as T;
}

export async function apiGet<T = any>(path: string): Promise<T> {
  const res = await fetch(path);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.detail || 'Ошибка загрузки данных');
  }
  return data as T;
}

export async function apiForm<T = any>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.detail || 'Ошибка обработки файла');
  }
  return data as T;
}

export async function copyText(value: string, onToast?: (msg: string) => void) {
  try {
    await navigator.clipboard.writeText(value);
    triggerHaptic('light');
    onToast?.('Скопировано в буфер обмена ✨');
  } catch {
    onToast?.('Не удалось скопировать');
  }
}
