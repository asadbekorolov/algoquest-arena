import { Award, Crown, Gauge, Lock, Medal, Trophy, User } from 'lucide-react';
import { BADGES, LEVELS, PEERS } from '../data/levels';
import { levelOf } from '../lib/storage';
import type { Progress } from '../types';

interface Props {
  progress: Progress;
  onRename(name: string): void;
  onResetProgress(): void;
}

function averageBigO(progress: Progress): string {
  const records = Object.values(progress.completed);
  if (!records.length) return '—';
  const avg = records.reduce((a, r) => a + r.bestEfficiency, 0) / records.length;
  if (avg >= 60) return 'O(N)';
  if (avg >= 30) return 'O(N log N)';
  return 'O(N^2)';
}

export default function Leaderboard({ progress, onRename, onResetProgress }: Props) {
  const bossDone = LEVELS.some((l) => l.mode === 'boss' && progress.completed[l.id]);
  const rows = [
    ...PEERS.map((p) => ({ ...p, me: false })),
    { name: progress.name, track: (bossDone ? 'Olimpiada' : "To'garak") as string, bigO: averageBigO(progress), xp: progress.xp, me: true },
  ].sort((a, b) => b.xp - a.xp);
  const solved = Object.keys(progress.completed).length;

  return (
    <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <section className="rounded-2xl border border-edge bg-panel">
        <div className="flex flex-wrap items-center gap-3 border-b border-edge px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ember/15 text-ember">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-100">To'garak reytingi</h2>
            <p className="text-xs text-slate-400">Tengdoshlar ma'lumoti namunaviy (simulyatsiya); sizning natijangiz haqiqiy.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">O'rin</th>
                <th className="px-3 py-3 font-medium">O'quvchi</th>
                <th className="px-3 py-3 font-medium">Yo'nalish (To'garak / Olimpiada)</th>
                <th className="px-3 py-3 font-medium">O'rtacha Big-O</th>
                <th className="px-5 py-3 text-right font-medium">Umumiy XP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.name}-${i}`} className={`border-t border-edge ${r.me ? 'bg-neon/10' : ''}`}>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2 font-mono text-slate-300">
                      {i === 0 ? <Crown className="h-4 w-4 text-ember" /> : i < 3 ? <Medal className="h-4 w-4 text-slate-400" /> : <span className="inline-block w-4" />}
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`flex items-center gap-2 ${r.me ? 'font-semibold text-neon' : 'text-slate-200'}`}>
                      {r.me && <User className="h-4 w-4" />}
                      {r.name}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs ${
                        r.track === 'Olimpiada' ? 'border-ember/40 bg-ember/10 text-ember' : 'border-neon/40 bg-neon/10 text-neon'
                      }`}
                    >
                      {r.track}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-slate-300">{r.bigO}</td>
                  <td className="px-5 py-3 text-right font-mono font-semibold text-slate-100">{r.xp.toLocaleString('uz')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="space-y-5">
        <section className="rounded-2xl border border-edge bg-panel p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
            <User className="h-4 w-4 text-neon" />
            Mening profilim
          </h3>
          <label className="block text-xs text-slate-400">
            Reytingdagi ism
            <input
              value={progress.name}
              maxLength={28}
              onChange={(e) => onRename(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-edge bg-obsidian px-3 py-2 text-sm text-slate-100 outline-none focus:border-neon"
            />
          </label>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ['Daraja', String(levelOf(progress.xp))],
              ['XP ball', progress.xp.toLocaleString('uz')],
              ['Yechilgan', `${solved} / ${LEVELS.length}`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-edge bg-obsidian px-2 py-3">
                <div className="font-mono text-lg font-semibold text-slate-100">{v}</div>
                <div className="text-[11px] text-slate-400">{k}</div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={onResetProgress}
            className="mt-4 w-full rounded-2xl border border-edge px-3 py-2 text-xs text-slate-400 hover:border-danger/60 hover:text-danger"
          >
            Natijalarni tozalash
          </button>
        </section>

        <section className="rounded-2xl border border-edge bg-panel p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Award className="h-4 w-4 text-ember" />
            Nishonlar
          </h3>
          <ul className="space-y-2">
            {BADGES.map((b) => {
              const earned = progress.badges.includes(b.id);
              return (
                <li
                  key={b.id}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${
                    earned ? 'border-ember/40 bg-ember/10' : 'border-edge bg-obsidian opacity-70'
                  }`}
                >
                  {earned ? <Award className="h-5 w-5 shrink-0 text-ember" /> : <Lock className="h-5 w-5 shrink-0 text-slate-600" />}
                  <div className="min-w-0">
                    <div className={`text-sm font-semibold ${earned ? 'text-amber-200' : 'text-slate-400'}`}>{b.title}</div>
                    <div className="text-xs text-slate-400">{b.desc}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-2xl border border-edge bg-panel p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Gauge className="h-4 w-4 text-neon" />
            Eng yaxshi samaradorlik
          </h3>
          <ul className="space-y-2.5">
            {LEVELS.map((l) => {
              const rec = progress.completed[l.id];
              return (
                <li key={l.id}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-slate-300">
                      <span className={`font-mono ${l.mode === 'boss' ? 'text-ember' : 'text-neon'}`}>{l.code}</span> {l.title}
                    </span>
                    <span className="shrink-0 font-mono text-slate-400">{rec ? `${rec.bestEfficiency}%` : '—'}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-edge">
                    <div className={`h-full rounded-full ${l.mode === 'boss' ? 'bg-ember' : 'bg-neon'}`} style={{ width: `${rec?.bestEfficiency ?? 0}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Samaradorlik — eng og'ir testda saqlab qolingan energiya ulushi. Qiymat qancha yuqori bo'lsa, algoritm shuncha tejamkor.
          </p>
        </section>
      </div>
    </div>
  );
}
