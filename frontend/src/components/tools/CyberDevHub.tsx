import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Hash,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  TerminalSquare,
  Timer,
} from 'lucide-react';
import { apiPost, copyText } from '../../lib/api';
import { CryptoStateCube3D } from '../three/Interactive3DScenes';

interface Props {
  activeCategory: string;
  activeTool: string;
  onSelectTool: (t: string) => void;
  onSync: () => void;
  onToast: (msg: string) => void;
}

export const CyberDevHub: React.FC<Props> = ({
  activeCategory,
  activeTool,
  onSelectTool,
  onSync,
  onToast,
}) => {
  // --- Security State ---
  const [secTab, setSecTab] = useState<'pass' | 'aes' | 'hash' | 'jwt'>('pass');
  const [pwLen, setPwLen] = useState(22);
  const [pwMode, setPwMode] = useState<'chars' | 'passphrase'>('chars');
  const [pwSymbols, setPwSymbols] = useState(true);
  const [pwDigits, setPwDigits] = useState(true);
  const [pwResult, setPwResult] = useState<any>(null);

  const [aesInput, setAesInput] = useState('Секретный текст для шифрования AES-256');
  const [aesPwd, setAesPwd] = useState('MyVaultKey2026');
  const [aesOutput, setAesOutput] = useState('');

  const [hashInput, setHashInput] = useState('MULTI_TG_TOOL');
  const [hmacKey, setHmacKey] = useState('');
  const [hashRes, setHashRes] = useState<any>(null);

  const [jwtPayload, setJwtPayload] = useState('{\n  "sub": "1001",\n  "username": "tg_user",\n  "scope": "app"\n}');
  const [jwtSecret, setJwtSecret] = useState('multi_tg_tool_hmac_secret_key_2026_32b');
  const [jwtToken, setJwtToken] = useState('');
  const [jwtDecoded, setJwtDecoded] = useState<any>(null);

  const [totpSecret, setTotpSecret] = useState('');
  const [totpInfo, setTotpInfo] = useState<any>(null);

  // --- Dev Swiss State ---
  const [devTab, setDevTab] = useState<'json' | 'regex' | 'codec' | 'cron'>('json');
  const [dataRaw, setDataRaw] = useState(
    '{\n  "bot": "MULTI_TG_TOOL",\n  "framework": "aiogram 3",\n  "features": ["QR", "Stego", "PDF", "MiniApp"],\n  "active": true\n}'
  );
  const [targetFmt, setTargetFmt] = useState('yaml');
  const [dataOut, setDataOut] = useState<any>(null);

  const [rgxPattern, setRgxPattern] = useState('([a-zA-Z0-9._-]+)@([a-zA-Z0-9.-]+)');
  const [rgxText, setRgxText] = useState('Контакты: dev@example.org, support@telegram.org и info@app.dev');
  const [rgxRes, setRgxRes] = useState<any>(null);

  const [codecText, setCodecText] = useState('Привет, MULTI_TG_TOOL!');
  const [codecName, setCodecName] = useState('base64');
  const [codecDir, setCodecDir] = useState<'encode' | 'decode'>('encode');
  const [codecOut, setCodecOut] = useState('');

  const [cronExpr, setCronExpr] = useState('*/15 9-18 * * 1-5');
  const [idKind, setIdKind] = useState('uuid7');
  const [tsInput, setTsInput] = useState('');
  const [cronUuidRes, setCronUuidRes] = useState<any>(null);

  useEffect(() => {
    if (activeTool === 'pass_forge') setSecTab('pass');
    else if (activeTool === 'aes_cipher') setSecTab('aes');
    else if (activeTool === 'hash_lab') setSecTab('hash');
    else if (activeTool === 'jwt_totp') setSecTab('jwt');

    if (activeTool === 'json_yaml') setDevTab('json');
    else if (activeTool === 'regex_lab') setDevTab('regex');
    else if (activeTool === 'encoders') setDevTab('codec');
    else if (activeTool === 'cron_uuid') setDevTab('cron');
  }, [activeTool]);

  const genPasswords = async () => {
    try {
      const res = await apiPost('/api/tools/security/passwords', {
        length: pwLen,
        count: 6,
        mode: pwMode,
        use_symbols: pwSymbols,
        use_digits: pwDigits,
      });
      setPwResult(res);
      onSync();
    } catch (e: any) {
      onToast(e.message || 'Ошибка генерации');
    }
  };

  useEffect(() => {
    if (activeCategory === 'security' && !pwResult) {
      genPasswords();
    }
  }, [activeCategory]);

  useEffect(() => {
    if (activeCategory === 'security' && secTab === 'jwt' && !totpInfo) {
      refreshTotp();
    }
  }, [activeCategory, secTab]);

  const refreshTotp = async (customSecret?: string, silent?: boolean) => {
    try {
      const res = await apiPost('/api/tools/security/totp', {
        secret: customSecret !== undefined ? customSecret : totpSecret,
      });
      setTotpInfo(res);
      if (!totpSecret || customSecret === '') {
        setTotpSecret(res.secret);
      }
      if (!silent) onSync();
    } catch (e: any) {
      if (!silent) onToast(e.message);
    }
  };

  useEffect(() => {
    if (activeCategory !== 'security' || secTab !== 'jwt' || !totpInfo) return;
    const t = setInterval(() => {
      setTotpInfo((prev: any) => {
        if (!prev) return prev;
        if ((prev.remaining_seconds ?? 0) <= 1) {
          refreshTotp(prev.secret, true);
          return prev;
        }
        return { ...prev, remaining_seconds: prev.remaining_seconds - 1 };
      });
    }, 1000);
    return () => clearInterval(t);
  }, [activeCategory, secTab, Boolean(totpInfo)]);

  const runAes = async (action: 'encrypt' | 'decrypt') => {
    try {
      const res = await apiPost('/api/tools/security/aes', {
        action,
        text: aesInput,
        password: aesPwd,
      });
      setAesOutput(res.output);
      onSync();
    } catch (e: any) {
      onToast(e.message);
    }
  };

  const runHash = async () => {
    try {
      const res = await apiPost('/api/tools/security/hash', {
        text: hashInput,
        hmac_key: hmacKey,
      });
      setHashRes(res);
      onSync();
    } catch (e: any) {
      onToast(e.message);
    }
  };

  const runJwtSign = async () => {
    try {
      const res = await apiPost('/api/tools/security/jwt', {
        mode: 'sign',
        payload_json: jwtPayload,
        secret: jwtSecret,
      });
      setJwtToken(res.token);
      setJwtDecoded(res);
      onSync();
    } catch (e: any) {
      onToast(e.message);
    }
  };

  const runJwtInspect = async () => {
    try {
      const res = await apiPost('/api/tools/security/jwt', {
        mode: 'inspect',
        token: jwtToken,
        secret: jwtSecret,
      });
      setJwtDecoded(res);
      onSync();
    } catch (e: any) {
      onToast(e.message);
    }
  };

  // =========================================================================
  // HUB 4: CYBER SECURITY
  // =========================================================================
  if (activeCategory === 'security') {
    return (
      <div className="space-y-5 min-w-0">
        {secTab === 'pass' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-4">
              <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
                <KeyRound className="w-4 h-4" /> Настройки криптостойкости
              </div>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-950 border border-white/10">
                <button
                  onClick={() => setPwMode('chars')}
                  className={`py-2 rounded-lg text-xs font-medium ${
                    pwMode === 'chars' ? 'bg-emerald-500 text-slate-950 font-semibold' : 'text-slate-300'
                  }`}
                >
                  🔤 Символьный
                </button>
                <button
                  onClick={() => setPwMode('passphrase')}
                  className={`py-2 rounded-lg text-xs font-medium ${
                    pwMode === 'passphrase' ? 'bg-emerald-500 text-slate-950 font-semibold' : 'text-slate-300'
                  }`}
                >
                  🗣 Мнемоническая фраза
                </button>
              </div>

              {pwMode === 'chars' && (
                <>
                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Длина пароля</span>
                      <span className="font-mono text-emerald-300 font-bold">{pwLen} симв.</span>
                    </div>
                    <input
                      type="range"
                      min={8}
                      max={64}
                      value={pwLen}
                      onChange={(e) => setPwLen(Number(e.target.value))}
                      className="w-full accent-emerald-400"
                    />
                  </div>
                  <div className="flex gap-4 text-xs text-slate-300">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pwDigits}
                        onChange={(e) => setPwDigits(e.target.checked)}
                        className="accent-emerald-400"
                      />
                      Цифры (2–9)
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pwSymbols}
                        onChange={(e) => setPwSymbols(e.target.checked)}
                        className="accent-emerald-400"
                      />
                      Спецсимволы (!@#$)
                    </label>
                  </div>
                </>
              )}

              <button
                onClick={genPasswords}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 transition"
              >
                <RefreshCw className="w-4 h-4" /> Сгенерировать пакет паролей
              </button>

              {pwResult && (
                <div className="p-3.5 rounded-xl bg-slate-950/90 border border-emerald-500/25 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Уровень:</span>
                    <span className="text-emerald-300 font-semibold">{pwResult.grade}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Энтропия Шеннона:</span>
                    <span className="font-mono text-white">{pwResult.entropy_bits} бит</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Перебор (100 GH/s):</span>
                    <span className="text-sky-300">{pwResult.crack_time}</span>
                  </div>
                </div>
              )}

              <CryptoStateCube3D entropyBits={pwResult?.entropy_bits || pwLen * 5.8} />
            </div>

            <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-2.5">
              <div className="text-xs text-slate-400 mb-2">Нажмите на любой пароль для мгновенного копирования:</div>
              {pwResult?.passwords?.map((pw: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => copyText(pw, onToast)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-950 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-400/40 transition group"
                >
                  <span className="font-mono text-sm text-emerald-200 truncate">{pw}</span>
                  <Copy className="w-4 h-4 text-slate-500 group-hover:text-emerald-300 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {secTab === 'aes' && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-4">
            <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
              <ShieldCheck className="w-4 h-4" /> Аутентифицированное шифрование AES-256-GCM (PBKDF2-SHA256 120,000 итераций)
            </div>
            <textarea
              rows={3}
              value={aesInput}
              onChange={(e) => setAesInput(e.target.value)}
              placeholder="Открытый текст или контейнер NX1.…"
              className="w-full rounded-xl bg-slate-950 border border-white/10 p-3 text-sm text-white font-mono"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Мастер-пароль</label>
                <input
                  value={aesPwd}
                  onChange={(e) => setAesPwd(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                />
              </div>
              <button
                onClick={() => runAes('encrypt')}
                className="py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs"
              >
                🔒 Зашифровать в NX1
              </button>
              <button
                onClick={() => runAes('decrypt')}
                className="py-2.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 font-semibold text-xs"
              >
                🔓 Расшифровать NX1
              </button>
            </div>
            {aesOutput && (
              <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-2">
                <div className="flex justify-between text-xs text-emerald-300">
                  <span>Результат операции:</span>
                  <div className="flex gap-3">
                    {aesOutput.startsWith('NX1.') && (
                      <button
                        onClick={() => setAesInput(aesOutput)}
                        className="underline hover:text-white"
                      >
                        ⇄ Подставить на вход для проверки
                      </button>
                    )}
                    <button onClick={() => copyText(aesOutput, onToast)} className="underline hover:text-white">
                      Копировать
                    </button>
                  </div>
                </div>
                <pre className="text-xs font-mono text-white whitespace-pre-wrap break-all">{aesOutput}</pre>
              </div>
            )}
          </div>
        )}

        {secTab === 'hash' && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-4">
            <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
              <Hash className="w-4 h-4" /> Мульти-Хеш Генератор & Распознаватель Дайджестов
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                value={hashInput}
                onChange={(e) => setHashInput(e.target.value)}
                placeholder="Текст или готовый хеш…"
                className="md:col-span-2 rounded-xl bg-slate-950 border border-white/10 px-3.5 py-2 text-sm text-white"
              />
              <input
                value={hmacKey}
                onChange={(e) => setHmacKey(e.target.value)}
                placeholder="Ключ HMAC (опционально)"
                className="rounded-xl bg-slate-950 border border-white/10 px-3.5 py-2 text-sm text-white"
              />
            </div>
            <button
              onClick={runHash}
              className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-semibold text-xs"
            >
              Вычислить дайджесты
            </button>
            {hashRes && (
              <div className="space-y-2">
                <div className="text-xs text-amber-300">
                  Классификатор входа: <b>{hashRes.identified_as?.join(', ')}</b>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(hashRes.hashes)
                    .filter(([k]) => k !== 'mode')
                    .map(([algo, val]) => (
                      <div
                        key={algo}
                        onClick={() => copyText(String(val), onToast)}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2.5 rounded-xl bg-slate-950 border border-white/10 hover:border-emerald-400/40 cursor-pointer"
                      >
                        <span className="text-xs font-semibold text-emerald-300 shrink-0">{algo}</span>
                        <code className="text-xs text-slate-200 break-all">{String(val)}</code>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {secTab === 'jwt' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-3">
              <h4 className="text-sm font-semibold text-white">🔑 Подпись и Инспекция JWT (HS256)</h4>
              <textarea
                rows={4}
                value={jwtPayload}
                onChange={(e) => setJwtPayload(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-white/10 p-3 font-mono text-xs text-white"
              />
              <input
                value={jwtSecret}
                onChange={(e) => setJwtSecret(e.target.value)}
                placeholder="Секрет подписи"
                className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
              />
              <div className="flex gap-2">
                <button
                  onClick={runJwtSign}
                  className="flex-1 py-2 rounded-xl bg-emerald-500 text-slate-950 font-semibold text-xs"
                >
                  Сгенерировать JWT
                </button>
                <button
                  onClick={runJwtInspect}
                  disabled={!jwtToken}
                  className="flex-1 py-2 rounded-xl bg-white/10 text-white font-semibold text-xs disabled:opacity-40"
                >
                  Проверить токен
                </button>
              </div>
              <textarea
                rows={2}
                value={jwtToken}
                onChange={(e) => setJwtToken(e.target.value)}
                placeholder="Вставьте существующий eyJ... токен для разбора"
                className="w-full rounded-xl bg-slate-950 border border-white/10 p-2.5 font-mono text-xs text-sky-300"
              />
              {jwtDecoded && (
                <div className="p-3 rounded-xl bg-slate-950 border border-white/10 text-xs space-y-1">
                  <div className="text-emerald-300">{jwtDecoded.signature_verified || jwtDecoded.exp_status}</div>
                  <pre className="text-slate-300 overflow-x-auto">{JSON.stringify(jwtDecoded.payload, null, 2)}</pre>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Timer className="w-4 h-4 text-sky-400 shrink-0" /> Живой 2FA TOTP Генератор (RFC 6238)
                </h4>
                <button
                  type="button"
                  onClick={() => refreshTotp('')}
                  className="text-xs text-sky-300 hover:underline shrink-0"
                >
                  Новый Base32 ключ
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  value={totpSecret}
                  onChange={(e) => setTotpSecret(e.target.value)}
                  placeholder="Base32 секрет (JBSWY3DPEHPK3PXP)"
                  className="min-w-0 flex-1 rounded-xl bg-slate-950 border border-white/10 px-3 py-2 font-mono text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => refreshTotp(totpSecret)}
                  className="shrink-0 px-3.5 py-2 rounded-xl bg-sky-500 text-slate-950 font-semibold text-xs"
                >
                  Обновить
                </button>
              </div>
              {totpInfo && (
                <div className="p-5 rounded-2xl bg-slate-950 border border-sky-500/30 text-center space-y-2">
                  <div className="text-xs text-slate-400">Текущий 6-значный код (клик — копировать)</div>
                  <button
                    onClick={() => copyText(totpInfo.code, onToast)}
                    className="text-4xl font-mono font-bold tracking-[0.25em] text-sky-300 hover:text-white transition"
                  >
                    {totpInfo.code}
                  </button>
                  <div className="text-xs text-slate-400">
                    Осталось <b className="text-emerald-300">{totpInfo.remaining_seconds} сек</b> • Следующий код:{' '}
                    <code className="text-slate-200">{totpInfo.next_code}</code>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // HUB 5: DEV SWISS KNIFE
  // =========================================================================
  const runFormat = async () => {
    try {
      const res = await apiPost('/api/tools/dev/format', {
        raw_text: dataRaw,
        source_fmt: 'auto',
        target_fmt: targetFmt,
      });
      setDataOut(res);
      onSync();
    } catch (e: any) {
      onToast(e.message);
    }
  };

  const runRegex = async () => {
    try {
      const res = await apiPost('/api/tools/dev/regex', {
        pattern: rgxPattern,
        test_text: rgxText,
      });
      setRgxRes(res);
      onSync();
    } catch (e: any) {
      onToast(e.message);
    }
  };

  const runCodec = async () => {
    try {
      const res = await apiPost('/api/tools/dev/codec', {
        text: codecText,
        codec_name: codecName,
        direction: codecDir,
      });
      setCodecOut(res.output);
      onSync();
    } catch (e: any) {
      onToast(e.message);
    }
  };

  const runCronUuid = async () => {
    try {
      const res = await apiPost('/api/tools/dev/cron-uuid', {
        cron_expr: cronExpr,
        id_kind: idKind,
        id_count: 5,
        ts_input: tsInput,
      });
      setCronUuidRes(res);
      onSync();
    } catch (e: any) {
      onToast(e.message);
    }
  };

  return (
    <div className="space-y-5 min-w-0">
      {devTab === 'json' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                <TerminalSquare className="w-4 h-4" /> Входной JSON / YAML / CSV
              </span>
              <select
                value={targetFmt}
                onChange={(e) => setTargetFmt(e.target.value)}
                className="rounded-lg bg-slate-950 border border-white/10 px-2.5 py-1 text-xs text-white"
              >
                <option value="json_pretty">→ JSON (Pretty)</option>
                <option value="json_min">→ JSON (Minified)</option>
                <option value="yaml">→ YAML</option>
                <option value="csv">→ CSV Таблица</option>
              </select>
            </div>
            <textarea
              rows={9}
              value={dataRaw}
              onChange={(e) => setDataRaw(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-white/10 p-3 font-mono text-xs text-white"
            />
            <button
              onClick={runFormat}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs"
            >
              Преобразовать и проверить структуру
            </button>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">
                {dataOut
                  ? `Распознан ${dataOut.summary.detected_format} (${dataOut.summary.items_count} полей)`
                  : 'Результат конвертации'}
              </span>
              {dataOut && (
                <button
                  onClick={() => copyText(dataOut.output, onToast)}
                  className="text-xs text-amber-300 hover:underline"
                >
                  Копировать
                </button>
              )}
            </div>
            <pre className="flex-1 rounded-xl bg-slate-950 border border-white/10 p-3 font-mono text-xs text-emerald-200 overflow-auto min-h-[220px]">
              {dataOut ? dataOut.output : '// Нажмите «Преобразовать»'}
            </pre>
          </div>
        </div>
      )}

      {devTab === 'regex' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-3.5">
          <div className="flex flex-wrap gap-2 items-center">
            <input
              value={rgxPattern}
              onChange={(e) => setRgxPattern(e.target.value)}
              placeholder="Регулярное выражение…"
              className="flex-1 rounded-xl bg-slate-950 border border-white/10 px-3.5 py-2 font-mono text-xs text-amber-200"
            />
            <button
              onClick={runRegex}
              className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-semibold text-xs"
            >
              Найти совпадения
            </button>
          </div>
          <textarea
            rows={4}
            value={rgxText}
            onChange={(e) => setRgxText(e.target.value)}
            className="w-full rounded-xl bg-slate-950 border border-white/10 p-3 text-xs text-white"
          />
          {rgxRes && (
            <div className="space-y-2">
              <div className="text-xs text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Найдено совпадений: <b>{rgxRes.count}</b>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {rgxRes.matches.map((m: any) => (
                  <div key={m.index} className="p-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs">
                    <div className="font-mono text-amber-300 font-semibold">
                      #{m.index}: {m.match}{' '}
                      <span className="text-slate-500">[{m.span[0]}..{m.span[1]}]</span>
                    </div>
                    {m.groups?.length > 0 && (
                      <div className="text-slate-400 mt-1">Группы: {JSON.stringify(m.groups)}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {devTab === 'codec' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-3.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'base64', label: 'Base64' },
              { id: 'base58', label: 'Base58 (TON/BTC)' },
              { id: 'morse', label: 'Азбука Морзе (RU/EN)' },
              { id: 'hex', label: 'HEX байты' },
              { id: 'binary', label: 'Бинарный 0101' },
              { id: 'url', label: 'URL Encode' },
              { id: 'html', label: 'HTML Entities' },
              { id: 'rot13', label: 'ROT13' },
            ].map((c) => (
              <button
                key={c.id}
                onClick={() => setCodecName(c.id)}
                className={`py-2 px-3 rounded-xl text-xs font-medium border ${
                  codecName === c.id
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                    : 'bg-slate-950 border-white/10 text-slate-300'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <textarea
            rows={3}
            value={codecText}
            onChange={(e) => setCodecText(e.target.value)}
            className="w-full rounded-xl bg-slate-950 border border-white/10 p-3 text-sm text-white font-mono"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setCodecDir('encode');
                apiPost('/api/tools/dev/codec', { text: codecText, codec_name: codecName, direction: 'encode' })
                  .then((r) => {
                    setCodecOut(r.output);
                    onSync();
                  })
                  .catch((e) => onToast(e.message));
              }}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-semibold text-xs"
            >
              Закодировать (Encode)
            </button>
            <button
              type="button"
              onClick={() => {
                setCodecDir('decode');
                apiPost('/api/tools/dev/codec', { text: codecText, codec_name: codecName, direction: 'decode' })
                  .then((r) => {
                    setCodecOut(r.output);
                    onSync();
                  })
                  .catch((e) => onToast(e.message));
              }}
              className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-semibold text-xs"
            >
              Декодировать (Decode)
            </button>
          </div>
          {codecOut && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-white/10 space-y-2">
              <div className="flex justify-between text-xs text-amber-300">
                <span>Результат ({codecName}):</span>
                <div className="flex gap-3">
                  <button onClick={() => setCodecText(codecOut)} className="underline">
                    ⇄ На вход
                  </button>
                  <button onClick={() => copyText(codecOut, onToast)} className="underline">
                    Копировать
                  </button>
                </div>
              </div>
              <pre className="text-xs font-mono text-white whitespace-pre-wrap break-all">{codecOut}</pre>
            </div>
          )}
        </div>
      )}

      {devTab === 'cron' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Cron расписание</label>
              <input
                value={cronExpr}
                onChange={(e) => setCronExpr(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 font-mono text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Генератор ID</label>
              <select
                value={idKind}
                onChange={(e) => setIdKind(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
              >
                <option value="uuid7">UUID v7 (Sortable Time)</option>
                <option value="uuid4">UUID v4 (Random)</option>
                <option value="ulid">ULID (Lexicographic)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Unix Timestamp / ISO (опц.)</label>
              <input
                value={tsInput}
                onChange={(e) => setTsInput(e.target.value)}
                placeholder="Авто (сейчас)"
                className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 font-mono text-xs text-white"
              />
            </div>
          </div>
          <button
            onClick={runCronUuid}
            className="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-semibold text-xs"
          >
            Рассчитать запуски Cron и сгенерировать ID
          </button>

          {cronUuidRes && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cronUuidRes.cron && (
                <div className="p-4 rounded-xl bg-slate-950 border border-white/10 space-y-2 text-xs">
                  <div className="text-amber-300 font-semibold">{cronUuidRes.cron.human_ru}</div>
                  <div className="text-slate-400">Следующие 5 срабатываний:</div>
                  {cronUuidRes.cron.next_runs.map((r: string) => (
                    <div key={r} className="font-mono text-slate-200">• {r}</div>
                  ))}
                </div>
              )}
              <div className="p-4 rounded-xl bg-slate-950 border border-white/10 space-y-1.5 text-xs">
                <div className="text-sky-300 font-semibold mb-1">
                  Сгенерированные {cronUuidRes.kind.toUpperCase()} (клик — копировать):
                </div>
                {cronUuidRes.ids.map((id: string) => (
                  <div
                    key={id}
                    onClick={() => copyText(id, onToast)}
                    className="font-mono text-slate-200 hover:text-amber-300 cursor-pointer"
                  >
                    {id}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
