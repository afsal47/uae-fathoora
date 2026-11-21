import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export type SelectMenuOption = {
  value: string;
  label: string;
  description?: string;
};

type SelectMenuProps = {
  id?: string;
  value: string;
  options: SelectMenuOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Show only the label; use description as hover tooltip (e.g. tenant code + name). */
  labelOnly?: boolean;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

export default function SelectMenu({
  id,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  className = '',
  labelOnly = false,
}: SelectMenuProps) {
  const autoId = useId();
  const listboxId = `${id ?? autoId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const selected = options.find((opt) => opt.value === value);

  const updatePosition = () => {
    const trigger = rootRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportPad = 12;
    const preferredWidth = labelOnly
      ? rect.width
      : Math.max(rect.width, Math.min(280, window.innerWidth - viewportPad * 2));
    const maxLeft = window.innerWidth - preferredWidth - viewportPad;
    setPosition({
      top: rect.bottom + 4,
      left: Math.max(viewportPad, Math.min(rect.left, maxLeft)),
      width: preferredWidth,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, labelOnly]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    const onReposition = () => updatePosition();

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`select-menu${labelOnly ? ' is-label-only' : ''} ${className}`.trim()}
    >
      <button
        type="button"
        id={id}
        className="select-menu-trigger input"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        title={selected?.description || undefined}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="select-menu-value">
          {selected ? (
            labelOnly || !selected.description ? (
              <span className="select-menu-code">{selected.label}</span>
            ) : (
              <>
                <span className="select-menu-code">{selected.label}</span>
                <span className="select-menu-name"> — {selected.description}</span>
              </>
            )
          ) : (
            <span className="select-menu-placeholder">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={16} className={`select-chevron ${open ? 'is-open' : ''}`} aria-hidden />
      </button>

      {open && position
        ? createPortal(
            <ul
              ref={listRef}
              id={listboxId}
              role="listbox"
              className={`select-menu-list${labelOnly ? ' is-label-only' : ''}`}
              aria-labelledby={id}
              style={{
                top: position.top,
                left: position.left,
                width: position.width,
              }}
            >
              {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <li key={opt.value || 'empty'} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`select-menu-option ${isSelected ? 'is-selected' : ''}`}
                      title={opt.description || undefined}
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                    >
                      {labelOnly || !opt.description ? (
                        <span className="select-menu-code">{opt.label}</span>
                      ) : (
                        <>
                          <span className="select-menu-code">{opt.label}</span>
                          <span className="select-menu-name">{opt.description}</span>
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
