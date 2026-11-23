import type { EnergySource, Frame, FrameEvent, Laser, RunResult, Scene, TestResult, Verdict } from '../types';
import { BudgetError, HardLimitError, Meter, SimError, StudentError, type Executor } from './meter';

export const TLE_MESSAGE = 'Energiya tugadi (TLE): Algoritm samaradorligi past!';
const HARD_MESSAGE = `${TLE_MESSAGE} Amallar soni chegaradan oshdi — dasturda cheksiz sikl bo'lishi mumkin.`;

export type JudgeResult = Omit<RunResult, 'timeMs' | 'engine'>;

const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];
const MOVES: Record<string, [number, number, number]> = {
  R: [1, 0, 0],
  D: [0, 1, 1],
  L: [-1, 0, 2],
  U: [0, -1, 3],
};

/* ------------------------------------------------------------------ */
/* Sahna quruvchilar                                                    */
/* ------------------------------------------------------------------ */

export function gridScene(rows: string[], lasers: Omit<Laser, 'x' | 'y'>[] = [], caption = ''): Scene {
  const scene: Scene = {
    kind: 'grid',
    cols: rows[0].length,
    rows: rows.length,
    tiles: [],
    start: { x: 0, y: 0, dir: 0 },
    portal: null,
    crystals: [],
    lasers: [],
    labels: [],
    nodes: [],
    edges: [],
    caption,
  };
  rows.forEach((row, y) => {
    let line = '';
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      line += c === '#' ? '#' : '.';
      if (c === 'S') scene.start = { x, y, dir: 0 };
      else if (c === 'P') scene.portal = { x, y };
      else if (c === 'K') scene.crystals.push({ x, y });
      else if (c === 'L') {
        const spec = lasers[scene.lasers.length] ?? { period: 4, on: 2, phase: 0 };
        scene.lasers.push({ x, y, ...spec });
      }
    }
    scene.tiles.push(line);
  });
  return scene;
}

function graphScene(
  pos: [number, number][],
  edges: [number, number][],
  start: number,
  target: number,
  cols: number,
  rows: number,
  caption: string,
): Scene {
  return {
    kind: 'graph',
    cols,
    rows,
    tiles: Array.from({ length: rows }, () => '.'.repeat(cols)),
    start: { x: pos[start][0], y: pos[start][1], dir: 0 },
    portal: { x: pos[target][0], y: pos[target][1] },
    crystals: [],
    lasers: [],
    labels: [],
    nodes: pos.map(([x, y], i) => ({ x, y, label: String(i) })),
    edges,
    caption,
  };
}

function mkFrame(
  x: number,
  y: number,
  angle: number,
  energy: number,
  steps: number,
  tick: number,
  mask: number,
  event?: FrameEvent,
): Frame {
  const f: Frame = { x, y, angle, energy: Math.max(0, Math.min(1, energy)), steps, tick, mask };
  if (event) f.event = event;
  return f;
}

export function initialFrame(scene: Scene): Frame {
  return mkFrame(scene.start.x, scene.start.y, (scene.start.dir * Math.PI) / 2, 1, 0, 0, 0);
}

