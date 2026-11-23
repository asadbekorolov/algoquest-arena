/**
 * Mini-Python: Pyodide yuklanmagan yoki internet yo'q paytda ishlaydigan
 * ixcham Python interpretatori. To'garak va olimpiada masalalari uchun
 * yetarli bo'lgan til qismini qo'llab-quvvatlaydi: o'zgaruvchilar, if/elif/else,
 * for/while, funksiyalar va rekursiya, list/tuple/dict/set, deque, kesimlar,
 * list comprehension, lambda, f-satrlar va asosiy ichki funksiyalar.
 */
import { BudgetError, HardLimitError, SimError, StudentError, type ExecEnv, type Meter } from './meter';

/* eslint-disable @typescript-eslint/no-explicit-any */

export class PyError extends Error {
  kind: string;
  line: number;
  constructor(kind: string, message: string, line = 0) {
    super(message);
    this.kind = kind;
    this.line = line;
  }
}

/* ------------------------------------------------------------------ */
/* Leksik tahlil                                                        */
/* ------------------------------------------------------------------ */

interface Tok {
  t: 'name' | 'kw' | 'num' | 'str' | 'fstr' | 'op' | 'nl' | 'indent' | 'dedent' | 'eof';
  v: string;
  line: number;
}

const KEYWORDS = new Set([
  'def', 'return', 'if', 'elif', 'else', 'while', 'for', 'in', 'not', 'and', 'or', 'break', 'continue', 'pass',
  'True', 'False', 'None', 'import', 'from', 'as', 'global', 'nonlocal', 'lambda', 'is', 'del', 'try', 'except',
  'finally', 'class', 'with', 'raise', 'assert', 'yield',
]);
const OPS3 = ['**=', '//=', '>>=', '<<='];
const OPS2 = ['**', '//', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '->', '<<', '>>', '|=', '&=', '^='];
const OPS1 = '+-*/%<>=()[]{},:.;&|^~';
const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', '0': '\0', '\\': '\\', "'": "'", '"': '"' };

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  const indents = [0];
  const n = src.length;
  let i = 0;
  let line = 1;
  let depth = 0;
  let atLineStart = true;

  while (i < n) {
    if (atLineStart && depth === 0) {
      let col = 0;
      let j = i;
      while (j < n && (src[j] === ' ' || src[j] === '\t')) {
        col += src[j] === '\t' ? 4 : 1;
        j++;
      }
      if (j >= n) break;
      if (src[j] === '\r') {
        i = j + 1;
        continue;
      }
      if (src[j] === '\n') {
        i = j + 1;
        line++;
        continue;
      }
      if (src[j] === '#') {
        while (j < n && src[j] !== '\n') j++;
        i = j;
        continue;
      }
      i = j;
      if (col > indents[indents.length - 1]) {
        indents.push(col);
        toks.push({ t: 'indent', v: '', line });
      } else {
        while (col < indents[indents.length - 1]) {
          indents.pop();
          toks.push({ t: 'dedent', v: '', line });
        }
        if (col !== indents[indents.length - 1]) throw new PyError('IndentationError', 'chekinish (indent) darajasi mos kelmadi', line);
      }
      atLineStart = false;
    }
    const c = src[i];
    if (c === '\n') {
      if (depth === 0) {
        toks.push({ t: 'nl', v: '', line });
        atLineStart = true;
      }
      line++;
      i++;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\r') {
      i++;
      continue;
    }
    if (c === '#') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '\\' && (src[i + 1] === '\n' || (src[i + 1] === '\r' && src[i + 2] === '\n'))) {
      i += src[i + 1] === '\r' ? 3 : 2;
      line++;
      continue;
    }
    const sm = /^([rRbBfF]{0,2})('''|"""|'|")/.exec(src.slice(i, i + 5));
    if (sm) {
      const prefix = sm[1].toLowerCase();
      const q = sm[2];
      const raw = prefix.includes('r');
      const startLine = line;
      let j = i + sm[0].length;
      let s = '';
      for (;;) {
        if (j >= n) throw new PyError('SyntaxError', 'satr (string) yopilmagan', startLine);
        if (src.startsWith(q, j)) {
          j += q.length;
          break;
        }
        const ch = src[j];
        if (ch === '\\' && !raw) {
          const nx = src[j + 1];
          if (nx === '\n') line++;
          else s += ESCAPES[nx] ?? `\\${nx}`;
          j += 2;
          continue;
        }
        if (ch === '\n') {
          if (q.length === 1) throw new PyError('SyntaxError', 'satr (string) yopilmagan', startLine);
          line++;
        }
        s += ch;
        j++;
      }
      toks.push({ t: prefix.includes('f') ? 'fstr' : 'str', v: s, line: startLine });
      i = j;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = /^(\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)/.exec(src.slice(i, i + 40));
      const text = m ? m[0] : c;
      toks.push({ t: 'num', v: text.replace(/_/g, ''), line });
      i += text.length;
      continue;
    }
    if (/[A-Za-z_\u0080-￿]/.test(c)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_\u0080-￿]/.test(src[j])) j++;
      const word = src.slice(i, j);
      toks.push({ t: KEYWORDS.has(word) ? 'kw' : 'name', v: word, line });
      i = j;
      continue;
    }
    const three = src.slice(i, i + 3);
    const two = src.slice(i, i + 2);
    let op = '';
    if (OPS3.includes(three)) op = three;
    else if (OPS2.includes(two)) op = two;
    else if (OPS1.includes(c)) op = c;
    else throw new PyError('SyntaxError', `kutilmagan belgi '${c}'`, line);
    if (op === '(' || op === '[' || op === '{') depth++;
    else if (op === ')' || op === ']' || op === '}') depth = Math.max(0, depth - 1);
    toks.push({ t: 'op', v: op, line });
    i += op.length;
  }
  if (toks.length && toks[toks.length - 1].t !== 'nl') toks.push({ t: 'nl', v: '', line });
  while (indents.length > 1) {
    indents.pop();
    toks.push({ t: 'dedent', v: '', line });
  }
  toks.push({ t: 'eof', v: '', line });
  return toks;
}

/* ------------------------------------------------------------------ */
/* Sintaktik tahlil                                                     */
/* ------------------------------------------------------------------ */

const BIN_LEVELS = [['|'], ['^'], ['&'], ['<<', '>>'], ['+', '-'], ['*', '/', '//', '%']];
const AUG_OPS = ['+=', '-=', '*=', '/=', '//=', '%=', '**=', '|=', '&=', '^=', '>>=', '<<='];
const CMP_OPS = ['==', '!=', '<', '>', '<=', '>='];
const UNSUPPORTED = new Set(['try', 'except', 'finally', 'class', 'with', 'raise', 'assert', 'yield']);

class Parser {
  private p = 0;
  private toks: Tok[];
  constructor(toks: Tok[]) {
    this.toks = toks;
  }

  private peek(): Tok {
    return this.toks[this.p];
  }
  private isOp(v: string): boolean {
    const t = this.peek();
    return t.t === 'op' && t.v === v;
  }
  private isKw(v: string): boolean {
    const t = this.peek();
    return t.t === 'kw' && t.v === v;
  }
  private eatOp(v: string): boolean {
    if (this.isOp(v)) {
      this.p++;
      return true;
    }
    return false;
  }
  private eatKw(v: string): boolean {
    if (this.isKw(v)) {
      this.p++;
      return true;
    }
    return false;
  }
  private err(msg: string): never {
    throw new PyError('SyntaxError', msg, this.peek().line);
  }
  private expectOp(v: string): void {
    if (!this.eatOp(v)) {
      const t = this.peek();
      this.err(`'${v}' kutilgan edi${t.v ? `, '${t.v}' uchradi` : ''}`);
    }
  }
  private expectName(): string {
    const t = this.peek();
    if (t.t !== 'name') this.err('nom (identifikator) kutilgan edi');
    this.p++;
    return t.v;
  }

  parseProgram(): any[] {
    const out: any[] = [];
    while (this.peek().t !== 'eof') {
      if (this.peek().t === 'nl' || this.peek().t === 'dedent') {
        this.p++;
        continue;
      }
      out.push(...this.parseStmt());
    }
    return out;
  }

  private parseStmt(): any[] {
    const t = this.peek();
    if (t.t === 'indent') throw new PyError('IndentationError', "kutilmagan chekinish (ortiqcha bo'sh joy)", t.line);
    if (t.t === 'kw') {
      if (t.v === 'if') return [this.parseIf()];
      if (t.v === 'while') {
        this.p++;
        const test = this.parseExpr();
        return [{ k: 'while', test, body: this.parseBlock(), line: t.line }];
      }
      if (t.v === 'for') {
        this.p++;
        const target = this.parseTargets();
        if (!this.eatKw('in')) this.err("for siklida 'in' kutilgan edi");
        const iter = this.parseExprList();
        const body = this.parseBlock();
        let orelse: any[] | null = null;
        if (this.eatKw('else')) orelse = this.parseBlock();
        return [{ k: 'for', target, iter, body, orelse, line: t.line }];
      }
      if (t.v === 'def') {
        this.p++;
        const name = this.expectName();
        this.expectOp('(');
        const { params, defaults } = this.parseParams(')');
        this.expectOp(')');
        if (this.eatOp('->')) this.parseExpr();
        return [{ k: 'def', name, params, defaults, body: this.parseBlock(), line: t.line }];
      }
      if (UNSUPPORTED.has(t.v))
        this.err(`'${t.v}' konstruksiyasi ichki interpretatorda qo'llab-quvvatlanmaydi (Pyodide yuklangach ishlaydi)`);
      if (t.v === 'elif' || t.v === 'else') this.err(`'${t.v}' dan oldin mos 'if' topilmadi`);
    }
    return this.parseSimpleLine();
  }

  private parseIf(): any {
    const line = this.peek().line;
    this.p++;
    const test = this.parseExpr();
    const body = this.parseBlock();
    let orelse: any[] | null = null;
    if (this.isKw('elif')) orelse = [this.parseIf()];
    else if (this.eatKw('else')) orelse = this.parseBlock();
    return { k: 'if', test, body, orelse, line };
  }

  private parseParams(end: string): { params: string[]; defaults: any[] } {
    const params: string[] = [];
    const defaults: any[] = [];
    while (!this.isOp(end)) {
      if (this.isOp('*') || this.isOp('**')) this.err("*args / **kwargs ichki interpretatorda qo'llab-quvvatlanmaydi");
      params.push(this.expectName());
      if (end === ')' && this.eatOp(':')) this.parseExpr();
      defaults.push(this.eatOp('=') ? this.parseExpr() : null);
      if (!this.eatOp(',')) break;
    }
    return { params, defaults };
  }

  private parseBlock(): any[] {
    this.expectOp(':');
    if (this.peek().t === 'nl') {
      this.p++;
      if (this.peek().t !== 'indent')
        throw new PyError('IndentationError', "blok ichida chekinish (4 ta bo'sh joy) bilan yozilgan kod kutilgan", this.peek().line);
      this.p++;
      const out: any[] = [];
      while (this.peek().t !== 'dedent' && this.peek().t !== 'eof') {
        if (this.peek().t === 'nl') {
          this.p++;
          continue;
        }
        out.push(...this.parseStmt());
      }
      if (this.peek().t === 'dedent') this.p++;
      return out;
    }
    return this.parseSimpleLine();
  }

  private atEnd(): boolean {
    const t = this.peek();
    return t.t === 'nl' || t.t === 'eof' || t.t === 'dedent' || (t.t === 'op' && t.v === ';');
  }

  private parseSimpleLine(): any[] {
    const out = [this.parseSimple()];
    while (this.eatOp(';')) {
      if (this.atEnd()) break;
      out.push(this.parseSimple());
    }
    const t = this.peek();
    if (t.t === 'nl') this.p++;
    else if (t.t !== 'eof' && t.t !== 'dedent') this.err(`kutilmagan '${t.v}'`);
    return out;
  }

  private parseSimple(): any {
    const t = this.peek();
    const line = t.line;
    if (t.t === 'kw') {
      switch (t.v) {
        case 'pass':
          this.p++;
          return { k: 'pass', line };
        case 'break':
          this.p++;
          return { k: 'break', line };
        case 'continue':
          this.p++;
          return { k: 'continue', line };
        case 'return': {
          this.p++;
          return { k: 'return', v: this.atEnd() ? null : this.parseExprList(), line };
        }
        case 'global':
        case 'nonlocal': {
          this.p++;
          const names = [this.expectName()];
          while (this.eatOp(',')) names.push(this.expectName());
          return { k: t.v, names, line };
        }
        case 'import': {
          this.p++;
          const mods: { name: string; as: string }[] = [];
          do {
            let name = this.expectName();
            while (this.eatOp('.')) name += `.${this.expectName()}`;
            mods.push({ name, as: this.eatKw('as') ? this.expectName() : name });
          } while (this.eatOp(','));
          return { k: 'import', mods, line };
        }
        case 'from': {
          this.p++;
          let mod = this.expectName();
          while (this.eatOp('.')) mod += `.${this.expectName()}`;
          if (!this.eatKw('import')) this.err("'import' kutilgan edi");
          const names: { name: string; as: string }[] = [];
          if (this.eatOp('*')) names.push({ name: '*', as: '*' });
          else {
            const paren = this.eatOp('(');
            do {
              if (paren && this.isOp(')')) break;
              const name = this.expectName();
              names.push({ name, as: this.eatKw('as') ? this.expectName() : name });
            } while (this.eatOp(','));
            if (paren) this.expectOp(')');
          }
          return { k: 'from', mod, names, line };
        }
        case 'del': {
          this.p++;
          return { k: 'del', target: this.parseExpr(), line };
        }
        default:
          break;
      }
    }
    const first = this.parseExprList();
    if (this.isOp('=')) {
      const parts = [first];
      while (this.eatOp('=')) parts.push(this.parseExprList());
      const value = parts.pop();
      return { k: 'assign', targets: parts, value, line };
    }
    const nt = this.peek();
    if (nt.t === 'op' && AUG_OPS.includes(nt.v)) {
      this.p++;
      return { k: 'aug', op: nt.v.slice(0, -1), target: first, value: this.parseExprList(), line };
    }
    if (nt.t === 'op' && nt.v === ':' && first.k === 'name') {
      // tip izohi: x: int = 5
      this.p++;
      this.parseExpr();
      if (this.eatOp('=')) return { k: 'assign', targets: [first], value: this.parseExprList(), line };
      return { k: 'pass', line };
    }
    return { k: 'expr', e: first, line };
  }

  private exprStart(): boolean {
    const t = this.peek();
    if (t.t === 'name' || t.t === 'num' || t.t === 'str' || t.t === 'fstr') return true;
    if (t.t === 'kw') return ['not', 'lambda', 'True', 'False', 'None'].includes(t.v);
    if (t.t === 'op') return ['(', '[', '{', '-', '+', '~'].includes(t.v);
    return false;
  }

  parseExprList(): any {
    const first = this.parseExpr();
    if (!this.isOp(',')) return first;
    const items = [first];
    const line = this.peek().line;
    while (this.eatOp(',')) {
      if (!this.exprStart()) break;
      items.push(this.parseExpr());
    }
    return { k: 'tuple', items, line };
  }

  private parseTargets(): any {
    const items = [this.parseBin(0)];
    let tuple = false;
    while (this.eatOp(',')) {
      tuple = true;
      if (this.isKw('in')) break;
      items.push(this.parseBin(0));
    }
    return tuple ? { k: 'tuple', items } : items[0];
  }

  parseExpr(): any {
    const line = this.peek().line;
    if (this.eatKw('lambda')) {
      const { params, defaults } = this.parseParams(':');
      this.expectOp(':');
      return { k: 'lambda', params, defaults, body: this.parseExpr(), line };
    }
    const e = this.parseOr();
    if (this.eatKw('if')) {
      const test = this.parseOr();
      if (!this.eatKw('else')) this.err("shartli ifodada 'else' kutilgan edi");
      return { k: 'cond', test, a: e, b: this.parseExpr() };
    }
    return e;
  }

  private parseOr(): any {
    let e = this.parseAnd();
    while (this.eatKw('or')) e = { k: 'or', a: e, b: this.parseAnd() };
    return e;
  }
  private parseAnd(): any {
    let e = this.parseNot();
    while (this.eatKw('and')) e = { k: 'and', a: e, b: this.parseNot() };
    return e;
  }
  private parseNot(): any {
    if (this.eatKw('not')) return { k: 'not', e: this.parseNot() };
    return this.parseCmp();
  }

  private parseCmp(): any {
    const left = this.parseBin(0);
    const ops: string[] = [];
    const rights: any[] = [];
    for (;;) {
      const t = this.peek();
      let op = '';
      if (t.t === 'op' && CMP_OPS.includes(t.v)) {
        op = t.v;
        this.p++;
      } else if (t.t === 'kw' && t.v === 'in') {
        op = 'in';
        this.p++;
      } else if (t.t === 'kw' && t.v === 'not' && this.toks[this.p + 1].t === 'kw' && this.toks[this.p + 1].v === 'in') {
        op = 'not in';
        this.p += 2;
      } else if (t.t === 'kw' && t.v === 'is') {
        this.p++;
        op = this.eatKw('not') ? 'is not' : 'is';
      } else break;
      ops.push(op);
      rights.push(this.parseBin(0));
    }
    return ops.length ? { k: 'cmp', left, ops, rights } : left;
  }

  private parseBin(level: number): any {
    if (level === BIN_LEVELS.length) return this.parseUnary();
    let e = this.parseBin(level + 1);
    for (;;) {
      const t = this.peek();
      if (t.t === 'op' && BIN_LEVELS[level].includes(t.v)) {
        this.p++;
        e = { k: 'bin', op: t.v, a: e, b: this.parseBin(level + 1) };
      } else return e;
    }
  }

  private parseUnary(): any {
    const t = this.peek();
    if (t.t === 'op' && (t.v === '-' || t.v === '+' || t.v === '~')) {
      this.p++;
      return { k: 'unary', op: t.v, e: this.parseUnary() };
    }
    const base = this.parsePostfix();
    if (this.eatOp('**')) return { k: 'bin', op: '**', a: base, b: this.parseUnary() };
    return base;
  }

  private parsePostfix(): any {
    let e = this.parseAtom();
    for (;;) {
      const line = this.peek().line;
      if (this.eatOp('(')) {
        const args: any[] = [];
        const kw: { name: string; e: any }[] = [];
        while (!this.isOp(')')) {
          if (this.eatOp('*')) args.push({ k: 'star', e: this.parseExpr() });
          else if (this.isOp('**')) this.err("**kwargs ichki interpretatorda qo'llab-quvvatlanmaydi");
          else if (this.peek().t === 'name' && this.toks[this.p + 1].t === 'op' && this.toks[this.p + 1].v === '=') {
            const name = this.peek().v;
            this.p += 2;
            kw.push({ name, e: this.parseExpr() });
          } else {
            const a = this.parseExpr();
            if (this.isKw('for')) args.push({ k: 'comp', kind: 'list', elt: a, clauses: this.parseClauses() });
            else args.push(a);
          }
          if (!this.eatOp(',')) break;
        }
        this.expectOp(')');
        e = { k: 'call', f: e, args, kw, line };
      } else if (this.eatOp('[')) {
        let start: any = null;
        let stop: any = null;
        let step: any = null;
        let slice = false;
        if (!this.isOp(':')) start = this.parseExprList();
        if (this.eatOp(':')) {
          slice = true;
          if (!this.isOp(':') && !this.isOp(']')) stop = this.parseExpr();
          if (this.eatOp(':') && !this.isOp(']')) step = this.parseExpr();
        }
        this.expectOp(']');
        e = slice ? { k: 'slice', o: e, start, stop, step } : { k: 'index', o: e, i: start };
      } else if (this.eatOp('.')) {
        e = { k: 'attr', o: e, name: this.expectName() };
      } else return e;
    }
  }

  private parseClauses(): any[] {
    const clauses: any[] = [];
    while (this.eatKw('for')) {
      const target = this.parseTargets();
      if (!this.eatKw('in')) this.err("'in' kutilgan edi");
      const iter = this.parseOr();
      const conds: any[] = [];
      while (this.eatKw('if')) conds.push(this.parseOr());
      clauses.push({ target, iter, conds });
    }
    return clauses;
  }

  private parseAtom(): any {
    const t = this.peek();
    const line = t.line;
    if (t.t === 'name') {
      this.p++;
      return { k: 'name', id: t.v, line };
    }
    if (t.t === 'num') {
      this.p++;
      return { k: 'const', v: Number(t.v) };
    }
    if (t.t === 'str') {
      let s = '';
      while (this.peek().t === 'str') s += this.toks[this.p++].v;
      return { k: 'const', v: s };
    }
    if (t.t === 'fstr') {
      this.p++;
      return { k: 'fstr', parts: parseFString(t.v, line) };
    }
    if (t.t === 'kw') {
      if (t.v === 'True' || t.v === 'False' || t.v === 'None') {
        this.p++;
        return { k: 'const', v: t.v === 'None' ? null : t.v === 'True' };
      }
      this.err(`kutilmagan kalit so'z '${t.v}'`);
    }
    if (t.t === 'op') {
      if (t.v === '(') {
        this.p++;
        if (this.eatOp(')')) return { k: 'tuple', items: [] };
        const first = this.parseExpr();
        if (this.isKw('for')) {
          const c = { k: 'comp', kind: 'list', elt: first, clauses: this.parseClauses() };
          this.expectOp(')');
          return c;
        }
        if (this.isOp(',')) {
          const items = [first];
          while (this.eatOp(',')) {
            if (this.isOp(')')) break;
            items.push(this.parseExpr());
          }
          this.expectOp(')');
          return { k: 'tuple', items };
        }
        this.expectOp(')');
        return first;
      }
      if (t.v === '[') {
        this.p++;
        if (this.eatOp(']')) return { k: 'list', items: [] };
        const first = this.parseExpr();
        if (this.isKw('for')) {
          const c = { k: 'comp', kind: 'list', elt: first, clauses: this.parseClauses() };
          this.expectOp(']');
          return c;
        }
        const items = [first];
        while (this.eatOp(',')) {
          if (this.isOp(']')) break;
          items.push(this.parseExpr());
        }
        this.expectOp(']');
        return { k: 'list', items };
      }
      if (t.v === '{') {
        this.p++;
        if (this.eatOp('}')) return { k: 'dict', items: [] };
        const first = this.parseExpr();
        if (this.eatOp(':')) {
          const value = this.parseExpr();
          if (this.isKw('for')) {
            const c = { k: 'comp', kind: 'dict', key: first, elt: value, clauses: this.parseClauses() };
            this.expectOp('}');
            return c;
          }
          const items: [any, any][] = [[first, value]];
          while (this.eatOp(',')) {
            if (this.isOp('}')) break;
            const key = this.parseExpr();
            this.expectOp(':');
            items.push([key, this.parseExpr()]);
          }
          this.expectOp('}');
          return { k: 'dict', items };
        }
        if (this.isKw('for')) {
          const c = { k: 'comp', kind: 'set', elt: first, clauses: this.parseClauses() };
          this.expectOp('}');
          return c;
        }
        const items = [first];
        while (this.eatOp(',')) {
          if (this.isOp('}')) break;
          items.push(this.parseExpr());
        }
        this.expectOp('}');
        return { k: 'set', items };
      }
    }
    if (t.t === 'nl' || t.t === 'eof' || t.t === 'dedent') this.err('ifoda tugallanmagan');
    this.err(`kutilmagan '${t.v}'`);
  }
}

function parseFString(raw: string, line: number): any[] {
  const parts: any[] = [];
  let buf = '';
  let i = 0;
  while (i < raw.length) {
    const c = raw[i];
    if (c === '{') {
      if (raw[i + 1] === '{') {
        buf += '{';
        i += 2;
        continue;
      }
      let depth = 1;
      let j = i + 1;
      while (j < raw.length && depth > 0) {
        if (raw[j] === '{' || raw[j] === '[' || raw[j] === '(') depth++;
        else if (raw[j] === '}' || raw[j] === ']' || raw[j] === ')') depth--;
        if (depth > 0) j++;
      }
      if (j >= raw.length) throw new PyError('SyntaxError', "f-satrda '}' yopilmagan", line);
      let inner = raw.slice(i + 1, j).replace(/![rsa]$/, '');
      let spec = '';
      const m = /^(.*?):([^:[\]()'"]*)$/.exec(inner);
      if (m) {
        inner = m[1];
        spec = m[2];
      }
      if (buf) parts.push(buf);
      buf = '';
      const toks = tokenize(inner.trim());
      toks.forEach((t) => (t.line = line));
      parts.push({ e: new Parser(toks).parseExprList(), spec });
      i = j + 1;
      continue;
    }
    if (c === '}' && raw[i + 1] === '}') {
      buf += '}';
      i += 2;
      continue;
    }
    buf += c;
    i++;
  }
  if (buf) parts.push(buf);
  return parts;
}

/* ------------------------------------------------------------------ */
/* Qiymatlar                                                            */
/* ------------------------------------------------------------------ */

class PyTuple {
  items: any[];
  constructor(items: any[]) {
    this.items = items;
  }
}

function hashKey(v: any): string {
  if (typeof v === 'number') return `n${v}`;
  if (typeof v === 'boolean') return v ? 'n1' : 'n0';
  if (typeof v === 'string') return `s${v.length}:${v}`;
  if (v === null || v === undefined) return 'N';
  if (v instanceof PyTuple) return `t(${v.items.map(hashKey).join(',')})`;
  throw new PyError('TypeError', `${typeName(v)} turini kalit sifatida ishlatib bo'lmaydi (unhashable)`);
}

class PyDict {
  m = new Map<string, [any, any]>();
  get(k: any): any {
    const e = this.m.get(hashKey(k));
    return e ? e[1] : undefined;
  }
  set(k: any, v: any): void {
    const h = hashKey(k);
    const e = this.m.get(h);
    if (e) e[1] = v;
    else this.m.set(h, [k, v]);
  }
  has(k: any): boolean {
    return this.m.has(hashKey(k));
  }
  delete(k: any): boolean {
    return this.m.delete(hashKey(k));
  }
  get size(): number {
    return this.m.size;
  }
  keys(): any[] {
    return Array.from(this.m.values(), (e) => e[0]);
  }
  values(): any[] {
    return Array.from(this.m.values(), (e) => e[1]);
  }
  items(): any[] {
    return Array.from(this.m.values(), (e) => new PyTuple([e[0], e[1]]));
  }
}

class PySet {
  m = new Map<string, any>();
  add(v: any): void {
    this.m.set(hashKey(v), v);
  }
  has(v: any): boolean {
    return this.m.has(hashKey(v));
  }
  delete(v: any): boolean {
    return this.m.delete(hashKey(v));
  }
  get size(): number {
    return this.m.size;
  }
  values(): any[] {
    return Array.from(this.m.values());
  }
}

class PyRange {
  start: number;
  stop: number;
  step: number;
  constructor(start: number, stop: number, step: number) {
    this.start = start;
    this.stop = stop;
    this.step = step;
  }
  get length(): number {
    return Math.max(0, Math.ceil((this.stop - this.start) / this.step));
  }
  *gen(): Generator<number> {
    if (this.step > 0) for (let i = this.start; i < this.stop; i += this.step) yield i;
    else for (let i = this.start; i > this.stop; i += this.step) yield i;
  }
}

class PyDeque {
  a: any[];
  h = 0;
  constructor(items: any[]) {
    this.a = items;
  }
  get length(): number {
    return this.a.length - this.h;
  }
  items(): any[] {
    return this.a.slice(this.h);
  }
  append(v: any): void {
    this.a.push(v);
  }
  appendleft(v: any): void {
    if (this.h > 0) this.a[--this.h] = v;
    else this.a.unshift(v);
  }
  pop(): any {
    if (this.length === 0) throw new PyError('IndexError', "bo'sh deque dan element olib bo'lmaydi");
    return this.a.pop();
  }
  popleft(): any {
    if (this.length === 0) throw new PyError('IndexError', "bo'sh deque dan element olib bo'lmaydi");
    const v = this.a[this.h++];
    if (this.h > 2048 && this.h * 2 > this.a.length) {
      this.a = this.a.slice(this.h);
      this.h = 0;
    }
    return v;
  }
}

class PyModule {
  name: string;
  attrs: Record<string, any>;
  constructor(name: string, attrs: Record<string, any>) {
    this.name = name;
    this.attrs = attrs;
  }
}

class Scope {
  vars = new Map<string, any>();
  parent: Scope | null;
  globalNames: Set<string> | null = null;
  nonlocalNames: Set<string> | null = null;
  constructor(parent: Scope | null) {
    this.parent = parent;
  }
}

class PyFunc {
  name: string;
  params: string[];
  defaults: any[];
  body: any[];
  closure: Scope;
  constructor(name: string, params: string[], defaults: any[], body: any[], closure: Scope) {
    this.name = name;
    this.params = params;
    this.defaults = defaults;
    this.body = body;
    this.closure = closure;
  }
}

type Kw = Record<string, any>;
type Builtin = (args: any[], kw: Kw) => any;
const NO_KW: Kw = {};
const BREAK = { t: 'b' as const, v: null };
const CONT = { t: 'c' as const, v: null };
type Signal = { t: 'b' | 'c' | 'r'; v: any };

function typeName(v: any): string {
  if (v === null || v === undefined) return 'NoneType';
  if (typeof v === 'boolean') return 'bool';
  if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'float';
  if (typeof v === 'string') return 'str';
  if (Array.isArray(v)) return 'list';
  if (v instanceof PyTuple) return 'tuple';
  if (v instanceof PyDict) return 'dict';
  if (v instanceof PySet) return 'set';
  if (v instanceof PyRange) return 'range';
  if (v instanceof PyDeque) return 'deque';
  if (v instanceof PyFunc || typeof v === 'function') return 'function';
  if (v instanceof PyModule) return 'module';
  return 'object';
}

const isNum = (v: any): boolean => typeof v === 'number' || typeof v === 'boolean';

function truthy(v: any): boolean {
  if (v === null || v === undefined || v === false || v === 0 || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  if (v instanceof PyTuple) return v.items.length > 0;
  if (v instanceof PyDict || v instanceof PySet) return v.size > 0;
  if (v instanceof PyRange || v instanceof PyDeque) return v.length > 0;
  return true;
}

function pyEq(a: any, b: any): boolean {
  if (a === b) return true;
  if (isNum(a) && isNum(b)) return Number(a) === Number(b);
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => pyEq(x, b[i]));
  if (a instanceof PyTuple && b instanceof PyTuple) return pyEq(a.items, b.items);
  if (a instanceof PySet && b instanceof PySet) return a.size === b.size && a.values().every((x) => b.has(x));
  if (a instanceof PyDict && b instanceof PyDict)
    return a.size === b.size && a.keys().every((k) => b.has(k) && pyEq(a.get(k), b.get(k)));
  return false;
}

function pyCmp(a: any, b: any): number {
  if (isNum(a) && isNum(b)) return Number(a) - Number(b);
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  const la = Array.isArray(a) ? a : a instanceof PyTuple ? a.items : null;
  const lb = Array.isArray(b) ? b : b instanceof PyTuple ? b.items : null;
  if (la && lb && Array.isArray(a) === Array.isArray(b)) {
    const n = Math.min(la.length, lb.length);
    for (let i = 0; i < n; i++) {
      if (!pyEq(la[i], lb[i])) return pyCmp(la[i], lb[i]);
    }
    return la.length - lb.length;
  }
  throw new PyError('TypeError', `${typeName(a)} va ${typeName(b)} turlarini taqqoslab bo'lmaydi`);
}

function numStr(v: number): string {
  if (v === Infinity) return 'inf';
  if (v === -Infinity) return '-inf';
  if (Number.isNaN(v)) return 'nan';
  return String(v);
}

function repr(v: any): string {
  if (typeof v === 'string') return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
  return str(v);
}

function str(v: any): string {
  if (v === null || v === undefined) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  if (typeof v === 'number') return numStr(v);
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return `[${v.map(repr).join(', ')}]`;
  if (v instanceof PyTuple) return v.items.length === 1 ? `(${repr(v.items[0])},)` : `(${v.items.map(repr).join(', ')})`;
  if (v instanceof PyDict) return `{${v.items().map((t: PyTuple) => `${repr(t.items[0])}: ${repr(t.items[1])}`).join(', ')}}`;
  if (v instanceof PySet) return v.size ? `{${v.values().map(repr).join(', ')}}` : 'set()';
  if (v instanceof PyRange) return `range(${v.start}, ${v.stop}${v.step !== 1 ? `, ${v.step}` : ''})`;
  if (v instanceof PyDeque) return `deque([${v.items().map(repr).join(', ')}])`;
  if (v instanceof PyFunc) return `<function ${v.name}>`;
  if (v instanceof PyModule) return `<module '${v.name}'>`;
  return '<object>';
}

function format(v: any, spec: string): string {
  if (!spec) return str(v);
  let m = /^(\d*)\.(\d+)f$/.exec(spec);
  if (m && isNum(v)) return Number(v).toFixed(Number(m[2])).padStart(Number(m[1] || 0));
  m = /^(0?)(\d+)d?$/.exec(spec);
  if (m) return str(v).padStart(Number(m[2]), m[1] ? '0' : ' ');
  m = /^([<>^])(\d+)$/.exec(spec);
  if (m) return m[1] === '<' ? str(v).padEnd(Number(m[2])) : str(v).padStart(Number(m[2]));
  return str(v);
}

function sliceIndices(len: number, a: any, b: any, s: any): number[] {
  const step = s === null || s === undefined ? 1 : Number(s);
  if (step === 0) throw new PyError('ValueError', "kesim qadami 0 bo'lishi mumkin emas");
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const norm = (v: any) => (Number(v) < 0 ? Number(v) + len : Number(v));
  const out: number[] = [];
  if (step > 0) {
    const start = a === null || a === undefined ? 0 : clamp(norm(a), 0, len);
    const stop = b === null || b === undefined ? len : clamp(norm(b), 0, len);
    for (let i = start; i < stop; i += step) out.push(i);
  } else {
    const start = a === null || a === undefined ? len - 1 : clamp(norm(a), -1, len - 1);
    const stop = b === null || b === undefined ? -1 : clamp(norm(b), -1, len - 1);
    for (let i = start; i > stop; i += step) out.push(i);
  }
  return out;
}

function toPy(v: any): any {
  if (v === undefined) return null;
  if (Array.isArray(v)) return v.map(toPy);
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    const d = new PyDict();
    for (const [k, x] of Object.entries(v)) d.set(k, toPy(x));
    return d;
  }
  return v;
}

function toJs(v: any, depth = 0): any {
  if (v === undefined || v === null || depth > 8) return null;
  if (Array.isArray(v)) return v.map((x) => toJs(x, depth + 1));
  if (v instanceof PyTuple) return v.items.map((x) => toJs(x, depth + 1));
  if (v instanceof PySet) return v.values().map((x) => toJs(x, depth + 1));
  if (v instanceof PyDeque) return v.items().map((x) => toJs(x, depth + 1));
  if (v instanceof PyRange) return Array.from(v.gen());
  if (v instanceof PyDict) {
    const o: Record<string, any> = {};
    for (const k of v.keys()) o[str(k)] = toJs(v.get(k), depth + 1);
    return o;
  }
  if (v instanceof PyFunc || typeof v === 'function' || v instanceof PyModule) return str(v);
  return v;
}

/* ------------------------------------------------------------------ */
/* Interpretator                                                        */
/* ------------------------------------------------------------------ */

export class MiniPython {
  private globals = new Scope(null);
  private builtins = new Map<string, any>();
  private modules: Record<string, PyModule> = {};
  private counted = new WeakSet<object>();
  private depth = 0;
  private partial = '';
  private meter: Meter;
  private logs: string[];

  constructor(meter: Meter, logs: string[]) {
    this.meter = meter;
    this.logs = logs;
    this.installBuiltins();
  }

  defineHost(name: string, fn: (...a: any[]) => unknown): void {
    this.globals.vars.set(name, ((args: any[]) => toPy(fn(...args.map((a) => toJs(a))))) as Builtin);
  }

  setGlobal(name: string, value: unknown): void {
    this.globals.vars.set(name, toPy(value));
  }

  run(src: string): void {
    const ast = new Parser(tokenize(src)).parseProgram();
    this.execBlock(ast, this.globals);
    this.flush();
  }

  callSolve(args: unknown[], counted: number[]): unknown {
    const fn = this.globals.vars.get('solve');
    if (!(fn instanceof PyFunc)) throw new PyError('NameError', 'solve() funksiyasi topilmadi');
    const pyArgs = args.map((a, i) => {
      const v = toPy(a);
      if (counted.includes(i) && Array.isArray(v)) this.counted.add(v);
      return v;
    });
    const res = this.callFunc(fn, pyArgs, NO_KW);
    this.flush();
    return toJs(res);
  }

  private flush(): void {
    if (this.partial) {
      if (this.logs.length < 300) this.logs.push(this.partial);
      this.partial = '';
    }
  }

  /* ---- nomlar ---- */

  private lookup(name: string, sc: Scope): any {
    for (let s: Scope | null = sc; s; s = s.parent) {
      if (s.vars.has(name)) return s.vars.get(name);
    }
    if (this.builtins.has(name)) return this.builtins.get(name);
    throw new PyError('NameError', `'${name}' nomi aniqlanmagan`);
  }

  private store(name: string, v: any, sc: Scope): void {
    if (sc.globalNames?.has(name)) {
      this.globals.vars.set(name, v);
      return;
    }
    if (sc.nonlocalNames?.has(name)) {
      for (let s = sc.parent; s && s !== this.globals; s = s.parent) {
        if (s.vars.has(name)) {
          s.vars.set(name, v);
          return;
        }
      }
    }
    sc.vars.set(name, v);
  }

  /* ---- operatorlar ---- */

  private exec(s: any, sc: Scope): Signal | undefined {
    this.meter.tick();
    try {
      return this.execInner(s, sc);
    } catch (e) {
      if (e instanceof PyError && !e.line) e.line = s.line;
      throw e;
    }
  }

  private execBlock(stmts: any[], sc: Scope): Signal | undefined {
    for (let i = 0; i < stmts.length; i++) {
      const r = this.exec(stmts[i], sc);
      if (r) return r;
    }
    return undefined;
  }

  private execInner(s: any, sc: Scope): Signal | undefined {
    switch (s.k) {
      case 'expr':
        this.ev(s.e, sc);
        return undefined;
      case 'assign': {
        const v = this.ev(s.value, sc);
        for (const t of s.targets) this.assign(t, v, sc);
        return undefined;
      }
      case 'aug': {
        const cur = this.ev(s.target, sc);
        const rhs = this.ev(s.value, sc);
        if (s.op === '+' && Array.isArray(cur)) {
          for (const x of this.iter(rhs)) cur.push(x);
          return undefined;
        }
        this.assign(s.target, this.binop(s.op, cur, rhs), sc);
        return undefined;
      }
      case 'if':
        if (truthy(this.ev(s.test, sc))) return this.execBlock(s.body, sc);
        if (s.orelse) return this.execBlock(s.orelse, sc);
        return undefined;
      case 'while':
        while (truthy(this.ev(s.test, sc))) {
          this.meter.tick();
          const r = this.execBlock(s.body, sc);
          if (r) {
            if (r === BREAK) break;
            if (r !== CONT) return r;
          }
        }
        return undefined;
      case 'for': {
        let broke = false;
        for (const item of this.iter(this.ev(s.iter, sc))) {
          this.meter.tick();
          this.assign(s.target, item, sc);
          const r = this.execBlock(s.body, sc);
          if (r) {
            if (r === BREAK) {
              broke = true;
              break;
            }
            if (r !== CONT) return r;
          }
        }
        if (!broke && s.orelse) return this.execBlock(s.orelse, sc);
        return undefined;
      }
      case 'def': {
        const defaults = s.defaults.map((d: any) => (d ? this.ev(d, sc) : undefined));
        this.store(s.name, new PyFunc(s.name, s.params, defaults, s.body, sc), sc);
        return undefined;
      }
      case 'return':
        return { t: 'r', v: s.v ? this.ev(s.v, sc) : null };
      case 'break':
        return BREAK;
      case 'continue':
        return CONT;
      case 'pass':
        return undefined;
      case 'global':
        sc.globalNames ??= new Set();
        for (const nm of s.names) sc.globalNames.add(nm);
        return undefined;
      case 'nonlocal':
        sc.nonlocalNames ??= new Set();
        for (const nm of s.names) sc.nonlocalNames.add(nm);
        return undefined;
      case 'import':
        for (const m of s.mods) this.store(m.as, this.module(m.name), sc);
        return undefined;
      case 'from': {
        const mod = this.module(s.mod);
        for (const nm of s.names) {
          if (nm.name === '*') {
            for (const [k, v] of Object.entries(mod.attrs)) this.store(k, v, sc);
          } else {
            if (!(nm.name in mod.attrs)) throw new PyError('ImportError', `'${s.mod}' modulida '${nm.name}' yo'q`);
            this.store(nm.as, mod.attrs[nm.name], sc);
          }
        }
        return undefined;
      }
      case 'del': {
        const t = s.target;
        if (t.k === 'index') {
          const o = this.ev(t.o, sc);
          const i = this.ev(t.i, sc);
          if (Array.isArray(o)) o.splice(this.listIndex(o.length, i), 1);
          else if (o instanceof PyDict) {
            if (!o.delete(i)) throw new PyError('KeyError', repr(i));
          } else throw new PyError('TypeError', `${typeName(o)} dan element o'chirib bo'lmaydi`);
        } else if (t.k === 'name') sc.vars.delete(t.id);
        return undefined;
      }
      default:
        throw new PyError('SyntaxError', "qo'llab-quvvatlanmaydigan operator");
    }
  }

  private assign(t: any, v: any, sc: Scope): void {
    switch (t.k) {
      case 'name':
        this.store(t.id, v, sc);
        return;
      case 'index':
        this.setItem(this.ev(t.o, sc), this.ev(t.i, sc), v);
        return;
      case 'tuple':
      case 'list': {
        const items = Array.from(this.iter(v));
        if (items.length !== t.items.length)
          throw new PyError('ValueError', `ochish (unpack) uchun ${t.items.length} ta qiymat kutilgan, ${items.length} ta berildi`);
        t.items.forEach((x: any, i: number) => this.assign(x, items[i], sc));
        return;
      }
      default:
        throw new PyError('SyntaxError', "bu ifodaga qiymat berib bo'lmaydi");
    }
  }

  /* ---- ifodalar ---- */

  private ev(e: any, sc: Scope): any {
    switch (e.k) {
      case 'const':
        return e.v;
      case 'name':
        return this.lookup(e.id, sc);
      case 'bin':
        return this.binop(e.op, this.ev(e.a, sc), this.ev(e.b, sc));
      case 'unary': {
        const v = this.ev(e.e, sc);
        if (!isNum(v)) throw new PyError('TypeError', `unar '${e.op}' amalini ${typeName(v)} uchun qo'llab bo'lmaydi`);
        return e.op === '-' ? -Number(v) : e.op === '+' ? Number(v) : ~Number(v);
      }
      case 'not':
        return !truthy(this.ev(e.e, sc));
      case 'and': {
        const a = this.ev(e.a, sc);
        return truthy(a) ? this.ev(e.b, sc) : a;
      }
      case 'or': {
        const a = this.ev(e.a, sc);
        return truthy(a) ? a : this.ev(e.b, sc);
      }
      case 'cond':
        return truthy(this.ev(e.test, sc)) ? this.ev(e.a, sc) : this.ev(e.b, sc);
      case 'cmp': {
        let left = this.ev(e.left, sc);
        for (let i = 0; i < e.ops.length; i++) {
          const right = this.ev(e.rights[i], sc);
          if (!this.compare(e.ops[i], left, right)) return false;
          left = right;
        }
        return true;
      }
      case 'list':
        return e.items.map((x: any) => this.ev(x, sc));
      case 'tuple':
        return new PyTuple(e.items.map((x: any) => this.ev(x, sc)));
      case 'dict': {
        const d = new PyDict();
        for (const [k, v] of e.items) d.set(this.ev(k, sc), this.ev(v, sc));
        return d;
      }
      case 'set': {
        const s = new PySet();
        for (const x of e.items) s.add(this.ev(x, sc));
        return s;
      }
      case 'comp':
        return this.comp(e, sc);
      case 'fstr':
        return e.parts.map((p: any) => (typeof p === 'string' ? p : format(this.ev(p.e, sc), p.spec))).join('');
      case 'lambda': {
        const defaults = e.defaults.map((d: any) => (d ? this.ev(d, sc) : undefined));
        return new PyFunc('<lambda>', e.params, defaults, [{ k: 'return', v: e.body, line: e.line }], sc);
      }
      case 'index':
        return this.getItem(this.ev(e.o, sc), this.ev(e.i, sc));
      case 'slice': {
        const o = this.ev(e.o, sc);
        const a = e.start ? this.ev(e.start, sc) : null;
        const b = e.stop ? this.ev(e.stop, sc) : null;
        const st = e.step ? this.ev(e.step, sc) : null;
        return this.slice(o, a, b, st);
      }
      case 'attr':
        return this.getAttr(this.ev(e.o, sc), e.name);
      case 'call': {
        const args: any[] = [];
        for (const a of e.args) {
          if (a.k === 'star') for (const x of this.iter(this.ev(a.e, sc))) args.push(x);
          else args.push(this.ev(a, sc));
        }
        let kw = NO_KW;
        if (e.kw.length) {
          kw = {};
          for (const k of e.kw) kw[k.name] = this.ev(k.e, sc);
        }
        if (e.f.k === 'attr') {
          const o = this.ev(e.f.o, sc);
          if (o instanceof PyModule) {
            if (!(e.f.name in o.attrs)) throw new PyError('AttributeError', `'${o.name}' modulida '${e.f.name}' yo'q`);
            return this.call(o.attrs[e.f.name], args, kw);
          }
          return this.method(o, e.f.name, args, kw);
        }
        return this.call(this.ev(e.f, sc), args, kw);
      }
      default:
        throw new PyError('SyntaxError', "qo'llab-quvvatlanmaydigan ifoda");
    }
  }

  private comp(e: any, sc: Scope): any {
    const inner = new Scope(sc);
    const out: any[] = [];
    const d = e.kind === 'dict' ? new PyDict() : null;
    const s = e.kind === 'set' ? new PySet() : null;
    const rec = (ci: number): void => {
      if (ci === e.clauses.length) {
        if (d) d.set(this.ev(e.key, inner), this.ev(e.elt, inner));
        else if (s) s.add(this.ev(e.elt, inner));
        else out.push(this.ev(e.elt, inner));
        return;
      }
      const c = e.clauses[ci];
      for (const item of this.iter(this.ev(c.iter, inner))) {
        this.meter.tick();
        this.assign(c.target, item, inner);
        if (c.conds.every((x: any) => truthy(this.ev(x, inner)))) rec(ci + 1);
      }
    };
    rec(0);
    return d ?? s ?? out;
  }

  call(f: any, args: any[], kw: Kw): any {
    if (f instanceof PyFunc) return this.callFunc(f, args, kw);
    if (typeof f === 'function') return (f as Builtin)(args, kw);
    throw new PyError('TypeError', `${typeName(f)} turidagi qiymatni funksiya kabi chaqirib bo'lmaydi`);
  }

  private callFunc(fn: PyFunc, args: any[], kw: Kw): any {
    if (++this.depth > 450) {
      this.depth--;
      throw new PyError('RecursionError', "rekursiya chuqurligi chegaradan oshdi (to'xtash sharti bormi?)");
    }
    try {
      const np = fn.params.length;
      if (args.length > np)
        throw new PyError('TypeError', `${fn.name}() ${np} ta argument qabul qiladi, ${args.length} ta berildi`);
      const sc = new Scope(fn.closure);
      for (let i = 0; i < np; i++) {
        const p = fn.params[i];
        if (i < args.length) sc.vars.set(p, args[i]);
        else if (p in kw) sc.vars.set(p, kw[p]);
        else if (fn.defaults[i] !== undefined) sc.vars.set(p, fn.defaults[i]);
        else throw new PyError('TypeError', `${fn.name}() uchun '${p}' argumenti yetishmayapti`);
      }
      const r = this.execBlock(fn.body, sc);
      return r && r.t === 'r' ? r.v : null;
    } finally {
      this.depth--;
    }
  }

  private iter(v: any): Iterable<any> {
    if (Array.isArray(v)) return this.counted.has(v) ? this.countedIter(v) : v;
    if (v instanceof PyRange) return v.gen();
    if (v instanceof PyTuple) return v.items;
    if (typeof v === 'string') return Array.from(v);
    if (v instanceof PyDict) return v.keys();
    if (v instanceof PySet) return v.values();
    if (v instanceof PyDeque) return v.items();
    throw new PyError('TypeError', `${typeName(v)} turidagi qiymat bo'yicha sikl yuritib bo'lmaydi`);
  }

  private *countedIter(a: any[]): Generator<any> {
    for (let i = 0; i < a.length; i++) {
      this.meter.read(1);
      yield a[i];
    }
  }

  private len(v: any): number {
    if (Array.isArray(v) || typeof v === 'string' || v instanceof PyRange || v instanceof PyDeque) return v.length;
    if (v instanceof PyTuple) return v.items.length;
    if (v instanceof PyDict || v instanceof PySet) return v.size;
    throw new PyError('TypeError', `${typeName(v)} turining uzunligi (len) yo'q`);
  }

  private listIndex(len: number, i: any): number {
    if (typeof i === 'boolean') i = Number(i);
    if (typeof i !== 'number' || !Number.isInteger(i))
      throw new PyError('TypeError', `indeks butun son bo'lishi kerak, ${typeName(i)} emas`);
    const j = i < 0 ? i + len : i;
    if (j < 0 || j >= len) throw new PyError('IndexError', `indeks chegaradan tashqarida (indeks ${i}, uzunlik ${len})`);
    return j;
  }

  private getItem(o: any, i: any): any {
    if (Array.isArray(o)) {
      const j = this.listIndex(o.length, i);
      if (this.counted.has(o)) this.meter.read(1);
      return o[j];
    }
    if (typeof o === 'string') return o[this.listIndex(o.length, i)];
    if (o instanceof PyTuple) return o.items[this.listIndex(o.items.length, i)];
    if (o instanceof PyDict) {
      const v = o.get(i);
      if (v === undefined) throw new PyError('KeyError', repr(i));
      return v;
    }
    if (o instanceof PyRange) return o.start + this.listIndex(o.length, i) * o.step;
    if (o instanceof PyDeque) return o.a[o.h + this.listIndex(o.length, i)];
    throw new PyError('TypeError', `${typeName(o)} turidan indeks bo'yicha element olib bo'lmaydi`);
  }

  private setItem(o: any, i: any, v: any): void {
    if (Array.isArray(o)) o[this.listIndex(o.length, i)] = v;
    else if (o instanceof PyDict) o.set(i, v);
    else if (o instanceof PyDeque) o.a[o.h + this.listIndex(o.length, i)] = v;
    else throw new PyError('TypeError', `${typeName(o)} turidagi qiymat elementini o'zgartirib bo'lmaydi`);
  }

  private slice(o: any, a: any, b: any, s: any): any {
    if (Array.isArray(o)) {
      const out = sliceIndices(o.length, a, b, s).map((i) => o[i]);
      if (this.counted.has(o)) {
        this.meter.read(out.length);
        this.counted.add(out);
      }
      return out;
    }
    if (typeof o === 'string') return sliceIndices(o.length, a, b, s).map((i) => o[i]).join('');
    if (o instanceof PyTuple) return new PyTuple(sliceIndices(o.items.length, a, b, s).map((i) => o.items[i]));
    throw new PyError('TypeError', `${typeName(o)} turidan kesim olib bo'lmaydi`);
  }

  private contains(c: any, v: any): boolean {
    if (Array.isArray(c)) {
      if (this.counted.has(c)) this.meter.read(c.length);
      return c.some((x) => pyEq(x, v));
    }
    if (c instanceof PyTuple) return c.items.some((x) => pyEq(x, v));
    if (typeof c === 'string') {
      if (typeof v !== 'string') throw new PyError('TypeError', "satr ichidan faqat satr qidiriladi");
      return c.includes(v);
    }
    if (c instanceof PyDict || c instanceof PySet) return c.has(v);
    if (c instanceof PyRange) {
      if (!isNum(v)) return false;
      const k = (Number(v) - c.start) / c.step;
      return Number.isInteger(k) && k >= 0 && k < c.length;
    }
    if (c instanceof PyDeque) return c.items().some((x) => pyEq(x, v));
    throw new PyError('TypeError', `'in' amalini ${typeName(c)} uchun qo'llab bo'lmaydi`);
  }

  private compare(op: string, a: any, b: any): boolean {
    switch (op) {
      case '==':
        return pyEq(a, b);
      case '!=':
        return !pyEq(a, b);
      case '<':
        return pyCmp(a, b) < 0;
      case '>':
        return pyCmp(a, b) > 0;
      case '<=':
        return pyCmp(a, b) <= 0;
      case '>=':
        return pyCmp(a, b) >= 0;
      case 'in':
        return this.contains(b, a);
      case 'not in':
        return !this.contains(b, a);
      case 'is':
        return a === b || (a == null && b == null);
      default:
        return !(a === b || (a == null && b == null));
    }
  }

  private binop(op: string, a: any, b: any): any {
    const bad = (): never => {
      throw new PyError('TypeError', `'${op}' amalini ${typeName(a)} va ${typeName(b)} uchun qo'llab bo'lmaydi`);
    };
    if (isNum(a) && isNum(b)) {
      const x = Number(a);
      const y = Number(b);
      switch (op) {
        case '+':
          return x + y;
        case '-':
          return x - y;
        case '*':
          return x * y;
        case '/':
          if (y === 0) throw new PyError('ZeroDivisionError', "nolga bo'lish mumkin emas");
          return x / y;
        case '//':
          if (y === 0) throw new PyError('ZeroDivisionError', "nolga bo'lish mumkin emas");
          return Math.floor(x / y);
        case '%':
          if (y === 0) throw new PyError('ZeroDivisionError', "nolga bo'lish mumkin emas");
          return x - Math.floor(x / y) * y;
        case '**':
          return Math.pow(x, y);
        case '&':
          return x & y;
        case '|':
          return x | y;
        case '^':
          return x ^ y;
        case '<<':
          return x * Math.pow(2, y);
        case '>>':
          return Math.floor(x / Math.pow(2, y));
        default:
          return bad();
      }
    }
    if (op === '+') {
      if (typeof a === 'string' && typeof b === 'string') return a + b;
      if (Array.isArray(a) && Array.isArray(b)) return a.concat(b);
      if (a instanceof PyTuple && b instanceof PyTuple) return new PyTuple(a.items.concat(b.items));
      return bad();
    }
    if (op === '*') {
      const [seq, n] = isNum(b) ? [a, Number(b)] : [b, isNum(a) ? Number(a) : NaN];
      if (Number.isNaN(n)) return bad();
      const k = Math.max(0, Math.floor(n));
      if (typeof seq === 'string') return seq.repeat(k);
      const rep = (arr: any[]) => {
        if (arr.length * k > 2_000_000) throw new PyError('MemoryError', "ro'yxat juda katta");
        let out: any[] = [];
        for (let i = 0; i < k; i++) out = out.concat(arr);
        return out;
      };
      if (Array.isArray(seq)) return rep(seq);
      if (seq instanceof PyTuple) return new PyTuple(rep(seq.items));
      return bad();
    }
    if (a instanceof PySet && b instanceof PySet) {
      const out = new PySet();
      if (op === '|') [...a.values(), ...b.values()].forEach((x) => out.add(x));
      else if (op === '&') a.values().forEach((x) => b.has(x) && out.add(x));
      else if (op === '-') a.values().forEach((x) => !b.has(x) && out.add(x));
      else return bad();
      return out;
    }
    if (op === '%' && typeof a === 'string') {
      const vals = b instanceof PyTuple ? [...b.items] : [b];
      return a.replace(/%[sd]/g, () => str(vals.shift()));
    }
    return bad();
  }

  /* ---- atribut va metodlar ---- */

  private getAttr(o: any, name: string): any {
    if (o instanceof PyModule) {
      if (!(name in o.attrs)) throw new PyError('AttributeError', `'${o.name}' modulida '${name}' yo'q`);
      return o.attrs[name];
    }
    return ((args: any[], kw: Kw) => this.method(o, name, args, kw)) as Builtin;
  }

  private sortInPlace(arr: any[], kw: Kw): void {
    const key = kw.key;
    const keyed = arr.map((v) => ({ v, k: key != null ? this.call(key, [v], NO_KW) : v }));
    keyed.sort((p, q) => pyCmp(p.k, q.k));
    if (truthy(kw.reverse)) keyed.reverse();
    keyed.forEach((x, i) => (arr[i] = x.v));
  }

  private method(o: any, name: string, args: any[], kw: Kw): any {
    const noAttr = (): never => {
      throw new PyError('AttributeError', `${typeName(o)} turida '${name}' metodi yo'q`);
    };
    if (Array.isArray(o)) {
      const cnt = this.counted.has(o);
      switch (name) {
        case 'append':
          o.push(args[0]);
          return null;
        case 'pop': {
          if (o.length === 0) throw new PyError('IndexError', "bo'sh ro'yxatdan element olib bo'lmaydi");
          if (args.length === 0) return o.pop();
          return o.splice(this.listIndex(o.length, args[0]), 1)[0];
        }
        case 'insert': {
          let i = Number(args[0]);
          if (i < 0) i = Math.max(0, i + o.length);
          o.splice(Math.min(i, o.length), 0, args[1]);
          return null;
        }
        case 'extend':
          for (const x of this.iter(args[0])) o.push(x);
          return null;
        case 'index': {
          if (cnt) this.meter.read(o.length);
          const i = o.findIndex((x) => pyEq(x, args[0]));
          if (i < 0) throw new PyError('ValueError', `${repr(args[0])} ro'yxatda yo'q`);
          return i;
        }
        case 'count':
          if (cnt) this.meter.read(o.length);
          return o.filter((x) => pyEq(x, args[0])).length;
        case 'sort':
          this.sortInPlace(o, kw);
          return null;
        case 'reverse':
          o.reverse();
          return null;
        case 'copy':
          if (cnt) this.meter.read(o.length);
          return o.slice();
        case 'remove': {
          const i = o.findIndex((x) => pyEq(x, args[0]));
          if (i < 0) throw new PyError('ValueError', `${repr(args[0])} ro'yxatda yo'q`);
          o.splice(i, 1);
          return null;
        }
        case 'clear':
          o.length = 0;
          return null;
        default:
          return noAttr();
      }
    }
    if (o instanceof PyDict) {
      switch (name) {
        case 'get': {
          const v = o.get(args[0]);
          return v === undefined ? (args.length > 1 ? args[1] : null) : v;
        }
        case 'keys':
          return o.keys();
        case 'values':
          return o.values();
        case 'items':
          return o.items();
        case 'pop': {
          const v = o.get(args[0]);
          if (v === undefined) {
            if (args.length > 1) return args[1];
            throw new PyError('KeyError', repr(args[0]));
          }
          o.delete(args[0]);
          return v;
        }
        case 'setdefault': {
          const v = o.get(args[0]);
          if (v !== undefined) return v;
          const d = args.length > 1 ? args[1] : null;
          o.set(args[0], d);
          return d;
        }
        case 'update':
          if (args[0] instanceof PyDict) for (const k of args[0].keys()) o.set(k, args[0].get(k));
          return null;
        case 'copy': {
          const d = new PyDict();
          for (const k of o.keys()) d.set(k, o.get(k));
          return d;
        }
        case 'clear':
          o.m.clear();
          return null;
        default:
          return noAttr();
      }
    }
    if (typeof o === 'string') {
      switch (name) {
        case 'join': {
          const parts = Array.from(this.iter(args[0]));
          if (parts.some((p) => typeof p !== 'string')) throw new PyError('TypeError', "join() faqat satrlarni birlashtiradi (str() dan foydalaning)");
          return parts.join(o);
        }
        case 'split':
          return args.length && args[0] !== null ? o.split(args[0]) : o.trim().split(/\s+/).filter((x) => x.length);
        case 'strip':
          return o.trim();
        case 'lstrip':
          return o.trimStart();
        case 'rstrip':
          return o.trimEnd();
        case 'upper':
          return o.toUpperCase();
        case 'lower':
          return o.toLowerCase();
        case 'replace':
          return o.split(args[0]).join(args[1]);
        case 'startswith':
          return o.startsWith(args[0]);
        case 'endswith':
          return o.endsWith(args[0]);
        case 'find':
          return o.indexOf(args[0]);
        case 'index': {
          const i = o.indexOf(args[0]);
          if (i < 0) throw new PyError('ValueError', 'qism satr topilmadi');
          return i;
        }
        case 'count':
          return args[0] ? o.split(args[0]).length - 1 : 0;
        case 'isdigit':
          return /^\d+$/.test(o);
        case 'isalpha':
          return /^[A-Za-z\u0080-￿]+$/.test(o);
        default:
          return noAttr();
      }
    }
    if (o instanceof PySet) {
      switch (name) {
        case 'add':
          o.add(args[0]);
          return null;
        case 'remove':
          if (!o.delete(args[0])) throw new PyError('KeyError', repr(args[0]));
          return null;
        case 'discard':
          o.delete(args[0]);
          return null;
        case 'pop': {
          const vals = o.values();
          if (!vals.length) throw new PyError('KeyError', "bo'sh to'plamdan element olib bo'lmaydi");
          o.delete(vals[0]);
          return vals[0];
        }
        case 'update':
          for (const x of this.iter(args[0])) o.add(x);
          return null;
        case 'union': {
          const s = new PySet();
          o.values().forEach((x) => s.add(x));
          for (const a of args) for (const x of this.iter(a)) s.add(x);
          return s;
        }
        case 'copy': {
          const s = new PySet();
          o.values().forEach((x) => s.add(x));
          return s;
        }
        case 'clear':
          o.m.clear();
          return null;
        default:
          return noAttr();
      }
    }
    if (o instanceof PyDeque) {
      switch (name) {
        case 'append':
          o.append(args[0]);
          return null;
        case 'appendleft':
          o.appendleft(args[0]);
          return null;
        case 'pop':
          return o.pop();
        case 'popleft':
          return o.popleft();
        case 'extend':
          for (const x of this.iter(args[0])) o.append(x);
          return null;
        case 'clear':
          o.a = [];
          o.h = 0;
          return null;
        default:
          return noAttr();
      }
    }
    if (o instanceof PyTuple) {
      if (name === 'index') {
        const i = o.items.findIndex((x) => pyEq(x, args[0]));
        if (i < 0) throw new PyError('ValueError', 'qiymat kortejda yo\'q');
        return i;
      }
      if (name === 'count') return o.items.filter((x) => pyEq(x, args[0])).length;
    }
    return noAttr();
  }

  /* ---- modullar va ichki funksiyalar ---- */

  private module(name: string): PyModule {
    const m = this.modules[name];
    if (!m) throw new PyError('ModuleNotFoundError', `'${name}' moduli ichki interpretatorda mavjud emas`);
    return m;
  }

  private installBuiltins(): void {
    const B = this.builtins;
    const list = (v: any): any[] => Array.from(this.iter(v));
    const needNum = (v: any, fn: string): number => {
      if (!isNum(v)) throw new PyError('TypeError', `${fn}() son kutgan edi, ${typeName(v)} berildi`);
      return Number(v);
    };

    B.set('print', (args: any[], kw: Kw) => {
      const sep = typeof kw.sep === 'string' ? kw.sep : ' ';
      const end = typeof kw.end === 'string' ? kw.end : '\n';
      const text = this.partial + args.map(str).join(sep) + end;
      const lines = text.split('\n');
      this.partial = lines.pop() ?? '';
      for (const l of lines) if (this.logs.length < 300) this.logs.push(l);
      return null;
    });
    B.set('len', (a: any[]) => this.len(a[0]));
    B.set('range', (a: any[]) => {
      const v = a.map((x) => {
        if (!isNum(x) || !Number.isInteger(Number(x))) throw new PyError('TypeError', `range() butun son kutadi, ${typeName(x)} berildi`);
        return Number(x);
      });
      if (v.length === 1) return new PyRange(0, v[0], 1);
      if (v.length === 2) return new PyRange(v[0], v[1], 1);
      if (v.length === 3) {
        if (v[2] === 0) throw new PyError('ValueError', "range() qadami 0 bo'lishi mumkin emas");
        return new PyRange(v[0], v[1], v[2]);
      }
      throw new PyError('TypeError', 'range() 1 tadan 3 tagacha argument qabul qiladi');
    });
    B.set('int', (a: any[]) => {
      const v = a.length ? a[0] : 0;
      if (isNum(v)) return Math.trunc(Number(v));
      if (typeof v === 'string' && /^\s*[+-]?\d+\s*$/.test(v)) return parseInt(v, 10);
      throw new PyError('ValueError', `int() uchun yaroqsiz qiymat: ${repr(v)}`);
    });
    B.set('float', (a: any[]) => {
      const v = a.length ? a[0] : 0;
      if (isNum(v)) return Number(v);
      if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        if (s === 'inf' || s === '+inf' || s === 'infinity') return Infinity;
        if (s === '-inf' || s === '-infinity') return -Infinity;
        const n = Number(s);
        if (s !== '' && !Number.isNaN(n)) return n;
      }
      throw new PyError('ValueError', `float() uchun yaroqsiz qiymat: ${repr(v)}`);
    });
    B.set('str', (a: any[]) => (a.length ? str(a[0]) : ''));
    B.set('repr', (a: any[]) => repr(a[0]));
    B.set('bool', (a: any[]) => truthy(a[0]));
    B.set('abs', (a: any[]) => Math.abs(needNum(a[0], 'abs')));
    B.set('pow', (a: any[]) => Math.pow(needNum(a[0], 'pow'), needNum(a[1], 'pow')));
    B.set('round', (a: any[]) => {
      const x = needNum(a[0], 'round');
      const nd = a.length > 1 ? Number(a[1]) : 0;
      const f = Math.pow(10, nd);
      return Math.round(x * f) / f;
    });
    B.set('divmod', (a: any[]) => new PyTuple([this.binop('//', a[0], a[1]), this.binop('%', a[0], a[1])]));
    B.set('chr', (a: any[]) => String.fromCharCode(Number(a[0])));
    B.set('ord', (a: any[]) => String(a[0]).charCodeAt(0));
    const extreme = (sign: number, fname: string): Builtin => (args, kw) => {
      const items = args.length === 1 ? list(args[0]) : args;
      if (!items.length) {
        if ('default' in kw) return kw.default;
        throw new PyError('ValueError', `${fname}() ga bo'sh ketma-ketlik berildi`);
      }
      const key = kw.key;
      const kf = (v: any) => (key != null ? this.call(key, [v], NO_KW) : v);
      let best = items[0];
      let bk = kf(best);
      for (let i = 1; i < items.length; i++) {
        const k = kf(items[i]);
        if (sign * pyCmp(k, bk) > 0) {
          best = items[i];
          bk = k;
        }
      }
      return best;
    };
    B.set('max', extreme(1, 'max'));
    B.set('min', extreme(-1, 'min'));
    B.set('sum', (a: any[], kw: Kw) => {
      let total: any = a.length > 1 ? a[1] : (kw.start ?? 0);
      for (const x of this.iter(a[0])) total = this.binop('+', total, x);
      return total;
    });
    B.set('sorted', (a: any[], kw: Kw) => {
      const out = list(a[0]);
      this.sortInPlace(out, kw);
      return out;
    });
    B.set('reversed', (a: any[]) => list(a[0]).reverse());
    B.set('enumerate', (a: any[], kw: Kw) => {
      const start = a.length > 1 ? Number(a[1]) : Number(kw.start ?? 0);
      return list(a[0]).map((v, i) => new PyTuple([i + start, v]));
    });
    B.set('zip', (a: any[]) => {
      const ls = a.map(list);
      const n = ls.length ? Math.min(...ls.map((l) => l.length)) : 0;
      return Array.from({ length: n }, (_, i) => new PyTuple(ls.map((l) => l[i])));
    });
    B.set('map', (a: any[]) => list(a[1]).map((v) => this.call(a[0], [v], NO_KW)));
    B.set('filter', (a: any[]) => list(a[1]).filter((v) => truthy(a[0] === null ? v : this.call(a[0], [v], NO_KW))));
    B.set('any', (a: any[]) => list(a[0]).some(truthy));
    B.set('all', (a: any[]) => list(a[0]).every(truthy));
    B.set('list', (a: any[]) => (a.length ? list(a[0]).slice() : []));
    B.set('tuple', (a: any[]) => new PyTuple(a.length ? list(a[0]).slice() : []));
    B.set('set', (a: any[]) => {
      const s = new PySet();
      if (a.length) for (const x of this.iter(a[0])) s.add(x);
      return s;
    });
    B.set('dict', (a: any[], kw: Kw) => {
      const d = new PyDict();
      if (a.length) {
        if (a[0] instanceof PyDict) for (const k of a[0].keys()) d.set(k, a[0].get(k));
        else
          for (const pair of this.iter(a[0])) {
            const [k, v] = Array.from(this.iter(pair));
            d.set(k, v);
          }
      }
      for (const [k, v] of Object.entries(kw)) d.set(k, v);
      return d;
    });
    B.set('isinstance', () => {
      throw new PyError('NameError', "isinstance() ichki interpretatorda qo'llab-quvvatlanmaydi");
    });
    B.set('input', () => {
      throw new PyError('RuntimeError', "input() ishlatilmaydi: ma'lumotlar funksiya argumentlari orqali beriladi");
    });

    const deque: Builtin = (a) => new PyDeque(a.length ? list(a[0]).slice() : []);
    const num1 = (f: (x: number) => number, name: string): Builtin => (a) => f(needNum(a[0], name));
    this.modules.collections = new PyModule('collections', { deque });
    this.modules.math = new PyModule('math', {
      inf: Infinity,
      pi: Math.PI,
      e: Math.E,
      floor: num1(Math.floor, 'floor'),
      ceil: num1(Math.ceil, 'ceil'),
      sqrt: num1(Math.sqrt, 'sqrt'),
      log2: num1(Math.log2, 'log2'),
      log: ((a) => (a.length > 1 ? Math.log(needNum(a[0], 'log')) / Math.log(needNum(a[1], 'log')) : Math.log(needNum(a[0], 'log')))) as Builtin,
      gcd: ((a) => {
        let x = Math.abs(needNum(a[0], 'gcd'));
        let y = Math.abs(needNum(a[1], 'gcd'));
        while (y) [x, y] = [y, x % y];
        return x;
      }) as Builtin,
    });
    this.modules.sys = new PyModule('sys', { setrecursionlimit: (() => null) as Builtin, maxsize: Number.MAX_SAFE_INTEGER });
    this.modules.heapq = new PyModule('heapq', {
      heappush: ((a) => {
        const h: any[] = a[0];
        h.push(a[1]);
        let i = h.length - 1;
        while (i > 0) {
          const p = (i - 1) >> 1;
          if (pyCmp(h[i], h[p]) >= 0) break;
          [h[i], h[p]] = [h[p], h[i]];
          i = p;
        }
        return null;
      }) as Builtin,
      heappop: ((a) => {
        const h: any[] = a[0];
        if (!h.length) throw new PyError('IndexError', "bo'sh uyumdan (heap) element olib bo'lmaydi");
        const top = h[0];
        const last = h.pop();
        if (h.length) {
          h[0] = last;
          let i = 0;
          for (;;) {
            const l = 2 * i + 1;
            const r = l + 1;
            let m = i;
            if (l < h.length && pyCmp(h[l], h[m]) < 0) m = l;
            if (r < h.length && pyCmp(h[r], h[m]) < 0) m = r;
            if (m === i) break;
            [h[i], h[m]] = [h[m], h[i]];
            i = m;
          }
        }
        return top;
      }) as Builtin,
    });
    this.modules.itertools = new PyModule('itertools', {
      permutations: ((a) => {
        const items = list(a[0]);
        const r = a.length > 1 && a[1] !== null ? Number(a[1]) : items.length;
        const out: PyTuple[] = [];
        const used = new Array<boolean>(items.length).fill(false);
        const cur: any[] = [];
        const rec = () => {
          if (cur.length === r) {
            out.push(new PyTuple(cur.slice()));
            if (out.length > 50000) throw new PyError('MemoryError', "o'rin almashtirishlar soni juda ko'p");
            return;
          }
          for (let i = 0; i < items.length; i++) {
            if (used[i]) continue;
            this.meter.tick();
            used[i] = true;
            cur.push(items[i]);
            rec();
            cur.pop();
            used[i] = false;
          }
        };
        rec();
        return out;
      }) as Builtin,
    });
  }
}

/** Ichki interpretator orqali bajarish (Executor shartnomasi). */
export function runMini(code: string, env: ExecEnv): unknown {
  const it = new MiniPython(env.meter, env.logs);
  for (const [name, fn] of Object.entries(env.api)) it.defineHost(name, fn);
  for (const [name, v] of Object.entries(env.globals)) it.setGlobal(name, v);
  try {
    it.run(code);
    if (env.call) return it.callSolve(env.call.args, env.call.counted);
    return undefined;
  } catch (e) {
    if (e instanceof BudgetError || e instanceof HardLimitError || e instanceof SimError || e instanceof StudentError) throw e;
    if (e instanceof PyError) throw new StudentError(`${e.kind}: ${e.message}`, e.line);
    if (e instanceof RangeError)
      throw new StudentError("RecursionError: rekursiya chuqurligi chegaradan oshdi (to'xtash sharti bormi?)");
    throw new StudentError(`Ichki interpretator xatosi: ${(e as Error)?.message ?? String(e)}`);
  }
}
