export type Lang = 'python' | 'javascript';
export type Mode = 'club' | 'boss' | 'leaderboard';
export type EnergySource = 'ops' | 'reads' | 'actions';
export type Verdict = 'ok' | 'wrong' | 'tle' | 'error' | 'crash';
export type FrameEvent = 'crystal' | 'portal' | 'crash' | 'tle' | 'fail';
export type EngineName = 'pyodide' | 'mini-python' | 'javascript';
export type PyStatus = 'idle' | 'loading' | 'ready' | 'failed';

export interface Laser {
  x: number;
  y: number;
  period: number;
  on: number;
  phase: number;
}

export interface SceneLabel {
  x: number;
  y: number;
  text: string;
}

export interface SceneNode {
  x: number;
  y: number;
  label: string;
}

/** Canvas chizadigan dunyo tavsifi. */
export interface Scene {
  kind: 'grid' | 'graph';
  cols: number;
  rows: number;
  /** '#' devor, '.' bo'sh katak */
  tiles: string[];
  start: { x: number; y: number; dir: number };
  portal: { x: number; y: number } | null;
  crystals: { x: number; y: number }[];
  lasers: Laser[];
  labels: SceneLabel[];
  nodes: SceneNode[];
  edges: [number, number][];
  caption: string;
}

/** Animatsiyaning bitta kadri: agent holati va HUD qiymatlari. */
export interface Frame {
  x: number;
  y: number;
  angle: number;
  /** 0..1 qolgan energiya ulushi */
  energy: number;
  steps: number;
  tick: number;
  /** yig'ilgan kristallar bit-maskasi */
  mask: number;
  event?: FrameEvent;
}

export interface TestResult {
  name: string;
  hidden: boolean;
  ok: boolean;
  message: string;
  used: number;
  budget: number;
}

export interface RunResult {
  ok: boolean;
  verdict: Verdict;
  message: string;
  errorLine: number;
  logs: string[];
  tests: TestResult[];
  totalTests: number;
  scene: Scene;
  frames: Frame[];
  timeMs: number;
  energyUsed: number;
  energyBudget: number;
  /** 0..100: eng og'ir testda qolgan energiya foizi */
  efficiency: number;
  engine: EngineName;
}

export interface ApiDoc {
  name: string;
  desc: string;
}

export interface LevelDef {
  id: string;
  mode: 'club' | 'boss';
  code: string;
  module: string;
  title: string;
  story: string;
  task: string;
  api: ApiDoc[];
  input: string;
  output: string;
  complexity: string;
  energyNote: string;
  energyUnit: string;
  bloom: string;
  xp: number;
  starter: Record<Lang, string>;
  hints: string[];
}

export interface LevelRecord {
  bestEfficiency: number;
  bestTimeMs: number;
  xp: number;
  lang: Lang;
  at: number;
}

export interface Progress {
  name: string;
  xp: number;
  completed: Record<string, LevelRecord>;
  badges: string[];
  attempts: number;
}

export interface BadgeDef {
  id: string;
  title: string;
  desc: string;
  requires: string[];
}

export interface MentorMessage {
  text: string;
  source: 'gemini' | 'local' | 'info';
}