function stillFrames(scene: Scene, verdict: Verdict): Frame[] {
  const f0 = initialFrame(scene);
  if (verdict === 'ok') return [f0];
  return [f0, { ...f0, energy: verdict === 'tle' ? 0 : 1, event: verdict === 'tle' ? 'tle' : 'fail' }];
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const show = (v: unknown): string => {
  let s: string;
  try {
    s = JSON.stringify(v) ?? String(v);
  } catch {
    s = String(v);
  }
  return s.length > 70 ? `${s.slice(0, 67)}...` : s;
};

/* ------------------------------------------------------------------ */
/* Agent dunyosi (1-modul)                                              */
/* ------------------------------------------------------------------ */

class World {
  x: number;
  y: number;
  dir: number;
  tick = 0;
  mask = 0;
  frames: Frame[] = [];
  fatal: Error | null = null;
  scene: Scene;
  meter: Meter;

  constructor(scene: Scene, meter: Meter) {
    this.scene = scene;
    this.meter = meter;
    this.x = scene.start.x;
    this.y = scene.start.y;
    this.dir = scene.start.dir;
    this.push();
  }

  energy(): number {
    return Math.max(0, 1 - this.meter.used / this.meter.budget);
  }

  push(event?: FrameEvent, energy = this.energy()): void {
    this.frames.push(mkFrame(this.x, this.y, (this.dir * Math.PI) / 2, energy, this.meter.actions, this.tick, this.mask, event));
  }

  private guard(): void {
    if (this.fatal) throw this.fatal;
    if (this.frames.length > 700) {
      this.fatal = new SimError("Juda ko'p harakat bajarildi: agent bir joyda aylanib qolgan bo'lishi mumkin.");
      this.push('fail');
      throw this.fatal;
    }
    try {
      this.meter.act();
    } catch (e) {
      this.fatal = e as Error;
      this.push('tle', 0);
      throw e;
    }
  }

  private crash(message: string): never {
    this.fatal = new SimError(message);
    this.push('crash');
    throw this.fatal;
  }

  laserActive(l: Laser): boolean {
    return (this.tick + l.phase) % l.period < l.on;
  }

  what(x: number, y: number): string {
    const s = this.scene;
    if (y < 0 || y >= s.rows || x < 0 || x >= s.cols || s.tiles[y][x] === '#') return 'devor';
    const l = s.lasers.find((q) => q.x === x && q.y === y);
    if (l && this.laserActive(l)) return 'lazer';
    if (s.portal && s.portal.x === x && s.portal.y === y) return 'portal';
    const ci = s.crystals.findIndex((c) => c.x === x && c.y === y);
    if (ci >= 0 && !(this.mask & (1 << ci))) return 'kristall';
    return 'bosh';
  }

  scan(): string {
    if (this.fatal) throw this.fatal;
    return this.what(this.x + DX[this.dir], this.y + DY[this.dir]);
  }

  move(): void {
    this.guard();
    const nx = this.x + DX[this.dir];
    const ny = this.y + DY[this.dir];
    const w = this.what(nx, ny);
    if (w === 'devor') this.crash('Agent devorga urildi.');
    if (w === 'lazer') this.crash("Agent faol lazer to'sig'iga urildi.");
    this.x = nx;
    this.y = ny;
    this.tick++;
    const ci = this.scene.crystals.findIndex((c) => c.x === nx && c.y === ny);
    if (ci >= 0 && !(this.mask & (1 << ci))) {
      this.mask |= 1 << ci;
      this.push('crystal');
    } else this.push();
  }

  turn(d: number): void {
    this.guard();
    this.dir = (this.dir + d + 4) % 4;
    this.tick++;
    this.push();
  }

  wait(): void {
    this.guard();
    this.tick++;
    this.push();
  }

  atPortal(): boolean {
    const p = this.scene.portal;
    return !!p && p.x === this.x && p.y === this.y;
  }

  allCollected(): boolean {
    return this.mask === (1 << this.scene.crystals.length) - 1;
  }

  api(): Record<string, (...a: any[]) => unknown> {
    return {
      move_forward: () => this.move(),
      turn_left: () => this.turn(-1),
      turn_right: () => this.turn(1),
      wait: () => this.wait(),
      scan: () => this.scan(),
      at_portal: () => {
        if (this.fatal) throw this.fatal;
        return this.atPortal();
      },
    };
  }
}

/* ------------------------------------------------------------------ */
/* Yo'l bo'ylab yurish (3.1, Boss 2) va graf bo'ylab yurish (3.2)        */
/* ------------------------------------------------------------------ */

interface CheckResult {
  ok: boolean;
  message: string;
  frames?: Frame[];
}

function walkPath(scene: Scene, res: unknown, left: number, needAll: boolean, maxLen: number): CheckResult {
  let moves: string[];
  if (typeof res === 'string') moves = res.toUpperCase().split('');
  else if (Array.isArray(res) && res.every((m) => typeof m === 'string')) moves = (res as string[]).join('').toUpperCase().split('');
  else return { ok: false, message: "Javob formati noto'g'ri: 'U', 'D', 'L', 'R' harflaridan iborat satr kutilgan.", frames: stillFrames(scene, 'wrong') };
  if (moves.some((m) => !MOVES[m]))
    return { ok: false, message: "Yo'lda noma'lum belgi bor: faqat 'U', 'D', 'L', 'R' ishlatiladi.", frames: stillFrames(scene, 'wrong') };
  if (moves.length > 500) return { ok: false, message: "Yo'l haddan tashqari uzun.", frames: stillFrames(scene, 'wrong') };

  let { x, y } = scene.start;
  let angle = (scene.start.dir * Math.PI) / 2;
  let mask = 0;
  const total = Math.max(1, moves.length);
  const frames: Frame[] = [mkFrame(x, y, angle, 1, 0, 0, 0)];
  const e = (i: number) => 1 - ((1 - left) * i) / total;
  const fail = (message: string, event: FrameEvent, i: number): CheckResult => {
    frames.push(mkFrame(x, y, angle, e(i), i, i, mask, event));
    return { ok: false, message, frames };
  };

  for (let i = 0; i < moves.length; i++) {
    const [dx, dy, d] = MOVES[moves[i]];
    angle = (d * Math.PI) / 2;
    const nx = x + dx;
    const ny = y + dy;
    if (ny < 0 || ny >= scene.rows || nx < 0 || nx >= scene.cols || scene.tiles[ny][nx] === '#')
      return fail(`Yo'l ${i + 1}-qadamda devorga urildi.`, 'crash', i);
    x = nx;
    y = ny;
    const ci = scene.crystals.findIndex((c) => c.x === x && c.y === y);
    let ev: FrameEvent | undefined;
    if (ci >= 0 && !(mask & (1 << ci))) {
      mask |= 1 << ci;
      ev = 'crystal';
    }
    frames.push(mkFrame(x, y, angle, e(i + 1), i + 1, i + 1, mask, ev));
  }
  const n = moves.length;
  if (!scene.portal || scene.portal.x !== x || scene.portal.y !== y) return fail("Yo'l portalda tugamadi.", 'fail', n);
  if (needAll && mask !== (1 << scene.crystals.length) - 1) return fail("Barcha energiya yadrolari yig'ilmadi.", 'fail', n);
  if (n > maxLen) return fail(`Marshrut eng qisqa emas: ${n} qadam, optimal ${maxLen} qadam.`, 'fail', n);
  frames.push(mkFrame(x, y, angle, left, n, n, mask, 'portal'));
  return { ok: true, message: '', frames };
}

function walkGraph(scene: Scene, adj: number[][], start: number, target: number, dist: number, res: unknown, left: number): CheckResult {
  const f0 = initialFrame(scene);
  if (!Array.isArray(res) || res.some((v) => typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= adj.length))
    return { ok: false, message: "Javob formati noto'g'ri: tugun raqamlari ro'yxati kutilgan.", frames: stillFrames(scene, 'wrong') };
  const path = res as number[];
  if (dist < 0) {
    if (path.length === 0) return { ok: true, message: '', frames: [f0] };
    return { ok: false, message: "Bu tugunlar orasida yo'l yo'q: bo'sh ro'yxat kutilgan.", frames: stillFrames(scene, 'wrong') };
  }
  if (path.length === 0 || path[0] !== start)
    return { ok: false, message: "Yo'l start tugunidan boshlanishi kerak.", frames: stillFrames(scene, 'wrong') };
  const total = Math.max(1, path.length - 1);
  const frames: Frame[] = [f0];
  let angle = 0;
  const node = (i: number) => scene.nodes[path[i]];
  for (let i = 1; i < path.length; i++) {
    const a = node(i - 1);
    const b = node(i);
    const e = 1 - ((1 - left) * i) / total;
    if (!adj[path[i - 1]].includes(path[i])) {
      frames.push(mkFrame(a.x, a.y, angle, e, i - 1, i - 1, 0, 'crash'));
      return { ok: false, message: `${path[i - 1]} va ${path[i]} tugunlari orasida ulanish yo'q.`, frames };
    }
    angle = Math.atan2(b.y - a.y, b.x - a.x);
    frames.push(mkFrame(b.x, b.y, angle, e, i, i, 0));
  }
  const last = node(path.length - 1);
  const n = path.length - 1;
  const fail = (message: string): CheckResult => {
    frames.push(mkFrame(last.x, last.y, angle, left, n, n, 0, 'fail'));
    return { ok: false, message, frames };
  };
  if (path[n] !== target) return fail("Yo'l target tugunida tugamadi.");
  if (n > dist) return fail(`Yo'l eng qisqa emas: ${n} ta ulanish, optimal ${dist} ta.`);
  frames.push(mkFrame(last.x, last.y, angle, left, n, n, 0, 'portal'));
  return { ok: true, message: '', frames };
}

/* ------------------------------------------------------------------ */
/* Test tavsiflari                                                      */
/* ------------------------------------------------------------------ */

interface AgentTest {
  name: string;
  hidden: boolean;
  scene: Scene;
  globals: Record<string, unknown>;
  budget: number;
}

interface SolveTest {
  name: string;
  hidden: boolean;
  args: unknown[];
  counted: number[];
  budget: number;
  scene?: Scene;
  check(res: unknown, left: number): CheckResult;
}

type LevelSpec =
  | { kind: 'agent'; tests: AgentTest[] }
  | { kind: 'solve'; mode: EnergySource; tests: SolveTest[]; track?: Scene };

/** Massivli masalalar uchun yo'lak: har bir test — bitta kristall, oxirida portal. */
function trackScene(values: (number | string)[], nTests: number, caption: string): Scene {
  const cols = 2 * nTests + 3;
  const wall = '#'.repeat(cols);
  let lane = '#S';
  for (let i = 0; i < nTests; i++) lane += i === nTests - 1 ? '.P' : '.K';
  lane += '#';
  const scene = gridScene([wall, `#${'.'.repeat(cols - 2)}#`, wall, lane, wall], [], caption);
  const room = cols - 2;
  const shown = values.length > room ? [...values.slice(0, room - 1), '...'] : values;
  shown.forEach((v, i) => scene.labels.push({ x: 1 + i, y: 1, text: String(v) }));
  return scene;
}

function trackFrames(scene: Scene, passed: number, total: number, left: number, verdict: Verdict): Frame[] {
  const reach = 2 * passed;
  const y = scene.start.y;
  const frames: Frame[] = [];
  let mask = 0;
  const end = verdict === 'tle' ? 0 : left;
  for (let i = 0; i <= reach; i++) {
    const x = scene.start.x + i;
    const ci = scene.crystals.findIndex((c) => c.x === x && c.y === y);
    let ev: FrameEvent | undefined;
    if (ci >= 0) {
      mask |= 1 << ci;
      ev = 'crystal';
    }
    const e = reach === 0 ? 1 : 1 - ((1 - end) * i) / (2 * total);
    frames.push(mkFrame(x, y, 0, e, i, i, mask, ev));
  }
  const lastF = frames[frames.length - 1];
  if (verdict === 'ok') frames.push({ ...lastF, energy: left, event: 'portal' });
  else frames.push({ ...lastF, energy: end, event: verdict === 'tle' ? 'tle' : 'fail' });
  return frames;
}

const eqArr = (a: unknown, b: number[]): boolean =>
  Array.isArray(a) && a.length === b.length && a.every((v, i) => typeof v === 'number' && v === b[i]);

function valueCheck(expected: unknown, hidden: boolean, same: (res: unknown) => boolean) {
  return (res: unknown): CheckResult =>
    same(res)
      ? { ok: true, message: '' }
      : {
          ok: false,
          message: hidden
            ? `Noto'g'ri javob (sizning javobingiz: ${show(res)}).`
            : `Noto'g'ri javob. Kutilgan: ${show(expected)}, sizning javobingiz: ${show(res)}.`,
        };
}

/* ---- 1.1 ---- */
function stairScene(n: number, caption: string): Scene {
  const cols = 2 * n + 3;
  const rows = n + 3;
  const g = Array.from({ length: rows }, () => Array<string>(cols).fill('#'));
  let x = 1;
  let y = rows - 2;
  g[y][x] = 'S';
  for (let i = 0; i < n; i++) {
    g[y][x + 1] = 'K';
    g[y][x + 2] = '.';
    g[y - 1][x + 2] = '.';
    x += 2;
    y -= 1;
  }
  g[y][x] = 'P';
  return gridScene(g.map((r) => r.join('')), [], caption);
}

function level11(): LevelSpec {
  const mk = (n: number, name: string, hidden: boolean): AgentTest => ({
    name,
    hidden,
    scene: stairScene(n, hidden ? `${name}` : ''),
    globals: { N: n },
    budget: 8 * n + 4,
  });
  return {
    kind: 'agent',
    tests: [
      mk(3, 'Ochiq xarita (N = 3)', false),
      mk(5, 'Yashirin xarita (N = 5)', true),
      mk(1, 'Chegaraviy holat (N = 1)', true),
      mk(6, 'Yashirin xarita (N = 6)', true),
    ],
  };
}

/* ---- 1.2 ---- */
function corridorScene(len: number, gates: { x: number; period: number; on: number; phase: number }[], crystals: number[], caption: string): Scene {
  const cols = len + 2;
  const wall = '#'.repeat(cols);
  let lane = '#';
  for (let x = 1; x <= len; x++) {
    if (x === 1) lane += 'S';
    else if (x === len) lane += 'P';
    else if (gates.some((g) => g.x === x)) lane += 'L';
    else if (crystals.includes(x)) lane += 'K';
    else lane += '.';
  }
  lane += '#';
  const sorted = [...gates].sort((a, b) => a.x - b.x);
  return gridScene([wall, wall, lane, wall, wall], sorted, caption);
}

function level12(): LevelSpec {
  const mk = (
    name: string,
    hidden: boolean,
    len: number,
    gates: { x: number; period: number; on: number; phase: number }[],
    crystals: number[],
  ): AgentTest => ({
    name,
    hidden,
    scene: corridorScene(len, gates, crystals, hidden ? name : ''),
    globals: {},
    budget: 4 * len + 10,
  });
  return {
    kind: 'agent',
    tests: [
      mk("Ochiq yo'lak (2 ta lazer)", false, 9, [{ x: 4, period: 4, on: 2, phase: 0 }, { x: 7, period: 3, on: 1, phase: 0 }], [2, 5]),
      mk("Yashirin yo'lak (3 ta lazer)", true, 13, [{ x: 3, period: 5, on: 3, phase: 0 }, { x: 6, period: 2, on: 1, phase: 1 }, { x: 10, period: 4, on: 2, phase: 2 }], [4, 8]),
      mk("Chegaraviy holat (lazersiz yo'lak)", true, 6, [], [3]),
      mk('Yashirin: ketma-ket ikki lazer', true, 8, [{ x: 2, period: 6, on: 4, phase: 0 }, { x: 3, period: 3, on: 1, phase: 2 }], [5]),
    ],
  };
}

/* ---- 2.1 ---- */
function level21(): LevelSpec {
  const rnd = mulberry32(2101);
  const big = Array.from({ length: 400 }, () => Math.floor(rnd() * 2001) - 1000);
  const cases: [string, boolean, number[]][] = [
    ['Ochiq test: 6 ta sandiq', false, [4, 9, 2, 7, 1, 8]],
    ['Chegaraviy holat: bitta sandiq', true, [5]],
    ['Chegaraviy holat: barcha qiymatlar teng', true, [3, 3, 3, 3]],
    ['Yashirin: manfiy sonlar va takrorlar', true, [-5, -2, -9, -2, -9]],
    ["Yashirin: o'suvchi ketma-ketlik", true, Array.from({ length: 50 }, (_, i) => i + 1)],
    ['Katta test: N = 400', true, big],
  ];
  const tests: SolveTest[] = cases.map(([name, hidden, data]) => {
    let mx = 0;
    let mn = 0;
    data.forEach((v, i) => {
      if (v > data[mx]) mx = i;
      if (v < data[mn]) mn = i;
    });
    const exp = [mx, mn];
    return {
      name,
      hidden,
      args: [data],
      counted: [0],
      budget: 20 * data.length + 80,
      check: valueCheck(exp, hidden, (r) => eqArr(r, exp)),
    };
  });
  return { kind: 'solve', mode: 'ops', tests, track: trackScene(cases[0][2], tests.length, 'Sandiqlardagi shifrlar') };
}

/* ---- 2.2 ---- */
function level22(): LevelSpec {
  const rnd = mulberry32(2202);
  const sortedArr = (n: number) => {
    const out: number[] = [];
    let v = 10;
    for (let i = 0; i < n; i++) {
      v += 2 + Math.floor(rnd() * 8);
      out.push(v);
    }
    return out;
  };
  const a1000 = sortedArr(1000);
  const b1000 = sortedArr(1000);
  const c1024 = sortedArr(1024);
  const vis = [3, 8, 15, 21, 34, 42, 57, 63];
  const cases: [string, boolean, number[], number][] = [
    ['Ochiq test: 8 ta chastota, target = 34', false, vis, 34],
    ['Chegaraviy holat: target birinchi element', true, [2, 5, 9, 14, 20], 2],
    ['Chegaraviy holat: target oxirgi element', true, [2, 5, 9, 14, 20, 27], 27],
    ['Yashirin: target massivda yo\'q', true, [2, 5, 9, 14, 20, 27, 31], 15],
    ['Chegaraviy holat: bitta element, topiladi', true, [7], 7],
    ['Chegaraviy holat: bitta element, topilmaydi', true, [7], 4],
    ['Katta test: N = 1000', true, a1000, a1000[733]],
    ["Katta test: N = 1000, target yo'q", true, b1000, b1000[999] + 5],
    ['Katta test: N = 1024, target boshida', true, c1024, c1024[0]],
  ];
  const tests: SolveTest[] = cases.map(([name, hidden, data, target]) => {
    const exp = data.indexOf(target);
    return {
      name,
      hidden,
      args: [data, target],
      counted: [0],
      budget: 2 * Math.ceil(Math.log2(data.length + 1)) + 2,
      check: valueCheck(exp, hidden, (r) => r === exp),
    };
  });
  return { kind: 'solve', mode: 'reads', tests, track: trackScene(vis, tests.length, 'Saralangan chastotalar, target = 34') };
}

/* ---- 3.1 ---- */
const MAZES: [string, boolean, string[]][] = [
  ['Ochiq labirint', false, ['#########', '#S..#...#', '#.#.#.#.#', '#.#...#.#', '#.###.#.#', '#.....#P#', '#########']],
  [
    'Yashirin: halqali labirint',
    true,
    ['###########', '#S........#', '#.###.###.#', '#.#.....#.#', '#.#.###.#.#', '#...#P#...#', '#.###.###.#', '#.........#', '###########'],
  ],
  ['Chegaraviy holat: portal yonma-yon', true, ['#####', '#SP.#', '#...#', '#####']],
  ["Yashirin: ilonizi yo'lak", true, ['#########', '#S......#', '#######.#', '#.......#', '#.#######', '#......P#', '#########']],
  ['Yashirin: ochiq maydon', true, ['##########', '#S.......#', '#........#', '#........#', '#.......P#', '##########']],
];

function level31(): LevelSpec {
  const tests: SolveTest[] = MAZES.map(([name, hidden, rows]) => {
    const scene = gridScene(rows, [], hidden ? name : '');
    return {
      name,
      hidden,
      args: [rows],
      counted: [],
      budget: 300 * rows.length * rows[0].length,
      scene,
      check: (res, left) => walkPath(scene, res, left, false, 500),
    };
  });
  return { kind: 'solve', mode: 'ops', tests };
}

/* ---- 3.2 ---- */
function adjacency(n: number, edges: [number, number][]): number[][] {
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of edges) {
    if (!adj[a].includes(b)) adj[a].push(b);
    if (!adj[b].includes(a)) adj[b].push(a);
  }
  adj.forEach((l) => l.sort((p, q) => p - q));
  return adj;
}

