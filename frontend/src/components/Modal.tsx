import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  open,
  title,
  description,
  onClose,
  children,
  size = 'lg',
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-slate-950/45"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative flex w-full ${
          size === 'md' ? 'max-w-lg' : size === 'xl' ? 'max-w-6xl' : 'max-w-3xl'
        } max-h-[min(92vh,900px)] flex-col overflow-hidden border border-[var(--color-line)] bg-[var(--color-surface)] shadow-2xl shadow-slate-900/20`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-line)] bg-[#fafafa] px-6 py-4">
          <div className="min-w-0">
            <h2 id="modal-title" className="text-base font-semibold tracking-tight text-[var(--color-ink)]">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm leading-snug text-[var(--color-ink-subtle)]">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1.5 text-[var(--color-ink-subtle)] hover:bg-slate-200/70 hover:text-[var(--color-ink)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
