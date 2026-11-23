import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Code2,
  Cpu,
  EyeOff,
  Gauge,
  Layers,
  Loader2,
  RotateCcw,
  ShieldAlert,
  Swords,
  Target,
  Terminal,
  XCircle,
} from 'lucide-react';
import ArenaCanvas from '../engine/ArenaCanvas';
import { runCode } from '../engine/codeRunner';
import { previewScene, testCount } from '../engine/judge';
import { codeKey, lsGet, lsSet, type Gain } from '../lib/storage';
import type { Lang, LevelDef, Progress, PyStatus, RunResult } from '../types';
import CodeEditor from './CodeEditor';
import SocraticMentor from './SocraticMentor';

interface Props {
  level: LevelDef;
  levels: LevelDef[];
  lang: Lang;
  progress: Progress;
  pyStatus: PyStatus;
  apiKey: string;
  onSelectLevel(id: string): void;
  onLang(lang: Lang): void;
  onSolved(levelId: string, result: RunResult, lang: Lang): Gain;
  onAttempt(): void;
  onOpenSettings(): void;
  onNext: (() => void) | null;
}

const ENGINE_LABEL: Record<RunResult['engine'], string> = {
  pyodide: 'Pyodide (CPython)',
  'mini-python': 'Ichki Python interpretatori',
  javascript: 'JavaScript (Web Worker)',
};

const VERDICT_TITLE: Record<RunResult['verdict'], string> = {
  ok: 'Bosqich yechildi',
  wrong: "Noto'g'ri javob",
  tle: 'Energiya tugadi (TLE)',
  error: 'Dasturda xato',
  crash: 'Agent ishdan chiqdi',
};