function bfsDist(adj: number[][], s: number, t: number): number {
  const d = new Array<number>(adj.length).fill(-1);
  d[s] = 0;
  const q = [s];
  for (let h = 0; h < q.length; h++) for (const v of adj[q[h]]) if (d[v] < 0) (d[v] = d[q[h]] + 1), q.push(v);
  return d[t];
}

function circlePos(n: number, cols: number, rows: number): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n - Math.PI;
    return [(cols - 1) / 2 + ((cols - 2) / 2) * Math.cos(a), (rows - 1) / 2 + ((rows - 2) / 2) * Math.sin(a)] as [number, number];
  });
}

function level32(): LevelSpec {
  const tests: SolveTest[] = [];
  const add = (name: string, hidden: boolean, n: number, edges: [number, number][], s: number, t: number, pos?: [number, number][], cols = 13, rows = 9) => {
    const adj = adjacency(n, edges);
    const dist = bfsDist(adj, s, t);
    const scene = graphScene(pos ?? circlePos(n, cols, rows), edges, s, t, cols, rows, hidden ? name : '');
    const e2 = adj.reduce((a, l) => a + l.length, 0);
    tests.push({
      name,
      hidden,
      args: [adj, s, t],
      counted: [],
      budget: 80 * (n + e2) + 300,
      scene,
      check: (res, left) => walkGraph(scene, adj, s, t, dist, res, left),
    });
  };
  add(
    'Ochiq tarmoq: 8 ta tugun',
    false,
    8,
    [[0, 1], [0, 2], [1, 3], [2, 3], [1, 4], [3, 5], [2, 5], [4, 6], [5, 6], [6, 7]],
    0,
    7,
    [[1, 3], [3, 1], [3, 5], [5, 3], [7, 1], [7, 5], [9, 3], [11, 3]],
    13,
    7,
  );
  add('Chegaraviy holat: start = target', true, 4, [[0, 1], [1, 2], [2, 3]], 2, 2);
  add('Yashirin: zanjirsimon tarmoq', true, 6, [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]], 0, 5);
  const ring: [number, number][] = Array.from({ length: 10 }, (_, i) => [i, (i + 1) % 10] as [number, number]);
  add('Yashirin: halqa va qisqa yo\'l', true, 10, [...ring, [0, 5]], 1, 6);
  add("Chegaraviy holat: yo'l mavjud emas", true, 7, [[0, 1], [1, 2], [2, 0], [3, 4], [4, 5], [5, 6]], 0, 6);
  const rnd = mulberry32(3207);
  const big: [number, number][] = Array.from({ length: 39 }, (_, i) => [i, i + 1] as [number, number]);
  for (let i = 0; i < 30; i++) {
    const a = Math.floor(rnd() * 40);
    const b = Math.floor(rnd() * 40);
    if (a !== b) big.push([a, b]);
  }
  add('Katta test: 40 ta tugun', true, 40, big, 0, 39, undefined, 15, 11);
  return { kind: 'solve', mode: 'ops', tests };
}

