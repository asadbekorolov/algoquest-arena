/**
 * Dvigatelni o'z-o'zini tekshirish: har bir daraja uchun etalon yechimlar
 * (Python mini-interpretator va JavaScript) barcha yashirin testlardan o'tishi,
 * boshlang'ich shablonlar va samarasiz yechimlar esa o'tmasligi kerak.
 * Ishga tushirish: npm run selftest
 */
import { LEVELS } from '../src/data/levels';
import { judge } from '../src/engine/judge';
import { runJS } from '../src/engine/jsExec';
import { runMini } from '../src/engine/miniPython';

const PY: Record<string, string> = {
  'club-1-1': `
for i in range(N):
    move_forward()
    move_forward()
    turn_left()
    move_forward()
    turn_right()
`,
  'club-1-2': `
while not at_portal():
    if scan() == "lazer":
        wait()
    else:
        move_forward()
`,
  'club-2-1': `
def solve(data):
    mx = 0
    mn = 0
    for i in range(len(data)):
        v = data[i]
        if v > data[mx]:
            mx = i
        if v < data[mn]:
            mn = i
    return [mx, mn]
`,
  'club-2-2': `
def solve(data, target):
    lo, hi = 0, len(data) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        v = data[mid]
        if v == target:
            return mid
        elif v < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1
`,
  'club-3-1': `
def solve(maze):
    rows, cols = len(maze), len(maze[0])
    for r in range(rows):
        for c in range(cols):
            if maze[r][c] == 'S':
                sr, sc = r, c
    seen = set()
    path = []
    def dfs(r, c):
        if maze[r][c] == 'P':
            return True
        seen.add((r, c))
        for dr, dc, ch in [(-1, 0, 'U'), (1, 0, 'D'), (0, -1, 'L'), (0, 1, 'R')]:
            nr, nc = r + dr, c + dc
            if maze[nr][nc] != '#' and (nr, nc) not in seen:
                path.append(ch)
                if dfs(nr, nc):
                    return True
                path.pop()
        return False
    dfs(sr, sc)
    return ''.join(path)
`,
  'club-3-2': `
from collections import deque

def solve(graph, start, target):
    parent = {start: None}
    q = deque([start])
    while q:
        u = q.popleft()
        if u == target:
            break
        for v in graph[u]:
            if v not in parent:
                parent[v] = u
                q.append(v)
    if target not in parent:
        return []
    path = []
    cur = target
    while cur is not None:
        path.append(cur)
        cur = parent[cur]
    path.reverse()
    return path
`,
  'boss-1': `
def solve(data, k):
    s = 0
    for i in range(k):
        s += data[i]
    best = s
    for i in range(k, len(data)):
        s += data[i] - data[i - k]
        if s > best:
            best = s
    return best
`,
  'boss-2': `
from collections import deque
from itertools import permutations

def bfs(grid, start):
    dist = {start: 0}
    par = {start: None}
    q = deque([start])
    while q:
        r, c = q.popleft()
        for dr, dc, ch in ((-1, 0, 'U'), (1, 0, 'D'), (0, -1, 'L'), (0, 1, 'R')):
            nr, nc = r + dr, c + dc
            if grid[nr][nc] != '#' and (nr, nc) not in dist:
                dist[(nr, nc)] = dist[(r, c)] + 1
                par[(nr, nc)] = (r, c, ch)
                q.append((nr, nc))
    return dist, par

def trace(par, end):
    out = []
    cur = end
    while par[cur] is not None:
        r, c, ch = par[cur]
        out.append(ch)
        cur = (r, c)
    out.reverse()
    return ''.join(out)

def solve(grid):
    keys = []
    for r in range(len(grid)):
        for c in range(len(grid[0])):
            ch = grid[r][c]
            if ch == 'S':
                s = (r, c)
            elif ch == 'P':
                p = (r, c)
            elif ch == 'K':
                keys.append((r, c))
    info = {}
    for pt in [s] + keys:
        info[pt] = bfs(grid, pt)
    best = None
    best_order = None
    for order in permutations(keys):
        total = 0
        cur = s
        for k in order:
            total += info[cur][0][k]
            cur = k
        total += info[cur][0][p]
        if best is None or total < best:
            best = total
            best_order = order
    res = ''
    cur = s
    for k in list(best_order) + [p]:
        res += trace(info[cur][1], k)
        cur = k
    return res
`,
};

