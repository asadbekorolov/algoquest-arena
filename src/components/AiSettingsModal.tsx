import { useState } from 'react';
import { Eye, EyeOff, KeyRound, Settings, Trash2 } from 'lucide-react';
import Modal from './Modal';

interface Props {
  apiKey: string;
  onSave(key: string): void;
  onClose(): void;
}

export default function AiSettingsModal({ apiKey, onSave, onClose }: Props) {
  const [value, setValue] = useState(apiKey);
  const [show, setShow] = useState(false);

  return (
    <Modal title="AI Sozlamalari" subtitle="Sokratik mentor uchun Gemini API kaliti (ixtiyoriy)" icon={<Settings className="h-5 w-5" />} onClose={onClose}>
      <div className="space-y-4 text-sm text-slate-300">
        <p className="leading-relaxed">
          Kalit kiritilsa, mentor savollari <span className="font-mono text-neon">gemini-2.5-flash</span> modeli orqali jonli
          tuziladi. Kalit kiritilmasa ham mentor to'liq ishlaydi: mahalliy tahlilchi kodingizga qarab savollar beradi.
        </p>
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <KeyRound className="h-3.5 w-3.5" />
            Gemini API kaliti
          </span>
          <div className="flex gap-2">
            <input
              type={show ? 'text' : 'password'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="AIza..."
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-2xl border border-edge bg-obsidian px-3 py-2.5 font-mono text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-neon"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? 'Kalitni yashirish' : "Kalitni ko'rsatish"}
              className="rounded-2xl border border-edge px-3 text-slate-400 hover:text-slate-100"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>
        <p className="rounded-2xl border border-edge bg-obsidian p-3 text-xs leading-relaxed text-slate-400">
          Kalit faqat shu brauzerning localStorage xotirasida saqlanadi va faqat Google Gemini API manziliga yuboriladi.
          Umumiy kompyuterda ishlaganingizdan so'ng kalitni o'chirib qo'ying.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          {apiKey && (
            <button
              type="button"
              onClick={() => {
                onSave('');
                onClose();
              }}
              className="flex items-center gap-2 rounded-2xl border border-edge px-4 py-2.5 text-sm text-slate-300 hover:border-danger/60 hover:text-danger"
            >
              <Trash2 className="h-4 w-4" />
              Kalitni o'chirish
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onSave(value.trim());
              onClose();
            }}
            className="rounded-2xl bg-neon px-5 py-2.5 text-sm font-semibold text-obsidian hover:brightness-110"
          >
            Saqlash
          </button>
        </div>
      </div>
    </Modal>
  );
}