/* ---- Boss 1 ---- */
function levelBoss1(): LevelSpec {
  const rnd = mulberry32(9101);
  const gen = (n: number) => Array.from({ length: n }, () => Math.floor(rnd() * 1001) - 500);
  const vis = [2, 1, 5, 1, 3, 2];
  const cases: [string, boolean, number[], number][] = [
    ['Ochiq test: 6 ta sensor, k = 3', false, vis, 3],
    ['Chegaraviy holat: k = 1', true, [4, -1, 7, 3], 1],
    ['Chegaraviy holat: k = N', true, [1, 2, 3, 4], 4],
    ['Yashirin: barcha qiymatlar manfiy', true, [-3, -1, -4, -1, -5], 2],
    ['Katta test: N = 3000, k = 1000', true, gen(3000), 1000],
    ['Katta test: N = 5000, k = 2500', true, gen(5000), 2500],
  ];
  const tests: SolveTest[] = cases.map(([name, hidden, data, k]) => {
    let s = 0;
    for (let i = 0; i < k; i++) s += data[i];
    let best = s;
    for (let i = k; i < data.length; i++) {
      s += data[i] - data[i - k];
      if (s > best) best = s;
    }
    return {
      name,
      hidden,
      args: [data, k],
      counted: [0],
      budget: 25 * data.length + 200,
      check: valueCheck(best, hidden, (r) => r === best),
    };
  });
  return { kind: 'solve', mode: 'ops', tests, track: trackScene(vis, tests.length, "Sensor ko'rsatkichlari, k = 3") };
}