const JS: Record<string, string> = {
  'club-1-1': `
for (let i = 0; i < N; i++) {
  move_forward(); move_forward(); turn_left(); move_forward(); turn_right();
}`,
  'club-1-2': `
while (!at_portal()) {
  if (scan() === "lazer") wait();
  else move_forward();
}`,
  'club-2-1': `
function solve(data) {
  let mx = 0, mn = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v > data[mx]) mx = i;
    if (v < data[mn]) mn = i;
  }
  return [mx, mn];
}`,
  'club-2-2': `
function solve(data, target) {
  let lo = 0, hi = data.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = data[mid];
    if (v === target) return mid;
    if (v < target) lo = mid + 1; else hi = mid - 1;
  }
  return -1;
}`,
  'club-3-1': `
function solve(maze) {
  let s;
  for (let r = 0; r < maze.length; r++) for (let c = 0; c < maze[0].length; c++) { if (maze[r][c] === 'S') s = [r, c]; }
  const prev = new Map([[s.join(), null]]);
  const q = [s];
  const D = [[-1, 0, 'U'], [1, 0, 'D'], [0, -1, 'L'], [0, 1, 'R']];
  for (let h = 0; h < q.length; h++) {
    const [r, c] = q[h];
    if (maze[r][c] === 'P') {
      let out = '', key = r + ',' + c;
      while (prev.get(key)) { const [pk, ch] = prev.get(key); out = ch + out; key = pk; }
      return out;
    }
    for (const [dr, dc, ch] of D) {
      const nr = r + dr, nc = c + dc, k = nr + ',' + nc;
      if (maze[nr][nc] !== '#' && !prev.has(k)) { prev.set(k, [r + ',' + c, ch]); q.push([nr, nc]); }
    }
  }
  return '';
}`,
  'club-3-2': `
function solve(graph, start, target) {
  const parent = new Map([[start, null]]);
  const q = [start];
  for (let h = 0; h < q.length; h++) {
    const u = q[h];
    if (u === target) break;
    for (const v of graph[u]) { if (!parent.has(v)) { parent.set(v, u); q.push(v); } }
  }
  if (!parent.has(target)) return [];
  const path = [];
  for (let cur = target; cur !== null; cur = parent.get(cur)) { path.push(cur); }
  return path.reverse();
}`,
  'boss-1': `
function solve(data, k) {
  let s = 0;
  for (let i = 0; i < k; i++) { s += data[i]; }
  let best = s;
  for (let i = k; i < data.length; i++) {
    s += data[i] - data[i - k];
    if (s > best) best = s;
  }
  return best;
}`,
  'boss-2': `
function bfs(grid, start) {
  const dist = new Map([[start.join(), 0]]);
  const par = new Map([[start.join(), null]]);
  const q = [start];
  const D = [[-1, 0, 'U'], [1, 0, 'D'], [0, -1, 'L'], [0, 1, 'R']];
  for (let h = 0; h < q.length; h++) {
    const [r, c] = q[h];
    for (const [dr, dc, ch] of D) {
      const nr = r + dr, nc = c + dc, k = nr + ',' + nc;
      if (grid[nr][nc] !== '#' && !dist.has(k)) { dist.set(k, dist.get(r + ',' + c) + 1); par.set(k, [r + ',' + c, ch]); q.push([nr, nc]); }
    }
  }
  return { dist, par };
}
function solve(grid) {
  let s, p; const keys = [];
  for (let r = 0; r < grid.length; r++) for (let c = 0; c < grid[0].length; c++) {
    const ch = grid[r][c];
    if (ch === 'S') s = [r, c]; else if (ch === 'P') p = [r, c]; else if (ch === 'K') keys.push([r, c]);
  }
  const info = new Map();
  for (const pt of [s, ...keys]) { info.set(pt.join(), bfs(grid, pt)); }
  let best = Infinity, bestOrder = [];
  const rec = (order, used) => {
    if (order.length === keys.length) {
      let total = 0, cur = s;
      for (const k of order) { total += info.get(cur.join()).dist.get(k.join()); cur = k; }
      total += info.get(cur.join()).dist.get(p.join());
      if (total < best) { best = total; bestOrder = order.slice(); }
      return;
    }
    for (let i = 0; i < keys.length; i++) { if (!used[i]) { used[i] = true; order.push(keys[i]); rec(order, used); order.pop(); used[i] = false; } }
  };
  rec([], []);
  let res = '', cur = s;
  for (const k of [...bestOrder, p]) {
    const par = info.get(cur.join()).par;
    let seg = '', key = k.join();
    while (par.get(key)) { const [pk, ch] = par.get(key); seg = ch + seg; key = pk; }
    res += seg; cur = k;
  }
  return res;
}`,
};

