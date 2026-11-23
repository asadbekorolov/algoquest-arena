import { BudgetError, HardLimitError, SimError, StudentError, type ExecEnv, type Meter } from './meter';

const isIdChar = (c: string) => /[A-Za-z0-9_$]/.test(c);

function stringEnd(src: string, i: number): number {
  const q = src[i];
  let j = i + 1;
  while (j < src.length) {
    if (src[j] === '\\') j += 2;
    else if (src[j] === q) return j + 1;
    else if (src[j] === '\n' && q !== '`') return j;
    else j++;
  }
  return src.length;
}

function matchParen(src: string, open: number): number {
  let depth = 0;
  let j = open;
  while (j < src.length) {
    const c = src[j];
    if (c === '"' || c === "'" || c === '`') {
      j = stringEnd(src, j);
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return j;
    }
    j++;
  }
  return -1;
}

const skipWs = (src: string, j: number) => {
  while (j < src.length && /\s/.test(src[j])) j++;
  return j;
};

/**
 * Sikl va funksiya tanalarining boshiga `__t();` qo'yadi — bu Big-O hisoblagichi.
 * Satr raqamlari o'zgarmaydi (qo'shimcha kod o'sha satrning o'zida).
 */
export function instrument(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      const j = src.indexOf('\n', i);
      const e = j < 0 ? n : j;
      out += src.slice(i, e);
      i = e;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const j = src.indexOf('*/', i + 2);
      const e = j < 0 ? n : j + 2;
      out += src.slice(i, e);
      i = e;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const e = stringEnd(src, i);
      out += src.slice(i, e);
      i = e;
      continue;
    }
    if (c === '=' && src[i + 1] === '>') {
      const j = skipWs(src, i + 2);
      if (src[j] === '{') {
        out += `${src.slice(i, j + 1)}__t();`;
        i = j + 1;
      } else {
        out += '=>';
        i += 2;
      }
      continue;
    }
    if (/[A-Za-z_$]/.test(c) && (i === 0 || !isIdChar(src[i - 1]))) {
      let j = i;
      while (j < n && isIdChar(src[j])) j++;
      const word = src.slice(i, j);
      let p = i - 1;
      while (p >= 0 && (src[p] === ' ' || src[p] === '\t')) p--;
      const afterDot = p >= 0 && src[p] === '.';
      if (!afterDot && word === 'do') {
        const k = skipWs(src, j);
        if (src[k] === '{') {
          out += `${src.slice(i, k + 1)}__t();`;
          i = k + 1;
          continue;
        }
      } else if (!afterDot && (word === 'for' || word === 'while' || word === 'function')) {
        let k = skipWs(src, j);
        if (word === 'function') {
          if (src[k] === '*') k = skipWs(src, k + 1);
          while (k < n && isIdChar(src[k])) k++;
          k = skipWs(src, k);
        }
        if (src[k] === '(') {
          const close = matchParen(src, k);
          if (close > 0) {
            const b = skipWs(src, close + 1);
            if (src[b] === '{') {
              out += `${src.slice(i, b + 1)}__t();`;
              i = b + 1;
              continue;
            }
          }
        }
      }
      out += word;
      i = j;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function countedProxy(arr: unknown[], meter: Meter): unknown[] {
  return new Proxy(arr, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && prop.length > 0) {
        const ch = prop.charCodeAt(0);
        if (ch >= 48 && ch <= 57) meter.read(1);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

function showValue(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v === undefined) return 'undefined';
  try {
    return JSON.stringify(v instanceof Map ? [...v.entries()] : v instanceof Set ? [...v] : v) ?? String(v);
  } catch {
    return String(v);
  }
}

function plain(v: unknown, depth = 0): unknown {
  if (v === undefined || v === null) return null;
  if (depth > 6) return null;
  if (Array.isArray(v)) return Array.from(v, (x) => plain(x, depth + 1));
  if (v instanceof Set) return Array.from(v, (x) => plain(x, depth + 1));
  if (v instanceof Map) return Array.from(v.entries(), (x) => plain(x, depth + 1));
  if (typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as object)) o[k] = plain(x, depth + 1);
    return o;
  }
  if (typeof v === 'function' || typeof v === 'symbol' || typeof v === 'bigint') return String(v);
  return v;
}

function lineFromStack(e: unknown, code: string): number {
  const stack = String((e as { stack?: string })?.stack ?? '');
  const m = /<anonymous>:(\d+):\d+/.exec(stack);
  if (!m) return 0;
  const line = Number(m[1]) - 3;
  return line >= 1 && line <= code.split('\n').length ? line : 0;
}

const SHADOWED = [
  'self', 'globalThis', 'window', 'document', 'fetch', 'XMLHttpRequest', 'WebSocket', 'importScripts',
  'postMessage', 'indexedDB', 'caches', 'navigator', 'Worker', 'localStorage', 'setTimeout', 'setInterval',
];

/** O'quvchining JavaScript kodini cheklangan muhitda bajaradi. */
export function runJS(code: string, env: ExecEnv): unknown {
  const { meter, logs } = env;
  const names: string[] = [];
  const values: unknown[] = [];
  const add = (name: string, value: unknown) => {
    if (names.includes(name)) return;
    names.push(name);
    values.push(value);
  };
  for (const [k, f] of Object.entries(env.api)) {
    add(k, f);
    add(k.replace(/_([a-z])/g, (_m, ch: string) => ch.toUpperCase()), f);
  }
  for (const [k, v] of Object.entries(env.globals)) add(k, v);
  add('__t', () => meter.tick());
  const log = (...a: unknown[]) => {
    if (logs.length < 300) logs.push(a.map(showValue).join(' '));
  };
  add('console', { log, info: log, warn: log, error: log });
  for (const s of SHADOWED) add(s, undefined);

  let fn: (...a: unknown[]) => unknown;
  try {
    fn = new Function(
      ...names,
      `"use strict";\n${instrument(code)}\n;return typeof solve === "function" ? solve : undefined;`,
    ) as (...a: unknown[]) => unknown;
  } catch (e) {
    throw new StudentError(`SyntaxError: ${(e as Error).message}`);
  }

  try {
    const solve = fn(...values);
    if (!env.call) return undefined;
    if (typeof solve !== 'function') throw new StudentError('solve() funksiyasi topilmadi.');
    const counted = env.call.counted;
    const args = env.call.args.map((a, i) => (counted.includes(i) && Array.isArray(a) ? countedProxy(a, meter) : a));
    return plain((solve as (...a: unknown[]) => unknown)(...args));
  } catch (e) {
    if (e instanceof BudgetError || e instanceof HardLimitError || e instanceof SimError || e instanceof StudentError) throw e;
    if (e instanceof RangeError && /call stack/i.test(e.message))
      throw new StudentError("RangeError: rekursiya juda chuqur (to'xtash sharti bormi?)");
    const err = e as Error;
    throw new StudentError(`${err?.name ?? 'Error'}: ${err?.message ?? String(e)}`, lineFromStack(e, code));
  }
}
