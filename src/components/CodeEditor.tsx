import { useRef, type KeyboardEvent } from 'react';

interface Props {
  value: string;
  onChange(value: string): void;
  errorLine: number;
  ariaLabel: string;
}

/** Satr raqamlari, Tab va avtomatik chekinishga ega yengil kod muharriri. */
export default function CodeEditor({ value, onChange, errorLine, ariaLabel }: Props) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const lineCount = value.split('\n').length;

  const insert = (text: string) => {
    const el = areaRef.current;
    if (!el) return;
    el.focus();
    let done = false;
    try {
      done = document.execCommand('insertText', false, text);
    } catch {
      done = false;
    }
    if (!done) {
      const { selectionStart: s, selectionEnd: e } = el;
      onChange(value.slice(0, s) + text + value.slice(e));
      requestAnimationFrame(() => el.setSelectionRange(s + text.length, s + text.length));
    }
  };

  const onKeyDown = (ev: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = ev.currentTarget;
    if (ev.key === 'Tab' && !ev.shiftKey && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
      ev.preventDefault();
      insert('    ');
    } else if (ev.key === 'Enter' && !ev.ctrlKey && !ev.metaKey) {
      const before = value.slice(0, el.selectionStart);
      const line = before.slice(before.lastIndexOf('\n') + 1);
      const indent = /^[ \t]*/.exec(line)?.[0] ?? '';
      const extra = /[:{([]\s*$/.test(line) ? '    ' : '';
      ev.preventDefault();
      insert(`\n${indent}${extra}`);
    }
  };

  return (
    <div className="flex h-[420px] overflow-hidden rounded-2xl border border-edge bg-obsidian font-mono text-[13px] leading-[1.55]">
      <div
        ref={gutterRef}
        aria-hidden="true"
        className="select-none overflow-hidden border-r border-edge bg-panel/60 py-3 pl-3 pr-2 text-right text-slate-600"
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} className={errorLine === i + 1 ? 'rounded bg-danger/20 px-1 font-semibold text-danger' : 'px-1'}>
            {i + 1}
          </div>
        ))}
      </div>
      <textarea
        ref={areaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onScroll={(e) => {
          if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
        }}
        aria-label={ariaLabel}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        wrap="off"
        className="h-full min-w-0 flex-1 resize-none overflow-auto whitespace-pre bg-transparent py-3 pl-3 pr-4 text-emerald-100 caret-neon outline-none placeholder:text-slate-600"
      />
    </div>
  );
}
