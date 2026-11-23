import { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, GraduationCap, Settings, Sparkles, Star, Swords, Trophy } from 'lucide-react';
import AiSettingsModal from './components/AiSettingsModal';
import Leaderboard from './components/Leaderboard';
import MethodologicalModal from './components/MethodologicalModal';
import Workspace from './components/Workspace';
import { LEVELS, LEVEL_BY_ID } from './data/levels';
import { subscribePyStatus, warmUp } from './engine/codeRunner';
import { GEMINI_KEY, LANG_KEY, levelOf, loadProgress, lsGet, lsSet, recordSuccess, saveProgress, type Gain } from './lib/storage';
import type { Lang, Mode, Progress, PyStatus, RunResult } from './types';

const TABS: { id: Mode; label: string; short: string; icon: typeof Swords }[] = [
  { id: 'club', label: "To'garak Rejimi (Bosqichma-bosqich)", short: "To'garak", icon: GraduationCap },
  { id: 'boss', label: 'Olimpiada Arena (Boss-Fight)', short: 'Olimpiada', icon: Swords },
  { id: 'leaderboard', label: 'Reyting (Leaderboard)', short: 'Reyting', icon: Trophy },
];

export default function App() {
  const [mode, setMode] = useState<Mode>('club');
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [selected, setSelected] = useState<{ club: string; boss: string }>({ club: 'club-1-1', boss: 'boss-1' });
  const [lang, setLang] = useState<Lang>(() => (lsGet(LANG_KEY) === 'javascript' ? 'javascript' : 'python'));
  const [apiKey, setApiKey] = useState(() => lsGet(GEMINI_KEY) ?? '');
  const [pyStatus, setPyStatus] = useState<PyStatus>('idle');
  const [showPassport, setShowPassport] = useState(false);
  const [showAi, setShowAi] = useState(false);

  useEffect(() => {
    const off = subscribePyStatus(setPyStatus);
    warmUp();
    return off;
  }, []);

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  const changeLang = (l: Lang) => {
    setLang(l);
    lsSet(LANG_KEY, l);
  };

  const saveKey = (key: string) => {
    setApiKey(key);
    lsSet(GEMINI_KEY, key || null);
  };

  const onSolved = (levelId: string, result: RunResult, usedLang: Lang): Gain => {
    const { progress: next, gain } = recordSuccess(progress, levelId, result, usedLang);
    setProgress(next);
    return gain;
  };

  const solved = Object.keys(progress.completed).length;
  const levels = mode === 'leaderboard' ? [] : LEVELS.filter((l) => l.mode === mode);
  const level = mode === 'leaderboard' ? null : LEVEL_BY_ID[selected[mode]];
  const nextLevel = level ? levels[levels.findIndex((l) => l.id === level.id) + 1] : undefined;

  return (
    <div className="min-h-screen bg-obsidian text-slate-200">
      <header className="sticky top-0 z-30 border-b border-edge bg-obsidian/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-neon/40 bg-neon/10 text-neon shadow-[0_0_24px_rgba(16,185,129,0.25)]">
              <Swords className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-base font-semibold text-slate-100">
                AlgoQuest: <span className="text-neon">Olimpiada Arenasi</span>
              </div>
              <div className="text-[11px] text-slate-500">Informatika to'garagi va olimpiadaga tayyorlov platformasi</div>
            </div>
          </div>

          <nav aria-label="Rejimlar" className="order-3 flex w-full gap-1 overflow-x-auto rounded-2xl border border-edge bg-panel p-1 lg:order-none lg:w-auto">
            {TABS.map((t) => {
              const active = mode === t.id;
              const boss = t.id === 'boss';
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setMode(t.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    active ? (boss ? 'bg-ember/15 text-ember' : 'bg-neon/15 text-neon') : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <t.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.label}</span>
                  <span className="sm:hidden">{t.short}</span>
                </button>
              );
            })}
          </nav>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-edge bg-panel px-3 py-1.5 text-xs text-slate-300" title="Daraja (Level)">
              <Star className="h-3.5 w-3.5 text-ember" />
              Daraja <span className="font-mono font-semibold text-slate-100">{levelOf(progress.xp)}</span>
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-edge bg-panel px-3 py-1.5 text-xs text-slate-300">
              <Sparkles className="h-3.5 w-3.5 text-neon" />
              XP ball <span className="font-mono font-semibold text-slate-100">{progress.xp.toLocaleString('uz')}</span>
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-edge bg-panel px-3 py-1.5 text-xs text-slate-300">
              <CheckCircle2 className="h-3.5 w-3.5 text-neon" />
              Yechilgan masalalar{' '}
              <span className="font-mono font-semibold text-slate-100">
                {solved}/{LEVELS.length}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setShowPassport(true)}
              className="flex items-center gap-2 rounded-2xl border border-neon/40 bg-neon/10 px-3 py-2 text-xs font-semibold text-neon hover:bg-neon/20"
            >
              <BookOpen className="h-4 w-4" />
              Metodik Pasport
            </button>
            <button
              type="button"
              onClick={() => setShowAi(true)}
              className="flex items-center gap-2 rounded-2xl border border-edge bg-panel px-3 py-2 text-xs font-semibold text-slate-200 hover:border-neon/50"
            >
              <Settings className="h-4 w-4 text-slate-400" />
              AI Sozlamalari
              {apiKey && <span className="h-1.5 w-1.5 rounded-full bg-neon" aria-label="API kaliti kiritilgan" />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1680px] px-4 py-5">
        {level ? (
          <Workspace
            key={`${level.id}:${lang}`}
            level={level}
            levels={levels}
            lang={lang}
            progress={progress}
            pyStatus={pyStatus}
            apiKey={apiKey}
            onSelectLevel={(id) => setSelected((s) => ({ ...s, [LEVEL_BY_ID[id].mode]: id }))}
            onLang={changeLang}
            onSolved={onSolved}
            onAttempt={() => setProgress((p) => ({ ...p, attempts: p.attempts + 1 }))}
            onOpenSettings={() => setShowAi(true)}
            onNext={
              nextLevel
                ? () => setSelected((s) => ({ ...s, [nextLevel.mode]: nextLevel.id }))
                : mode === 'club'
                  ? () => setMode('boss')
                  : null
            }
          />
        ) : (
          <Leaderboard
            progress={progress}
            onRename={(name) => setProgress((p) => ({ ...p, name }))}
            onResetProgress={() => {
              if (window.confirm("Barcha XP, nishonlar va yechilgan bosqichlar o'chiriladi. Davom etasizmi?"))
                setProgress((p) => ({ name: p.name, xp: 0, completed: {}, badges: [], attempts: 0 }));
            }}
          />
        )}
      </main>

      {showPassport && <MethodologicalModal onClose={() => setShowPassport(false)} />}
      {showAi && <AiSettingsModal apiKey={apiKey} onSave={saveKey} onClose={() => setShowAi(false)} />}
    </div>
  );
}
