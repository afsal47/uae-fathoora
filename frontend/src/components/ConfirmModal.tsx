import Modal from './Modal';

export type ConfirmTone = 'primary' | 'danger';

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={busy ? () => undefined : onCancel}
      size="md"
      elevated
      tone={tone === 'danger' ? 'danger' : 'default'}
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => void onConfirm()}
            disabled={busy}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="modal-confirm-copy">
        {description ?? 'Are you sure you want to continue?'}
      </p>
    </Modal>
  );
}