/* ---- Boss 2 ---- */
const FORTS: [string, boolean, string[]][] = [
  [
    "Ochiq qal'a: 3 ta yadro",
    false,
    ['###########', '#S..#...K.#', '#.#.#.###.#', '#.#...#...#', '#.###.#.#.#', '#K..#...#P#', '#.#.###.#.#', '#...K.....#', '###########'],
  ],
  ['Yashirin: yadro orqa tomonda', true, ['#########', '#K.S...P#', '#########']],
  ["Chegaraviy holat: yadro yo'q", true, ['#######', '#S#...#', '#.#.#.#', '#...#P#', '#######']],
  [
    'Yashirin: ochiq maydon, 4 ta yadro',
    true,
    ['############', '#S........K#', '#..........#', '#....K.....#', '#..........#', '#K........P#', '#.....K....#', '############'],
  ],
  ["Yashirin: ikki qavatli yo'lak", true, ['#############', '#K....S.K...#', '#.#########.#', '#.....K....P#', '#############']],
];

function optimalRoute(rows: string[]): number {
  const pts: [number, number][] = [];
  let s: [number, number] = [0, 0];
  let p: [number, number] = [0, 0];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === 'S') s = [x, y];
      else if (row[x] === 'P') p = [x, y];
      else if (row[x] === 'K') pts.push([x, y]);
    }
  });
  const all = [s, ...pts, p];
  const W = rows[0].length;
  const dist = all.map(([sx, sy]) => {
    const d = new Array<number>(W * rows.length).fill(-1);
    d[sy * W + sx] = 0;
    const q = [[sx, sy]];
    for (let h = 0; h < q.length; h++) {
      const [x, y] = q[h];
      for (let k = 0; k < 4; k++) {
        const nx = x + DX[k];
        const ny = y + DY[k];
        if (rows[ny][nx] !== '#' && d[ny * W + nx] < 0) {
          d[ny * W + nx] = d[y * W + x] + 1;
          q.push([nx, ny]);
        }
      }
    }
    return all.map(([x, y]) => d[y * W + x]);
  });
  const k = pts.length;
  let best = Infinity;
  const rec = (cur: number, usedMask: number, total: number) => {
    if (usedMask === (1 << k) - 1) {
      best = Math.min(best, total + dist[cur][k + 1]);
      return;
    }
    for (let i = 0; i < k; i++) if (!(usedMask & (1 << i))) rec(i + 1, usedMask | (1 << i), total + dist[cur][i + 1]);
  };
  rec(0, 0, 0);
  return best;
}

