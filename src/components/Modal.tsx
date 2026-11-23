import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  onClose(): void;
  children: ReactNode;
  wide?: boolean;
}

export default function Modal({ title, subtitle, icon, onClose, children, wide }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`my-6 w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} rounded-2xl border border-edge bg-panel shadow-2xl shadow-black/60`}
      >
        <div className="flex items-center gap-3 border-b border-edge px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon/15 text-neon">{icon}</div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-100">{title}</h2>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Yopish" className="rounded-xl p-2 text-slate-400 hover:bg-edge hover:text-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
