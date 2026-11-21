import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = 'lg',
  elevated = false,
  tone = 'default',
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
  /** Stack above another open modal (e.g. confirmations). */
  elevated?: boolean;
  tone?: 'default' | 'confirm' | 'danger';
}) {
  const titleId = useId();
  const descriptionId = useId();
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

  const toneClass =
    tone === 'danger' ? ' is-danger' : tone === 'confirm' ? ' is-confirm' : '';

  return (
    <div className={`modal-overlay${elevated ? ' is-elevated' : ''}`}>
      <button
        type="button"
        aria-label="Close dialog"
        className="modal-backdrop"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={`modal-dialog is-${size}${toneClass}`}
      >
        <div className="modal-header">
          <div className="modal-header-text min-w-0">
            <h2 id={titleId} className="modal-title">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="modal-description">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modal-close"
            aria-label="Close"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}