function levelBoss2(): LevelSpec {
  const tests: SolveTest[] = FORTS.map(([name, hidden, rows]) => {
    const scene = gridScene(rows, [], hidden ? name : '');
    const opt = optimalRoute(rows);
    return {
      name,
      hidden,
      args: [rows],
      counted: [],
      budget: 60000,
      scene,
      check: (res, left) => walkPath(scene, res, left, true, opt),
    };
  });
  return { kind: 'solve', mode: 'ops', tests };
}

const BUILDERS: Record<string, () => LevelSpec> = {
  'club-1-1': level11,
  'club-1-2': level12,
  'club-2-1': level21,
  'club-2-2': level22,
  'club-3-1': level31,
  'club-3-2': level32,
  'boss-1': levelBoss1,
  'boss-2': levelBoss2,
};

const cache = new Map<string, LevelSpec>();
function spec(id: string): LevelSpec {
  let s = cache.get(id);
  if (!s) {
    const b = BUILDERS[id];
    if (!b) throw new Error(`Noma'lum daraja: ${id}`);
    s = b();
    cache.set(id, s);
  }
  return s;
}

export function previewScene(id: string): Scene {
  const s = spec(id);
  if (s.kind === 'agent') return s.tests[0].scene;
  return s.track ?? s.tests[0].scene!;
}

