import { BADGES, LEVEL_BY_ID } from '../data/levels';
import type { BadgeDef, Lang, Progress, RunResult } from '../types';

const PROGRESS_KEY = 'algoquest.progress.v1';
export const GEMINI_KEY = 'algoquest.geminiKey';
export const LANG_KEY = 'algoquest.lang';

export function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function lsSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* saqlash imkoni yo'q (maxfiy rejim) — e'tiborsiz qoldiramiz */
  }
}

const EMPTY: Progress = { name: 'Siz', xp: 0, completed: {}, badges: [], attempts: 0 };

export function loadProgress(): Progress {
  const raw = lsGet(PROGRESS_KEY);
  if (!raw) return { ...EMPTY };
  try {
    const p = JSON.parse(raw) as Partial<Progress>;
    return {
      name: typeof p.name === 'string' && p.name.trim() ? p.name : 'Siz',
      xp: typeof p.xp === 'number' ? p.xp : 0,
      completed: p.completed && typeof p.completed === 'object' ? p.completed : {},
      badges: Array.isArray(p.badges) ? p.badges : [],
      attempts: typeof p.attempts === 'number' ? p.attempts : 0,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveProgress(p: Progress): void {
  lsSet(PROGRESS_KEY, JSON.stringify(p));
}

export const levelOf = (xp: number): number => Math.floor(xp / 250) + 1;

export interface Gain {
  xp: number;
  badges: BadgeDef[];
  firstTime: boolean;
}

/** Muvaffaqiyatli yechimni qayd etadi: XP, eng yaxshi samaradorlik va nishonlar. */
export function recordSuccess(p: Progress, levelId: string, result: RunResult, lang: Lang): { progress: Progress; gain: Gain } {
  const level = LEVEL_BY_ID[levelId];
  const prev = p.completed[levelId];
  const earned = level.xp + Math.round(level.xp * 0.25 * (result.efficiency / 100));
  const record = {
    bestEfficiency: Math.max(prev?.bestEfficiency ?? 0, result.efficiency),
    bestTimeMs: prev ? Math.min(prev.bestTimeMs, result.timeMs) : result.timeMs,
    xp: Math.max(prev?.xp ?? 0, earned),
    lang,
    at: Date.now(),
  };
  const completed = { ...p.completed, [levelId]: record };
  const xp = Object.values(completed).reduce((a, r) => a + r.xp, 0);
  const newBadges = BADGES.filter((b) => !p.badges.includes(b.id) && b.requires.every((id) => completed[id]));
  return {
    progress: { ...p, completed, xp, badges: [...p.badges, ...newBadges.map((b) => b.id)], attempts: p.attempts + 1 },
    gain: { xp: xp - p.xp, badges: newBadges, firstTime: !prev },
  };
}

export const codeKey = (levelId: string, lang: Lang): string => `algoquest.code.${levelId}.${lang}`;
