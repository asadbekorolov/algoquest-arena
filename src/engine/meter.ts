import type { EnergySource } from '../types';

/** Energiya byudjeti tugadi (TLE). */
export class BudgetError extends Error {
  constructor() {
    super('budget');
    this.name = 'BudgetError';
  }
}

/** Mutlaq amal chegarasi oshdi (odatda cheksiz sikl). */
export class HardLimitError extends Error {
  constructor() {
    super('hard-limit');
    this.name = 'HardLimitError';
  }
}

/** Dunyo simulyatsiyasidagi halokat (devor, lazer). */
export class SimError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SimError';
  }
}

/** O'quvchi kodidagi sintaksis yoki bajarilish xatosi. */
export class StudentError extends Error {
  line: number;
  constructor(message: string, line = 0) {
    super(message);
    this.name = 'StudentError';
    this.line = line;
  }
}

/**
 * Big-O hisoblagichi. Uch xil manba:
 *  - ticks: bajarilgan satrlar / sikl aylanishlari
 *  - reads: nazoratdagi massivdan o'qishlar
 *  - actions: agent harakatlari
 * Daraja qaysi manba energiya sarflashini `mode` orqali tanlaydi.
 */
export class Meter {
  ticks = 0;
  reads = 0;
  actions = 0;
  dead: '' | 'budget' | 'hard' = '';
  mode: EnergySource;
  budget: number;
  hard: number;

  constructor(mode: EnergySource, budget: number, hard = 1_500_000) {
    this.mode = mode;
    this.budget = budget;
    this.hard = hard;
  }

  get used(): number {
    if (this.mode === 'ops') return this.ticks + this.reads;
    if (this.mode === 'reads') return this.reads;
    return this.actions;
  }

  private check(): void {
    if (this.dead === 'hard' || this.ticks + this.reads > this.hard) {
      this.dead = 'hard';
      throw new HardLimitError();
    }
    if (this.dead === 'budget' || this.used > this.budget) {
      this.dead = 'budget';
      throw new BudgetError();
    }
  }

  tick(): void {
    this.ticks++;
    this.check();
  }

  read(n = 1): void {
    this.reads += n;
    this.check();
  }

  act(): void {
    this.actions++;
    this.check();
  }
}

export interface ExecEnv {
  meter: Meter;
  /** O'quvchi kodiga ochiladigan o'yin API funksiyalari */
  api: Record<string, (...args: any[]) => unknown>;
  /** Tayyor global o'zgaruvchilar (masalan N) */
  globals: Record<string, unknown>;
  /** solve(...) chaqiruvi; counted - o'qishlari sanaladigan argument indekslari */
  call?: { args: unknown[]; counted: number[] };
  logs: string[];
}

/** Kodni bajaradi; `call` berilgan bo'lsa solve() natijasini qaytaradi. */
export type Executor = (code: string, env: ExecEnv) => unknown;