export function testCount(id: string): number {
  return spec(id).tests.length;
}

/* ------------------------------------------------------------------ */
/* Hakam                                                                */
/* ------------------------------------------------------------------ */

function classify(e: unknown): { v: Verdict; msg: string; line: number } {
  if (e instanceof BudgetError) return { v: 'tle', msg: TLE_MESSAGE, line: 0 };
  if (e instanceof HardLimitError) return { v: 'tle', msg: HARD_MESSAGE, line: 0 };
  if (e instanceof SimError) return { v: 'crash', msg: e.message, line: 0 };
  if (e instanceof StudentError) return { v: 'error', msg: e.message, line: e.line };
  return { v: 'error', msg: e instanceof Error ? `${e.name}: ${e.message}` : String(e), line: 0 };
}

function deadError(meter: Meter): Error | null {
  if (meter.dead === 'hard') return new HardLimitError();
  if (meter.dead === 'budget') return new BudgetError();
  return null;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function judge(id: string, code: string, exec: Executor): JudgeResult {
  const s = spec(id);
  const tests: TestResult[] = [];
  let verdict: Verdict = 'ok';
  let message = '';
  let errorLine = 0;
  let logs: string[] = [];
  let scene: Scene = previewScene(id);
  let frames: Frame[] = [initialFrame(scene)];
  let worstLeft = 1;
  let energyUsed = 0;
  let energyBudget = 1;
  let passed = 0;

  const fullMessage = (name: string, msg: string) => `${name}: ${msg}`;

  if (s.kind === 'agent') {
    for (let i = 0; i < s.tests.length; i++) {
      const t = s.tests[i];
      const meter = new Meter('actions', t.budget);
      const w = new World(t.scene, meter);
      const tl: string[] = [];
      let c = { v: 'ok' as Verdict, msg: '', line: 0 };
      try {
        exec(code, { meter, api: w.api(), globals: clone(t.globals), logs: tl });
      } catch (e) {
        c = classify(w.fatal ?? deadError(meter) ?? e);
      }
      if (c.v === 'ok') {
        const pending = w.fatal ?? deadError(meter);
        if (pending) c = classify(pending);
        else if (!w.atPortal()) c = { v: 'wrong', msg: 'Agent portalga yetib bormadi.', line: 0 };
        else if (!w.allCollected()) c = { v: 'wrong', msg: "Barcha kristallar yig'ilmadi.", line: 0 };
      }
      const lastEvent = w.frames[w.frames.length - 1].event;
      if (c.v === 'ok') w.push('portal');
      else if (lastEvent !== 'crash' && lastEvent !== 'tle' && lastEvent !== 'fail') w.push(c.v === 'tle' ? 'tle' : 'fail', c.v === 'tle' ? 0 : undefined);
      tests.push({ name: t.name, hidden: t.hidden, ok: c.v === 'ok', message: c.msg, used: meter.used, budget: t.budget });
      if (i === 0 || c.v !== 'ok') {
        scene = t.scene;
        frames = w.frames;
        logs = tl;
        energyUsed = meter.used;
        energyBudget = t.budget;
      }
      if (c.v !== 'ok') {
        verdict = c.v;
        message = fullMessage(t.name, c.msg);
        errorLine = c.line;
        break;
      }
      passed++;
      worstLeft = Math.min(worstLeft, w.energy());
    }
  } else {
    let shownFrames: Frame[] | null = null;
    for (let i = 0; i < s.tests.length; i++) {
      const t = s.tests[i];
      const meter = new Meter(s.mode, t.budget);
      const tl: string[] = [];
      let c = { v: 'ok' as Verdict, msg: '', line: 0 };
      let res: unknown;
      try {
        res = exec(code, { meter, api: {}, globals: {}, call: { args: clone(t.args), counted: t.counted }, logs: tl });
        const pending = deadError(meter);
        if (pending) c = classify(pending);
      } catch (e) {
        c = classify(deadError(meter) ?? e);
      }
      const left = Math.max(0, 1 - meter.used / t.budget);
      let fr: Frame[] | undefined;
      if (c.v === 'ok') {
        const chk = t.check(res, left);
        fr = chk.frames;
        if (!chk.ok) c = { v: 'wrong', msg: chk.message, line: 0 };
      } else if (t.scene) fr = stillFrames(t.scene, c.v);
      tests.push({ name: t.name, hidden: t.hidden, ok: c.v === 'ok', message: c.msg, used: Math.min(meter.used, t.budget + 1), budget: t.budget });
      if (i === 0 || c.v !== 'ok') {
        logs = tl;
        energyUsed = meter.used;
        energyBudget = t.budget;
        if (t.scene) {
          scene = t.scene;
          shownFrames = fr ?? stillFrames(t.scene, c.v);
        }
      }
      if (c.v !== 'ok') {
        verdict = c.v;
        message = fullMessage(t.name, c.msg);
        errorLine = c.line;
        break;
      }
      passed++;
      if (left < worstLeft) {
        worstLeft = left;
        if (s.track) {
          energyUsed = meter.used;
          energyBudget = t.budget;
        }
      }
    }
    if (s.track) {
      scene = s.track;
      frames = trackFrames(s.track, passed, s.tests.length, worstLeft, verdict);
    } else if (shownFrames) frames = shownFrames;
  }

  const ok = verdict === 'ok';
  if (ok) message = "Barcha testlardan muvaffaqiyatli o'tdi.";
  return {
    ok,
    verdict,
    message,
    errorLine,
    logs,
    tests,
    totalTests: s.tests.length,
    scene,
    frames,
    energyUsed: Math.min(energyUsed, energyBudget),
    energyBudget,
    efficiency: ok ? Math.round(worstLeft * 100) : 0,
  };
}

export function failResult(id: string, message: string): JudgeResult {
  const scene = previewScene(id);
  return {
    ok: false,
    verdict: 'error',
    message,
    errorLine: 0,
    logs: [],
    tests: [],
    totalTests: testCount(id),
    scene,
    frames: stillFrames(scene, 'error'),
    energyUsed: 0,
    energyBudget: 1,
    efficiency: 0,
  };
}
