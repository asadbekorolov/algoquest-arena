/// Web Worker: o'quvchi kodi asosiy oqimdan ajratilgan holda shu yerda bajariladi.
import type { EngineName, Lang } from '../types';
import { failResult, judge } from './judge';
import { runJS } from './jsExec';
import type { Executor } from './meter';
import { runMini } from './miniPython';
import { loadPyodideRuntime, pyodideReady, runPyodide } from './pyodideExec';

interface RunMessage {
  type: 'run';
  id: number;
  levelId: string;
  lang: Lang;
  code: string;
}

const ctx = self as unknown as {
  postMessage(message: unknown): void;
  onmessage: ((e: MessageEvent) => void) | null;
};

ctx.onmessage = (e: MessageEvent) => {
  const m = e.data as RunMessage | { type: 'load-pyodide' };
  if (m.type === 'load-pyodide') {
    ctx.postMessage({ type: 'py-status', status: 'loading' });
    loadPyodideRuntime().then(
      () => ctx.postMessage({ type: 'py-status', status: 'ready' }),
      () => ctx.postMessage({ type: 'py-status', status: 'failed' }),
    );
    return;
  }
  if (m.type === 'run') {
    let engine: EngineName;
    let exec: Executor;
    if (m.lang === 'javascript') {
      engine = 'javascript';
      exec = runJS;
    } else if (pyodideReady()) {
      engine = 'pyodide';
      exec = runPyodide;
    } else {
      engine = 'mini-python';
      exec = runMini;
    }
    const t0 = performance.now();
    let result;
    try {
      result = judge(m.levelId, m.code, exec);
    } catch (err) {
      result = failResult(m.levelId, `Ichki xato: ${(err as Error)?.message ?? String(err)}`);
    }
    const timeMs = Math.round((performance.now() - t0) * 10) / 10;
    ctx.postMessage({ type: 'result', id: m.id, result: { ...result, timeMs, engine } });
  }
};