/** O'tmasligi kerak bo'lgan yechimlar: [daraja, til, kod, kutilgan hukm] */
const NEGATIVE: [string, 'py' | 'js', string, string][] = [
  ['club-1-1', 'py', 'for i in range(3):\n    move_forward()\n    move_forward()\n    turn_left()\n    move_forward()\n    turn_right()\n', 'wrong'],
  ['club-1-2', 'py', 'while not at_portal():\n    move_forward()\n', 'crash'],
  ['club-2-1', 'py', 'def solve(data):\n    r = [0, 0]\n    for i in range(len(data)):\n        ok = True\n        for j in range(len(data)):\n            if data[j] > data[i]:\n                ok = False\n        if ok:\n            r[0] = i\n            break\n    return r\n', 'wrong'],
  ['club-2-2', 'py', 'def solve(data, target):\n    for i in range(len(data)):\n        if data[i] == target:\n            return i\n    return -1\n', 'tle'],
  ['club-2-2', 'js', 'function solve(data, target) { return data.indexOf(target); }', 'tle'],
  ['club-3-1', 'py', 'def solve(maze):\n    def go(r, c):\n        return go(r, c + 1)\n    return go(1, 1)\n', 'error'],
  ['boss-1', 'py', 'def solve(data, k):\n    return max(sum(data[i:i + k]) for i in range(len(data) - k + 1))\n', 'tle'],
  ['boss-1', 'js', 'function solve(data, k) { let b = -Infinity; for (let i = 0; i + k <= data.length; i++) { b = Math.max(b, data.slice(i, i + k).reduce((a, c) => a + c, 0)); } return b; }', 'tle'],
  ['boss-1', 'py', 'def solve(data, k):\n    while True:\n        pass\n', 'tle'],
  ['boss-2', 'py', 'def solve(grid):\n    return "RRR"\n', 'crash-or-wrong'],
];

let failures = 0;
const check = (label: string, cond: boolean, detail: string) => {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}${cond ? '' : ` -> ${detail}`}`);
  if (!cond) failures++;
};

for (const lv of LEVELS) {
  for (const [lang, table, exec] of [['python', PY, runMini], ['javascript', JS, runJS]] as const) {
    const t0 = performance.now();
    const r = judge(lv.id, table[lv.id], exec);
    const ms = (performance.now() - t0).toFixed(0);
    check(
      `${lv.code} ${lang} etalon (${r.tests.length}/${r.totalTests} test, samaradorlik ${r.efficiency}%, ${ms} ms, ${r.frames.length} kadr)`,
      r.ok,
      r.message,
    );
    const st = judge(lv.id, lv.starter[lang], exec);
    const expectStarterFail = true;
    check(`${lv.code} ${lang} shablon o'tmaydi (${st.verdict})`, !st.ok === expectStarterFail && !/Ichki/.test(st.message), st.message);
  }
}

for (const [id, lang, code, expected] of NEGATIVE) {
  const r = judge(id, code, lang === 'py' ? runMini : runJS);
  const ok = expected === 'crash-or-wrong' ? r.verdict === 'crash' || r.verdict === 'wrong' : r.verdict === expected;
  check(`${id} ${lang} salbiy holat -> ${expected}`, ok, `${r.verdict}: ${r.message}`);
}

console.log(failures === 0 ? '\nBarcha tekshiruvlar muvaffaqiyatli.' : `\n${failures} ta tekshiruv muvaffaqiyatsiz.`);
process.exit(failures === 0 ? 0 : 1);
