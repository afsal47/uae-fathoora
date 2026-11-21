import { useId, useState } from 'react';

export default function StatusToggle({
  name = 'status',
  defaultActive = false,
  activeLabel = 'Active',
  inactiveLabel = 'Inactive',
}: {
  name?: string;
  defaultActive?: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  const id = useId();
  const [active, setActive] = useState(defaultActive);

  return (
    <div className="status-toggle-wrap">
      <input type="hidden" name={name} value={active ? 'ACTIVE' : 'INACTIVE'} />
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={active}
        className={`status-toggle${active ? ' is-on' : ''}`}
        onClick={() => setActive((prev) => !prev)}
      >
        <span className="status-toggle-track" aria-hidden="true">
          <span className="status-toggle-thumb" />
        </span>
        <span className="status-toggle-label">{active ? activeLabel : inactiveLabel}</span>
      </button>
    </div>
  );
}
