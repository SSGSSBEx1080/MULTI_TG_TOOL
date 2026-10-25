export interface ToolItem {
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
  tools: ToolItem[];
}

export interface UserRank {
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
  bio?: string;
  avatar_emoji?: string;
  profile_views?: number;
  respects?: number;
  best_game_score?: number;
  is_real?: number;
  rank: UserRank;
}

export interface NoteItem {
  id: number;
  title: string;
  content: string;
  tag: string;
  pinned: number;
  updated_at: string;
}

export interface TodoItem {
  id: number;
  text: string;
  priority: string;
  done: number;
  created_at: string;
}

export interface HabitDayCell {
  date: string;
  completed: boolean;
}

export interface HabitItem {
  id: number;
  title: string;
  icon: string;
  target_per_week: number;
  done_today: boolean;
  done_week: number;
  total_completions: number;
  streak: number;
  last_7_days: HabitDayCell[];
}

export interface SimButton {
  text: string;
  callback_data?: string | null;
  url?: string | null;
  web_app_url?: string | null;
  switch_inline?: string | null;
}

export interface SimMessage {
  seq: number;
  role: 'user' | 'bot';
  kind: 'text' | 'photo' | 'document';
  html?: string;
  text?: string;
  media_url?: string;
  filename?: string;
  buttons?: SimButton[][];
  timestamp: string;
}

interface TgWebApp {
  initData?: string;
  initDataUnsafe?: {
    start_param?: string;
    user?: {
      id: number;
      first_name?: string;
      username?: string;
    };
  };
  ready?: () => void;
  expand?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink?: (url: string) => void;
  downloadFile?: (params: { url: string; file_name: string }, cb?: (accepted: boolean) => void) => void;
  HapticFeedback?: {
    impactOccurred?: (style: 'light' | 'medium' | 'heavy') => void;
    notificationOccurred?: (type: 'error' | 'success' | 'warning') => void;
  };
  BackButton?: {
    isVisible?: boolean;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
}

export function getTelegramWebApp(): TgWebApp | undefined {
  return (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
}

export function isInsideTelegram(): boolean {
  const tg = getTelegramWebApp();
  return Boolean(tg?.initData && tg.initData.length > 0);
}

export function triggerHaptic(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  try {
    getTelegramWebApp()?.HapticFeedback?.impactOccurred?.(style);
  } catch {
    // ignore outside Telegram
  }
}

function getOrCreateGuestId(): string {
  try {
    const key = 'mtt_guest_uid';
    let val = localStorage.getItem(key);
    if (!val || !/^\d+$/.test(val)) {
      const rnd = Math.floor(Math.random() * 80_000_000) + 10_000_000;
      val = String(900_000_000_000 + rnd);
      localStorage.setItem(key, val);
    }
    return val;
  } catch {
    return '900000777000';
  }
}

function buildAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra || {}) };
  const tg = getTelegramWebApp();
  if (tg?.initData) {
    // Always ASCII-encode initData so non-Latin-1 code points in user names never crash browser fetch()
    headers['X-Telegram-Init-Data'] = encodeURIComponent(tg.initData);
  } else {
    headers['X-Guest-Id'] = getOrCreateGuestId();
  }
  return headers;
}

async function parseApiResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const msg =
      typeof err.detail === 'string'
        ? err.detail
        : Array.isArray(err.detail)
          ? err.detail.map((x: any) => x.msg || JSON.stringify(x)).join('; ')
          : 'Ошибка запроса';
    throw new Error(msg || 'Ошибка запроса');
  }
  return res.json();
}

export async function apiGet<T = any>(path: string): Promise<T> {
  const res = await fetch(path, {
    headers: buildAuthHeaders(),
  });
  return parseApiResponse<T>(res);
}

export async function apiPost<T = any>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: body !== undefined ? JSON.stringify(body) : '{}',
  });
  return parseApiResponse<T>(res);
}

export async function apiDelete<T = any>(path: string): Promise<T> {
  const res = await fetch(path, {
    method: 'DELETE',
    headers: buildAuthHeaders(),
  });
  return parseApiResponse<T>(res);
}

export async function apiForm<T = any>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: formData,
  });
  return parseApiResponse<T>(res);
}

export async function copyText(text: string, onToast?: (msg: string) => void): Promise<boolean> {
  if (!text) return false;
  let ok = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      ok = true;
    }
  } catch {
    // Fallback below for Telegram Android WebView
  }
  if (!ok) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.left = '-9999px';
      ta.setAttribute('readonly', '');
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ok = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch {
      ok = false;
    }
  }
  if (ok) {
    getTelegramWebApp()?.HapticFeedback?.notificationOccurred?.('success');
    onToast?.('Скопировано');
  } else {
    onToast?.('Не удалось скопировать');
  }
  return ok;
}

export function openExternalLink(url: string): void {
  if (!url) return;
  const fullUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url;
  const tg = getTelegramWebApp();
  try {
    if (
      (fullUrl.startsWith('https://t.me/') || fullUrl.startsWith('http://t.me/')) &&
      tg?.openTelegramLink
    ) {
      tg.openTelegramLink(fullUrl);
      return;
    }
    if (tg?.openLink && isInsideTelegram()) {
      tg.openLink(fullUrl);
      return;
    }
  } catch {
    // fallback below
  }
  const win = window.open(fullUrl, '_blank', 'noopener,noreferrer');
  if (!win) {
    window.location.href = fullUrl;
  }
}

export function buildAttachmentUrl(downloadUrl: string, filename: string): string {
  const params = new URLSearchParams({
    url: downloadUrl,
    name: filename,
  });
  return `${window.location.origin}/api/v2/files/download?${params.toString()}`;
}

export function triggerFileDownload(
  downloadUrl?: string,
  filename = 'result.bin',
  dataUrlFallback?: string
): void {
  const tg = getTelegramWebApp();
  if (downloadUrl) {
    const fullUrl = buildAttachmentUrl(downloadUrl, filename);
    if (isInsideTelegram()) {
      if (typeof tg?.downloadFile === 'function') {
        try {
          tg.downloadFile({ url: fullUrl, file_name: filename });
          return;
        } catch {
          // fallback to openLink
        }
      }
      if (tg?.openLink) {
        tg.openLink(fullUrl);
        return;
      }
    }
    const a = document.createElement('a');
    a.href = fullUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  if (dataUrlFallback) {
    const a = document.createElement('a');
    a.href = dataUrlFallback;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

export async function sendGeneratedToTelegramChat(
  downloadUrl: string | undefined,
  filename: string,
  dataUrlFallback?: string,
  caption?: string
): Promise<void> {
  await apiPost('/api/v2/files/send-to-chat', {
    download_url: downloadUrl || '',
    data_url: downloadUrl ? '' : dataUrlFallback || '',
    filename,
    caption: caption || filename,
  });
}