export default function Workspace({
  level,
  levels,
  lang,
  progress,
  pyStatus,
  apiKey,
  onSelectLevel,
  onLang,
  onSolved,
  onAttempt,
  onOpenSettings,
  onNext,
}: Props) {
  const [code, setCode] = useState(() => lsGet(codeKey(level.id, lang)) ?? level.starter[lang]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [canvasResult, setCanvasResult] = useState<RunResult | null>(null);
  const [runToken, setRunToken] = useState(0);
  const [startMode, setStartMode] = useState<'play' | 'step'>('play');
  const [busy, setBusy] = useState(false);
  const [showVerdict, setShowVerdict] = useState(false);
  const [gain, setGain] = useState<Gain | null>(null);
  const [mentorOpen, setMentorOpen] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const scene = useMemo(() => previewScene(level.id), [level.id]);
  const total = useMemo(() => testCount(level.id), [level.id]);
  const isBoss = level.mode === 'boss';
  const accent = isBoss ? 'text-ember' : 'text-neon';

  const modules = useMemo(() => {
    const map = new Map<string, LevelDef[]>();
    for (const l of levels) map.set(l.module, [...(map.get(l.module) ?? []), l]);
    return [...map.entries()];
  }, [levels]);

  const updateCode = (value: string) => {
    setCode(value);
    lsSet(codeKey(level.id, lang), value);
    if (canvasResult) {
      setCanvasResult(null);
      setRunToken((t) => t + 1);
      setShowVerdict(false);
    }
  };

  const handleRun = async (mode: 'play' | 'step') => {
    if (busy) return;
    setBusy(true);
    setShowVerdict(false);
    setGain(null);
    const r = await runCode(level.id, lang, code);
    if (!alive.current) return;
    setStartMode(mode);
    setResult(r);
    setCanvasResult(r);
    setRunToken((t) => t + 1);
    setBusy(false);
    if (r.ok) setGain(onSolved(level.id, r, lang));
    else onAttempt();
  };

  const handleReset = () => {
    setCanvasResult(null);
    setRunToken((t) => t + 1);
    setShowVerdict(false);
  };

  const restoreStarter = () => {
    if (code !== level.starter[lang] && !window.confirm("Kodingiz boshlang'ich shablon bilan almashtiriladi. Davom etasizmi?")) return;
    updateCode(level.starter[lang]);
    setResult(null);
  };

  const pyPill =
    lang === 'javascript'
      ? { text: 'JavaScript: Web Worker', cls: 'border-edge text-slate-400', spin: false }
      : pyStatus === 'ready'
        ? { text: 'Pyodide tayyor (CPython)', cls: 'border-neon/40 text-neon', spin: false }
        : pyStatus === 'failed'
          ? { text: 'Oflayn: ichki interpretator', cls: 'border-ember/40 text-ember', spin: false }
          : { text: 'Pyodide yuklanmoqda — hozircha ichki interpretator', cls: 'border-edge text-slate-400', spin: true };

  const passed = result ? result.tests.filter((t) => t.ok).length : 0;

  return (
    <div className="grid gap-4 xl:grid-cols-[270px_minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Bosqichlar ro'yxati */}
      <nav aria-label="Bosqichlar" className="space-y-3 xl:sticky xl:top-[88px] xl:self-start">
        {modules.map(([name, list]) => (
          <div key={name} className="rounded-2xl border border-edge bg-panel p-3">
            <div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {isBoss ? <Swords className="h-3.5 w-3.5 text-ember" /> : <Layers className="h-3.5 w-3.5 text-neon" />}
              {name}
            </div>
            <ul className="space-y-1">
              {list.map((l) => {
                const done = !!progress.completed[l.id];
                const active = l.id === level.id;
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => onSelectLevel(l.id)}
                      aria-current={active ? 'true' : undefined}
                      className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left text-sm transition ${
                        active
                          ? isBoss
                            ? 'border-ember/50 bg-ember/10 text-slate-100'
                            : 'border-neon/50 bg-neon/10 text-slate-100'
                          : 'border-transparent text-slate-300 hover:bg-edge/60'
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-neon" />
                      ) : (
                        <CircleDot className={`h-4 w-4 shrink-0 ${active ? accent : 'text-slate-600'}`} />
                      )}
                      <span className="min-w-0 flex-1 truncate">
                        <span className={`mr-1.5 font-mono text-xs ${accent}`}>{l.code}</span>
                        {l.title}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-slate-500">{l.xp} XP</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Masala sharti va arena */}
      <div className="min-w-0 space-y-4">
        <section className="rounded-2xl border border-edge bg-panel p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-lg border px-2 py-0.5 font-mono text-xs font-semibold ${isBoss ? 'border-ember/40 bg-ember/10 text-ember' : 'border-neon/40 bg-neon/10 text-neon'}`}>
              {level.code}
            </span>
            <h1 className="text-lg font-semibold text-slate-100">{level.title}</h1>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium ${isBoss ? 'border-ember/40 bg-ember/10 text-ember' : 'border-neon/40 bg-neon/10 text-neon'}`}>
              <Gauge className="h-3.5 w-3.5" />
              Maqsadli murakkablik: <span className="font-mono">{level.complexity}</span>
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-edge px-2.5 py-1 text-slate-300">
              <Layers className="h-3.5 w-3.5 text-slate-400" />
              Blum: {level.bloom}
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-edge px-2.5 py-1 text-slate-300">
              <EyeOff className="h-3.5 w-3.5 text-slate-400" />
              {total} ta test ({total - 1} tasi yashirin)
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">{level.story}</p>
          <div className="mt-3 flex gap-2.5 rounded-2xl border border-edge bg-obsidian/60 p-3.5">
            <Target className={`mt-0.5 h-4 w-4 shrink-0 ${accent}`} />
            <p className="text-sm leading-relaxed text-slate-200">{level.task}</p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Kirish</div>
              <p className="text-xs leading-relaxed text-slate-300">{level.input}</p>
              <div className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Chiqish</div>
              <p className="text-xs leading-relaxed text-slate-300">{level.output}</p>
              <div className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Energiya qoidasi</div>
              <p className="text-xs leading-relaxed text-slate-300">{level.energyNote}</p>
            </div>
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">O'yin API</div>
              <ul className="space-y-1.5">
                {level.api.map((a) => (
                  <li key={a.name} className="text-xs leading-relaxed">
                    <code className="rounded-md bg-obsidian px-1.5 py-0.5 font-mono text-neon">{a.name}</code>
                    <span className="ml-1.5 text-slate-400">{a.desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <ArenaCanvas
          scene={scene}
          result={canvasResult}
          runToken={runToken}
          startMode={startMode}
          busy={busy}
          energyUnit={level.energyUnit}
          onRun={handleRun}
          onReset={handleReset}
          onPlaybackEnd={() => setShowVerdict(true)}
        />

        {showVerdict && result && (
          <section
            role="status"
            className={`rounded-2xl border p-4 ${
              result.ok ? 'border-neon/50 bg-neon/10' : result.verdict === 'tle' ? 'border-ember/50 bg-ember/10' : 'border-danger/50 bg-danger/10'
            }`}
          >
            <div className="flex flex-wrap items-start gap-3">
              {result.ok ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-neon" />
              ) : result.verdict === 'tle' ? (
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-ember" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-100">{VERDICT_TITLE[result.verdict]}</div>
                <p className="mt-0.5 break-words text-sm text-slate-300">{result.message}</p>
                {result.ok && gain && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-neon/40 bg-obsidian px-2.5 py-1 font-mono text-neon">
                      {gain.xp > 0 ? `+${gain.xp} XP` : 'XP rekordi saqlangan'}
                    </span>
                    <span className="rounded-full border border-edge bg-obsidian px-2.5 py-1 text-slate-300">
                      Samaradorlik: <span className="font-mono">{result.efficiency}%</span>
                    </span>
                    {gain.badges.map((b) => (
                      <span key={b.id} className="flex items-center gap-1.5 rounded-full border border-ember/40 bg-obsidian px-2.5 py-1 text-ember">
                        <Award className="h-3.5 w-3.5" />
                        Yangi nishon: {b.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {result.ok && onNext ? (
                <button
                  type="button"
                  onClick={onNext}
                  className="flex items-center gap-1.5 rounded-2xl bg-neon px-4 py-2 text-sm font-semibold text-obsidian hover:brightness-110"
                >
                  Keyingi bosqich
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : !result.ok ? (
                <button
                  type="button"
                  onClick={() => setMentorOpen(true)}
                  className="flex items-center gap-1.5 rounded-2xl border border-edge bg-obsidian px-4 py-2 text-sm font-medium text-slate-200 hover:border-neon/60"
                >
                  <Bot className="h-4 w-4 text-neon" />
                  Mentordan so'rash
                </button>
              ) : null}
            </div>
          </section>
        )}
      </div>

      {/* Kod muharriri va natijalar */}
      <div className="min-w-0 space-y-4">
        <section className="rounded-2xl border border-edge bg-panel p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Code2 className="h-4 w-4 text-neon" />
            <h2 className="text-sm font-semibold text-slate-100">Kod muharriri</h2>
            <div className="ml-auto flex items-center gap-1 rounded-2xl border border-edge bg-obsidian p-1" role="group" aria-label="Dasturlash tili">
              {(['python', 'javascript'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => onLang(l)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    lang === l ? 'bg-neon/15 text-neon' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {l === 'python' ? 'Python' : 'JavaScript'}
                </button>
              ))}
            </div>
          </div>
          <CodeEditor value={code} onChange={updateCode} errorLine={result?.errorLine ?? 0} ariaLabel={`${level.title} uchun kod`} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${pyPill.cls}`}>
              {pyPill.spin ? <Loader2 className="h-3 w-3 animate-spin" /> : <Cpu className="h-3 w-3" />}
              {pyPill.text}
            </span>
            <button
              type="button"
              onClick={restoreStarter}
              className="ml-auto flex items-center gap-1.5 rounded-2xl border border-edge px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Shablonni tiklash
            </button>
            <button
              type="button"
              onClick={() => setMentorOpen(true)}
              className="flex items-center gap-1.5 rounded-2xl border border-neon/40 bg-neon/10 px-3 py-1.5 text-xs font-semibold text-neon hover:bg-neon/20"
            >
              <Bot className="h-3.5 w-3.5" />
              Sokratik Mentor
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-edge bg-panel p-4" aria-live="polite">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Terminal className="h-4 w-4 text-neon" />
            <h2 className="text-sm font-semibold text-slate-100">Konsol va testlar</h2>
            {result && (
              <span className="ml-auto font-mono text-xs text-slate-400">
                {passed} / {result.totalTests} test · {ENGINE_LABEL[result.engine]}
              </span>
            )}
          </div>
          {busy ? (
            <p className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-neon" />
              Kod bajarilmoqda...
            </p>
          ) : !result ? (
            <p className="text-sm text-slate-500">
              Natijalar shu yerda ko'rinadi. Kodni yozing va «Kodni Ishga Tushirish» tugmasini bosing.
            </p>
          ) : (
            <div className="space-y-3">
              {!result.ok && (
                <div
                  className={`rounded-xl border px-3 py-2 font-mono text-xs leading-relaxed ${
                    result.verdict === 'tle' ? 'border-ember/40 bg-ember/5 text-amber-200' : 'border-danger/40 bg-danger/5 text-red-200'
                  }`}
                >
                  {result.errorLine > 0 && <span className="font-semibold">Satr {result.errorLine}: </span>}
                  {result.message}
                </div>
              )}
              <ul className="space-y-1.5">
                {result.tests.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-xl border border-edge bg-obsidian px-3 py-2 text-xs">
                    {t.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-neon" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 text-slate-200">
                        <span>{t.name}</span>
                        {t.hidden && <span className="rounded border border-edge px-1 text-[10px] text-slate-500">yashirin</span>}
                      </div>
                      {!t.ok && t.message && <div className="mt-0.5 break-words text-slate-400">{t.message}</div>}
                    </div>
                    <span className={`shrink-0 font-mono ${t.used > t.budget ? 'text-danger' : 'text-slate-500'}`}>
                      {t.used > t.budget ? `> ${t.budget.toLocaleString('uz')}` : `${t.used.toLocaleString('uz')} / ${t.budget.toLocaleString('uz')}`}
                    </span>
                  </li>
                ))}
                {result.tests.length < result.totalTests && (
                  <li className="px-3 text-[11px] text-slate-500">
                    Qolgan {result.totalTests - result.tests.length} ta test birinchi xatodan keyin ishga tushirilmadi.
                  </li>
                )}
              </ul>
              {result.logs.length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">print() chiqishi</div>
                  <pre className="max-h-40 overflow-auto rounded-xl border border-edge bg-obsidian p-3 font-mono text-xs leading-relaxed text-slate-300">
                    {result.logs.join('\n')}
                  </pre>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <SocraticMentor
        open={mentorOpen}
        onClose={() => setMentorOpen(false)}
        level={level}
        lang={lang}
        code={code}
        result={result}
        apiKey={apiKey}
        onOpenSettings={onOpenSettings}
      />
    </div>
  );
}
