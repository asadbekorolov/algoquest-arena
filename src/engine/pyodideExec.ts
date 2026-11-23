import { BudgetError, HardLimitError, StudentError, type ExecEnv } from './meter';

const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';

/**
 * Python tomonidagi "jabduq": o'quvchi kodini sys.settrace orqali kuzatadi,
 * har bir bajarilgan satrni sanaydi va byudjet tugasa to'xtatadi.
 * SensorList — o'qishlari sanaladigan ro'yxat (kesim, sum, in ham hisobga olinadi).
 */
const HARNESS = `
import sys, json, traceback

class _AqBudget(BaseException):
    pass

class _AqHard(BaseException):
    pass

class _AqState:
    ticks = 0
    reads = 0
    mode = 'ops'
    budget = 0
    hard = 0
    dead = ''

_aq = _AqState()

def _aq_reads(n):
    _aq.reads += n
    if _aq.dead:
        raise _AqBudget()
    if _aq.mode == 'ops':
        if _aq.ticks + _aq.reads > _aq.budget:
            _aq.dead = 'budget'
            raise _AqBudget()
    elif _aq.mode == 'reads':
        if _aq.reads > _aq.budget:
            _aq.dead = 'budget'
            raise _AqBudget()

class SensorList(list):
    def __getitem__(self, i):
        if isinstance(i, slice):
            r = SensorList(list.__getitem__(self, i))
            _aq_reads(len(r))
            return r
        _aq_reads(1)
        return list.__getitem__(self, i)
    def __iter__(self):
        for i in range(len(self)):
            _aq_reads(1)
            yield list.__getitem__(self, i)
    def __reversed__(self):
        for i in range(len(self) - 1, -1, -1):
            _aq_reads(1)
            yield list.__getitem__(self, i)
    def __contains__(self, v):
        _aq_reads(len(self))
        return list.__contains__(self, v)
    def index(self, *a):
        _aq_reads(len(self))
        return list.index(self, *a)
    def count(self, v):
        _aq_reads(len(self))
        return list.count(self, v)
    def copy(self):
        _aq_reads(len(self))
        return SensorList(list.copy(self))

def _aq_trace(frame, event, arg):
    if frame.f_code.co_filename != '<student>':
        return None
    if event == 'line':
        _aq.ticks += 1
        if _aq.dead:
            raise _AqBudget()
        if _aq.ticks + _aq.reads > _aq.hard:
            _aq.dead = 'hard'
            raise _AqHard()
        if _aq.mode == 'ops' and _aq.ticks + _aq.reads > _aq.budget:
            _aq.dead = 'budget'
            raise _AqBudget()
    return _aq_trace

def _aq_default(o):
    try:
        return list(o)
    except TypeError:
        return str(o)

def _aq_run(code, cfg_json, api):
    cfg = json.loads(cfg_json)
    _aq.ticks = 0
    _aq.reads = 0
    _aq.mode = cfg['mode']
    _aq.budget = cfg['budget']
    _aq.hard = cfg['hard']
    _aq.dead = ''
    logs = []
    def _print(*a, sep=' ', end='\\n', **kw):
        if len(logs) < 300:
            logs.append(sep.join(str(x) for x in a))
    g = {'__name__': '__main__', 'print': _print}
    for name in cfg['api']:
        g[name] = getattr(api, name)
    for k, v in cfg['globals'].items():
        g[k] = v
    out = {'status': 'ok', 'result': None}
    try:
        co = compile(code, '<student>', 'exec')
        sys.settrace(_aq_trace)
        try:
            exec(co, g)
            if cfg['call'] is not None:
                fn = g.get('solve')
                if not callable(fn):
                    raise NameError('solve() funksiyasi topilmadi')
                args = [SensorList(a) if i in cfg['counted'] else a for i, a in enumerate(cfg['call'])]
                res = fn(*args)
                sys.settrace(None)
                out['result'] = json.loads(json.dumps(res, default=_aq_default, allow_nan=False))
        finally:
            sys.settrace(None)
    except _AqBudget:
        out['status'] = 'budget'
    except _AqHard:
        out['status'] = 'hard'
    except SyntaxError as e:
        out = {'status': 'error', 'message': type(e).__name__ + ': ' + str(e.msg), 'line': e.lineno or 0}
    except RecursionError:
        out = {'status': 'error', 'message': "RecursionError: rekursiya chuqurligi chegaradan oshdi (to'xtash sharti bormi?)", 'line': 0}
    except BaseException as e:
        line = 0
        for fs in traceback.extract_tb(e.__traceback__):
            if fs.filename == '<student>':
                line = fs.lineno
        out = {'status': 'error', 'message': type(e).__name__ + ': ' + str(e), 'line': line}
    if _aq.dead:
        out['status'] = 'hard' if _aq.dead == 'hard' else 'budget'
    out['ticks'] = _aq.ticks
    out['reads'] = _aq.reads
    out['logs'] = logs
    return json.dumps(out)
`;

type RunFn = (code: string, cfg: string, api: unknown) => string;
let runFn: RunFn | null = null;
let loading: Promise<void> | null = null;

/** Pyodide ni CDN dan yuklaydi (faqat bir marta). */
export function loadPyodideRuntime(): Promise<void> {
  if (!loading) {
    loading = (async () => {
      const mod = await import(/* @vite-ignore */ `${PYODIDE_URL}pyodide.mjs`);
      const py = await mod.loadPyodide({ indexURL: PYODIDE_URL });
      py.runPython(HARNESS);
      runFn = py.globals.get('_aq_run') as RunFn;
    })();
  }
  return loading;
}

export function pyodideReady(): boolean {
  return runFn !== null;
}

/** Haqiqiy CPython (Pyodide) orqali bajarish (Executor shartnomasi). */
export function runPyodide(code: string, env: ExecEnv): unknown {
  if (!runFn) throw new StudentError('Pyodide hali yuklanmagan.');
  const { meter } = env;
  const cfg = {
    mode: meter.mode,
    budget: meter.budget,
    hard: meter.hard,
    api: Object.keys(env.api),
    globals: env.globals,
    call: env.call ? env.call.args : null,
    counted: env.call?.counted ?? [],
  };
  const out = JSON.parse(runFn(code, JSON.stringify(cfg), env.api)) as {
    status: string;
    result: unknown;
    message?: string;
    line?: number;
    ticks: number;
    reads: number;
    logs: string[];
  };
  meter.ticks = out.ticks;
  meter.reads = out.reads;
  for (const l of out.logs) if (env.logs.length < 300) env.logs.push(l);
  if (out.status === 'budget') {
    meter.dead = 'budget';
    throw new BudgetError();
  }
  if (out.status === 'hard') {
    meter.dead = 'hard';
    throw new HardLimitError();
  }
  if (out.status === 'error') throw new StudentError(out.message ?? 'Xato', out.line ?? 0);
  return out.result;
}
