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
    setPosition({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open]);

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
    <div ref={rootRef} className={`select-menu ${className}`.trim()}>
      <button
        type="button"
        id={id}
        className="select-menu-trigger input"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        title={
          selected
            ? `${selected.label}${selected.description ? ` — ${selected.description}` : ''}`
            : undefined
        }
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="select-menu-value">
          {selected ? (
            selected.description ? (
              <>
                <span className="select-menu-code">{selected.label}</span>
                <span className="select-menu-name"> — {selected.description}</span>
              </>
            ) : (
              <span>{selected.label}</span>
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
              className="select-menu-list"
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
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                    >
                      {opt.description ? (
                        <>
                          <span className="select-menu-code">{opt.label}</span>
                          <span className="select-menu-name">{opt.description}</span>
                        </>
                      ) : (
                        <span>{opt.label}</span>
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
