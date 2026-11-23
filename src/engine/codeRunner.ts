/**
 * Ikki tilli (Python + JavaScript) brauzer ichidagi kod ijrochisi.
 *
 *  - JavaScript: Web Worker ichida, cheklangan global muhitda bajariladi.
 *  - Python: Pyodide (CDN) tayyor bo'lsa haqiqiy CPython, aks holda
 *    ichki mini-Python interpretatori — shu sababli oflayn ham ishlaydi.
 *
 * Har bir bajarilish Big-O hisoblagichi (Meter) nazoratida o'tadi.
 */
import type { Lang, PyStatus, RunResult } from '../types';
import { failResult } from './judge';

const RUN_TIMEOUT_MS = 12000;

let worker: Worker | null = null;
let nextId = 1;
let pyStatus: PyStatus = 'idle';
const listeners = new Set<(s: PyStatus) => void>();
const pending = new Map<number, { resolve: (r: RunResult) => void; timer: number; levelId: string; lang: Lang }>();

function setStatus(s: PyStatus): void {
  pyStatus = s;
  listeners.forEach((l) => l(s));
}

function ensureWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL('./runner.worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent) => {
    const m = e.data as { type: string; status?: PyStatus; id?: number; result?: RunResult };
    if (m.type === 'py-status' && m.status) setStatus(m.status);
    else if (m.type === 'result' && m.id !== undefined && m.result) {
      const p = pending.get(m.id);
      if (p) {
        window.clearTimeout(p.timer);
        pending.delete(m.id);
        p.resolve(m.result);
      }
    }
  };
  w.onerror = () => {
    for (const [id, p] of pending) {
      window.clearTimeout(p.timer);
      p.resolve(localFail(p.levelId, p.lang, 'Ijrochi kutilmaganda to\'xtadi. Qayta urinib ko\'ring.'));
      pending.delete(id);
    }
    restart();
  };
  worker = w;
  w.postMessage({ type: 'load-pyodide' });
  return w;
}

function restart(): void {
  worker?.terminate();
  worker = null;
  setStatus('idle');
  ensureWorker();
}

function localFail(levelId: string, lang: Lang, message: string): RunResult {
  return { ...failResult(levelId, message), verdict: 'tle', timeMs: RUN_TIMEOUT_MS, engine: lang === 'javascript' ? 'javascript' : 'mini-python' };
}

/** Ijrochini oldindan ishga tushiradi va Pyodide yuklanishini boshlaydi. */
export function warmUp(): void {
  ensureWorker();
}

export function getPyStatus(): PyStatus {
  return pyStatus;
}

export function subscribePyStatus(cb: (s: PyStatus) => void): () => void {
  listeners.add(cb);
  cb(pyStatus);
  return () => {
    listeners.delete(cb);
  };
}

/** O'quvchi kodini berilgan daraja testlarida bajaradi. */
export function runCode(levelId: string, lang: Lang, code: string): Promise<RunResult> {
  const w = ensureWorker();
  const id = nextId++;
  return new Promise<RunResult>((resolve) => {
    const timer = window.setTimeout(() => {
      pending.delete(id);
      resolve(
        localFail(
          levelId,
          lang,
          "Energiya tugadi (TLE): Algoritm samaradorligi past! Dastur belgilangan vaqtda tugamadi — cheksiz sikl bo'lishi mumkin.",
        ),
      );
      restart();
    }, RUN_TIMEOUT_MS);
    pending.set(id, { resolve, timer, levelId, lang });
    w.postMessage({ type: 'run', id, levelId, lang, code });
  });
}
