import { useEffect, useRef, useState } from 'react';
import { Bot, KeyRound, Lightbulb, Loader2, Sparkles, X } from 'lucide-react';
import { askGemini, localMentor } from '../lib/mentor';
import type { Lang, LevelDef, MentorMessage, RunResult } from '../types';

interface Props {
  open: boolean;
  onClose(): void;
  level: LevelDef;
  lang: Lang;
  code: string;
  result: RunResult | null;
  apiKey: string;
  onOpenSettings(): void;
}

const SOURCE_LABEL: Record<MentorMessage['source'], string> = {
  gemini: 'Gemini AI',
  local: 'Mahalliy mentor',
  info: 'Tizim',
};

/** Sokratik mentor: tayyor javob bermaydi, faqat yo'naltiruvchi savollar beradi. */
export default function SocraticMentor({ open, onClose, level, lang, code, result, apiKey, onOpenSettings }: Props) {
  const [messages, setMessages] = useState<MentorMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const turn = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, loading]);

  const ask = async () => {
    if (loading) return;
    const t = turn.current++;
    if (apiKey) {
      setLoading(true);
      try {
        const text = await askGemini(apiKey, level, lang, code, result);
        setMessages((m) => [...m, { text, source: 'gemini' }]);
      } catch (e) {
        setMessages((m) => [
          ...m,
          { text: `${(e as Error).message}. Mahalliy mentor savollari ko'rsatilmoqda.`, source: 'info' },
          { text: localMentor(level, lang, code, result, t), source: 'local' },
        ]);
      } finally {
        setLoading(false);
      }
    } else {
      setMessages((m) => [...m, { text: localMentor(level, lang, code, result, t), source: 'local' }]);
    }
  };

  return (
    <aside
      aria-label="Sokratik Mentor"
      aria-hidden={!open}
      {...(open ? {} : { inert: '' })}
      className={`fixed inset-y-0 right-0 z-40 flex w-full max-w-[400px] flex-col border-l border-edge bg-panel shadow-2xl shadow-black/60 transition-transform duration-300 ${
        open ? 'translate-x-0' : 'pointer-events-none translate-x-full'
      }`}
    >
      <div className="flex items-center gap-3 border-b border-edge px-4 py-3.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neon/15 text-neon">
          <Bot className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-slate-100">Sokratik Mentor (Gemini AI)</h2>
          <p className="truncate text-[11px] text-slate-400">
            {apiKey ? 'Jonli rejim: Gemini 2.5 Flash' : 'Mahalliy rejim: API kalitsiz ishlaydi'}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Mentor panelini yopish" className="rounded-xl p-2 text-slate-400 hover:bg-edge hover:text-slate-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <div className="rounded-2xl border border-edge bg-obsidian/60 p-3 text-xs leading-relaxed text-slate-400">
          Mentor tayyor kod yoki to'g'ri javobni bermaydi. U sizning joriy kodingiz va oxirgi natijani tahlil qilib,
          xatoni yoki Big-O dagi tor joyni o'zingiz topishingizga yordam beradigan savollar beradi.
          <div className="mt-2 font-medium text-slate-300">
            Joriy masala: {level.code} — {level.title}
          </div>
        </div>

        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-2xl border p-3 text-sm leading-relaxed ${
              m.source === 'info' ? 'border-ember/30 bg-ember/5 text-amber-200' : 'border-edge bg-obsidian text-slate-200'
            }`}
          >
            <div className={`mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold ${m.source === 'info' ? 'text-ember' : 'text-neon'}`}>
              {m.source === 'gemini' ? <Sparkles className="h-3.5 w-3.5" /> : <Lightbulb className="h-3.5 w-3.5" />}
              {SOURCE_LABEL[m.source]}
            </div>
            <div className="whitespace-pre-wrap">{m.text}</div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 rounded-2xl border border-edge bg-obsidian p-3 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-neon" />
            Mentor kodingizni tahlil qilmoqda...
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="space-y-2 border-t border-edge p-4">
        <button
          type="button"
          onClick={ask}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-neon px-4 py-3 text-sm font-semibold text-obsidian transition hover:brightness-110 disabled:opacity-60"
        >
          <Lightbulb className="h-4 w-4" />
          Yo'naltiruvchi Maslahat Olish
        </button>
        {!apiKey && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-edge px-4 py-2 text-xs text-slate-400 transition hover:border-neon/50 hover:text-slate-200"
          >
            <KeyRound className="h-3.5 w-3.5" />
            Jonli Gemini mentorini yoqish (ixtiyoriy)
          </button>
        )}
      </div>
    </aside>
  );
}
